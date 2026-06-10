"use client";

import { Loader2, Plus, Sparkles, Trash2, GripVertical } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  updateBasicsField,
  updateOptionalField,
  updateSkillsField,
  reorderArrayItems,
  reorderSections,
  getSectionOrder,
} from "@/lib/resume-editor-model.js";
import { normalizeStructuredResumeV1 } from "@/lib/resume-schema.js";

type StructuredResumeEditorProps = {
  structuredResume: Record<string, unknown>;
  userType: string;
  onChange: (nextStructuredResume: Record<string, unknown>) => void;
  onOptimizeModule?: (moduleName: string) => void;
  optimizingModule?: string | null;
};

type ArraySection = "education" | "work" | "projects";

function lines(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join("\n") : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Input className="h-8 text-xs" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function MultiLineField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Textarea className="min-h-20 text-xs" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

// Sortable wrapper for top-level sections
function SortableSection({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "rounded-md shadow-lg ring-2 ring-blue-200" : ""}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

// Sortable wrapper for individual items inside a repeated section
function SortableItem({ id, children }: { id: string; children: (dragHandleProps: Record<string, unknown>) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : "auto" as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "rounded-md shadow-lg ring-2 ring-blue-200" : ""}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

function Section({ title, moduleName, children, onOptimizeModule, optimizingModule, dragHandleProps }: {
  title: string;
  moduleName?: string;
  children: ReactNode;
  onOptimizeModule?: (moduleName: string) => void;
  optimizingModule?: string | null;
  dragHandleProps?: Record<string, unknown>;
}) {
  return (
    <section className="space-y-3 border-b px-3 py-4 last:border-b-0 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
        </div>
        {moduleName && onOptimizeModule && (
          <Button
            className="h-6 px-2 text-[10px]"
            type="button"
            variant="ghost"
            size="sm"
            disabled={optimizingModule === moduleName}
            onClick={() => onOptimizeModule(moduleName)}
          >
            {optimizingModule === moduleName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            AI 优化
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

export function StructuredResumeEditor({ structuredResume, userType, onChange, onOptimizeModule, optimizingModule }: StructuredResumeEditorProps) {
  const latestDraftRef = useRef<Record<string, unknown>>(structuredResume);

  useEffect(() => {
    latestDraftRef.current = structuredResume;
  }, [structuredResume]);

  const resume = normalizeStructuredResumeV1(structuredResume);

  function commit(next: Record<string, unknown>) {
    latestDraftRef.current = next;
    onChange(next);
  }

  function updateItem(section: ArraySection, index: number, patch: Record<string, unknown>) {
    commit(updateArrayItem(latestDraftRef.current, section, index, patch));
  }

  function addItem(section: ArraySection) {
    commit(addArrayItem(latestDraftRef.current, section));
  }

  function removeItem(section: ArraySection, index: number) {
    commit(removeArrayItem(latestDraftRef.current, section, index));
  }

  const educationItems: unknown[] = Array.isArray(structuredResume.education) ? structuredResume.education : resume.education;
  const workItems: unknown[] = Array.isArray(structuredResume.work) ? structuredResume.work : resume.work;
  const projectItems: unknown[] = Array.isArray(structuredResume.projects) ? structuredResume.projects : resume.projects;
  const basics = resume.basics;
  const skills = resume.skills;
  const optional = resume.optional;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const sectionOrder: string[] = getSectionOrder(latestDraftRef.current);

  const handleSectionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(String(active.id));
    const newIndex = sectionOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    commit(reorderSections(latestDraftRef.current, oldIndex, newIndex));
  }, [sectionOrder]);

  const makeItemDragEndHandler = useCallback((section: ArraySection, items: unknown[]) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = items.map((_, i) => `${section}-${i}`);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    commit(reorderArrayItems(latestDraftRef.current, section, oldIndex, newIndex));
  }, []);

  // Render a section block for a given sectionId, receiving dragHandleProps from SortableSection
  const renderSection = (sectionId: string, dragHandleProps: Record<string, unknown>) => {
    switch (sectionId) {
      case "basics":
        return (
          <Section title="个人信息" moduleName="basics" onOptimizeModule={onOptimizeModule} optimizingModule={optimizingModule} dragHandleProps={dragHandleProps}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="姓名" value={basics.name} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "name", value))} />
              <Field label="电话" value={basics.phone} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "phone", value))} />
              <Field label="邮箱" value={basics.email} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "email", value))} />
              <Field label="现居地" value={basics.location} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "location", value))} />
              <Field label="求职意向" value={basics.job_target} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "job_target", value))} />
              <Field label="作品集链接" value={basics.portfolio_url} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "portfolio_url", value))} />
            </div>
          </Section>
        );

      case "education":
        return (
          <Section title="教育经历" dragHandleProps={dragHandleProps}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeItemDragEndHandler("education", educationItems)}>
              <SortableContext items={educationItems.map((_, i) => `education-${i}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {educationItems.map((item, index) => {
                    const education = item as Record<string, unknown>;
                    return (
                      <SortableItem key={`education-${index}`} id={`education-${index}`}>
                        {(itemDrag) => (
                          <div className="flex items-start gap-1">
                            <button type="button" className="mt-2 shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing" {...itemDrag}>
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1 space-y-3 rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium">教育经历 {index + 1}</p>
                                <Button className="h-7 px-2" type="button" variant="ghost" size="sm" onClick={() => removeItem("education", index)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                <Field label="时间段" value={text(education.time_range)} onChange={(value) => updateItem("education", index, { time_range: value })} />
                                <Field label="学校" value={text(education.school)} onChange={(value) => updateItem("education", index, { school: value })} />
                                <Field label="专业" value={text(education.major)} onChange={(value) => updateItem("education", index, { major: value })} />
                                <Field label="学历" value={text(education.degree)} onChange={(value) => updateItem("education", index, { degree: value })} />
                                <Field label="绩点" value={text(education.gpa)} onChange={(value) => updateItem("education", index, { gpa: value })} />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <MultiLineField label="主修课程" value={lines(education.courses)} onChange={(value) => updateItem("education", index, { courses: value })} />
                                <MultiLineField label="荣誉奖项" value={lines(education.honors)} onChange={(value) => updateItem("education", index, { honors: value })} />
                              </div>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            <Button className="h-8 px-2 text-xs" type="button" variant="outline" size="sm" onClick={() => addItem("education")}>
              <Plus className="h-3 w-3" />
              新增教育经历
            </Button>
            {!educationItems.length && <p className="text-xs text-muted-foreground">暂无内容，点击新增后填写。</p>}
          </Section>
        );

      case "work":
        return (
          <Section title="工作/实习经历" dragHandleProps={dragHandleProps}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeItemDragEndHandler("work", workItems)}>
              <SortableContext items={workItems.map((_, i) => `work-${i}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {workItems.map((item, index) => {
                    const work = item as Record<string, unknown>;
                    return (
                      <SortableItem key={`work-${index}`} id={`work-${index}`}>
                        {(itemDrag) => (
                          <div className="flex items-start gap-1">
                            <button type="button" className="mt-2 shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing" {...itemDrag}>
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1 space-y-3 rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium">工作/实习经历 {index + 1}</p>
                                <Button className="h-7 px-2" type="button" variant="ghost" size="sm" onClick={() => removeItem("work", index)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <Field label="时间" value={text(work.time_range)} onChange={(value) => updateItem("work", index, { time_range: value })} />
                                <Field label="公司" value={text(work.company)} onChange={(value) => updateItem("work", index, { company: value })} />
                                <Field label="岗位" value={text(work.position)} onChange={(value) => updateItem("work", index, { position: value })} />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <MultiLineField label="工作内容" value={text(work.job_content)} onChange={(value) => updateItem("work", index, { job_content: value })} />
                                <MultiLineField label="工作成果" value={lines(work.job_result)} onChange={(value) => updateItem("work", index, { job_result: value })} />
                              </div>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            <Button className="h-8 px-2 text-xs" type="button" variant="outline" size="sm" onClick={() => addItem("work")}>
              <Plus className="h-3 w-3" />
              新增工作/实习经历
            </Button>
            {!workItems.length && <p className="text-xs text-muted-foreground">暂无内容，点击新增后填写。</p>}
          </Section>
        );

      case "projects":
        return (
          <Section title="项目经历" dragHandleProps={dragHandleProps}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeItemDragEndHandler("projects", projectItems)}>
              <SortableContext items={projectItems.map((_, i) => `projects-${i}`)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {projectItems.map((item, index) => {
                    const project = item as Record<string, unknown>;
                    return (
                      <SortableItem key={`projects-${index}`} id={`projects-${index}`}>
                        {(itemDrag) => (
                          <div className="flex items-start gap-1">
                            <button type="button" className="mt-2 shrink-0 cursor-grab rounded p-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing" {...itemDrag}>
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1 space-y-3 rounded-md border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium">项目经历 {index + 1}</p>
                                <Button className="h-7 px-2" type="button" variant="ghost" size="sm" onClick={() => removeItem("projects", index)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="项目名称" value={text(project.project_name)} onChange={(value) => updateItem("projects", index, { project_name: value })} />
                                <Field label="担任角色" value={text(project.role)} onChange={(value) => updateItem("projects", index, { role: value })} />
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <MultiLineField label="项目简介" value={text(project.project_intro)} onChange={(value) => updateItem("projects", index, { project_intro: value })} />
                                <MultiLineField label="负责工作" value={text(project.duty)} onChange={(value) => updateItem("projects", index, { duty: value })} />
                                <MultiLineField label="项目成果" value={lines(project.achievement)} onChange={(value) => updateItem("projects", index, { achievement: value })} />
                              </div>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            <Button className="h-8 px-2 text-xs" type="button" variant="outline" size="sm" onClick={() => addItem("projects")}>
              <Plus className="h-3 w-3" />
              新增项目经历
            </Button>
            {!projectItems.length && <p className="text-xs text-muted-foreground">暂无内容，点击新增后填写。</p>}
          </Section>
        );

      case "skills":
        return (
          <Section title="专业技能" moduleName="skills" onOptimizeModule={onOptimizeModule} optimizingModule={optimizingModule} dragHandleProps={dragHandleProps}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MultiLineField label="硬技能" value={lines(skills.skill_hard)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "skill_hard", value))} />
              <MultiLineField label="软技能" value={lines(skills.skill_soft)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "skill_soft", value))} />
              <MultiLineField label="技能熟练度" value={lines(skills.skill_level)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "skill_level", value))} />
              <MultiLineField label="证书" value={lines(skills.certificate_list)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "certificate_list", value))} />
            </div>
          </Section>
        );

      case "optional":
        return (
          <Section title="补充信息" moduleName="optional" onOptimizeModule={onOptimizeModule} optimizingModule={optimizingModule} dragHandleProps={dragHandleProps}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(userType === "fresh_graduate" || userType === "auto") && (
                <MultiLineField label="校园经历" value={lines(optional.campus_exp)} onChange={(value) => commit(updateOptionalField(latestDraftRef.current, "campus_exp", value))} />
              )}
              {(userType === "senior" || userType === "auto") && (
                <MultiLineField label="团队管理" value={lines(optional.manage_exp)} onChange={(value) => commit(updateOptionalField(latestDraftRef.current, "manage_exp", value))} />
              )}
              <Field label="政治面貌" value={optional.political_status} onChange={(value) => commit(updateOptionalField(latestDraftRef.current, "political_status", value))} />
              <MultiLineField label="自我评价" value={lines(optional.self_evaluation)} onChange={(value) => commit(updateOptionalField(latestDraftRef.current, "self_evaluation", value))} />
            </div>
          </Section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-auto bg-white">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((sectionId) => (
            <SortableSection key={sectionId} id={sectionId}>
              {(dragHandleProps) => renderSection(sectionId, dragHandleProps)}
            </SortableSection>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

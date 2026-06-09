"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
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
} from "@/lib/resume-editor-model.js";
import { normalizeStructuredResumeV1 } from "@/lib/resume-schema.js";

type StructuredResumeEditorProps = {
  structuredResume: Record<string, unknown>;
  userType: string;
  onChange: (nextStructuredResume: Record<string, unknown>) => void;
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b px-3 py-4 last:border-b-0 sm:px-4">
      <h3 className="text-xs font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function RepeatedSection({
  title,
  section,
  count,
  onAdd,
  children,
}: {
  title: string;
  section: ArraySection;
  count: number;
  onAdd: (section: ArraySection) => void;
  children: ReactNode;
}) {
  return (
    <Section title={title}>
      <div className="space-y-3">{children}</div>
      <Button className="h-8 px-2 text-xs" type="button" variant="outline" size="sm" onClick={() => onAdd(section)}>
        <Plus className="h-3 w-3" />
        新增{title}
      </Button>
      {!count && <p className="text-xs text-muted-foreground">暂无内容，点击新增后填写。</p>}
    </Section>
  );
}

export function StructuredResumeEditor({ structuredResume, userType, onChange }: StructuredResumeEditorProps) {
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

  return (
    <div className="h-full overflow-auto bg-white">
      <Section title="个人信息">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="姓名" value={basics.name} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "name", value))} />
          <Field label="电话" value={basics.phone} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "phone", value))} />
          <Field label="邮箱" value={basics.email} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "email", value))} />
          <Field label="现居地" value={basics.location} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "location", value))} />
          <Field label="求职意向" value={basics.job_target} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "job_target", value))} />
          <Field label="作品集链接" value={basics.portfolio_url} onChange={(value) => commit(updateBasicsField(latestDraftRef.current, "portfolio_url", value))} />
        </div>
      </Section>

      <RepeatedSection title="教育经历" section="education" count={educationItems.length} onAdd={addItem}>
        {educationItems.map((item, index) => {
          const education = item as Record<string, unknown>;
          return (
            <div key={`education-${index}`} className="space-y-3 rounded-md border p-3">
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
          );
        })}
      </RepeatedSection>

      <RepeatedSection title="工作/实习经历" section="work" count={workItems.length} onAdd={addItem}>
        {workItems.map((item, index) => {
          const work = item as Record<string, unknown>;
          return (
            <div key={`work-${index}`} className="space-y-3 rounded-md border p-3">
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
          );
        })}
      </RepeatedSection>

      <RepeatedSection title="项目经历" section="projects" count={projectItems.length} onAdd={addItem}>
        {projectItems.map((item, index) => {
          const project = item as Record<string, unknown>;
          return (
            <div key={`project-${index}`} className="space-y-3 rounded-md border p-3">
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
          );
        })}
      </RepeatedSection>

      <Section title="专业技能">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MultiLineField label="硬技能" value={lines(skills.skill_hard)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "skill_hard", value))} />
          <MultiLineField label="软技能" value={lines(skills.skill_soft)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "skill_soft", value))} />
          <MultiLineField label="技能熟练度" value={lines(skills.skill_level)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "skill_level", value))} />
          <MultiLineField label="证书" value={lines(skills.certificate_list)} onChange={(value) => commit(updateSkillsField(latestDraftRef.current, "certificate_list", value))} />
        </div>
      </Section>

      <Section title="补充信息">
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
    </div>
  );
}

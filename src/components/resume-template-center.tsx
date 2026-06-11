"use client";

import { Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RESUME_TEMPLATES } from "@/lib/resume-templates.js";
import { recommendResumeTemplates } from "@/lib/resume-template-recommendation.js";

type ResumeTemplateCenterProps = {
  open: boolean;
  value: string;
  userType: string;
  targetRole: string;
  structuredResume: Record<string, unknown>;
  onOpenChange: (open: boolean) => void;
  onSelect: (templateId: string) => void;
};

const SCENES = ["全部", "通用", "校招", "社招", "国企/公考", "外企双语"];
const RECENT_STORAGE_KEY = "resume-template-center-recent";

function includesQuery(values: string[], query: string) {
  if (!query) return true;
  return values.some((value) => value.toLowerCase().includes(query));
}

function renderTemplatePreview(template: (typeof RESUME_TEMPLATES)[number]) {
  const accent = template.preview.accent;
  const isTwoColumn = template.preview.layout === "two-column";
  const isAccent = template.preview.layout === "single-accent";
  return (
    <div className="w-full rounded bg-white p-3 shadow-sm" style={{ minHeight: 100 }}>
      {template.preview.layout === "timeline" ? (
        <>
          <div className="mx-auto h-2 w-14 rounded bg-slate-800" />
          <div className="mx-auto mt-1 h-1.5 w-20 rounded bg-slate-200" />
          <div className="mt-2 ml-2 border-l-2 space-y-2 pl-3" style={{ borderColor: accent }}>
            <div>
              <div className="h-1.5 w-10 rounded bg-slate-300" style={{ position: "relative" }}>
                <div className="absolute -left-[7px] top-[-2px] h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded bg-slate-200" />
              <div className="mt-0.5 h-1.5 w-4/5 rounded bg-slate-200" />
            </div>
            <div>
              <div className="h-1.5 w-12 rounded bg-slate-300" style={{ position: "relative" }}>
                <div className="absolute -left-[7px] top-[-2px] h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
              </div>
              <div className="mt-0.5 h-1.5 w-full rounded bg-slate-200" />
              <div className="mt-0.5 h-1.5 w-2/3 rounded bg-slate-200" />
            </div>
          </div>
        </>
      ) : template.preview.layout === "infographic" ? (
        <>
          <div className="rounded px-3 py-2 text-center" style={{ backgroundColor: accent }}>
            <div className="mx-auto h-2 w-14 rounded bg-white/60" />
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              <div className="h-1.5 w-8 rounded-full bg-white/30" />
              <div className="h-1.5 w-10 rounded-full bg-white/30" />
              <div className="h-1.5 w-7 rounded-full bg-white/30" />
              <div className="h-1.5 w-9 rounded-full bg-white/30" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200" />
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-2/3 rounded bg-slate-200" />
          </div>
        </>
      ) : template.preview.layout === "sidebar-right" ? (
        <div className="grid grid-cols-[1fr_38px] gap-1.5">
          <div className="space-y-1">
            <div className="h-2 w-12 rounded bg-slate-800" />
            <div className="h-1.5 rounded bg-slate-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200" />
            <div className="h-1.5 rounded bg-slate-200" />
            <div className="h-1.5 w-2/3 rounded bg-slate-200" />
          </div>
          <div className="space-y-1">
            <div className="h-7 rounded" style={{ backgroundColor: accent }} />
            <div className="h-1.5 rounded bg-slate-300" />
            <div className="h-1.5 rounded bg-slate-300" />
            <div className="h-1.5 rounded bg-slate-300" />
          </div>
        </div>
      ) : isAccent ? (
        <>
          <div className="flex items-center gap-2">
            <div className="h-5 w-1 rounded" style={{ backgroundColor: accent }} />
            <div className="h-2 w-14 rounded bg-slate-800" />
          </div>
          <div className="mt-1.5 ml-3 h-1.5 w-20 rounded bg-slate-200" />
          <div className="mt-2 h-1.5 rounded" style={{ backgroundColor: accent, opacity: 0.15 }} />
          <div className="mt-1.5 space-y-1">
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200" />
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-2/3 rounded bg-slate-200" />
          </div>
        </>
      ) : isTwoColumn ? (
        <div className="grid grid-cols-[38px_1fr] gap-1.5">
          <div className="space-y-1">
            <div className="h-7 rounded" style={{ backgroundColor: accent }} />
            <div className="h-1.5 rounded bg-slate-300" />
            <div className="h-1.5 rounded bg-slate-300" />
            <div className="h-1.5 rounded bg-slate-300" />
          </div>
          <div className="space-y-1">
            <div className="h-2 w-12 rounded bg-slate-800" />
            <div className="h-1.5 rounded bg-slate-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200" />
            <div className="h-1.5 rounded bg-slate-200" />
            <div className="h-1.5 w-2/3 rounded bg-slate-200" />
          </div>
        </div>
      ) : (
        <>
          <div className="mx-auto h-2 w-14 rounded bg-slate-800" />
          <div className="mx-auto mt-1 h-1.5 w-20 rounded bg-slate-200" />
          <div className="mt-2 h-1.5 rounded" style={{ backgroundColor: accent, opacity: 0.2 }} />
          <div className="mt-1.5 space-y-1">
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200" />
            <div className="h-1.5 w-full rounded bg-slate-200" />
            <div className="h-1.5 w-2/3 rounded bg-slate-200" />
          </div>
        </>
      )}
    </div>
  );
}

export function ResumeTemplateCenter({ open, value, userType, targetRole, structuredResume, onOpenChange, onSelect }: ResumeTemplateCenterProps) {
  const [query, setQuery] = useState("");
  const [scene, setScene] = useState("全部");
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const recommendations = useMemo(
    () => recommendResumeTemplates({ userType, targetRole, structuredResume, templates: RESUME_TEMPLATES }),
    [userType, targetRole, structuredResume],
  );
  const recommendationById = new Map(recommendations.map((item) => [item.templateId, item.reason]));
  const filteredTemplates = RESUME_TEMPLATES.filter((template) => {
    const sceneMatched = scene === "全部" || template.scenarios.includes(scene);
    const queryMatched = includesQuery([template.name, template.description, ...template.tags, ...template.scenarios, ...template.audience, ...template.strengths], normalizedQuery);
    return sceneMatched && queryMatched;
  });
  const selectTemplate = (templateId: string) => {
    const nextRecent = [templateId, ...recentTemplateIds.filter((id) => id !== templateId)].slice(0, 3);
    setRecentTemplateIds(nextRecent);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(nextRecent));
    onSelect(templateId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] w-[calc(100vw-1rem)] max-w-5xl overflow-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>模板中心</DialogTitle>
          <DialogDescription>按求职场景浏览模板，选择后只切换版式，不修改简历正文。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 text-sm"
                placeholder="搜索模板名称、场景或标签"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {SCENES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`h-8 rounded-md border px-2 text-xs font-medium ${scene === item ? "border-blue-600 bg-blue-50 text-blue-700" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  onClick={() => setScene(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {!!recentTemplateIds.length && (
            <p className="text-xs text-muted-foreground">最近使用：{recentTemplateIds.map((id) => RESUME_TEMPLATES.find((template) => template.id === id)?.name).filter(Boolean).join("、")}</p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            {filteredTemplates.map((template) => {
              const selected = value === template.id;
              return (
                <article key={template.id} className="flex min-w-0 flex-col rounded-md border bg-white p-4 shadow-sm">
                  <div className="mb-3 flex h-28 items-center justify-center rounded-md border bg-slate-50 text-xs text-slate-500">
                    {renderTemplatePreview(template)}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{template.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                    </div>
                    {selected && <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">当前使用</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.tags.map((tag) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{tag}</span>)}
                  </div>
                  <p className="mt-3 text-[11px] text-slate-600">适配场景：{template.scenarios.join("、")}</p>
                  <p className="mt-1 text-[11px] text-slate-600">推荐人群：{template.audience.join("、")}</p>
                  <p className="mt-1 text-[11px] text-slate-600">模板优势：{template.strengths.join("、")}</p>
                  <p className="mt-2 flex items-start gap-1 text-[11px] text-blue-700">
                    <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span><span className="font-semibold">推荐理由：</span>{recommendationById.get(template.id) || "适合当前简历结构和求职方向。"}</span>
                  </p>
                  <Button className="mt-4 h-8 text-xs" type="button" variant={selected ? "secondary" : "default"} onClick={() => selectTemplate(template.id)}>
                    {selected ? "继续使用" : "选用模板"}
                  </Button>
                </article>
              );
            })}
          </div>

          {!filteredTemplates.length && (
            <div className="rounded-md border bg-slate-50 p-6 text-center text-sm text-muted-foreground">没有匹配的模板，请调整搜索或筛选条件。</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { buildStructuredResumeViewModel } from "@/lib/resume-template-rendering.js";
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
const FAMILIES = [
  { value: "全部家族", label: "全部家族" },
  { value: "ats", label: "ATS 网申" },
  { value: "modern_professional", label: "现代专业" },
  { value: "executive_expert", label: "高管专家" },
  { value: "campus_intern", label: "校招实习" },
];
const MARKET_TEMPLATE_IDS = [
  "ats_chronological",
  "ats_compact_cn",
  "modern_product_data",
  "tech_sidebar_pro",
  "executive_impact",
  "expert_timeline",
  "campus_project_plus",
  "intern_clean_onepage",
];
const MARKET_TEMPLATE_ORDER = new Map(MARKET_TEMPLATE_IDS.map((id, index) => [id, index]));
const RECENT_STORAGE_KEY = "resume-template-center-recent";
const ATS_LABELS: Record<string, string> = { high: "高", medium: "中", low: "低" };
const DENSITY_LABELS: Record<string, string> = { compact: "紧凑", balanced: "均衡", spacious: "舒展" };
const FAMILY_CHANNELS: Record<string, string> = {
  ats: "网申 / 海投",
  modern_professional: "社招 / 专业岗",
  executive_expert: "管理 / 专家岗",
  campus_intern: "校招 / 实习",
};
const SAMPLE_TEMPLATE_PREVIEW_RESUME = {
  basics: { name: "王小禾", phone: "13800138000", email: "hello@example.com", location: "上海", job_target: "产品经理" },
  education: [{ school: "华东理工大学", degree: "本科", major: "信息管理", time_range: "2019-2023", courses: ["数据分析", "产品设计"], honors: ["校级奖学金"] }],
  work: [{ company: "某科技公司", position: "产品实习生", time_range: "2023.07-2024.06", job_content: "负责增长工具需求梳理", job_result: ["推动转化率提升 18%", "协同研发上线 3 个核心功能"] }],
  projects: [{ project_name: "校园招聘系统优化", role: "项目负责人", project_intro: "重构候选人筛选流程", duty: "设计数据看板并推动 AB 实验", achievement: ["简历筛选效率提升 35%"] }],
  skills: { skill_hard: ["SQL", "Axure", "数据看板"], skill_soft: ["跨团队协作"], skill_level: [], certificate_list: ["CET-6"] },
  optional: { campus_exp: ["学生会运营负责人"], self_evaluation: ["结果导向，擅长用数据拆解问题"], manage_exp: ["带领 5 人项目小组"], political_status: "" },
  meta: { source: "template-preview", warnings: [] },
};

function includesQuery(values: string[], query: string) {
  if (!query) return true;
  return values.some((value) => value.toLowerCase().includes(query));
}

function renderTemplatePreview(template: (typeof RESUME_TEMPLATES)[number]) {
  const accent = template.preview.accent;
  const view = buildStructuredResumeViewModel(SAMPLE_TEMPLATE_PREVIEW_RESUME, template.id);
  const sections = view.sections.slice(0, template.density === "compact" ? 4 : 3);
  const isTwoColumn = template.preview.layout === "two-column" || template.preview.layout === "sidebar-right";
  const isAccent = template.preview.layout === "single-accent";
  const isTimeline = template.preview.layout === "timeline";
  const isInfographic = template.preview.layout === "infographic";
  const body = (
    <div className="min-w-0 space-y-1.5">
      {sections.map((section: { title: string; items: Array<{ heading: string; bullets: string[] }> }) => (
        <div key={section.title} className={isTimeline ? "border-l-2 pl-2" : ""} style={isTimeline ? { borderColor: accent } : undefined}>
          <p className="truncate text-[8px] font-bold uppercase tracking-wide" style={{ color: accent }}>{section.title}</p>
          <p className="mt-0.5 truncate text-[7px] font-medium text-slate-700">{section.items[0]?.heading || section.items[0]?.bullets[0] || "核心经历"}</p>
          <div className="mt-0.5 space-y-0.5">
            {(section.items[0]?.bullets || []).slice(0, 2).map((bullet: string, index: number) => (
              <p key={`${section.title}-${index}`} className="truncate text-[7px] leading-tight text-slate-500">- {bullet}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full overflow-hidden rounded bg-white p-2 text-left shadow-sm" style={{ minHeight: 100 }}>
      <div className={isInfographic ? "rounded px-2 py-1.5 text-center text-white" : isAccent ? "border-l-2 pl-2" : "border-b pb-1.5 text-center"} style={isInfographic ? { backgroundColor: accent } : isAccent ? { borderColor: accent } : { borderColor: accent }}>
        <p className={`truncate text-[10px] font-bold ${isInfographic ? "text-white" : "text-slate-900"}`}>{view.title}</p>
        <p className={`mt-0.5 truncate text-[7px] ${isInfographic ? "text-white/80" : "text-slate-500"}`}>{view.contactItems.slice(1, 3).join(" · ")}</p>
      </div>
      {isTwoColumn ? (
        <div className={`mt-2 grid gap-2 ${template.preview.layout === "sidebar-right" ? "grid-cols-[1fr_42px]" : "grid-cols-[42px_1fr]"}`}>
          {template.preview.layout !== "sidebar-right" && (
            <div className="rounded p-1.5 text-white" style={{ backgroundColor: accent }}>
              <p className="text-[7px] font-bold">技能</p>
              {view.skills.slice(0, 4).map((skill: string) => <p className="mt-1 truncate text-[7px] text-white/85" key={skill}>{skill}</p>)}
            </div>
          )}
          {body}
          {template.preview.layout === "sidebar-right" && (
            <div className="rounded p-1.5 text-white" style={{ backgroundColor: accent }}>
              <p className="text-[7px] font-bold">技能</p>
              {view.skills.slice(0, 4).map((skill: string) => <p className="mt-1 truncate text-[7px] text-white/85" key={skill}>{skill}</p>)}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2">
          {isInfographic && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {view.skills.slice(0, 3).map((skill: string) => <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[7px] text-slate-600" key={skill}>{skill}</span>)}
            </div>
          )}
          {body}
        </div>
      )}
    </div>
  );
}

function templateDecisionReason(template: (typeof RESUME_TEMPLATES)[number], recommendation: string | undefined) {
  const ats = `ATS 等级${ATS_LABELS[template.atsLevel] || template.atsLevel}`;
  const density = `版式${DENSITY_LABELS[template.density] || template.density}`;
  const priority = template.contentPriority.slice(0, 3).join(" / ");
  return `${recommendation || "适合当前简历结构和求职方向。"} ${ats}，${density}，优先呈现 ${priority}。`;
}

export function ResumeTemplateCenter({ open, value, userType, targetRole, structuredResume, onOpenChange, onSelect }: ResumeTemplateCenterProps) {
  const [query, setQuery] = useState("");
  const [scene, setScene] = useState("全部");
  const [family, setFamily] = useState("全部家族");
  const [recentTemplateIds, setRecentTemplateIds] = useState<string[]>([]);
  const normalizedQuery = query.trim().toLowerCase();
  const recommendations = useMemo(
    () => recommendResumeTemplates({ userType, targetRole, structuredResume, templates: RESUME_TEMPLATES }),
    [userType, targetRole, structuredResume],
  );
  const recommendationById = new Map(recommendations.map((item) => [item.templateId, item.reason]));
  const filteredTemplates = RESUME_TEMPLATES
    .filter((template) => {
      const sceneMatched = scene === "全部" || template.scenarios.includes(scene);
      const familyMatched = family === "全部家族" || template.family === family;
      const queryMatched = includesQuery([
        template.id,
        template.name,
        template.description,
        template.family,
        ...template.tags,
        ...template.marketTags,
        ...template.scenarios,
        ...template.audience,
        ...template.strengths,
      ], normalizedQuery);
      return sceneMatched && familyMatched && queryMatched;
    })
    .sort((left, right) => {
      const leftRank = MARKET_TEMPLATE_ORDER.get(left.id) ?? 99;
      const rightRank = MARKET_TEMPLATE_ORDER.get(right.id) ?? 99;
      return leftRank - rightRank;
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

          <div className="flex flex-wrap gap-1">
            {FAMILIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`h-8 rounded-md border px-2 text-xs font-medium ${family === item.value ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setFamily(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {!!recentTemplateIds.length && (
            <p className="text-xs text-muted-foreground">最近使用：{recentTemplateIds.map((id: string) => RESUME_TEMPLATES.find((template) => template.id === id)?.name).filter(Boolean).join("、")}</p>
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
                    {template.tags.map((tag: string) => <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{tag}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.marketTags.map((tag: string) => <span key={tag} className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{tag}</span>)}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] text-slate-600">
                    <div className="rounded border bg-slate-50 px-1.5 py-1">
                      <span className="block text-slate-400">ATS 等级</span>
                      <span className="font-semibold text-slate-800">{ATS_LABELS[template.atsLevel] || template.atsLevel}</span>
                    </div>
                    <div className="rounded border bg-slate-50 px-1.5 py-1">
                      <span className="block text-slate-400">版式密度</span>
                      <span className="font-semibold text-slate-800">{DENSITY_LABELS[template.density] || template.density}</span>
                    </div>
                    <div className="rounded border bg-slate-50 px-1.5 py-1">
                      <span className="block text-slate-400">适合渠道</span>
                      <span className="font-semibold text-slate-800">{FAMILY_CHANNELS[template.family] || "通用投递"}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-slate-600">适配场景：{template.scenarios.join("、")}</p>
                  <p className="mt-1 text-[11px] text-slate-600">推荐人群：{template.audience.join("、")}</p>
                  <p className="mt-1 text-[11px] text-slate-600">模板优势：{template.strengths.join("、")}</p>
                  <p className="mt-2 flex items-start gap-1 text-[11px] text-blue-700">
                    <Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <span><span className="font-semibold">推荐理由：</span>{templateDecisionReason(template, recommendationById.get(template.id))}</span>
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

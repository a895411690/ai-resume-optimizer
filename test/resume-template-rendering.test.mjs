import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStructuredResumeViewModel,
  getPreviewTemplateClasses,
  getTemplatePrintCss,
  renderTemplateExportHtml,
} from "../src/lib/resume-template-rendering.js";

const structuredResume = {
  basics: { name: "张三", phone: "13800138000", email: "zhangsan@example.com", location: "上海", job_target: "产品经理" },
  education: [],
  work: [{ company: "A公司", position: "产品经理", time_range: "2022.01-至今", job_content: "负责需求", job_result: ["上线 <AI> 功能"] }],
  projects: [],
  skills: { skill_hard: ["Axure"], skill_soft: [], skill_level: [], certificate_list: [] },
  optional: { campus_exp: [], self_evaluation: [], manage_exp: [], political_status: "" },
  meta: { source: "test", warnings: [] },
};

const customOrderedResume = {
  ...structuredResume,
  education: [{ school: "A大学", degree: "本科", major: "计算机", time_range: "2018-2022", courses: [], honors: [] }],
  skills: { skill_hard: ["Axure"], skill_soft: [], skill_level: [], certificate_list: ["PMP"] },
  optional: {
    campus_exp: ["学生会负责人"],
    self_evaluation: ["结果导向"],
    manage_exp: ["带领 10 人团队"],
    political_status: "",
  },
  meta: { source: "test", warnings: [], sectionOrder: ["basics", "optional", "work", "projects", "skills", "education"] },
};

const marketTemplateIds = [
  "ats_chronological",
  "ats_compact_cn",
  "modern_product_data",
  "tech_sidebar_pro",
  "executive_impact",
  "expert_timeline",
  "campus_project_plus",
  "intern_clean_onepage",
];

test("preview classes expose two-column template without forcing mobile two-column", () => {
  const classes = getPreviewTemplateClasses("modern");
  assert.match(classes.page, /bg-white/);
  assert.match(classes.body, /md:grid/);
});

test("print CSS is template-specific", () => {
  assert.match(getTemplatePrintCss("classic"), /border-bottom:2px solid #2563eb/);
  assert.match(getTemplatePrintCss("modern"), /grid-template-columns:210px 1fr/);
  assert.match(getTemplatePrintCss("executive"), /#1d4ed8/);
});

test("market flagship templates expose preview and export themes", () => {
  for (const templateId of marketTemplateIds) {
    const classes = getPreviewTemplateClasses(templateId);
    const css = getTemplatePrintCss(templateId);
    const html = renderTemplateExportHtml({ title: "测试", structuredResume, templateId });

    assert.match(classes.page, /bg-white/);
    assert.equal(typeof classes.accent, "string");
    assert.match(css, /font-family/);
    assert.match(html, new RegExp(`data-template="${templateId}"`));
    assert.match(html, /&lt;AI&gt;/);
  }
});

test("ATS flagship templates avoid complex sidebar export structures", () => {
  for (const templateId of ["ats_chronological", "ats_compact_cn"]) {
    const classes = getPreviewTemplateClasses(templateId);
    const css = getTemplatePrintCss(templateId);
    const html = renderTemplateExportHtml({ title: "测试", structuredResume, templateId });

    assert.doesNotMatch(classes.body, /md:grid/);
    assert.doesNotMatch(css, /grid-template-columns/);
    assert.doesNotMatch(html, /class="sidebar"/);
  }
});

test("view model is built from structured fields", () => {
  const view = buildStructuredResumeViewModel(structuredResume);
  assert.equal(view.title, "张三");
  assert.deepEqual(view.contactItems, ["13800138000", "zhangsan@example.com", "上海", "产品经理"]);
  assert.equal(view.sections[0].title, "工作/实习经历");
});

test("export html contains selected template id and escaped structured content", () => {
  const html = renderTemplateExportHtml({ title: "测试", structuredResume, templateId: "executive" });
  assert.match(html, /data-template="executive"/);
  assert.match(html, /&lt;AI&gt;/);
  assert.doesNotMatch(html, /<AI>/);
});

test("editor section order moves optional information as one display group", () => {
  const view = buildStructuredResumeViewModel(customOrderedResume);
  const titles = view.sections.map((section) => section.title);

  assert.deepEqual(titles.slice(0, 6), ["自我评价", "校园经历", "团队管理", "工作/实习经历", "专业技能", "技能证书"]);
});

test("export html follows editor section order for optional information", () => {
  const html = renderTemplateExportHtml({ title: "测试", structuredResume: customOrderedResume, templateId: "classic" });

  assert.ok(html.indexOf("自我评价") < html.indexOf("工作/实习经历"));
  assert.ok(html.indexOf("校园经历") < html.indexOf("工作/实习经历"));
  assert.ok(html.indexOf("团队管理") < html.indexOf("工作/实习经历"));
});

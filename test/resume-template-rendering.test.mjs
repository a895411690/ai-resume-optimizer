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

test("preview classes expose two-column template without forcing mobile two-column", () => {
  const classes = getPreviewTemplateClasses("modern");
  assert.match(classes.page, /bg-white/);
  assert.match(classes.body, /md:grid/);
});

test("print CSS is template-specific", () => {
  assert.match(getTemplatePrintCss("classic"), /border-bottom:2px solid #111827/);
  assert.match(getTemplatePrintCss("modern"), /grid-template-columns:210px 1fr/);
  assert.match(getTemplatePrintCss("executive"), /#1d4ed8/);
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addArrayItem, updateOptionalField, updateSkillsField } from "../src/lib/resume-editor-model.js";
import { renderStructuredResumeV1Markdown } from "../src/lib/resume-schema.js";
import { renderTemplateExportHtml } from "../src/lib/resume-template-rendering.js";

const structuredResume = {
  basics: {
    name: "张三",
    phone: "13800138000",
    email: "zhangsan@example.com",
    location: "上海",
    job_target: "产品经理",
  },
  work: [{
    time_range: "2024.01-2025.01",
    company: "A 公司",
    position: "产品经理",
    job_content: "负责需求分析和版本规划",
    job_result: ["上线核心功能", "提升转化率 12%"],
  }],
  projects: [{
    project_name: "AI 简历项目",
    role: "项目负责人",
    project_intro: "面向求职者的简历优化工具",
    duty: "负责流程设计和验收",
    achievement: ["完成模板切换", "支持结构化编辑"],
  }],
  skills: { skill_hard: ["Axure", "SQL"], skill_soft: ["跨部门沟通"], skill_level: ["Axure 熟练"], certificate_list: ["PMP"] },
  optional: { self_evaluation: ["具备产品规划和数据分析能力"] },
};

test("structured edits render a markdown compatibility projection with mainstream sections", () => {
  const markdown = renderStructuredResumeV1Markdown(structuredResume);

  assert.match(markdown, /## 个人信息/);
  assert.match(markdown, /张三/);
  assert.match(markdown, /## 工作\/实习经历/);
  assert.match(markdown, /A 公司/);
  assert.match(markdown, /## 项目经历/);
  assert.match(markdown, /AI 简历项目/);
  assert.match(markdown, /## 专业技能/);
  assert.match(markdown, /Axure/);
});

test("markdown compatibility mode still migrates edited text back into structured state", () => {
  const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /onClick=\{\(\) => setEditorMode\("markdown"\)\}/);
  assert.match(pageSource, /onClick=\{\(\) => setEditorMode\("structured"\)\}/);
  assert.match(pageSource, /onChange=\{\(event\) => updateCurrentMarkdown\(event\.target\.value\)\}/);
  assert.match(pageSource, /const structured = migrateMarkdownToStructuredResumeV1\(content\)/);
  assert.match(pageSource, /<StructuredResumeEditor structuredResume=\{currentStructuredResume\}/);
});

test("structured editor exposes every work and project field from the beta plan", () => {
  const source = readFileSync(new URL("../src/components/structured-resume-editor.tsx", import.meta.url), "utf8");

  for (const label of ["时间", "公司", "岗位", "工作内容", "工作成果", "项目名称", "担任角色", "项目简介", "负责工作", "项目成果"]) {
    assert.match(source, new RegExp(label));
  }
});

test("editing skills and optional fields preserves empty work and project drafts", () => {
  const withWorkDraft = addArrayItem(structuredResume, "work");
  const withProjectDraft = addArrayItem(withWorkDraft, "projects");
  const withSkills = updateSkillsField(withProjectDraft, "skill_hard", "Axure\nSQL\n数据分析");
  const withOptional = updateOptionalField(withSkills, "campus_exp", "学生会负责人");

  assert.equal(withOptional.work.length, 2);
  assert.equal(withOptional.projects.length, 2);
  assert.deepEqual(withOptional.work[1], { time_range: "", company: "", position: "", job_content: "", job_result: [] });
  assert.deepEqual(withOptional.projects[1], { project_name: "", role: "", project_intro: "", duty: "", achievement: [] });
  assert.deepEqual(withOptional.skills.skill_hard, ["Axure", "SQL", "数据分析"]);
  assert.deepEqual(withOptional.optional.campus_exp, ["学生会负责人"]);
});

test("PDF export html uses selected template and structured resume content", () => {
  const html = renderTemplateExportHtml({ title: "张三产品经理简历", structuredResume, templateId: "modern" });

  assert.match(html, /data-template="modern"/);
  assert.match(html, /张三/);
  assert.match(html, /13800138000/);
  assert.match(html, /zhangsan@example\.com/);
  assert.match(html, /A 公司/);
  assert.match(html, /AI 简历项目/);
  assert.match(html, /Axure/);
});

test("downloadPdf writes export html from current structured resume and template", () => {
  const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /function downloadPdf\(\)/);
  assert.match(pageSource, /renderTemplateExportHtml\(\{ title: resume\.title, structuredResume: currentStructuredResume, templateId: resume\.templateId \}\)/);
  assert.match(pageSource, /windowRef\.document\.write\(html\)/);
  assert.match(pageSource, /windowRef\.print\(\)/);
});

test("mobile workspace keeps stacked layout and scrollable editor constraints", () => {
  const pageSource = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const editorSource = readFileSync(new URL("../src/components/structured-resume-editor.tsx", import.meta.url), "utf8");
  const selectorSource = readFileSync(new URL("../src/components/resume-template-selector.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /flex min-h-screen flex-col/);
  assert.match(pageSource, /md:flex-row/);
  assert.match(pageSource, /h-\[38svh\] min-h-48/);
  assert.match(editorSource, /h-full overflow-auto/);
  assert.match(selectorSource, /flex-wrap/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("template center component exposes search filters recommendations and selection", () => {
  const source = readFileSync(new URL("../src/components/resume-template-center.tsx", import.meta.url), "utf8");

  assert.match(source, /模板中心/);
  assert.match(source, /搜索模板名称、场景或标签/);
  assert.match(source, /推荐理由/);
  assert.match(source, /推荐人群/);
  assert.match(source, /模板优势/);
  assert.match(source, /marketTags/);
  assert.match(source, /family/);
  assert.match(source, /最近使用/);
  assert.match(source, /resume-template-center-recent/);
  assert.match(source, /localStorage/);
  assert.match(source, /renderTemplatePreview/);
  assert.match(source, /选用模板/);
  for (const scene of ["全部", "通用", "校招", "社招", "国企\/公考", "外企双语"]) {
    assert.match(source, new RegExp(scene));
  }
  for (const family of ["全部家族", "ATS 网申", "现代专业", "高管专家", "校招实习"]) {
    assert.match(source, new RegExp(family));
  }
  for (const templateId of ["ats_chronological", "modern_product_data", "executive_impact", "campus_project_plus"]) {
    assert.match(source, new RegExp(templateId));
  }
});

test("page wires the template center dialog into the workspace header", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /ResumeTemplateCenter/);
  assert.match(source, /templateCenterOpen/);
  assert.match(source, /setTemplateCenterOpen/);
  assert.match(source, />模板中心</);
  assert.match(source, /onSelect=\{\(templateId\) =>/);
  assert.match(source, /updateResume\(\(current\) => \(\{ \.\.\.current, templateId \}\)\)/);
});

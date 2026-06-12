import assert from "node:assert/strict";
import test from "node:test";
import { RESUME_TEMPLATES } from "../src/lib/resume-templates.js";
import {
  getTemplateRecommendationContext,
  normalizeTemplateRecommendations,
  recommendResumeTemplates,
} from "../src/lib/resume-template-recommendation.js";

test("senior candidates are recommended the executive flagship template first", () => {
  const recommendations = recommendResumeTemplates({ userType: "senior", templates: RESUME_TEMPLATES });

  assert.equal(recommendations[0].templateId, "executive_impact");
  assert.match(recommendations[0].reason, /中高级|管理|影响力/);
});

test("fresh graduates are recommended the campus flagship template first", () => {
  const recommendations = recommendResumeTemplates({ userType: "fresh_graduate", templates: RESUME_TEMPLATES });

  assert.equal(recommendations[0].templateId, "campus_project_plus");
  assert.match(recommendations[0].reason, /应届|校招|实习|校园/);
});

test("product data technology and operation roles are recommended the modern professional flagship first", () => {
  for (const targetRole of ["产品经理", "数据分析师", "技术运营", "用户运营"]) {
    const recommendations = recommendResumeTemplates({ userType: "junior", targetRole, templates: RESUME_TEMPLATES });
    assert.equal(recommendations[0].templateId, "modern_product_data", targetRole);
    assert.match(recommendations[0].reason, /产品|数据|技术|运营|现代专业|成果叙事/);
  }
});

test("market family recommendations prioritize ATS modern executive and campus needs", () => {
  assert.equal(
    recommendResumeTemplates({ userType: "junior", targetRole: "外企 ATS 网申 海投", templates: RESUME_TEMPLATES })[0].templateId,
    "ats_chronological",
  );
  assert.equal(
    recommendResumeTemplates({ userType: "junior", targetRole: "数据产品经理", templates: RESUME_TEMPLATES })[0].templateId,
    "modern_product_data",
  );
  assert.equal(
    recommendResumeTemplates({ userType: "senior", targetRole: "业务负责人 总监", templates: RESUME_TEMPLATES })[0].templateId,
    "executive_impact",
  );
  assert.equal(
    recommendResumeTemplates({ userType: "fresh_graduate", targetRole: "校招 实习 产品助理", templates: RESUME_TEMPLATES })[0].templateId,
    "campus_project_plus",
  );
});

test("recommendation context includes template family matching keywords", () => {
  const recommendations = recommendResumeTemplates({
    userType: "career_switcher",
    targetRole: "技术转行 数据分析 网申",
    templates: RESUME_TEMPLATES,
  }).slice(0, 5);

  assert.ok(recommendations.some((item) => item.templateId === "ats_chronological"));
  assert.ok(recommendations.some((item) => item.templateId === "modern_product_data"));
});

test("recommendations never return template ids outside the catalog", () => {
  const recommendations = recommendResumeTemplates({ userType: "unknown", targetRole: "", templates: RESUME_TEMPLATES });
  const catalogIds = new Set(RESUME_TEMPLATES.map((template) => template.id));

  assert.ok(recommendations.length >= RESUME_TEMPLATES.length);
  for (const recommendation of recommendations) {
    assert.ok(catalogIds.has(recommendation.templateId), recommendation.templateId);
    assert.equal(typeof recommendation.reason, "string");
  }
});

test("recommendation context reads target role from structured resume when explicit role is empty", () => {
  const context = getTemplateRecommendationContext({
    userType: "auto",
    targetRole: "",
    structuredResume: { basics: { job_target: "数据产品经理" } },
  });

  assert.equal(context.userType, "auto");
  assert.equal(context.targetRole, "数据产品经理");
  assert.equal(context.keywordText.includes("数据产品经理"), true);
});

test("AI recommendation normalization keeps only catalog ids with reasons", () => {
  const normalized = normalizeTemplateRecommendations([
    { templateId: "modern", reason: "适合产品技术岗位。" },
    { templateId: "missing", reason: "不存在的模板。" },
    { templateId: "classic", reason: "" },
    { templateId: "modern", reason: "重复模板。" },
    { templateId: "executive", reason: "适合资深候选人。" },
  ], RESUME_TEMPLATES);

  assert.deepEqual(normalized, [
    { templateId: "modern", reason: "适合产品技术岗位。" },
    { templateId: "executive", reason: "适合资深候选人。" },
  ]);
});

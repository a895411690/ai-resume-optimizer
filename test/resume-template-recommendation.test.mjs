import assert from "node:assert/strict";
import test from "node:test";
import { RESUME_TEMPLATES } from "../src/lib/resume-templates.js";
import {
  getTemplateRecommendationContext,
  recommendResumeTemplates,
} from "../src/lib/resume-template-recommendation.js";

test("senior candidates are recommended the executive template first", () => {
  const recommendations = recommendResumeTemplates({ userType: "senior", templates: RESUME_TEMPLATES });

  assert.equal(recommendations[0].templateId, "executive");
  assert.match(recommendations[0].reason, /中高级|管理|影响力/);
});

test("fresh graduates are recommended the classic template first", () => {
  const recommendations = recommendResumeTemplates({ userType: "fresh_graduate", templates: RESUME_TEMPLATES });

  assert.equal(recommendations[0].templateId, "classic");
  assert.match(recommendations[0].reason, /应届|校招|通用/);
});

test("product data technology and operation roles are recommended the modern template first", () => {
  for (const targetRole of ["产品经理", "数据分析师", "技术运营", "用户运营"]) {
    const recommendations = recommendResumeTemplates({ userType: "junior", targetRole, templates: RESUME_TEMPLATES });
    assert.equal(recommendations[0].templateId, "modern", targetRole);
    assert.match(recommendations[0].reason, /产品|数据|技术|运营|信息密度/);
  }
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

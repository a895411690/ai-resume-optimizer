import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATES,
  getResumeTemplate,
  normalizeResumeTemplateId,
} from "../src/lib/resume-templates.js";

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

test("catalog ships 25 templates covering all PRD categories", () => {
  const ids = RESUME_TEMPLATES.map((item) => item.id);
  assert.ok(ids.length >= 25, `expected at least 25 templates, got ${ids.length}`);
  assert.equal(ids[0], "classic");
  assert.ok(ids.includes("modern"));
  assert.ok(ids.includes("executive"));
  assert.ok(ids.includes("campus_fresh"));
  assert.ok(ids.includes("gov_formal"));
  assert.ok(ids.includes("bilingual_modern"));
  assert.ok(ids.includes("campus_star"));
  assert.ok(ids.includes("data_analyst"));
  assert.ok(ids.includes("designer"));
  assert.ok(ids.includes("finance_pro"));
  assert.equal(DEFAULT_TEMPLATE_ID, "classic");
});

test("catalog includes eight market reference flagship templates", () => {
  const ids = RESUME_TEMPLATES.map((item) => item.id);
  for (const id of MARKET_TEMPLATE_IDS) {
    assert.ok(ids.includes(id), id);
  }
});

test("each template has user-facing metadata and tags", () => {
  for (const template of RESUME_TEMPLATES) {
    assert.ok(template.name);
    assert.ok(template.description);
    assert.ok(template.tags.length >= 2);
    assert.ok(template.scenarios.length >= 1);
    assert.ok(template.recommendedFor.length >= 1);
  }
});

test("each template has center metadata for previews audience and strengths", () => {
  for (const template of RESUME_TEMPLATES) {
    assert.ok(template.audience.length >= 1);
    assert.ok(template.strengths.length >= 2);
    assert.ok(template.preview);
    assert.ok(["single", "two-column", "single-accent", "timeline", "infographic", "sidebar-right"].includes(template.preview.layout));
    assert.ok(template.preview.accent);
  }
});

test("each template has market family metadata", () => {
  const families = new Set(["ats", "modern_professional", "executive_expert", "campus_intern"]);
  const densities = new Set(["compact", "balanced", "spacious"]);
  const atsLevels = new Set(["high", "medium", "low"]);

  for (const template of RESUME_TEMPLATES) {
    assert.ok(families.has(template.family), `${template.id} family`);
    assert.ok(densities.has(template.density), `${template.id} density`);
    assert.ok(atsLevels.has(template.atsLevel), `${template.id} atsLevel`);
    assert.ok(Array.isArray(template.contentPriority) && template.contentPriority.length >= 2, `${template.id} contentPriority`);
    assert.ok(Array.isArray(template.marketTags) && template.marketTags.length >= 1, `${template.id} marketTags`);
  }
});

test("market flagship templates map to the selected four families", () => {
  const byId = new Map(RESUME_TEMPLATES.map((template) => [template.id, template]));

  assert.equal(byId.get("ats_chronological").family, "ats");
  assert.equal(byId.get("ats_compact_cn").family, "ats");
  assert.equal(byId.get("modern_product_data").family, "modern_professional");
  assert.equal(byId.get("tech_sidebar_pro").family, "modern_professional");
  assert.equal(byId.get("executive_impact").family, "executive_expert");
  assert.equal(byId.get("expert_timeline").family, "executive_expert");
  assert.equal(byId.get("campus_project_plus").family, "campus_intern");
  assert.equal(byId.get("intern_clean_onepage").family, "campus_intern");
});

test("unknown template ids fall back to the classic template", () => {
  assert.equal(normalizeResumeTemplateId("missing"), "classic");
  assert.equal(getResumeTemplate("missing").id, "classic");
});

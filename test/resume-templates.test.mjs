import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATES,
  getResumeTemplate,
  normalizeResumeTemplateId,
} from "../src/lib/resume-templates.js";

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

test("unknown template ids fall back to the classic template", () => {
  assert.equal(normalizeResumeTemplateId("missing"), "classic");
  assert.equal(getResumeTemplate("missing").id, "classic");
});

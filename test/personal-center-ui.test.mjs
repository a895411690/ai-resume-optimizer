import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("page exposes personal center cloud persistence entry and states", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /我的简历/);
  assert.match(source, /resumeListOpen/);
  assert.match(source, /currentResumeId/);
  assert.match(source, /cloudSaveStatus/);
  assert.match(source, /保存中/);
  assert.match(source, /已保存/);
  assert.match(source, /保存失败/);
  assert.match(source, /更新时间/);
  assert.match(source, /打开/);
  assert.match(source, /删除/);
});

test("page uses Supabase auth client and cloud persistence helpers", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /supabase\.auth\.signInWithPassword/);
  assert.match(source, /supabase\.auth\.signUp/);
  assert.match(source, /supabase\.auth\.getSession/);
  assert.match(source, /supabase\.auth\.signOut/);
  assert.match(source, /getAuthHeaders/);
  assert.match(source, /listUserResumes/);
  assert.match(source, /saveUserResume/);
  assert.match(source, /deleteUserResume/);
  assert.doesNotMatch(source, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(resume\)\);\s*\}\s*<\/Button>/);
});

test("demo mode can diagnose but cannot access optimization actions", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /DEMO_AI_LIMIT_MESSAGE/);
  assert.match(source, /ensureDiagnosisAccess\(\)/);
  assert.match(source, /ensureOptimizationAccess\(\)/);
  assert.match(source, /getDemoHeaders/);
  assert.match(source, /disabled=\{!hasOriginal \|\| busy === "diagnose"\}/);
  assert.doesNotMatch(source, /disabled=\{demo \|\| !hasOriginal \|\| busy === "diagnose"\}/);
  assert.match(source, /onOptimizeModule=\{demo \? undefined : handleOptimizeModule\}/);
  assert.match(source, /Demo 模式支持免费诊断；优化需登录并使用免费次数或开通 VIP。/);
});

test("page exposes VIP entry and handles paid optimization gating", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /entitlement/);
  assert.match(source, /refreshEntitlement/);
  assert.match(source, /VIP_REQUIRED/);
  assert.match(source, /vipDialogOpen/);
  assert.match(source, /开通 VIP/);
  assert.match(source, /二维码位/);
});

test("AI API routes require authenticated users", () => {
  for (const route of [
    "../src/app/api/optimize/route.ts",
    "../src/app/api/optimize-module/route.ts",
    "../src/app/api/recommend-templates/route.ts",
  ]) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(source, /requireAuthenticatedUser/);
  }
  const diagnose = readFileSync(new URL("../src/app/api/diagnose/route.ts", import.meta.url), "utf8");
  assert.match(diagnose, /getOptionalAuthenticatedUser/);
});

test("migration extends resumes table with structured persistence fields", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260609000000_resume_persistence_v1.sql", import.meta.url), "utf8");

  for (const column of [
    "structured_resume",
    "optimized_structured_resume",
    "template_id",
    "user_type",
    "workflow_mode",
    "strength",
    "diagnosis",
    "optimization",
  ]) {
    assert.match(migration, new RegExp(column));
  }
  assert.match(migration, /ALTER TABLE resumes/);
});

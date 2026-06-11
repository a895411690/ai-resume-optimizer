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

test("demo mode cannot access paid AI actions", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /DEMO_AI_LIMIT_MESSAGE/);
  assert.match(source, /ensureAiAccess\(\)/);
  assert.match(source, /if \(!ensureAiAccess\(\)\) return null;/);
  assert.match(source, /if \(!ensureAiAccess\(\)\) return;/);
  assert.match(source, /disabled=\{demo \|\| !hasOriginal \|\| busy === "flow"\}/);
  assert.match(source, /disabled=\{demo \|\| !hasOriginal \|\| busy === "diagnose"\}/);
  assert.match(source, /disabled=\{demo \|\| !hasOriginal \|\| busy === "optimize"\}/);
  assert.match(source, /onOptimizeModule=\{demo \? undefined : handleOptimizeModule\}/);
  assert.match(source, /Demo 模式可体验编辑、导入和导出，AI 诊断优化需登录后使用。/);
});

test("AI API routes require authenticated users", () => {
  for (const route of [
    "../src/app/api/diagnose/route.ts",
    "../src/app/api/optimize/route.ts",
    "../src/app/api/optimize-module/route.ts",
    "../src/app/api/recommend-templates/route.ts",
  ]) {
    const source = readFileSync(new URL(route, import.meta.url), "utf8");
    assert.match(source, /requireAuthenticatedUser/);
  }
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

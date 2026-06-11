import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Supabase migration adds entitlement, AI usage, and demo diagnosis limit tables", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260611000000_ai_access_control.sql", import.meta.url), "utf8");

  for (const table of [
    "user_entitlements",
    "ai_usage_events",
    "demo_diagnosis_usage_daily",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(migration, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
  }

  assert.match(migration, /free_optimization_used BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /vip_expires_at TIMESTAMPTZ/);
  assert.match(migration, /diagnosis_count INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /GRANT SELECT ON user_entitlements TO authenticated/);
});

test("AI access control reserves optimization access and supports demo diagnosis limit", () => {
  const source = readFileSync(new URL("../src/lib/ai-access-control.ts", import.meta.url), "utf8");

  assert.match(source, /DEMO_DAILY_DIAGNOSIS_LIMIT = 3/);
  assert.match(source, /reserveDemoDiagnosisAccess/);
  assert.match(source, /reserveOptimizationAccess/);
  assert.match(source, /free_optimization_used/);
  assert.match(source, /VIP_REQUIRED/);
  assert.match(source, /markAiUsageCompleted/);
  assert.match(source, /markAiUsageFailed/);
});

test("AI routes use the correct access gates", () => {
  const diagnose = readFileSync(new URL("../src/app/api/diagnose/route.ts", import.meta.url), "utf8");
  const optimize = readFileSync(new URL("../src/app/api/optimize/route.ts", import.meta.url), "utf8");
  const optimizeModule = readFileSync(new URL("../src/app/api/optimize-module/route.ts", import.meta.url), "utf8");
  const entitlement = readFileSync(new URL("../src/app/api/entitlement/route.ts", import.meta.url), "utf8");

  assert.match(diagnose, /getOptionalAuthenticatedUser/);
  assert.match(diagnose, /reserveDemoDiagnosisAccess/);
  assert.match(optimize, /reserveOptimizationAccess/);
  assert.match(optimize, /markAiUsageCompleted/);
  assert.match(optimize, /markAiUsageFailed/);
  assert.match(optimizeModule, /reserveOptimizationAccess/);
  assert.match(entitlement, /getEntitlementSummary/);
});


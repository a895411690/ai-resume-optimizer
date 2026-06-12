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

test("Supabase migration adds payment entitlement fields and service-role RPCs", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20260612000000_fix_payment_entitlement_atomicity.sql", import.meta.url), "utf8");

  assert.match(migration, /ADD COLUMN IF NOT EXISTS optimization_credits INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS lifetime_vip BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /entitlement_source IN \('authenticated', 'demo_daily', 'free_once', 'vip', 'credits'\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS product_code TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS product_name TEXT NOT NULL DEFAULT ''/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS credits_granted INTEGER NOT NULL DEFAULT 0/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS lifetime_vip_granted BOOLEAN NOT NULL DEFAULT false/);

  for (const functionName of [
    "reserve_optimization_credit",
    "refund_optimization_credit",
    "reserve_demo_diagnosis",
    "finalize_payment_order",
  ]) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${functionName}`));
    assert.match(migration, new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${functionName}`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}`));
  }
});

test("AI access control reserves optimization access and supports demo diagnosis limit", () => {
  const source = readFileSync(new URL("../src/lib/ai-access-control.ts", import.meta.url), "utf8");

  assert.match(source, /DEMO_DAILY_DIAGNOSIS_LIMIT = 3/);
  assert.match(source, /reserveDemoDiagnosisAccess/);
  assert.match(source, /optimization_credits/);
  assert.match(source, /lifetime_vip/);  assert.match(source, /reserveOptimizationAccess/);
  assert.match(source, /free_optimization_used/);
  assert.match(source, /VIP_REQUIRED/);
  assert.match(source, /markAiUsageCompleted/);
  assert.match(source, /markAiUsageFailed/);
});

test("AI access control uses atomic RPCs for credit and demo reservations", () => {
  const source = readFileSync(new URL("../src/lib/ai-access-control.ts", import.meta.url), "utf8");

  assert.match(source, /admin\.rpc\("reserve_optimization_credit"/);
  assert.match(source, /admin\.rpc\("refund_optimization_credit"/);
  assert.match(source, /admin\.rpc\("reserve_demo_diagnosis"/);
  assert.doesNotMatch(source, /optimization_credits: entitlement\.optimizationCredits - 1/);
  assert.doesNotMatch(source, /diagnosis_count: currentCount \+ 1/);
});

test("payment routes use atomic finalization and migration supports product grants", () => {
  const notify = readFileSync(new URL("../src/app/api/payment/notify/route.ts", import.meta.url), "utf8");
  const xddpay = readFileSync(new URL("../src/lib/xddpay.ts", import.meta.url), "utf8");

  assert.match(notify, /admin\.rpc\("finalize_payment_order"/);
  assert.match(notify, /expected_money/);
  assert.doesNotMatch(notify, /select\("optimization_credits"\)/);
  assert.doesNotMatch(notify, /optimization_credits: newCredits/);
  assert.match(xddpay, /product_code: product\.code/);
  assert.match(xddpay, /credits_granted: product\.credits/);
  assert.match(xddpay, /lifetime_vip_granted: product\.lifetimeVip/);
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

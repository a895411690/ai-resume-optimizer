import test from "node:test";
import assert from "node:assert/strict";
import { chooseDeepSeekModel } from "../src/lib/deepseek-model-router.js";

test("routes basic diagnosis to flash", () => {
  const decision = chooseDeepSeekModel({ scene: "diagnose_basic", textLength: 420, workItemCount: 1, userTier: "free" });
  assert.equal(decision.tier, "flash");
  assert.match(decision.reason, /basic/i);
});

test("routes deep JD optimization to pro", () => {
  const decision = chooseDeepSeekModel({ scene: "optimize_deep", textLength: 2200, workItemCount: 5, jdLength: 1800, userTier: "free", proQuotaRemaining: 3 });
  assert.equal(decision.tier, "pro");
  assert.equal(decision.downgraded, false);
});

test("free users over pro quota downgrade to flash", () => {
  const decision = chooseDeepSeekModel({ scene: "optimize_deep", textLength: 2200, workItemCount: 5, userTier: "free", proQuotaRemaining: 0 });
  assert.equal(decision.tier, "flash");
  assert.equal(decision.downgraded, true);
});

test("paid users keep pro routing for senior complex resumes", () => {
  const decision = chooseDeepSeekModel({ scene: "optimize_deep", textLength: 900, workItemCount: 4, userTier: "paid", userType: "senior" });
  assert.equal(decision.tier, "pro");
});

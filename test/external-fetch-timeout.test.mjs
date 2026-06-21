import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const files = [
  "../src/app/api/import/route.ts",
  "../src/app/api/diagnose/route.ts",
  "../src/app/api/optimize/route.ts",
  "../src/app/api/optimize-module/route.ts",
  "../src/app/api/recommend-templates/route.ts",
  "../src/lib/xddpay.ts",
];

test("external API calls use the shared timeout wrapper", () => {
  const helper = readFileSync(new URL("../src/lib/fetch-with-timeout.ts", import.meta.url), "utf8");

  assert.match(helper, /export async function fetchWithTimeout/);
  assert.match(helper, /AbortController/);
  assert.match(helper, /function combineAbortSignals/);
  assert.match(helper, /init\.signal/);
  assert.match(helper, /DEFAULT_AI_FETCH_TIMEOUT_MS = 60_000/);
  assert.match(helper, /DEFAULT_PAYMENT_FETCH_TIMEOUT_MS = 15_000/);

  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /fetchWithTimeout/);
  }
});

test("AI and payment routes no longer call external fetch directly", () => {
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /await fetch\(`\$\{DEEPSEEK_BASE_URL\}/);
    assert.doesNotMatch(source, /await fetch\(`\$\{XDDPAY_GATEWAY\}/);
  }
});

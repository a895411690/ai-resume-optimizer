import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("module optimization validates model output before returning it", () => {
  const route = readFileSync(new URL("../src/app/api/optimize-module/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(route, /function normalizeOptimizedModule\(moduleName: string, value: unknown, originalModule: unknown\)/);
  assert.match(route, /const normalizedModule = normalizeOptimizedModule\(moduleName, parsed\.optimizedModule, moduleData\)/);
  assert.match(route, /if \(!normalizedModule\)/);
  assert.match(route, /optimizedModule: normalizedModule/);
  assert.doesNotMatch(route, /optimizedModule: parsed\.optimizedModule \|\| moduleData/);
  assert.match(page, /normalizeStructuredResumeV1\(\{ \.\.\.resume\.structuredResume, \[moduleName\]: data\.optimizedModule \}\)/);
});

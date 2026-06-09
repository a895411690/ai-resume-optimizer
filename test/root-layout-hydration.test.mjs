import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("root html suppresses extension-injected hydration attribute warnings", () => {
  const source = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

  assert.match(source, /<html\s+lang="zh-CN"\s+suppressHydrationWarning>/);
});

test("root layout does not depend on remote Google font downloads during build", () => {
  const source = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /next\/font\/google/);
  assert.doesNotMatch(source, /Geist/);
});

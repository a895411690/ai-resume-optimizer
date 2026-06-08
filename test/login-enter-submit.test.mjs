import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("login form submits with Enter without triggering secondary actions", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /<form[^>]+onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\);\s*signIn\(\);\s*\}\}/s);
  assert.match(source, /<Button className="w-full" type="submit" disabled=\{authLoading\}>/);
  assert.doesNotMatch(source, /type="submit" onClick=\{signIn\}/);
  assert.match(source, /<button type="button" className="text-primary hover:underline"/);
  assert.match(source, /<Button className="w-full" type="button" variant="outline" onClick=\{enterDemo\}>/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PDF import parses in-process after installing Node PDF polyfills", () => {
  const source = readFileSync(new URL("../src/app/api/import/route.ts", import.meta.url), "utf8");

  assert.match(source, /function installPdfNodePolyfills\(\)/);
  assert.match(source, /DOMMatrix = class DOMMatrix/);
  assert.match(source, /installPdfNodePolyfills\(\);\s*const \{ PDFParse \} = await import\("pdf-parse"\);/s);
  assert.match(source, /await import\("pdf-parse"\)/);
  assert.match(source, /async function extractPdfText\(buffer: Buffer\)/);
  assert.match(source, /const parser = new PDFParse\(\{ data: buffer \}\);/);
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /PDF_PARSE_SCRIPT/);
  assert.doesNotMatch(source, /require\.resolve\("pdf-parse"\)/);
});

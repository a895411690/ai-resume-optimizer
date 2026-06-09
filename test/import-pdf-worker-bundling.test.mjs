import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PDF import parses in-process with a statically traced pdf-parse import", () => {
  const source = readFileSync(new URL("../src/app/api/import/route.ts", import.meta.url), "utf8");

  assert.match(source, /import \{ PDFParse \} from "pdf-parse";/);
  assert.match(source, /async function extractPdfText\(buffer: Buffer\)/);
  assert.match(source, /const parser = new PDFParse\(\{ data: buffer \}\);/);
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /PDF_PARSE_SCRIPT/);
  assert.doesNotMatch(source, /require\.resolve\("pdf-parse"\)/);
});

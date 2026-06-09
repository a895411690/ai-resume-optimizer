import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PDF import worker uses a statically traced pdf-parse path", () => {
  const source = readFileSync(new URL("../src/app/api/import/route.ts", import.meta.url), "utf8");

  assert.match(source, /const PDF_PARSE_MODULE_PATH = require\.resolve\("pdf-parse"\);/);
  assert.match(source, /const pdfModulePath = process\.argv\[4\];/);
  assert.match(source, /const pdf = require\(pdfModulePath\);/);
  assert.doesNotMatch(source, /createRequire\(path\.join\(cwd, 'package\.json'\)\)/);
  assert.match(source, /JSON\.stringify\(PDF_PARSE_MODULE_PATH\)/);
});

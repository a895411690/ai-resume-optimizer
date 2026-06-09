import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("PDF import uses an explicit in-process PDF.js worker port", () => {
  const source = readFileSync(new URL("../src/app/api/import/route.ts", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(source, /function installPdfNodePolyfills\(\)/);
  assert.match(source, /DOMMatrix = class DOMMatrix/);
  assert.match(source, /const pdfjs = await import\("pdfjs-dist\/legacy\/build\/pdf\.mjs"\);/);
  assert.match(source, /await import\("pdfjs-dist\/legacy\/build\/pdf\.worker\.mjs"\)/);
  assert.match(source, /class PdfLoopbackPort/);
  assert.match(source, /WorkerMessageHandler\.initializeFromPort\(workerPort\);/);
  assert.match(source, /const PdfWorker = pdfjs\.PDFWorker as unknown as PdfWorkerConstructor;/);
  assert.match(source, /new PdfWorker\(\{ port: workerPort \}\)/);
  assert.match(source, /worker,/);
  assert.match(source, /async function extractPdfText\(buffer: Buffer\)/);
  assert.match(source, /await loadingTask\.destroy\(\);/);
  assert.match(source, /worker\.destroy\(\);/);
  assert.match(source, /workerPort\.terminate\(\);/);
  assert.doesNotMatch(source, /disableWorker: true/);
  assert.doesNotMatch(source, /globalThis[\s\S]+\.pdfjsWorker = \{ WorkerMessageHandler \};/);
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /PDF_PARSE_SCRIPT/);
  assert.doesNotMatch(source, /await import\("pdf-parse"\)/);
  assert.doesNotMatch(source, /require\.resolve\("pdf-parse"\)/);
  assert.ok(manifest.dependencies["pdfjs-dist"]);
  assert.equal(manifest.dependencies["pdf-parse"], undefined);
});

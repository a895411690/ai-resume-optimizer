import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("main workspace stacks and avoids fixed desktop widths on mobile", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /flex min-h-screen flex-col/);
  assert.match(source, /md:h-screen md:flex-row md:overflow-hidden/);
  assert.match(source, /w-full flex-col border-b bg-white md:h-full md:w-\[320px\]/);
  assert.match(source, /flex flex-wrap items-start gap-2 border-b bg-white px-3/);
  assert.match(source, /grid gap-4 xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(source, /const \[editorHeight, setEditorHeight\] = useState\(38\);/);
  assert.match(source, /style=\{\{ height: `\$\{editorHeight\}svh`, minHeight: 192 \}\}/);
  assert.match(source, /w-\[calc\(100vw-1rem\)\]/);
  assert.doesNotMatch(source, /<div className="flex h-screen bg-slate-100 text-slate-950">/);
  assert.doesNotMatch(source, /<aside className="w-\[320px\] flex-shrink-0/);
  assert.doesNotMatch(source, /grid grid-cols-\[minmax\(0,1fr\)_360px\] gap-5/);
});

test("resume preview uses compact mobile sizing before A4 desktop sizing", () => {
  const source = readFileSync(new URL("../src/components/resume-preview.tsx", import.meta.url), "utf8");
  const renderingSource = readFileSync(new URL("../src/lib/resume-template-rendering.js", import.meta.url), "utf8");

  assert.match(source, /h-full min-w-0 overflow-auto/);
  assert.match(renderingSource, /mx-auto min-w-0 bg-white p-4/);
  assert.match(renderingSource, /md:max-w-\[794px\] md:p-12/);
  assert.match(renderingSource, /lg:min-h-\[1123px\]/);
  assert.match(renderingSource, /md:grid md:grid-cols-\[210px_minmax\(0,1fr\)\]/);
  assert.match(source, /break-words text-xl/);
  assert.match(source, /<span className="break-words" key=\{item\}>/);
  assert.doesNotMatch(source, /max-w-\[794px\] mx-auto bg-white shadow-lg p-12 min-h-\[1123px\]/);
});

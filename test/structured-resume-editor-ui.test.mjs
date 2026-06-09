import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("structured editor exposes PRD core modules", () => {
  const source = readFileSync(new URL("../src/components/structured-resume-editor.tsx", import.meta.url), "utf8");

  assert.match(source, /个人信息/);
  assert.match(source, /教育经历/);
  assert.match(source, /工作\/实习经历/);
  assert.match(source, /项目经历/);
  assert.match(source, /专业技能/);
  assert.match(source, /补充信息/);
  assert.match(source, /校园经历/);
  assert.match(source, /团队管理/);
  assert.match(source, /政治面貌/);
});

test("page defaults to structured editing with markdown compatibility as secondary mode", () => {
  const source = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /StructuredResumeEditor/);
  assert.match(source, /type EditorMode = "structured" \| "markdown"/);
  assert.match(source, /useState<EditorMode>\("structured"\)/);
  assert.match(source, /结构化/);
  assert.match(source, /Markdown兼容/);
  assert.match(source, /handleStructuredResumeChange/);
});

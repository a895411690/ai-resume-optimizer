# Resume Template System V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the updated PRD at `/Users/weijiahao/Downloads/AI简历优化工具-简历模板系统V1.0 产品需求文档（PRD） (1).md` into a staged engineering plan for WEIHUB's resume template system.

**Architecture:** The current app is a single Next.js workbench with Markdown-centered resume state, DeepSeek extraction/diagnosis/optimization APIs, localStorage persistence, and client-side print export. The updated PRD changes the target architecture: structured Schema data must become the only source of truth, Markdown is only an import/temporary rendering compatibility layer, and AI calls must go through a DeepSeek Flash/Pro routing service.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Supabase auth/storage/database, DeepSeek chat completions, pdfjs-dist, mammoth, node:test, ESLint.

---

## Scope Assessment

The PRD describes at least six independent subsystems:

- Template center and template catalog.
- Structured resume editor and data model.
- AI template recommendation and content migration.
- AI module-level diagnosis and explainable optimization.
- PDF and Word export.
- Personal center and admin management.
- Structured Schema as the only persistent/business data model.
- DeepSeek Flash/Pro smart model routing and usage telemetry.

This should not be implemented as one release branch. The recommended delivery is four milestones, each independently testable and deployable.

## Updated PRD Delta

The second PRD adds two non-negotiable architecture requirements that change the previous implementation order:

- **Structured Schema is the only source of truth.** Markdown cannot be the stored business model, cannot drive AI diagnosis/optimization, and cannot drive template migration. Markdown is only allowed as an input compatibility and temporary rendering layer.
- **AI calls must use smart model routing.** Diagnose, optimize, template recommendation, and future field-level edits should call a shared router that decides Flash or Pro by scene, content complexity, user tier, quota, and fallback state.

Because of this, Milestone 1 must include a structured data foundation before template rendering is expanded. A template-only MVP based on Markdown would conflict with the updated PRD.

## Recommended Milestones

### Milestone 1: Structured Foundation Plus Template MVP

Ship the smallest safe foundation that makes templates work while moving the app away from Markdown as core state.

**Included:**

- Canonical structured resume schema in code.
- Import path stores both structured data and a temporary Markdown compatibility projection during transition.
- AI API request builders read structured data first and only fall back to Markdown while old localStorage data is migrated.
- Shared DeepSeek model router scaffold with Flash/Pro scene decisions and fallback behavior.
- 3 mainstream templates: classic single-column, modern two-column, executive/professional.
- Template selector in the resume preview/export toolbar.
- Template preview rendering and PDF print/export based on structured data where available.
- Template metadata/tags as static code data.
- localStorage persistence of selected template.
- Tests for schema normalization, Markdown-to-structured migration, template definitions, render behavior, export style generation, model routing, and mobile fallback.

**Not included:**

- 25 templates.
- Backend template management.
- Word export.
- Full structured editor replacement UI.
- Paid quota enforcement and admin monitoring dashboards.

### Milestone 2: Structured Editor Beta And Field-Level AI

Introduce a structured resume model while keeping Markdown as a compatibility output.

**Included:**

- Structured resume schema based on PRD fields.
- Conversion from uploaded/imported DeepSeek `structured` output into the editor model.
- Form sections for personal info, education, work/internship, projects, and skills.
- AI APIs accept structured payloads directly and produce field-level diagnosis/optimization records.
- Optional dynamic modules: campus, political profile, management.
- Tests for migration, required fields, empty states, and no-data-loss template switching.

### Milestone 3: Template Center And AI Recommendation

Create the user-facing template center and recommendation flow.

**Included:**

- `/templates` page.
- Static catalog expanded toward 25 templates.
- Search, tag filters, cards, detail preview, and one-click choose.
- Recommendation modal asking target role, years, and industry.
- Rule-first recommendation using structured `job_target`, work years, industry, user type, and template tags; DeepSeek routed explanation may be added through the model router.

### Milestone 4: Persistence, Export, Personal Center, Admin

Move from demo/local state to production operations.

**Included:**

- Supabase tables for resumes, templates, template tags, diagnosis records, optimization records, and export records.
- Schema-first resume persistence; raw Markdown is not stored as business data.
- My resumes page with edit/delete/preview/continue optimize.
- Admin CRUD and sort/up-down shelf operations.
- PDF export hardening and Word export using a safe library.
- Usage analytics, model routing telemetry, latency, cost, and quota records.

---

## File Structure For Milestone 1

### Create

- `src/lib/resume-templates.js`: template IDs, labels, tags, recommended user types, layout settings, print CSS generator.
- `src/lib/resume-schema.js`: canonical structured Schema, defaults, normalization, migration helpers.
- `src/lib/resume-structured-rendering.js`: structured-to-view model helpers for templates and export.
- `src/lib/resume-template-rendering.js`: pure helpers that map a template ID plus structured view model into class names and export HTML.
- `src/lib/deepseek-model-router.js`: scene-driven Flash/Pro routing and fallback decisions.
- `src/components/resume-template-selector.tsx`: compact selector UI for the workbench toolbar.
- `test/resume-schema.test.mjs`: validates canonical Schema normalization and legacy Markdown migration.
- `test/resume-templates.test.mjs`: validates template catalog integrity and tag coverage.
- `test/resume-template-rendering.test.mjs`: validates template class/export HTML behavior.
- `test/deepseek-model-router.test.mjs`: validates Flash/Pro selection rules.

### Modify

- `src/app/page.tsx`: selected template state, structured resume state, legacy localStorage migration, selector placement, PDF export integration.
- `src/app/api/import/route.ts`: keep returning `structured`, normalize through canonical schema, and mark Markdown as compatibility output only.
- `src/app/api/diagnose/route.ts`: add structured payload support and route model calls through `deepseek-model-router`.
- `src/app/api/optimize/route.ts`: add structured payload support and route model calls through `deepseek-model-router`.
- `src/components/resume-preview.tsx`: accept `templateId` and structured resume/view model, render template-specific layout, keep mobile single-column fallback for two-column templates.
- `src/lib/resume-preview-layout.js`: keep template-neutral extraction helpers; add fields only if template rendering needs them.
- `test/mobile-responsive-layout.test.mjs`: add checks for mobile two-column fallback.
- `test/resume-preview-layout.test.mjs`: add no-regression coverage for personal info/contact extraction.

---

## Milestone 1 Task Plan

### Task 1: Canonical Structured Resume Schema

**Files:**

- Create: `src/lib/resume-schema.js`
- Test: `test/resume-schema.test.mjs`

- [ ] **Step 1: Write failing schema tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_STRUCTURED_RESUME,
  normalizeStructuredResumeV1,
  migrateMarkdownToStructuredResumeV1,
} from "../src/lib/resume-schema.js";

test("empty structured resume includes every PRD module", () => {
  assert.deepEqual(Object.keys(EMPTY_STRUCTURED_RESUME), [
    "basics",
    "education",
    "work",
    "projects",
    "skills",
    "optional",
    "meta",
  ]);
  assert.equal(EMPTY_STRUCTURED_RESUME.basics.job_target, "");
  assert.equal(EMPTY_STRUCTURED_RESUME.skills.skill_hard.length, 0);
});

test("normalizer maps legacy extraction fields into PRD schema names", () => {
  const resume = normalizeStructuredResumeV1({
    basics: { name: "张三", phone: "13800138000", targetRole: "产品经理", portfolioUrl: "https://example.com" },
    work: [{ organization: "A公司", title: "产品经理", description: "负责需求", bullets: ["上线功能"] }],
    skills: ["Axure", "SQL"],
  });
  assert.equal(resume.basics.name, "张三");
  assert.equal(resume.basics.job_target, "产品经理");
  assert.equal(resume.basics.portfolio_url, "https://example.com");
  assert.equal(resume.work[0].company, "A公司");
  assert.equal(resume.work[0].position, "产品经理");
  assert.equal(resume.work[0].job_content, "负责需求");
  assert.deepEqual(resume.work[0].job_result, ["上线功能"]);
  assert.deepEqual(resume.skills.skill_hard, ["Axure", "SQL"]);
});

test("legacy Markdown migration produces structured data and marks source", () => {
  const resume = migrateMarkdownToStructuredResumeV1(`# 张三\n\n## 个人信息\n- **电话**：13800138000\n- **邮箱**：zhangsan@example.com\n- **求职意向**：产品经理`);
  assert.equal(resume.basics.name, "张三");
  assert.equal(resume.basics.phone, "13800138000");
  assert.equal(resume.basics.email, "zhangsan@example.com");
  assert.equal(resume.basics.job_target, "产品经理");
  assert.equal(resume.meta.source, "markdown-migration");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/resume-schema.test.mjs`

Expected: FAIL because `src/lib/resume-schema.js` does not exist.

- [ ] **Step 3: Implement the schema module**

Create `src/lib/resume-schema.js` with a PRD-aligned canonical shape:

```js
const EMPTY_STRUCTURED_RESUME = {
  basics: { name: "", phone: "", email: "", location: "", job_target: "", avatar: "", portfolio_url: "" },
  education: [],
  work: [],
  projects: [],
  skills: { skill_hard: [], skill_soft: [], skill_level: [], certificate_list: [] },
  optional: { campus_exp: [], self_evaluation: [], manage_exp: [], political_status: "" },
  meta: { source: "empty", warnings: [] },
};

function normalizeStructuredResumeV1(input = {}) {
  // Implement field mapping from existing extraction names to PRD names.
}

function migrateMarkdownToStructuredResumeV1(markdown) {
  // Reuse existing fallback extraction logic, then normalize into PRD schema.
}

module.exports = { EMPTY_STRUCTURED_RESUME, normalizeStructuredResumeV1, migrateMarkdownToStructuredResumeV1 };
```

Use `src/lib/resume-structured-extraction.js` as the compatibility source for old extraction output. Do not store Markdown on the normalized object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/resume-schema.test.mjs`

Expected: PASS.

### Task 2: DeepSeek Model Router Scaffold

**Files:**

- Create: `src/lib/deepseek-model-router.js`
- Test: `test/deepseek-model-router.test.mjs`

- [ ] **Step 1: Write failing router tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { chooseDeepSeekModel } from "../src/lib/deepseek-model-router.js";

test("routes basic diagnosis to flash", () => {
  const decision = chooseDeepSeekModel({ scene: "diagnose_basic", textLength: 420, workItemCount: 1, userTier: "free" });
  assert.equal(decision.tier, "flash");
  assert.match(decision.reason, /basic/i);
});

test("routes deep JD optimization to pro", () => {
  const decision = chooseDeepSeekModel({ scene: "optimize_deep", textLength: 2200, workItemCount: 5, jdLength: 1800, userTier: "free" });
  assert.equal(decision.tier, "pro");
});

test("free users over pro quota downgrade to flash", () => {
  const decision = chooseDeepSeekModel({ scene: "optimize_deep", textLength: 2200, workItemCount: 5, userTier: "free", proQuotaRemaining: 0 });
  assert.equal(decision.tier, "flash");
  assert.equal(decision.downgraded, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/deepseek-model-router.test.mjs`

Expected: FAIL because router module does not exist.

- [ ] **Step 3: Implement routing decision service**

Create `chooseDeepSeekModel(input)` returning `{ tier, model, reason, downgraded }`. Use environment variables for model names:

- `DEEPSEEK_FLASH_MODEL`, default `deepseek-chat` until the provider exposes the exact Flash ID.
- `DEEPSEEK_PRO_MODEL`, default `deepseek-chat` until the provider exposes the exact Pro ID.

The router should be policy-complete even if both env defaults currently point to the same deployed model.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/deepseek-model-router.test.mjs`

Expected: PASS.

### Task 3: Template Catalog Domain

**Files:**

- Create: `src/lib/resume-templates.js`
- Test: `test/resume-templates.test.mjs`

- [ ] **Step 1: Write failing catalog tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATES,
  getResumeTemplate,
  normalizeResumeTemplateId,
} from "../src/lib/resume-templates.js";

test("catalog ships three mainstream templates with stable ids", () => {
  assert.deepEqual(RESUME_TEMPLATES.map((item) => item.id), ["classic", "modern", "executive"]);
  assert.equal(DEFAULT_TEMPLATE_ID, "classic");
});

test("each template has user-facing metadata and tags", () => {
  for (const template of RESUME_TEMPLATES) {
    assert.ok(template.name);
    assert.ok(template.description);
    assert.ok(template.tags.length >= 2);
    assert.ok(template.scenarios.length >= 1);
  }
});

test("unknown template ids fall back to the classic template", () => {
  assert.equal(normalizeResumeTemplateId("missing"), "classic");
  assert.equal(getResumeTemplate("missing").id, "classic");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/resume-templates.test.mjs`

Expected: FAIL because `src/lib/resume-templates.js` does not exist.

- [ ] **Step 3: Implement catalog**

Create `src/lib/resume-templates.js` with:

```js
const DEFAULT_TEMPLATE_ID = "classic";

const RESUME_TEMPLATES = [
  {
    id: "classic",
    name: "经典单栏",
    description: "ATS 友好，适合通用投递和网申上传。",
    tags: ["极简商务", "经典通用", "ATS友好"],
    scenarios: ["通用", "社招", "校招"],
    recommendedFor: ["fresh_graduate", "junior", "career_switcher", "senior"],
    layout: "single",
  },
  {
    id: "modern",
    name: "现代双栏",
    description: "左侧突出联系信息和技能，右侧呈现经历。",
    tags: ["现代", "信息密度高", "产品技术"],
    scenarios: ["社招", "外企双语", "通用"],
    recommendedFor: ["junior", "career_switcher"],
    layout: "two-column",
  },
  {
    id: "executive",
    name: "专业管理型",
    description: "强调职业摘要、核心成果和管理影响力。",
    tags: ["正式严谨", "成果导向", "中高阶"],
    scenarios: ["社招", "国企/公考", "通用"],
    recommendedFor: ["senior", "junior"],
    layout: "single-accent",
  },
];

function normalizeResumeTemplateId(value) {
  return RESUME_TEMPLATES.some((template) => template.id === value) ? value : DEFAULT_TEMPLATE_ID;
}

function getResumeTemplate(value) {
  const id = normalizeResumeTemplateId(value);
  return RESUME_TEMPLATES.find((template) => template.id === id) || RESUME_TEMPLATES[0];
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATES,
  getResumeTemplate,
  normalizeResumeTemplateId,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/resume-templates.test.mjs`

Expected: PASS.

### Task 4: Structured Template Rendering Helpers

**Files:**

- Create: `src/lib/resume-template-rendering.js`
- Test: `test/resume-template-rendering.test.mjs`

- [ ] **Step 1: Write failing rendering tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  getPreviewTemplateClasses,
  getTemplatePrintCss,
  buildStructuredResumeViewModel,
  renderTemplateExportHtml,
} from "../src/lib/resume-template-rendering.js";

const structuredResume = {
  basics: { name: "张三", phone: "13800138000", email: "zhangsan@example.com", location: "上海", job_target: "产品经理" },
  education: [],
  work: [{ company: "A公司", position: "产品经理", time_range: "2022.01-至今", job_content: "负责需求", job_result: ["上线 <AI> 功能"] }],
  projects: [],
  skills: { skill_hard: ["Axure"], skill_soft: [], skill_level: [], certificate_list: [] },
  optional: { campus_exp: [], self_evaluation: [], manage_exp: [], political_status: "" },
  meta: { source: "test", warnings: [] },
};

test("preview classes expose two-column template without forcing mobile two-column", () => {
  const classes = getPreviewTemplateClasses("modern");
  assert.match(classes.page, /bg-white/);
  assert.match(classes.body, /md:grid/);
});

test("print CSS is template-specific", () => {
  assert.match(getTemplatePrintCss("classic"), /border-bottom:2px solid #111827/);
  assert.match(getTemplatePrintCss("modern"), /grid-template-columns:210px 1fr/);
  assert.match(getTemplatePrintCss("executive"), /#1d4ed8/);
});

test("view model is built from structured fields", () => {
  const view = buildStructuredResumeViewModel(structuredResume);
  assert.equal(view.title, "张三");
  assert.deepEqual(view.contactItems, ["13800138000", "zhangsan@example.com", "上海", "产品经理"]);
  assert.equal(view.sections[0].title, "工作/实习经历");
});

test("export html contains selected template id and escaped structured content", () => {
  const html = renderTemplateExportHtml({ title: "测试", structuredResume, templateId: "executive" });
  assert.match(html, /data-template="executive"/);
  assert.match(html, /&lt;AI&gt;/);
  assert.doesNotMatch(html, /<AI>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/resume-template-rendering.test.mjs`

Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement pure rendering helpers**

Create helpers that return:

- `page`: shared A4 page classes.
- `header`: header classes.
- `body`: structured section body classes.
- `getTemplatePrintCss(templateId)`: print CSS for classic, modern, executive.
- `buildStructuredResumeViewModel(structuredResume)`: converts PRD Schema fields into renderable sections.
- `renderTemplateExportHtml({ title, structuredResume, templateId })`: escaped print HTML.

Use `src/lib/resume-schema.js` as the input contract. Do not parse Markdown inside template rendering except for a temporary caller-side migration path for old localStorage data.

- [ ] **Step 4: Run tests**

Run: `node --test test/resume-template-rendering.test.mjs test/resume-templates.test.mjs`

Expected: PASS.

### Task 5: Preview Component Template Support

**Files:**

- Modify: `src/components/resume-preview.tsx`
- Test: `test/mobile-responsive-layout.test.mjs`

- [ ] **Step 1: Add static test assertions**

Add checks that `ResumePreview` accepts `structuredResume` plus `templateId`, calls `buildStructuredResumeViewModel`, calls `getPreviewTemplateClasses`, and contains `md:grid` only for the modern template path so mobile remains single-column.

- [ ] **Step 2: Run targeted tests**

Run: `node --test test/mobile-responsive-layout.test.mjs`

Expected: FAIL until the component accepts the prop and helper call.

- [ ] **Step 3: Update component**

Change props to:

```ts
interface Props {
  structuredResume: StructuredResumeV1;
  title?: string;
  templateId?: string;
}
```

Inside `ResumePreview`, resolve a view model with `buildStructuredResumeViewModel(structuredResume)` and classes with `getPreviewTemplateClasses(templateId)`. Render sections from structured fields. For the modern template, render contact items and skills in a sidebar on desktop and stack them above content on mobile.

- [ ] **Step 4: Run tests**

Run: `node --test test/resume-preview-layout.test.mjs test/mobile-responsive-layout.test.mjs`

Expected: PASS.

### Task 6: Workbench Selector And Persistence

**Files:**

- Create: `src/components/resume-template-selector.tsx`
- Modify: `src/app/page.tsx`
- Test: `test/resume-templates.test.mjs`

- [ ] **Step 1: Add template state compatibility test**

Extend `test/resume-templates.test.mjs` to assert `normalizeResumeTemplateId` protects localStorage values.

- [ ] **Step 2: Implement selector component**

Use a compact button group or native select-like menu with visible labels from `RESUME_TEMPLATES`. Keep it dense because the app is a workbench, not a landing page.

- [ ] **Step 3: Update app state**

Add `templateId` and `structuredResume` to `ResumeState`, defaulting to `classic` and `EMPTY_STRUCTURED_RESUME`. On load, migrate legacy Markdown-only state with `migrateMarkdownToStructuredResumeV1`. Pass structured data to `ResumePreview` and `renderTemplateExportHtml`.

- [ ] **Step 4: Run tests**

Run: `node --test test/*.test.mjs`

Expected: all tests pass.

### Task 7: PDF Export Consistency

**Files:**

- Modify: `src/app/page.tsx`
- Test: `test/resume-template-rendering.test.mjs`

- [ ] **Step 1: Move export HTML generation out of `page.tsx`**

Replace the inline `escapeHtml(...).replace(...)` block with `renderTemplateExportHtml({ title: resume.title, structuredResume: resume.structuredResume, templateId: resume.templateId })`.

- [ ] **Step 2: Keep browser print behavior unchanged**

`downloadPdf()` should still `window.open`, write the HTML, close the document, then call `print()` after 300ms.

- [ ] **Step 3: Run tests and lint**

Run: `node --test test/*.test.mjs && npm run lint`

Expected: PASS.

### Task 8: API Structured Payload And Model Router Integration

**Files:**

- Modify: `src/app/api/import/route.ts`
- Modify: `src/app/api/diagnose/route.ts`
- Modify: `src/app/api/optimize/route.ts`
- Test: `test/resume-structured-extraction.test.mjs`
- Test: `test/deepseek-model-router.test.mjs`

- [ ] **Step 1: Normalize import output through PRD Schema**

In `/api/import`, pass model/fallback extraction through `normalizeStructuredResumeV1`. Return `structured` as the primary response. Keep `markdown` only as `compatMarkdown` or legacy response field while the UI migration is active.

- [ ] **Step 2: Change diagnose/optimize request builders**

Accept `structuredResume` in request bodies. Build AI prompts from structured fields and only migrate Markdown at the boundary when old clients call with `markdown` and no structured data.

- [ ] **Step 3: Route model selection**

Use `chooseDeepSeekModel` before each DeepSeek call. Include scene values such as `diagnose_basic`, `optimize_deep`, and `jd_match`. Return non-secret routing metadata in API responses: `{ modelTier, routingReason }`.

- [ ] **Step 4: Run tests**

Run: `node --test test/resume-structured-extraction.test.mjs test/deepseek-model-router.test.mjs`

Expected: PASS.

### Task 9: Browser Regression

**Files:**

- No product file changes unless QA finds a bug.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: app starts on an available localhost port.

- [ ] **Step 2: Use Chrome to verify flow**

Open localhost in Chrome. Log in or enter demo. Import `/Users/weijiahao/Downloads/个人简历-卫家豪.pdf`. Confirm the resume preview is formatted.

- [ ] **Step 3: Verify template switching**

Switch classic, modern, and executive. Confirm:

- no content disappears;
- modern stacks on mobile and becomes two-column on desktop;
- PDF export opens a print document using the selected template.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: PASS.

---

## Milestone 2 Structured Editor Direction

Extend `src/lib/resume-schema.js` and add form UI for the normalized model:

- `basics`: name, phone, email, location, job_target, avatar, portfolio_url.
- `education[]`: time_range, school, major, degree, gpa, courses, honors.
- `work[]`: time_range, company, position, job_content, job_result.
- `projects[]`: project_name, role, project_intro, duty, achievement.
- `skills`: skill_hard, skill_soft, skill_level, certificate_list.
- `optional`: campus_exp, self_evaluation, manage_exp, political_status.

AI APIs should use structured payloads directly. Markdown may remain only as a temporary import compatibility and debug preview projection.

## Milestone 3 Template Center Direction

Create `/templates` as a frontend catalog first. Use static metadata until admin exists:

- `src/app/templates/page.tsx`
- `src/components/template-card.tsx`
- `src/components/template-filter-bar.tsx`
- `src/lib/template-recommendation.js`

Do not fetch copied third-party template assets. Build original HTML/CSS templates based on mainstream categories and keep commercial font usage limited to system fonts or verified free commercial fonts.

## Milestone 4 Production Data Direction

Add Supabase tables after the editor model is stable:

- `resume_templates`
- `resume_template_tags`
- `resumes`
- `resume_versions`
- `diagnosis_records`
- `optimization_records`
- `export_records`

Use row-level security so users only read/write their own resumes. Admin-only endpoints need a role check before template CRUD.

## Acceptance Strategy

For Milestone 1, acceptance requires:

- Three templates selectable in the workbench.
- Selected template persists across reload.
- Resume state has canonical `structuredResume` and migrates legacy Markdown-only localStorage.
- Import, diagnosis, optimization, and export read structured data first.
- API responses expose non-secret model routing metadata for DeepSeek Flash/Pro decisions.
- Import, diagnosis, optimization, compare, and PDF export still work.
- PDF export uses the same selected template as preview.
- Mobile layout has no horizontal overflow.
- `node --test test/*.test.mjs`, `npm run lint`, and `npm run build` pass.

For full PRD V1.0, acceptance requires Milestones 1-4 plus 25 compliant templates, structured editing, recommendation, Word export, personal center, admin, and production data persistence.

## Key Risks And Controls

- **Scope risk:** PRD V1.0 is too large for one safe code pass. Control: milestone releases.
- **Copyright risk:** never copy competitor templates or paid template assets. Control: original CSS/HTML and documented font choices.
- **ATS risk:** two-column templates can parse worse. Control: classic single-column as default and export warning for ATS-sensitive usage.
- **Data loss risk:** structure migration can drop fields. Control: test legacy Markdown migration and preserve compatibility projection until structured editor is stable.
- **Model availability risk:** exact DeepSeek V4 Flash/Pro model IDs may differ from PRD assumptions. Control: route by policy now, configure actual model IDs through environment variables when provider IDs are confirmed.
- **Export risk:** Word export adds layout complexity. Control: stabilize PDF first; add Word only after template HTML model is proven.

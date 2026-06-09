import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_STRUCTURED_RESUME,
  normalizeStructuredResumeV1,
  migrateMarkdownToStructuredResumeV1,
  renderStructuredResumeV1Markdown,
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
    basics: {
      name: "张三",
      phone: "13800138000",
      email: "zhangsan@example.com",
      targetRole: "产品经理",
      portfolioUrl: "https://example.com",
    },
    work: [{ organization: "A公司", title: "产品经理", description: "负责需求", bullets: ["上线功能"] }],
    projects: [{ name: "AI项目", role: "负责人", description: "搭建平台", bullets: ["节省时间"] }],
    skills: ["Axure", "SQL"],
  });

  assert.equal(resume.basics.name, "张三");
  assert.equal(resume.basics.job_target, "产品经理");
  assert.equal(resume.basics.portfolio_url, "https://example.com");
  assert.equal(resume.work[0].company, "A公司");
  assert.equal(resume.work[0].position, "产品经理");
  assert.equal(resume.work[0].job_content, "负责需求");
  assert.deepEqual(resume.work[0].job_result, ["上线功能"]);
  assert.equal(resume.projects[0].project_name, "AI项目");
  assert.deepEqual(resume.projects[0].achievement, ["节省时间"]);
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

test("legacy Markdown migration preserves PRD work and skill section aliases", () => {
  const resume = migrateMarkdownToStructuredResumeV1(`# 张三\n\n## 工作/实习经历\n### A公司｜产品经理｜2022.01-至今\n- 负责需求分析和版本规划\n- 上线核心功能，提升转化率 12%\n\n## 专业技能\n- Axure\n- SQL`);

  assert.equal(resume.work.length, 1);
  assert.equal(resume.work[0].company, "A公司");
  assert.equal(resume.work[0].position, "产品经理");
  assert.deepEqual(resume.work[0].job_result, ["负责需求分析和版本规划", "上线核心功能，提升转化率 12%"]);
  assert.deepEqual(resume.skills.skill_hard, ["Axure", "SQL"]);
});

test("structured resume can render a compatibility markdown projection", () => {
  const markdown = renderStructuredResumeV1Markdown(normalizeStructuredResumeV1({
    basics: { name: "张三", phone: "13800138000", targetRole: "产品经理" },
    work: [{ company: "A公司", position: "产品经理", job_content: "负责需求", job_result: ["上线功能"] }],
    skills: { skill_hard: ["Axure"], skill_soft: ["沟通"], certificate_list: ["PMP"] },
  }));

  assert.match(markdown, /^# 张三/m);
  assert.match(markdown, /## 个人信息/);
  assert.match(markdown, /## 工作\/实习经历/);
  assert.match(markdown, /- 上线功能/);
  assert.match(markdown, /## 专业技能/);
  assert.match(markdown, /- Axure/);
});

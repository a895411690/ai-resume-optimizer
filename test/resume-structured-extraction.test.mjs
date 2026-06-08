import assert from "node:assert/strict";
import test from "node:test";
import extraction from "../src/lib/resume-structured-extraction.js";

const {
  buildFallbackStructuredResume,
  normalizeStructuredResume,
  renderStructuredResumeMarkdown,
} = extraction;

test("normalizes model extracted resume entities into stable structured data", () => {
  const structured = normalizeStructuredResume({
    basics: {
      name: "张三",
      phone: "13800138000",
      email: "zhangsan@example.com",
      location: "上海",
      targetRole: "产品经理",
    },
    education: [
      { school: "复旦大学", degree: "本科", major: "计算机科学", startDate: "2020-09", endDate: "2024/06" },
    ],
    work: [
      { organization: "某科技公司", title: "产品经理", startDate: "2024年07月", endDate: "至今", bullets: ["负责增长转化分析"] },
    ],
    projects: [
      { name: "会员转化提升项目", role: "项目负责人", startDate: "2023.03", endDate: "2023.08", bullets: ["推动页面迭代"] },
    ],
    skills: ["SQL", "用户研究", "Axure"],
  });

  assert.equal(structured.basics.name, "张三");
  assert.equal(structured.basics.email, "zhangsan@example.com");
  assert.equal(structured.education[0].startDate, "2020.09");
  assert.equal(structured.education[0].endDate, "2024.06");
  assert.equal(structured.work[0].startDate, "2024.07");
  assert.equal(structured.skills.length, 3);
});

test("renders structured resume data into mainstream markdown sections", () => {
  const markdown = renderStructuredResumeMarkdown(normalizeStructuredResume({
    basics: { name: "张三", phone: "13800138000", email: "zhangsan@example.com", targetRole: "产品经理" },
    education: [{ school: "复旦大学", degree: "本科", major: "计算机科学", startDate: "2020.09", endDate: "2024.06" }],
    projects: [{ name: "会员转化提升项目", role: "产品经理", startDate: "2023.03", endDate: "2023.08", bullets: ["负责用户访谈，输出页面优化建议"] }],
    skills: ["SQL", "用户研究"],
  }));

  assert.match(markdown, /^# 张三/m);
  assert.match(markdown, /^## 个人信息/m);
  assert.match(markdown, /^- \*\*电话\*\*：13800138000/m);
  assert.match(markdown, /^## 教育经历/m);
  assert.match(markdown, /^### 复旦大学｜本科｜计算机科学｜2020\.09 - 2024\.06/m);
  assert.match(markdown, /^## 项目经历/m);
  assert.match(markdown, /^### 会员转化提升项目｜产品经理｜2023\.03 - 2023\.08/m);
  assert.match(markdown, /^## 技能/m);
  assert.match(markdown, /^- SQL/m);
});

test("builds fallback structured resume from plain extracted text without inventing facts", () => {
  const structured = buildFallbackStructuredResume(`姓名：李四
电话：13900139000
邮箱：lisi@example.com
教育经历
北京大学 本科 信息管理 2018.09 - 2022.06
项目经历
数据看板项目
负责 SQL 指标核对和报表维护`);

  assert.equal(structured.basics.name, "李四");
  assert.equal(structured.basics.phone, "13900139000");
  assert.equal(structured.basics.email, "lisi@example.com");
  assert.ok(structured.education.some((item) => item.school === "北京大学"));
  assert.ok(structured.projects.some((item) => item.name.includes("数据看板")));
  assert.equal(structured.meta.source, "fallback-rules");
});

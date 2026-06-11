import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildResumeWordDocument,
  getResumeWordFileName,
  getWordTemplateProfile,
} from "../src/lib/resume-word-export.js";

class FakeDocument {
  constructor(options) {
    this.kind = "Document";
    this.options = options;
  }
}

class FakeParagraph {
  constructor(options) {
    this.kind = "Paragraph";
    this.options = options;
  }
}

class FakeTextRun {
  constructor(options) {
    this.kind = "TextRun";
    this.options = options;
  }
}

class FakeTable {
  constructor(options) {
    this.kind = "Table";
    this.options = options;
  }
}

class FakeTableRow {
  constructor(options) {
    this.kind = "TableRow";
    this.options = options;
  }
}

class FakeTableCell {
  constructor(options) {
    this.kind = "TableCell";
    this.options = options;
  }
}

const fakeDocx = {
  AlignmentType: { CENTER: "center", LEFT: "left" },
  BorderStyle: { NONE: "none", SINGLE: "single" },
  Document: FakeDocument,
  Paragraph: FakeParagraph,
  Table: FakeTable,
  TableCell: FakeTableCell,
  TableRow: FakeTableRow,
  TextRun: FakeTextRun,
  WidthType: { PERCENTAGE: "pct" },
};

const structuredResume = {
  basics: { name: "张三/产品", phone: "13800138000", email: "zhangsan@example.com", location: "上海", job_target: "产品经理" },
  education: [{ school: "A大学", degree: "本科", major: "计算机", time_range: "2018-2022", courses: ["数据结构"], honors: [] }],
  work: [{ company: "A公司", position: "产品经理", time_range: "2022-至今", job_content: "负责需求分析", job_result: ["上线核心功能"] }],
  projects: [{ project_name: "增长项目", role: "负责人", project_intro: "提升转化", duty: "设计方案", achievement: ["转化提升"] }],
  skills: { skill_hard: ["Axure", "SQL"], skill_soft: ["沟通"], skill_level: [], certificate_list: ["PMP"] },
  optional: { self_evaluation: ["结果导向"], campus_exp: [], manage_exp: [], political_status: "" },
  meta: {},
};

const customOrderedResume = {
  ...structuredResume,
  optional: { self_evaluation: ["结果导向"], campus_exp: ["学生会负责人"], manage_exp: ["带领 10 人团队"], political_status: "" },
  meta: { sectionOrder: ["basics", "optional", "work", "projects", "skills", "education"] },
};

test("word template profiles map catalog layouts into export profiles", () => {
  assert.equal(getWordTemplateProfile("classic").layout, "single");
  assert.equal(getWordTemplateProfile("modern").isTwoColumn, true);
  assert.equal(getWordTemplateProfile("executive").isAccent, true);
  assert.equal(getWordTemplateProfile("missing").id, "classic");
});

test("word file names are sanitized from resume names", () => {
  assert.equal(getResumeWordFileName(structuredResume), "张三产品.docx");
  assert.equal(getResumeWordFileName({ basics: { name: "" } }), "简历.docx");
});

test("two-column templates build a table-based editable Word document", () => {
  const doc = buildResumeWordDocument({ docx: fakeDocx, structuredResume, templateId: "modern" });
  const children = doc.options.sections[0].children;

  assert.equal(doc.kind, "Document");
  assert.equal(children[0].kind, "Table");
  assert.equal(children[0].options.rows[0].options.children.length, 2);
});

test("single and accent templates keep resume sections in document body", () => {
  const singleDoc = buildResumeWordDocument({ docx: fakeDocx, structuredResume, templateId: "classic" });
  const accentDoc = buildResumeWordDocument({ docx: fakeDocx, structuredResume, templateId: "executive" });
  const singleText = JSON.stringify(singleDoc);
  const accentText = JSON.stringify(accentDoc);

  assert.equal(singleText.includes("工作/实习经历"), true);
  assert.equal(singleText.includes("专业技能"), true);
  assert.match(accentText, /1d4ed8/i);
});

test("word export follows editor section order for optional information", () => {
  const doc = buildResumeWordDocument({ docx: fakeDocx, structuredResume: customOrderedResume, templateId: "classic" });
  const text = JSON.stringify(doc);

  assert.ok(text.indexOf("自我评价") < text.indexOf("工作/实习经历"));
  assert.ok(text.indexOf("校园经历") < text.indexOf("工作/实习经历"));
  assert.ok(text.indexOf("团队管理") < text.indexOf("工作/实习经历"));
});

test("page word export delegates document construction to the helper", () => {
  const source = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /buildResumeWordDocument/);
  assert.match(source, /getResumeWordFileName/);
  assert.doesNotMatch(source, /const addSection =/);
});

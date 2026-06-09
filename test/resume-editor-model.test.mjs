import test from "node:test";
import assert from "node:assert/strict";
import {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  updateBasicsField,
  updateOptionalField,
  updateSkillsField,
} from "../src/lib/resume-editor-model.js";
import { normalizeStructuredResumeV1 } from "../src/lib/resume-schema.js";

const baseResume = normalizeStructuredResumeV1({
  basics: { name: "张三", phone: "13800138000", targetRole: "产品经理" },
  projects: [{ name: "AI项目", role: "负责人", bullets: ["上线功能"] }],
  skills: { skill_hard: ["Axure"], certificate_list: ["PMP"] },
});

test("updates a basics field without mutating other modules", () => {
  const next = updateBasicsField(baseResume, "email", "zhangsan@example.com");

  assert.equal(next.basics.email, "zhangsan@example.com");
  assert.equal(baseResume.basics.email, "");
  assert.deepEqual(next.projects, baseResume.projects);
  assert.deepEqual(next.skills, baseResume.skills);
});

test("adds updates and removes work items without losing projects and skills", () => {
  const withWork = addArrayItem(baseResume, "work");
  assert.equal(withWork.work.length, 1);

  const updated = updateArrayItem(withWork, "work", 0, {
    company: "A公司",
    position: "产品经理",
    job_content: "负责需求分析",
    job_result: ["上线核心功能"],
  });
  assert.equal(updated.work[0].company, "A公司");
  assert.equal(updated.work[0].position, "产品经理");
  assert.deepEqual(updated.projects, baseResume.projects);
  assert.deepEqual(updated.skills, baseResume.skills);

  const removed = removeArrayItem(updated, "work", 0);
  assert.equal(removed.work.length, 0);
  assert.deepEqual(removed.projects, baseResume.projects);
});

test("skills fields accept multiline text and arrays", () => {
  const next = updateSkillsField(baseResume, "skill_hard", "Axure\nSQL\n数据分析");
  assert.deepEqual(next.skills.skill_hard, ["Axure", "SQL", "数据分析"]);

  const certificates = updateSkillsField(next, "certificate_list", ["PMP", "CET-6"]);
  assert.deepEqual(certificates.skills.certificate_list, ["PMP", "CET-6"]);
});

test("optional fields support campus management and political status", () => {
  const campus = updateOptionalField(baseResume, "campus_exp", "学生会负责人\n校赛一等奖");
  const management = updateOptionalField(campus, "manage_exp", ["管理 5 人项目小组"]);
  const political = updateOptionalField(management, "political_status", "共青团员");

  assert.deepEqual(political.optional.campus_exp, ["学生会负责人", "校赛一等奖"]);
  assert.deepEqual(political.optional.manage_exp, ["管理 5 人项目小组"]);
  assert.equal(political.optional.political_status, "共青团员");
});

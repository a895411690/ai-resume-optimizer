import test from "node:test";
import assert from "node:assert/strict";
import {
  deserializeResumeFromDatabase,
  getResumeStateAfterCloudDelete,
  saveResumeWithPersistence,
  serializeResumeForDatabase,
} from "../src/lib/resume-persistence.js";
import { EMPTY_STRUCTURED_RESUME } from "../src/lib/resume-schema.js";

const baseResume = {
  title: "产品经理简历",
  position: "产品经理",
  original_content: "# 张三\n\n## 个人信息\n- **电话**：13800138000\n- **邮箱**：zhangsan@example.com\n- **求职意向**：产品经理",
  optimized_content: "",
  structuredResume: {
    ...EMPTY_STRUCTURED_RESUME,
    basics: { ...EMPTY_STRUCTURED_RESUME.basics, name: "张三", phone: "13800138000", email: "zhangsan@example.com", job_target: "产品经理" },
  },
  optimizedStructuredResume: null,
  templateId: "modern",
};

test("serializes current resume state into a database payload", () => {
  const payload = serializeResumeForDatabase({
    resume: baseResume,
    user: { id: "user-1", email: "u@example.com" },
    currentResumeId: "resume-1",
    userType: "junior",
    workflowMode: "professional",
    strength: "strong",
    diagnosis: { overallScore: 82 },
    optimization: { editSummary: ["强化岗位匹配"] },
    jdText: "负责产品规划",
  });

  assert.equal(payload.id, "resume-1");
  assert.equal(payload.user_id, "user-1");
  assert.equal(payload.title, "产品经理简历");
  assert.equal(payload.position, "产品经理");
  assert.equal(payload.template_id, "modern");
  assert.equal(payload.user_type, "junior");
  assert.equal(payload.workflow_mode, "professional");
  assert.equal(payload.strength, "strong");
  assert.equal(payload.target_jd, "负责产品规划");
  assert.equal(payload.structured_resume.basics.name, "张三");
  assert.equal(payload.diagnosis.overallScore, 82);
});

test("deserializes legacy markdown-only rows into structured resume state", () => {
  const result = deserializeResumeFromDatabase({
    id: "legacy-1",
    title: "旧简历",
    position: "测试工程师",
    original_content: "# 李四\n\n## 个人信息\n- **电话**：13900139000\n- **邮箱**：lisi@example.com\n- **求职意向**：测试工程师",
    optimized_content: "",
    template_id: null,
    structured_resume: null,
    optimized_structured_resume: null,
    target_jd: "",
  });

  assert.equal(result.id, "legacy-1");
  assert.equal(result.resume.title, "旧简历");
  assert.equal(result.resume.templateId, "classic");
  assert.equal(result.resume.structuredResume.basics.name, "李四");
  assert.equal(result.resume.structuredResume.basics.phone, "13900139000");
});

test("invalid template ids fall back to the classic template", () => {
  const result = deserializeResumeFromDatabase({
    id: "row-1",
    title: "简历",
    position: "",
    original_content: "# 王五\n\n## 个人信息\n- **电话**：13800138000",
    optimized_content: "",
    template_id: "unknown-template",
    structured_resume: null,
  });

  assert.equal(result.resume.templateId, "classic");
});

test("deleting the currently opened cloud resume resets the local resume state", () => {
  const next = getResumeStateAfterCloudDelete({
    deletedResumeId: "resume-1",
    currentResumeId: "resume-1",
    emptyResume: { title: "我的简历" },
    currentResume: baseResume,
  });

  assert.equal(next.currentResumeId, null);
  assert.deepEqual(next.resume, { title: "我的简历" });
});

test("demo mode save writes local storage without calling Supabase", async () => {
  let localSaved = null;
  let cloudCalled = false;
  const result = await saveResumeWithPersistence({
    isDemo: true,
    resume: baseResume,
    saveLocal: (resume) => {
      localSaved = resume;
    },
    saveCloud: async () => {
      cloudCalled = true;
      return { id: "cloud-1" };
    },
  });

  assert.equal(result.mode, "local");
  assert.equal(localSaved.title, "产品经理简历");
  assert.equal(cloudCalled, false);
});

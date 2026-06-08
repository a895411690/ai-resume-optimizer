import assert from "node:assert/strict";
import test from "node:test";
import contract from "../src/lib/ai-resume-contract.js";

const {
  buildFallbackDiagnosis,
  buildFallbackOptimization,
  normalizeUserType,
  safeParseJsonObject,
} = contract;

test("normalizes auto-detected and known career stages", () => {
  assert.equal(normalizeUserType("auto"), "auto");
  assert.equal(normalizeUserType("career_switcher"), "career_switcher");
  assert.equal(normalizeUserType("unexpected"), "auto");
});

test("parses json objects from plain or fenced model output", () => {
  assert.deepEqual(safeParseJsonObject('{"overallScore":82}'), { overallScore: 82 });
  assert.deepEqual(safeParseJsonObject('```json\n{"optimizedMarkdown":"# A"}\n```'), {
    optimizedMarkdown: "# A",
  });
});

test("builds a structured fallback diagnosis without inventing facts", () => {
  const diagnosis = buildFallbackDiagnosis({
    markdown: "# 张三\n\n## 项目经历\n负责增长活动",
    userType: "fresh_graduate",
    targetRole: "产品经理",
    jdText: "需要数据分析、用户研究",
  });

  assert.equal(diagnosis.userType, "fresh_graduate");
  assert.equal(diagnosis.jdMatch.enabled, true);
  assert.equal(typeof diagnosis.overallScore, "number");
  assert.ok(diagnosis.topIssues.length > 0);
  assert.ok(diagnosis.riskNotes.some((note) => note.includes("不确定") || note.includes("补充")));
});

test("builds structured fallback optimization with confirmation markers", () => {
  const optimization = buildFallbackOptimization({
    markdown: "# 张三\n\n## 工作经历\n负责运营报表",
    diagnosis: buildFallbackDiagnosis({
      markdown: "# 张三\n\n## 工作经历\n负责运营报表",
      userType: "junior",
      targetRole: "数据分析师",
      jdText: "",
    }),
    strength: "strong",
    targetRole: "数据分析师",
  });

  assert.match(optimization.optimizedMarkdown, /\[请补充/);
  assert.ok(optimization.editSummary.length > 0);
  assert.ok(optimization.editExplanations.some((item) => item.requiresUserConfirmation));
});

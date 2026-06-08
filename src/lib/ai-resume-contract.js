const VALID_USER_TYPES = new Set([
  "auto",
  "fresh_graduate",
  "junior",
  "career_switcher",
  "senior",
]);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeResumeMarkdown } = require("./resume-formatting.js");

const USER_TYPE_LABELS = {
  auto: "AI 自动判断",
  fresh_graduate: "应届生",
  junior: "1-3 年职场人",
  career_switcher: "转行求职者",
  senior: "中高级人才",
};

const STRENGTH_LABELS = {
  conservative: "保守润色",
  professional: "专业增强",
  strong: "强岗位匹配包装",
};

function normalizeUserType(userType) {
  return VALID_USER_TYPES.has(userType) ? userType : "auto";
}

function detectUserType(markdown) {
  const text = String(markdown || "");
  if (/应届|校园|课程|竞赛|学生会|社团|毕业|本科|硕士|研究生/.test(text)) return "fresh_graduate";
  if (/转行|跨行|转型|目标岗位|迁移/.test(text)) return "career_switcher";
  if (/负责人|管理|团队|战略|预算|架构|总监|高级|专家/.test(text)) return "senior";
  return "junior";
}

function safeParseJsonObject(content) {
  if (!content || typeof content !== "string") return null;
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [stripped];
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(stripped.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
}

function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 65;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function pickIssueFocus(userType) {
  const normalized = normalizeUserType(userType);
  if (normalized === "fresh_graduate") return ["项目/校园经历证据", "技能清晰度", "岗位相关性"];
  if (normalized === "career_switcher") return ["可迁移能力", "目标岗位关键词", "转型叙事"];
  if (normalized === "senior") return ["业务影响", "团队/项目规模", "决策复杂度"];
  return ["职责与贡献区分", "量化成果", "专业关键词"];
}

function extractKeywords(text) {
  return Array.from(
    new Set(
      String(text || "")
        .split(/[\s,，。；;、/|｜:：()（）\[\]【】]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length <= 18)
        .slice(0, 24)
    )
  );
}

function buildFallbackDiagnosis({ markdown, userType, targetRole, jdText }) {
  const selectedType = normalizeUserType(userType);
  const resolvedType = selectedType === "auto" ? detectUserType(markdown) : selectedType;
  const text = String(markdown || "").trim();
  const jd = String(jdText || "").trim();
  const issueFocus = pickIssueFocus(resolvedType);
  const hasMetrics = /\d+[%％]|\d+\s*(人|万|千|次|个|项|小时|天|月|年)/.test(text);
  const hasSections = /^#{1,3}\s+/m.test(text);
  const hasContact = /邮箱|电话|手机|email|mail|@/.test(text);
  const baseScore = 58 + Math.min(18, Math.floor(text.length / 180)) + (hasSections ? 6 : 0) + (hasMetrics ? 8 : 0);
  const jdKeywords = extractKeywords(jd);
  const matchedKeywords = jdKeywords.filter((keyword) => text.includes(keyword)).slice(0, 12);
  const missingKeywords = jdKeywords.filter((keyword) => !text.includes(keyword)).slice(0, 12);

  const topIssues = [
    {
      severity: hasMetrics ? "medium" : "high",
      section: issueFocus[1],
      originalExcerpt: text.slice(0, 90) || "简历正文为空",
      problem: hasMetrics ? "已有部分量化信息，但缺少上下文、口径或业务结果解释。" : "经历描述偏任务清单，缺少可验证的结果、规模或影响。",
      suggestion: "只补充真实存在的数据；不确定的数据使用 [请补充具体数据] 标记后再确认。",
    },
    {
      severity: jd ? "medium" : "low",
      section: issueFocus[2],
      originalExcerpt: targetRole || "未填写目标岗位",
      problem: jd ? "目标 JD 中的部分关键词尚未在简历中形成证据闭环。" : "缺少完整 JD 时，只能按目标岗位做通用匹配。",
      suggestion: "围绕目标岗位补充已有项目、工具、方法和成果证据，避免声明未实际掌握的技能。",
    },
  ];

  if (!hasContact) {
    topIssues.unshift({
      severity: "medium",
      section: "基础信息",
      originalExcerpt: text.slice(0, 60) || "未检测到联系方式",
      problem: "未检测到明确联系方式，投递简历可能影响 HR 联系效率。",
      suggestion: "补充电话、邮箱等必要联系信息。",
    });
  }

  return {
    userType: resolvedType,
    userTypeReason: selectedType === "auto"
      ? `根据简历中的关键词和经历层级，暂按「${USER_TYPE_LABELS[resolvedType]}」评估。`
      : `用户选择了「${USER_TYPE_LABELS[resolvedType]}」，诊断标准按该阶段调整。`,
    overallScore: clampScore(baseScore),
    dimensionScores: [
      { name: "role_fit", score: jd ? clampScore(62 + matchedKeywords.length * 3) : 64, reason: jd ? "依据 JD 关键词与简历证据重合度估算。" : "未提供完整 JD，按目标岗位做基础评估。" },
      { name: "evidence_strength", score: hasMetrics ? 76 : 52, reason: hasMetrics ? "检测到部分量化信息，仍需补充口径。" : "缺少具体成果、规模或影响数据。" },
      { name: "structure_clarity", score: hasSections ? 78 : 56, reason: hasSections ? "已具备基础 Markdown 层级。" : "建议使用清晰章节组织内容。" },
    ],
    topIssues: topIssues.slice(0, 5),
    jdMatch: {
      enabled: Boolean(jd),
      matchScore: jd ? clampScore(55 + matchedKeywords.length * 4 - missingKeywords.length) : 0,
      hardRequirements: jdKeywords.slice(0, 6),
      matchedKeywords,
      missingKeywords,
      recommendations: jd
        ? missingKeywords.slice(0, 4).map((keyword) => `如简历事实支持，请补充与「${keyword}」相关的项目或成果证据。`)
        : ["粘贴完整 JD 后可生成硬性要求、关键词和缺口分析。"],
    },
    riskNotes: [
      "AI 不应补写不确定的公司、学校、证书、日期、头衔或成果数据。",
      "所有未在原文出现的指标都需要使用 [请补充具体数据] 后由用户确认。",
    ],
  };
}

function normalizeDiagnosis(value, fallbackInput) {
  const fallback = buildFallbackDiagnosis(fallbackInput);
  if (!value || typeof value !== "object") return fallback;
  return {
    ...fallback,
    ...value,
    userType: normalizeUserType(value.userType) === "auto" ? fallback.userType : value.userType,
    overallScore: clampScore(value.overallScore ?? fallback.overallScore),
    dimensionScores: Array.isArray(value.dimensionScores) ? value.dimensionScores : fallback.dimensionScores,
    topIssues: Array.isArray(value.topIssues) ? value.topIssues.slice(0, 5) : fallback.topIssues,
    jdMatch: value.jdMatch && typeof value.jdMatch === "object" ? { ...fallback.jdMatch, ...value.jdMatch } : fallback.jdMatch,
    riskNotes: normalizeStringArray(value.riskNotes).length ? normalizeStringArray(value.riskNotes) : fallback.riskNotes,
  };
}

function buildFallbackOptimization({ markdown, diagnosis, strength, targetRole }) {
  const text = normalizeResumeMarkdown(markdown);
  const selectedStrength = STRENGTH_LABELS[strength] ? strength : "professional";
  const roleLine = targetRole ? `\n\n> 目标岗位：${targetRole}` : "";
  const optimizedMarkdown = normalizeResumeMarkdown(`${text || "# 我的简历"}${roleLine}

## 待确认补充
- 请补充最能证明岗位匹配度的 2-3 个真实成果数据：[请补充具体数据]
- 请确认是否有与目标岗位直接相关的工具、方法或项目证据：[请补充具体信息]
`);

  return {
    optimizedMarkdown,
    editSummary: [
      `按「${STRENGTH_LABELS[selectedStrength]}」生成可信优化草稿。`,
      "保留原始事实，未自动编造指标、公司、学校、证书或项目名称。",
      "将缺失但关键的信息集中标记为待确认项。",
    ],
    editExplanations: [
      {
        originalExcerpt: text.slice(0, 90) || "空白简历",
        revisedExcerpt: "补充了待确认信息区，避免 AI 直接编造经历或成果。",
        reason: diagnosis?.topIssues?.[0]?.suggestion || "当前简历缺少可验证的岗位匹配证据。",
        requiresUserConfirmation: true,
        confirmationPrompt: "请补充真实数据或删除该占位符后再导出投递版。",
      },
    ],
    riskNotes: [
      "含 [请补充具体数据] 的内容不能直接投递，需要用户确认。",
      ...(Array.isArray(diagnosis?.riskNotes) ? diagnosis.riskNotes : []),
    ],
  };
}

function normalizeOptimization(value, fallbackInput) {
  const fallback = buildFallbackOptimization(fallbackInput);
  if (!value || typeof value !== "object") return fallback;
  const optimizedMarkdown = normalizeResumeMarkdown(value.optimizedMarkdown || "");
  return {
    optimizedMarkdown: optimizedMarkdown
      ? optimizedMarkdown
      : fallback.optimizedMarkdown,
    editSummary: normalizeStringArray(value.editSummary).length ? normalizeStringArray(value.editSummary) : fallback.editSummary,
    editExplanations: Array.isArray(value.editExplanations) ? value.editExplanations : fallback.editExplanations,
    riskNotes: normalizeStringArray(value.riskNotes).length ? normalizeStringArray(value.riskNotes) : fallback.riskNotes,
  };
}

module.exports = {
  USER_TYPE_LABELS,
  STRENGTH_LABELS,
  buildFallbackDiagnosis,
  buildFallbackOptimization,
  normalizeDiagnosis,
  normalizeOptimization,
  normalizeUserType,
  safeParseJsonObject,
};

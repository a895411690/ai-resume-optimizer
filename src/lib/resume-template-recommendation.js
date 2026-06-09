// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RESUME_TEMPLATES } = require("./resume-templates.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeStructuredResumeV1 } = require("./resume-schema.js");

const ROLE_KEYWORD_PATTERN = /产品|数据|技术|研发|工程|运营/;

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getTemplateRecommendationContext({ userType = "auto", targetRole = "", structuredResume = {} } = {}) {
  const resume = normalizeStructuredResumeV1(structuredResume);
  const explicitRole = stringValue(targetRole);
  const schemaRole = stringValue(resume.basics.job_target);
  const resolvedRole = explicitRole || schemaRole;
  return {
    userType: stringValue(userType) || "auto",
    targetRole: resolvedRole,
    keywordText: [resolvedRole, resume.basics.location, ...resume.skills.skill_hard, ...resume.skills.skill_soft].filter(Boolean).join(" "),
  };
}

function recommendationReason(template, context) {
  if (template.id === "executive" && context.userType === "senior") {
    return "中高级人才优先突出管理影响力、关键成果和正式职业形象。";
  }
  if (template.id === "classic" && context.userType === "fresh_graduate") {
    return "应届生和校招投递更需要 ATS 友好、结构清晰的通用版式。";
  }
  if (template.id === "modern" && ROLE_KEYWORD_PATTERN.test(context.keywordText)) {
    return "产品、数据、技术和运营岗位适合信息密度更高的现代双栏模板。";
  }
  if (template.id === "classic") return "经典单栏兼容多数岗位和网申系统，适合作为稳妥默认模板。";
  if (template.id === "modern") return "现代双栏适合突出技能、联系方式和项目经历。";
  return "专业管理型适合强调成果、经验规模和职业稳定性。";
}

function priorityForTemplate(template, context, index) {
  if (context.userType === "senior" && template.id === "executive") return -30;
  if (context.userType === "fresh_graduate" && template.id === "classic") return -30;
  if (ROLE_KEYWORD_PATTERN.test(context.keywordText) && template.id === "modern") return -25;
  return index;
}

function recommendResumeTemplates({ userType = "auto", targetRole = "", structuredResume = {}, templates = RESUME_TEMPLATES } = {}) {
  const context = getTemplateRecommendationContext({ userType, targetRole, structuredResume });
  return templates
    .map((template, index) => ({
      templateId: template.id,
      reason: recommendationReason(template, context),
      priority: priorityForTemplate(template, context, index),
      index,
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ templateId, reason }) => ({ templateId, reason }));
}

module.exports = {
  getTemplateRecommendationContext,
  recommendResumeTemplates,
};

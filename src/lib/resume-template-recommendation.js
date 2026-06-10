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
  const userType = context.userType;
  const keywords = context.keywordText;
  const role = context.targetRole;
  const scenarios = template.scenarios;
  const layout = template.preview.layout;

  if (userType === "senior" && scenarios.includes("社招") && layout === "single-accent") {
    return "中高级人才优先突出管理影响力、关键成果和正式职业形象。";
  }
  if (userType === "fresh_graduate" && scenarios.includes("校招")) {
    return "应届生和校招投递更适合突出校园经历、项目潜力和学习能力的模板。";
  }
  if (userType === "career_switcher" && template.tags.some(t => /转行|迁移/.test(t))) {
    return "转行求职者适合突出迁移能力和连贯职业叙事的模板。";
  }
  if (ROLE_KEYWORD_PATTERN.test(keywords) && layout === "two-column") {
    return "产品、数据、技术和运营岗位适合信息密度更高的双栏模板。";
  }
  if (/金融|财务|审计/.test(role) && scenarios.includes("社招")) {
    return "金融/财务类岗位需要正式严谨的版式，突出专业资质和数据。";
  }
  if (/设计|视觉|UI|UX|交互/.test(role)) {
    return "设计类岗位适合视觉导向、配色灵活的模板，突出作品和审美。";
  }
  if (/国企|公务员|事业单位|公考/.test(role) && scenarios.includes("国企/公考")) {
    return "国企/公考场景需要正式规范版式，支持政治面貌等特殊字段。";
  }
  if (/外企|英文|海外|双语/.test(role) && scenarios.includes("外企双语")) {
    return "外企和海外岗位投递适合国际化版式，双语友好。";
  }
  if (scenarios.includes("通用")) {
    return `${template.name}兼容多数岗位和网申系统，版式${layout === "two-column" ? "信息密度高" : "结构清晰"}，适合作为稳妥选择。`;
  }
  return `${template.name}适合${template.audience[0] || "通用求职"}场景，${template.strengths[0] || "版式专业"}。`;
}

function priorityForTemplate(template, context, index) {
  const userType = context.userType;
  const keywords = context.keywordText;
  const role = context.targetRole;
  const scenarios = template.scenarios;
  const layout = template.preview.layout;

  if (userType === "senior" && layout === "single-accent" && scenarios.includes("社招")) return -30;
  if (userType === "fresh_graduate" && scenarios.includes("校招")) return -28;
  if (userType === "career_switcher" && template.tags.some(t => /转行|迁移/.test(t))) return -27;
  if (/金融|财务|审计/.test(role) && scenarios.includes("社招") && layout === "single-accent") return -26;
  if (/设计|视觉|UI|UX|交互/.test(role)) return -25;
  if (/国企|公务员|事业单位|公考/.test(role) && scenarios.includes("国企/公考")) return -24;
  if (/外企|英文|海外|双语/.test(role) && scenarios.includes("外企双语")) return -23;
  if (ROLE_KEYWORD_PATTERN.test(keywords) && layout === "two-column") return -22;
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

function normalizeTemplateRecommendations(value, templates = RESUME_TEMPLATES) {
  const catalogIds = new Set(templates.map((template) => template.id));
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map((item) => ({
      templateId: stringValue(item && item.templateId),
      reason: stringValue(item && item.reason),
    }))
    .filter((item) => catalogIds.has(item.templateId) && item.reason && !seen.has(item.templateId) && seen.add(item.templateId))
    .slice(0, 5);
}

module.exports = {
  getTemplateRecommendationContext,
  normalizeTemplateRecommendations,
  recommendResumeTemplates,
};

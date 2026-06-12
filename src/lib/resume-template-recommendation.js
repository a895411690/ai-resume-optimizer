// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RESUME_TEMPLATES } = require("./resume-templates.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeStructuredResumeV1 } = require("./resume-schema.js");

const ATS_KEYWORD_PATTERN = /ATS|网申|海投|外企|英文|海外|双语|银行|批量投递/i;
const MODERN_KEYWORD_PATTERN = /产品|数据|技术|研发|工程|运营|增长|商业分析|算法|开发/i;
const EXECUTIVE_KEYWORD_PATTERN = /高管|专家|管理|负责人|总监|VP|CTO|CFO|CEO|影响力|资深|高级/i;
const CAMPUS_KEYWORD_PATTERN = /校招|实习|应届|校园|秋招|春招|在校|毕业生/i;

const FAMILY_FLAGSHIP_IDS = {
  ats: "ats_chronological",
  modern_professional: "modern_product_data",
  executive_expert: "executive_impact",
  campus_intern: "campus_project_plus",
};

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

function getFamilyMatches(context) {
  const text = [context.userType, context.targetRole, context.keywordText].filter(Boolean).join(" ");
  return {
    ats: ATS_KEYWORD_PATTERN.test(text),
    modern_professional: MODERN_KEYWORD_PATTERN.test(text),
    executive_expert: context.userType === "senior" || EXECUTIVE_KEYWORD_PATTERN.test(text),
    campus_intern: context.userType === "fresh_graduate" || CAMPUS_KEYWORD_PATTERN.test(text),
  };
}

function recommendationReason(template, context) {
  const matches = getFamilyMatches(context);
  const family = template.family;
  const role = context.targetRole;
  const scenarios = template.scenarios;
  const layout = template.preview.layout;

  if (family === "ats" && matches.ats) {
    return "网申、海投、外企或银行等场景优先选择 ATS 友好模板，结构稳定、机器解析更可靠。";
  }
  if (family === "campus_intern" && matches.campus_intern) {
    return "应届生、校招和实习投递更适合突出项目实践、校园经历和学习潜力的模板。";
  }
  if (family === "executive_expert" && matches.executive_expert) {
    return "中高级人才优先突出管理影响力、关键成果和正式职业形象。";
  }
  if (family === "modern_professional" && matches.modern_professional) {
    return "产品、数据、技术和运营岗位适合现代专业模板，兼顾技能呈现和成果叙事。";
  }
  if (context.userType === "career_switcher" && template.tags.some(t => /转行|迁移/.test(t))) {
    return "转行求职者适合突出迁移能力和连贯职业叙事的模板。";
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
  const matches = getFamilyMatches(context);
  const role = context.targetRole;
  const scenarios = template.scenarios;
  const layout = template.preview.layout;

  let priority = index;
  if (matches.ats && template.family === "ats") priority -= 1000;
  if (matches.campus_intern && template.family === "campus_intern") priority -= 900;
  if (matches.executive_expert && template.family === "executive_expert") priority -= 800;
  if (matches.modern_professional && template.family === "modern_professional") priority -= 700;

  if (Object.values(FAMILY_FLAGSHIP_IDS).includes(template.id)) priority -= 40;
  if (matches.ats && template.id === FAMILY_FLAGSHIP_IDS.ats) priority -= 80;
  if (matches.campus_intern && template.id === FAMILY_FLAGSHIP_IDS.campus_intern) priority -= 80;
  if (matches.executive_expert && template.id === FAMILY_FLAGSHIP_IDS.executive_expert) priority -= 80;
  if (matches.modern_professional && template.id === FAMILY_FLAGSHIP_IDS.modern_professional) priority -= 80;

  if (context.userType === "career_switcher" && template.tags.some(t => /转行|迁移/.test(t))) priority -= 60;
  if (/金融|财务|审计/.test(role) && scenarios.includes("社招") && layout === "single-accent") priority -= 50;
  if (/设计|视觉|UI|UX|交互/.test(role)) priority -= 45;
  if (/国企|公务员|事业单位|公考/.test(role) && scenarios.includes("国企/公考")) priority -= 40;
  if (/外企|英文|海外|双语/.test(role) && scenarios.includes("外企双语")) priority -= 35;

  return priority;
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

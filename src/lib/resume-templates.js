const DEFAULT_TEMPLATE_ID = "classic";

const RESUME_TEMPLATES = [
  {
    id: "classic",
    name: "经典单栏",
    description: "ATS 友好，适合通用投递和网申上传。",
    tags: ["极简商务", "经典通用", "ATS友好"],
    scenarios: ["通用", "社招", "校招"],
    recommendedFor: ["fresh_graduate", "junior", "career_switcher", "senior"],
    audience: ["应届生", "通用社招", "ATS 网申"],
    strengths: ["信息层级清晰", "机器解析友好", "适合高频投递"],
    preview: { layout: "single", accent: "#2563eb" },
    layout: "single",
  },
  {
    id: "modern",
    name: "现代双栏",
    description: "左侧突出联系信息和技能，右侧呈现经历。",
    tags: ["现代", "信息密度高", "产品技术"],
    scenarios: ["社招", "外企双语", "通用"],
    recommendedFor: ["junior", "career_switcher"],
    audience: ["1-3 年经验", "产品/数据/技术岗", "外企双语场景"],
    strengths: ["技能和联系方式更醒目", "信息密度高", "适合突出专业能力"],
    preview: { layout: "two-column", accent: "#0f766e" },
    layout: "two-column",
  },
  {
    id: "executive",
    name: "专业管理型",
    description: "强调职业摘要、核心成果和管理影响力。",
    tags: ["正式严谨", "成果导向", "中高阶"],
    scenarios: ["社招", "国企/公考", "通用"],
    recommendedFor: ["senior", "junior"],
    audience: ["中高级职场", "管理岗位", "国企/公考"],
    strengths: ["强调成果和影响力", "版式正式稳重", "适合管理型叙事"],
    preview: { layout: "single-accent", accent: "#1d4ed8" },
    layout: "single-accent",
  },
];

function normalizeResumeTemplateId(value) {
  return RESUME_TEMPLATES.some((template) => template.id === value) ? value : DEFAULT_TEMPLATE_ID;
}

function getResumeTemplate(value) {
  const id = normalizeResumeTemplateId(value);
  return RESUME_TEMPLATES.find((template) => template.id === id) || RESUME_TEMPLATES[0];
}

module.exports = {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATES,
  getResumeTemplate,
  normalizeResumeTemplateId,
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildFallbackStructuredResume, renderStructuredResumeMarkdown } = require("./resume-structured-extraction.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeResumeMarkdown } = require("./resume-formatting.js");

const EMPTY_STRUCTURED_RESUME = Object.freeze({
  basics: Object.freeze({ name: "", phone: "", email: "", location: "", job_target: "", avatar: "", portfolio_url: "" }),
  education: Object.freeze([]),
  work: Object.freeze([]),
  projects: Object.freeze([]),
  skills: Object.freeze({ skill_hard: Object.freeze([]), skill_soft: Object.freeze([]), skill_level: Object.freeze([]), certificate_list: Object.freeze([]) }),
  optional: Object.freeze({ campus_exp: Object.freeze([]), self_evaluation: Object.freeze([]), manage_exp: Object.freeze([]), political_status: "" }),
  meta: Object.freeze({ source: "empty", warnings: Object.freeze([]) }),
});

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean);
  const text = stringValue(value);
  if (!text) return [];
  return text.split(/[、,，/|｜\n；;]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeTimeRange(value, startDate, endDate) {
  const explicit = stringValue(value || value?.timeRange);
  if (explicit) return explicit;
  const start = stringValue(startDate);
  const end = stringValue(endDate);
  if (start && end) return `${start}-${end}`;
  return start || end || "";
}

function normalizeBasics(value = {}) {
  return {
    name: stringValue(value.name),
    phone: stringValue(value.phone || value.mobile),
    email: stringValue(value.email),
    location: stringValue(value.location || value.city),
    job_target: stringValue(value.job_target || value.targetRole || value.position || value.jobIntention),
    avatar: stringValue(value.avatar || value.photoUrl || value.photo),
    portfolio_url: stringValue(value.portfolio_url || value.portfolioUrl || value.portfolio || value.website),
  };
}

function normalizeEducationItem(value = {}) {
  return {
    time_range: normalizeTimeRange(value.time_range || value.timeRange, value.startDate, value.endDate),
    school: stringValue(value.school || value.organization),
    major: stringValue(value.major),
    degree: stringValue(value.degree),
    gpa: stringValue(value.gpa),
    courses: arrayValue(value.courses),
    honors: arrayValue(value.honors || value.awards || value.bullets || value.highlights),
  };
}

function normalizeWorkItem(value = {}) {
  return {
    time_range: normalizeTimeRange(value.time_range || value.timeRange, value.startDate, value.endDate),
    company: stringValue(value.company || value.organization),
    position: stringValue(value.position || value.title || value.role),
    job_content: stringValue(value.job_content || value.description || value.responsibilities),
    job_result: arrayValue(value.job_result || value.achievements || value.bullets || value.highlights),
  };
}

function normalizeProjectItem(value = {}) {
  return {
    project_name: stringValue(value.project_name || value.projectName || value.name || value.organization),
    role: stringValue(value.role || value.title || value.position),
    project_intro: stringValue(value.project_intro || value.description),
    duty: stringValue(value.duty || value.responsibilities || value.work),
    achievement: arrayValue(value.achievement || value.achievements || value.bullets || value.highlights),
  };
}

function normalizeSkills(value = {}) {
  if (Array.isArray(value)) {
    return { skill_hard: arrayValue(value), skill_soft: [], skill_level: [], certificate_list: [] };
  }
  return {
    skill_hard: arrayValue(value.skill_hard || value.hardSkills || value.hard || value.skills),
    skill_soft: arrayValue(value.skill_soft || value.softSkills || value.soft),
    skill_level: arrayValue(value.skill_level || value.levels || value.skillLevels),
    certificate_list: arrayValue(value.certificate_list || value.certificates || value.certificateList),
  };
}

function normalizeOptional(value = {}, source = {}) {
  return {
    campus_exp: arrayValue(value.campus_exp || value.campus || source.campus_exp || source.campus),
    self_evaluation: arrayValue(value.self_evaluation || value.selfEvaluation || source.summary || source.selfEvaluation),
    manage_exp: arrayValue(value.manage_exp || value.management || source.management),
    political_status: stringValue(value.political_status || value.politicalStatus || source.political_status),
  };
}

function normalizeStructuredResumeV1(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const basics = normalizeBasics(source.basics || source.personalInfo || source.profile || {});
  return {
    basics,
    education: Array.isArray(source.education) ? source.education.map(normalizeEducationItem).filter((item) => item.school || item.degree || item.major || item.time_range) : [],
    work: Array.isArray(source.work) ? source.work.map(normalizeWorkItem).filter((item) => item.company || item.position || item.job_content || item.job_result.length) : [],
    projects: Array.isArray(source.projects) ? source.projects.map(normalizeProjectItem).filter((item) => item.project_name || item.role || item.project_intro || item.duty || item.achievement.length) : [],
    skills: normalizeSkills(source.skills || source.skill || {}),
    optional: normalizeOptional(source.optional || {}, source),
    meta: {
      source: stringValue(source.meta?.source) || "structured-v1",
      warnings: arrayValue(source.meta?.warnings),
    },
  };
}

function migrateMarkdownToStructuredResumeV1(markdown) {
  const compatibilityMarkdown = normalizeResumeMarkdown(markdown)
    .replace(/^##\s+工作\/实习经历\s*$/gm, "## 工作经历")
    .replace(/^##\s+实习经历\s*$/gm, "## 工作经历")
    .replace(/^##\s+专业技能\s*$/gm, "## 技能");
  const migrated = normalizeStructuredResumeV1(buildFallbackStructuredResume(compatibilityMarkdown));
  if (!migrated.work.length) {
    migrated.work = parseWorkFromMarkdown(compatibilityMarkdown);
  }
  return { ...migrated, meta: { ...migrated.meta, source: "markdown-migration" } };
}

function parseWorkFromMarkdown(markdown) {
  const lines = normalizeResumeMarkdown(markdown).split("\n").map((line) => line.trim()).filter(Boolean);
  const work = [];
  let section = "";
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      section = line.replace(/^##\s+/, "").trim();
      current = null;
      continue;
    }
    if (section !== "工作经历") continue;
    if (/^###\s+/.test(line)) {
      const parts = line.replace(/^###\s+/, "").split(/[|｜]/).map((item) => item.trim()).filter(Boolean);
      current = normalizeWorkItem({ company: parts[0] || "", position: parts[1] || "", time_range: parts[2] || "", job_result: [] });
      work.push(current);
      continue;
    }
    if (current && /^[-*]\s+/.test(line)) {
      current.job_result.push(line.replace(/^[-*]\s+/, ""));
    }
  }
  return work.filter((item) => item.company || item.position || item.job_result.length);
}

function renderStructuredResumeV1Markdown(value) {
  const resume = normalizeStructuredResumeV1(value);
  const legacyShape = {
    basics: {
      name: resume.basics.name,
      phone: resume.basics.phone,
      email: resume.basics.email,
      location: resume.basics.location,
      targetRole: resume.basics.job_target,
    },
    education: resume.education.map((item) => ({
      school: item.school,
      degree: item.degree,
      major: item.major,
      startDate: item.time_range,
      endDate: "",
      bullets: [...item.courses, ...item.honors],
    })),
    work: resume.work.map((item) => ({
      organization: item.company,
      title: item.position,
      startDate: item.time_range,
      endDate: "",
      description: item.job_content,
      bullets: item.job_result,
    })),
    projects: resume.projects.map((item) => ({
      name: item.project_name,
      role: item.role,
      description: item.project_intro || item.duty,
      bullets: item.achievement,
    })),
    skills: [...resume.skills.skill_hard, ...resume.skills.skill_soft, ...resume.skills.skill_level],
    certificates: resume.skills.certificate_list,
    summary: resume.optional.self_evaluation,
    meta: resume.meta,
  };
  return normalizeResumeMarkdown(renderStructuredResumeMarkdown(legacyShape)
    .replace(/^## 工作经历$/m, "## 工作/实习经历")
    .replace(/^## 技能$/m, "## 专业技能"));
}

module.exports = {
  EMPTY_STRUCTURED_RESUME,
  migrateMarkdownToStructuredResumeV1,
  normalizeStructuredResumeV1,
  renderStructuredResumeV1Markdown,
};

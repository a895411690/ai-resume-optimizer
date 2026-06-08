// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeResumeMarkdown } = require("./resume-formatting.js");

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDate(value) {
  return stringValue(value)
    .replace(/Present|Current/gi, "Present")
    .replace(/年/g, ".")
    .replace(/月/g, "")
    .replace(/^(\d{4})-(\d{1,2})$/, "$1.$2")
    .replace(/\//g, ".")
    .replace(/\.$/, "");
}

function normalizeBullets(value) {
  if (Array.isArray(value)) {
    return value.map(stringValue).filter(Boolean);
  }
  const text = stringValue(value);
  if (!text) return [];
  return text.split(/[\n；;]/).map((item) => item.replace(/^[-*•●▪◦]\s*/, "").trim()).filter(Boolean);
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean);
  return stringValue(value).split(/[、,，/|｜\n]/).map((item) => item.trim()).filter(Boolean);
}

function normalizeBasics(value = {}) {
  return {
    name: stringValue(value.name),
    phone: stringValue(value.phone || value.mobile),
    email: stringValue(value.email),
    location: stringValue(value.location || value.city),
    targetRole: stringValue(value.targetRole || value.position || value.jobIntention),
  };
}

function normalizeExperienceItem(value = {}) {
  return {
    organization: stringValue(value.organization || value.company || value.school),
    name: stringValue(value.name || value.projectName),
    title: stringValue(value.title || value.role || value.position),
    role: stringValue(value.role || value.title || value.position),
    startDate: normalizeDate(value.startDate),
    endDate: normalizeDate(value.endDate),
    description: stringValue(value.description),
    bullets: normalizeBullets(value.bullets || value.responsibilities || value.highlights),
  };
}

function normalizeEducationItem(value = {}) {
  return {
    school: stringValue(value.school || value.organization),
    degree: stringValue(value.degree),
    major: stringValue(value.major),
    startDate: normalizeDate(value.startDate),
    endDate: normalizeDate(value.endDate),
    bullets: normalizeBullets(value.bullets || value.highlights),
  };
}

function normalizeStructuredResume(value = {}) {
  const basics = normalizeBasics(value.basics || value.personalInfo || value.profile || {});
  return {
    basics,
    education: Array.isArray(value.education) ? value.education.map(normalizeEducationItem).filter((item) => item.school || item.degree || item.major) : [],
    work: Array.isArray(value.work) ? value.work.map(normalizeExperienceItem).filter((item) => item.organization || item.title || item.bullets.length) : [],
    projects: Array.isArray(value.projects) ? value.projects.map(normalizeExperienceItem).filter((item) => item.name || item.organization || item.bullets.length) : [],
    skills: normalizeStringArray(value.skills),
    certificates: normalizeStringArray(value.certificates),
    summary: normalizeBullets(value.summary || value.selfEvaluation),
    meta: {
      source: stringValue(value.meta?.source) || "model",
      warnings: normalizeStringArray(value.meta?.warnings),
    },
  };
}

function dateRange(item) {
  if (item.startDate && item.endDate) return `${item.startDate} - ${item.endDate}`;
  return item.startDate || item.endDate || "";
}

function titleParts(parts) {
  return parts.map(stringValue).filter(Boolean).join("｜");
}

function renderStructuredResumeMarkdown(value) {
  const resume = normalizeStructuredResume(value);
  const lines = [];
  lines.push(`# ${resume.basics.name || "我的简历"}`);

  const info = [
    ["电话", resume.basics.phone],
    ["邮箱", resume.basics.email],
    ["现居地", resume.basics.location],
    ["求职意向", resume.basics.targetRole],
  ].filter(([, item]) => item);
  if (info.length) {
    lines.push("", "## 个人信息", ...info.map(([label, item]) => `- **${label}**：${item}`));
  }

  if (resume.summary.length) {
    lines.push("", "## 自我评价", ...resume.summary.map((item) => `- ${item}`));
  }

  if (resume.education.length) {
    lines.push("", "## 教育经历");
    for (const item of resume.education) {
      lines.push(`### ${titleParts([item.school, item.degree, item.major, dateRange(item)])}`);
      lines.push(...item.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  if (resume.work.length) {
    lines.push("", "## 工作经历");
    for (const item of resume.work) {
      lines.push(`### ${titleParts([item.organization, item.title, dateRange(item)])}`);
      if (item.description) lines.push(`- ${item.description}`);
      lines.push(...item.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  if (resume.projects.length) {
    lines.push("", "## 项目经历");
    for (const item of resume.projects) {
      lines.push(`### ${titleParts([item.name || item.organization, item.role, dateRange(item)])}`);
      if (item.description) lines.push(`- ${item.description}`);
      lines.push(...item.bullets.map((bullet) => `- ${bullet}`));
    }
  }

  if (resume.skills.length) lines.push("", "## 技能", ...resume.skills.map((item) => `- ${item}`));
  if (resume.certificates.length) lines.push("", "## 技能证书", ...resume.certificates.map((item) => `- ${item}`));

  return normalizeResumeMarkdown(lines.join("\n"));
}

function buildFallbackStructuredResume(text) {
  const markdown = normalizeResumeMarkdown(text);
  const lines = markdown.split("\n").map((line) => line.trim()).filter(Boolean);
  const basics = {};
  const education = [];
  const projects = [];
  const skills = [];
  let section = "";
  let currentProject = null;

  for (const line of lines) {
    if (/^#\s+/.test(line) && !/^##/.test(line)) basics.name = line.replace(/^#\s+/, "").trim();
    if (/^##\s+/.test(line)) {
      section = line.replace(/^##\s+/, "").trim();
      currentProject = null;
      continue;
    }
    const info = line.match(/^-\s+\*\*(电话|手机|邮箱|现居地|所在地|求职意向|目标岗位)\*\*：(.+)$/);
    if (info) {
      if (info[1] === "电话" || info[1] === "手机") basics.phone = info[2].trim();
      else if (info[1] === "邮箱") basics.email = info[2].trim();
      else if (info[1] === "现居地" || info[1] === "所在地") basics.location = info[2].trim();
      else basics.targetRole = info[2].trim();
      continue;
    }

    if (section === "教育经历" && /^###\s+/.test(line)) {
      const heading = line.replace(/^###\s+/, "").replace(/\s{2,}/g, " ").trim();
      let parts = heading.split(/[|｜]/).map((item) => item.trim()).filter(Boolean);
      if (parts.length === 1) {
        const compact = heading.match(/^(.+?(?:大学|学院|学校))\s+(本科|专科|硕士|博士|MBA|学士)\s+(.+?)\s+(\d{4}\.\d{1,2}\s+-\s+(?:\d{4}\.\d{1,2}|至今|现在|Present))$/i);
        if (compact) parts = [compact[1], compact[2], compact[3], compact[4]];
      }
      education.push({ school: parts[0] || "", degree: parts[1] || "", major: parts[2] || "", startDate: "", endDate: "" });
      const date = parts.find((part) => /\d{4}\.\d{1,2}/.test(part));
      if (date) {
        const [startDate, endDate] = date.split(/\s+-\s+/);
        education[education.length - 1].startDate = startDate || "";
        education[education.length - 1].endDate = endDate || "";
      }
    }

    if (section === "项目经历" && /^###\s+/.test(line)) {
      const parts = line.replace(/^###\s+/, "").split(/[|｜]/).map((item) => item.trim()).filter(Boolean);
      currentProject = { name: parts[0] || "", role: parts[1] || "", startDate: "", endDate: "", bullets: [] };
      const date = parts.find((part) => /\d{4}\.\d{1,2}/.test(part));
      if (date) {
        const [startDate, endDate] = date.split(/\s+-\s+/);
        currentProject.startDate = startDate || "";
        currentProject.endDate = endDate || "";
      }
      projects.push(currentProject);
      continue;
    }
    if (section === "项目经历" && currentProject && /^-\s+/.test(line)) currentProject.bullets.push(line.replace(/^-\s+/, ""));
    if (section === "技能" && /^-\s+/.test(line)) skills.push(line.replace(/^-\s+/, ""));
  }

  return normalizeStructuredResume({ basics, education, projects, skills, meta: { source: "fallback-rules" } });
}

module.exports = {
  buildFallbackStructuredResume,
  normalizeStructuredResume,
  renderStructuredResumeMarkdown,
};

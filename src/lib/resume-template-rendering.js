// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeStructuredResumeV1 } = require("./resume-schema.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeResumeTemplateId, getResumeTemplate } = require("./resume-templates.js");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compact(values) {
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function titleLine(parts) {
  return compact(parts).join("｜");
}

function resolveDisplaySectionOrder(sectionOrder) {
  const defaultOrder = ["self_evaluation", "education", "work", "projects", "skills", "certificates", "campus_exp", "manage_exp"];
  const editorSectionMap = {
    basics: [],
    education: ["education"],
    work: ["work"],
    projects: ["projects"],
    skills: ["skills", "certificates"],
    optional: ["self_evaluation", "campus_exp", "manage_exp"],
  };
  const sourceOrder = Array.isArray(sectionOrder) ? sectionOrder : defaultOrder;
  const resolved = [];

  for (const key of sourceOrder) {
    const mappedKeys = editorSectionMap[key] || [key];
    for (const mappedKey of mappedKeys) {
      if (!resolved.includes(mappedKey)) resolved.push(mappedKey);
    }
  }

  return [...resolved, ...defaultOrder.filter((key) => !resolved.includes(key))];
}

function buildStructuredResumeViewModel(value) {
  const resume = normalizeStructuredResumeV1(value);
  const skills = [...resume.skills.skill_hard, ...resume.skills.skill_soft, ...resume.skills.skill_level];

  // Build all sections keyed by their logical name
  const sectionMap = {
    self_evaluation: resume.optional.self_evaluation.length ? { title: "自我评价", items: resume.optional.self_evaluation.map((item) => ({ heading: "", bullets: [item] })) } : null,
    education: resume.education.length ? {
      title: "教育经历",
      items: resume.education.map((item) => ({
        heading: titleLine([item.school, item.degree, item.major, item.time_range]),
        bullets: [...item.courses, ...item.honors],
      })),
    } : null,
    work: resume.work.length ? {
      title: "工作/实习经历",
      items: resume.work.map((item) => ({
        heading: titleLine([item.company, item.position, item.time_range]),
        bullets: compact([item.job_content, ...item.job_result]),
      })),
    } : null,
    projects: resume.projects.length ? {
      title: "项目经历",
      items: resume.projects.map((item) => ({
        heading: titleLine([item.project_name, item.role]),
        bullets: compact([item.project_intro, item.duty, ...item.achievement]),
      })),
    } : null,
    skills: skills.length ? { title: "专业技能", items: [{ heading: "", bullets: skills }] } : null,
    certificates: resume.skills.certificate_list.length ? { title: "技能证书", items: [{ heading: "", bullets: resume.skills.certificate_list }] } : null,
    campus_exp: resume.optional.campus_exp.length ? { title: "校园经历", items: resume.optional.campus_exp.map((item) => ({ heading: "", bullets: [item] })) } : null,
    manage_exp: resume.optional.manage_exp.length ? { title: "团队管理", items: resume.optional.manage_exp.map((item) => ({ heading: "", bullets: [item] })) } : null,
  };

  const fullOrder = resolveDisplaySectionOrder(resume.meta?.sectionOrder);
  const sections = fullOrder.map((key) => sectionMap[key]).filter(Boolean);

  return {
    title: resume.basics.name || "我的简历",
    contactItems: compact([resume.basics.phone, resume.basics.email, resume.basics.location, resume.basics.job_target]),
    skills,
    sections,
  };
}

function getPreviewTemplateClasses(templateId) {
  const template = getResumeTemplate(normalizeResumeTemplateId(templateId));
  const layout = template.layout;
  const accent = template.preview.accent;
  const basePage = "mx-auto min-w-0 bg-white p-4 text-sm leading-relaxed shadow-sm sm:p-8 md:max-w-[794px] md:p-12 md:shadow-lg lg:min-h-[1123px] print:shadow-none print:p-0";
  if (layout === "two-column") {
    return {
      page: `${basePage} md:p-0`,
      header: "border-b border-slate-200 p-6 text-left md:border-b-0 md:text-white",
      body: "md:grid md:grid-cols-[210px_minmax(0,1fr)]",
      main: "min-w-0 p-4 sm:p-8 md:p-10",
      sidebar: "border-b bg-slate-50 p-4 text-xs sm:p-6 md:border-b-0 md:text-slate-100",
      sectionTitle: "mb-3 mt-5 break-words border-b border-gray-300 pb-1 text-base font-bold text-gray-800 sm:mt-6 sm:text-lg",
      accent,
    };
  }
  if (layout === "single-accent") {
    return {
      page: basePage,
      header: "mb-6 border-l-4 pb-4 pl-4 text-left",
      body: "",
      main: "",
      sidebar: "",
      sectionTitle: "mb-3 mt-5 break-words pb-1 text-base font-bold uppercase sm:mt-6 sm:text-lg",
      accent,
    };
  }
  return {
    page: basePage,
    header: "mb-6 border-b-2 pb-4 text-center",
    body: "",
    main: "",
    sidebar: "",
    sectionTitle: "mb-3 mt-5 break-words border-b pb-1 text-base font-bold text-gray-800 sm:mt-6 sm:text-lg",
    accent,
  };
}

function getTemplatePrintCss(templateId) {
  const template = getResumeTemplate(normalizeResumeTemplateId(templateId));
  const layout = template.layout;
  const accent = template.preview.accent;
  const base = "body{font-family:Arial,'Microsoft YaHei',sans-serif;max-width:794px;margin:40px auto;padding:20px;font-size:13px;line-height:1.6;color:#111827}h1{font-size:22px;margin:0}h2{margin-top:20px;padding-bottom:4px;font-size:15px}h3{font-size:14px;margin-bottom:4px}li{margin-bottom:3px}.contact{font-size:12px;color:#4b5563;margin-top:8px}.section{break-inside:avoid}.resume-body{display:block}";
  if (layout === "two-column") {
    return `${base}.resume-body{display:grid;grid-template-columns:210px 1fr;gap:28px}.sidebar{background:${accent};color:#f8fafc;padding:24px}.main{padding:24px 0}.contact{color:#cbd5e1}h2{border-bottom:1px solid #d1d5db}.skills{margin-top:18px}`;
  }
  if (layout === "single-accent") {
    return `${base}header{border-left:5px solid ${accent};padding-left:14px;border-bottom:0}h2{border-bottom:2px solid ${accent}33;color:${accent};text-transform:uppercase}`;
  }
  return `${base}header{text-align:center;border-bottom:2px solid ${accent};padding-bottom:12px}h2{border-bottom:1px solid ${accent}44}`;
}

function renderSectionHtml(section) {
  const items = section.items.map((item) => {
    const heading = item.heading ? `<h3>${escapeHtml(item.heading)}</h3>` : "";
    const bullets = item.bullets.length ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : "";
    return `<div class="item">${heading}${bullets}</div>`;
  }).join("");
  return `<section class="section"><h2>${escapeHtml(section.title)}</h2>${items}</section>`;
}

function renderTemplateExportHtml({ title, structuredResume, templateId }) {
  const template = getResumeTemplate(normalizeResumeTemplateId(templateId));
  const id = template.id;
  const layout = template.layout;
  const view = buildStructuredResumeViewModel(structuredResume);
  const documentTitle = title || view.title;
  const contact = view.contactItems.length ? `<div class="contact">${view.contactItems.map(escapeHtml).join(" · ")}</div>` : "";
  const skills = view.skills.length ? `<div class="skills"><h2>专业技能</h2><ul>${view.skills.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : "";
  const nonSkillSections = view.sections.filter((section) => section.title !== "专业技能");
  const sections = nonSkillSections.map(renderSectionHtml).join("");
  const body = layout === "two-column"
    ? `<div class="resume-body"><aside class="sidebar"><header><h1>${escapeHtml(view.title)}</h1>${contact}</header>${skills}</aside><main class="main">${sections}</main></div>`
    : `<header><h1>${escapeHtml(view.title)}</h1>${contact}</header><main>${view.sections.map(renderSectionHtml).join("")}</main>`;

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(documentTitle)}</title><style>${getTemplatePrintCss(id)}</style></head><body data-template="${id}">${body}</body></html>`;
}

module.exports = {
  buildStructuredResumeViewModel,
  getPreviewTemplateClasses,
  getTemplatePrintCss,
  renderTemplateExportHtml,
};

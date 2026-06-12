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

function getTemplateTheme(template) {
  const density = template.density || "balanced";
  const compact = density === "compact";
  const spacious = density === "spacious";
  return {
    density,
    pagePadding: compact ? "p-3 sm:p-6 md:p-9" : spacious ? "p-5 sm:p-9 md:p-14" : "p-4 sm:p-8 md:p-12",
    sectionTop: compact ? "mt-4 sm:mt-5" : spacious ? "mt-6 sm:mt-7" : "mt-5 sm:mt-6",
    sectionTitle: compact ? "text-sm sm:text-base" : "text-base sm:text-lg",
    printMargin: compact ? 28 : spacious ? 48 : 40,
    printPadding: compact ? 16 : spacious ? 24 : 20,
    printFontSize: compact ? 12 : spacious ? 13.5 : 13,
    printLineHeight: compact ? 1.45 : spacious ? 1.7 : 1.6,
    titleStyle: template.family === "ats" ? "plain" : template.layout === "single-accent" ? "accent" : "ruled",
  };
}

function getPreviewTemplateClasses(templateId) {
  const template = getResumeTemplate(normalizeResumeTemplateId(templateId));
  const layout = template.layout;
  const accent = template.preview.accent;
  const theme = getTemplateTheme(template);
  const basePage = `mx-auto min-w-0 bg-white ${theme.pagePadding} text-sm leading-relaxed shadow-sm md:max-w-[794px] md:shadow-lg lg:min-h-[1123px] print:shadow-none print:p-0`;
  const sectionTitle = `mb-3 ${theme.sectionTop} break-words border-b pb-1 ${theme.sectionTitle} font-bold text-gray-800`;
  if (layout === "two-column") {
    return {
      page: `${basePage} md:p-0`,
      header: "border-b border-slate-200 p-6 text-left md:border-b-0 md:text-white",
      body: "md:grid md:grid-cols-[210px_minmax(0,1fr)]",
      main: "min-w-0 p-4 sm:p-8 md:p-10",
      sidebar: "border-b bg-slate-50 p-4 text-xs sm:p-6 md:border-b-0 md:text-slate-100",
      sectionTitle: `${sectionTitle} border-gray-300`,
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
      sectionTitle: `${sectionTitle} uppercase`,
      accent,
    };
  }
  if (layout === "timeline") {
    return {
      page: basePage,
      header: "mb-6 border-b-2 pb-4 text-center",
      body: "",
      main: "",
      sidebar: "",
      sectionTitle,
      accent,
    };
  }
  if (layout === "infographic") {
    return {
      page: basePage,
      header: "mb-0 pb-6 text-center text-white",
      body: "",
      main: "mt-6",
      sidebar: "",
      sectionTitle,
      accent,
    };
  }
  if (layout === "sidebar-right") {
    return {
      page: `${basePage} md:p-0`,
      header: "border-b border-slate-200 p-6 text-left md:border-b-0 md:text-white",
      body: "md:grid md:grid-cols-[minmax(0,1fr)_210px]",
      main: "min-w-0 p-4 sm:p-8 md:p-10",
      sidebar: "border-b bg-slate-50 p-4 text-xs sm:p-6 md:border-b-0 md:text-slate-100",
      sectionTitle: `${sectionTitle} border-gray-300`,
      accent,
    };
  }
  return {
    page: basePage,
    header: "mb-6 border-b-2 pb-4 text-center",
    body: "",
    main: "",
    sidebar: "",
    sectionTitle,
    accent,
  };
}

function getTemplatePrintCss(templateId) {
  const template = getResumeTemplate(normalizeResumeTemplateId(templateId));
  const layout = template.layout;
  const accent = template.preview.accent;
  const theme = getTemplateTheme(template);
  const headingTransform = theme.titleStyle === "accent" ? "text-transform:uppercase;" : "";
  const base = `body{font-family:Arial,'Microsoft YaHei',sans-serif;max-width:794px;margin:${theme.printMargin}px auto;padding:${theme.printPadding}px;font-size:${theme.printFontSize}px;line-height:${theme.printLineHeight};color:#111827}h1{font-size:22px;margin:0}h2{margin-top:${theme.density === "compact" ? 16 : 20}px;padding-bottom:4px;font-size:15px;${headingTransform}}h3{font-size:14px;margin-bottom:4px}li{margin-bottom:${theme.density === "compact" ? 2 : 3}px}.contact{font-size:12px;color:#4b5563;margin-top:8px}.section{break-inside:avoid}.resume-body{display:block}`;
  if (layout === "two-column") {
    return `${base}.resume-body{display:grid;grid-template-columns:210px 1fr;gap:28px}.sidebar{background:${accent};color:#f8fafc;padding:24px}.main{padding:24px 0}.contact{color:#cbd5e1}h2{border-bottom:1px solid #d1d5db}.skills{margin-top:18px}`;
  }
 if (layout === "single-accent") {
   return `${base}header{border-left:5px solid ${accent};padding-left:14px;border-bottom:0}h2{border-bottom:2px solid ${accent}33;color:${accent};text-transform:uppercase}`;
 }
  if (layout === "timeline") {
    return `${base}header{text-align:center;border-bottom:2px solid ${accent};padding-bottom:12px}h2{border-bottom:1px solid ${accent}44}.timeline-item{position:relative;padding-left:24px;margin-bottom:16px;border-left:3px solid ${accent}}.timeline-item::before{content:'';position:absolute;left:-7px;top:4px;width:10px;height:10px;border-radius:50%;background:${accent}}`;
  }
  if (layout === "infographic") {
    return `${base}.infographic-banner{background:${accent};color:#f8fafc;padding:24px;text-align:center;margin:-20px -20px 20px}h1{color:#fff}.infographic-banner .contact{color:#cbd5e1}.skill-bar-wrap{margin-bottom:8px}.skill-bar-track{background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden}.skill-bar-fill{background:${accent};border-radius:4px;height:8px}h2{border-bottom:1px solid ${accent}44}`;
  }
  if (layout === "sidebar-right") {
    return `${base}.resume-body{display:grid;grid-template-columns:1fr 210px;gap:28px}.sidebar{background:${accent};color:#f8fafc;padding:24px;order:2}.main{padding:24px 0;order:1}.contact{color:#cbd5e1}h2{border-bottom:1px solid #d1d5db}.skills{margin-top:18px}`;
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
  let body;
  if (layout === "two-column") {
    body = `<div class="resume-body"><aside class="sidebar"><header><h1>${escapeHtml(view.title)}</h1>${contact}</header>${skills}</aside><main class="main">${sections}</main></div>`;
  } else if (layout === "sidebar-right") {
    body = `<div class="resume-body"><main class="main">${sections}</main><aside class="sidebar"><header><h1>${escapeHtml(view.title)}</h1>${contact}</header>${skills}</aside></div>`;
  } else if (layout === "timeline") {
    const timelineSections = view.sections.map((section) => {
      const items = section.items.map((item) => {
        const heading = item.heading ? `<h3>${escapeHtml(item.heading)}</h3>` : "";
        const bullets = item.bullets.length ? `<ul>${item.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : "";
        return `<div class="timeline-item">${heading}${bullets}</div>`;
      }).join("");
      return `<section class="section"><h2>${escapeHtml(section.title)}</h2>${items}</section>`;
    }).join("");
    body = `<header><h1>${escapeHtml(view.title)}</h1>${contact}</header><main>${timelineSections}</main>`;
  } else if (layout === "infographic") {
    const skillBars = view.skills.map((skill) => `<div class="skill-bar-wrap"><span>${escapeHtml(skill)}</span><div class="skill-bar-track"><div class="skill-bar-fill" style="width:75%"></div></div></div>`).join("");
    body = `<div class="infographic-banner"><header><h1>${escapeHtml(view.title)}</h1>${contact}</header>${skillBars}</div><main>${view.sections.map(renderSectionHtml).join("")}</main>`;
  } else {
    body = `<header><h1>${escapeHtml(view.title)}</h1>${contact}</header><main>${view.sections.map(renderSectionHtml).join("")}</main>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(documentTitle)}</title><style>${getTemplatePrintCss(id)}</style></head><body data-template="${id}">${body}</body></html>`;
}

module.exports = {
  buildStructuredResumeViewModel,
  getPreviewTemplateClasses,
  getTemplatePrintCss,
  renderTemplateExportHtml,
};

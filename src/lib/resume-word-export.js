/* eslint-disable @typescript-eslint/no-require-imports */
const { normalizeStructuredResumeV1 } = require("./resume-schema.js");
const { buildStructuredResumeViewModel } = require("./resume-template-rendering.js");
const { getResumeTemplate, normalizeResumeTemplateId } = require("./resume-templates.js");

function cleanHexColor(value, fallback = "111827") {
  const text = String(value || "").replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(text) ? text : fallback;
}

function getWordTemplateProfile(templateId) {
  const id = normalizeResumeTemplateId(templateId);
  const template = getResumeTemplate(id);
  const layout = template.layout || "single";
  const accent = cleanHexColor(template.preview?.accent, layout === "single-accent" ? "1d4ed8" : "111827");
  return {
    id,
    layout,
    accent,
    isTwoColumn: layout === "two-column" || layout === "sidebar-right",
    isSidebarRight: layout === "sidebar-right",
    isAccent: layout === "single-accent",
    titleAlignment: layout === "single" ? "center" : "left",
  };
}

function getResumeWordFileName(structuredResume) {
  const resume = normalizeStructuredResumeV1(structuredResume);
  const name = String(resume.basics.name || "简历")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return `${name || "简历"}.docx`;
}

function textRun(TextRun, text, options = {}) {
  return new TextRun({ text: String(text || ""), font: "Microsoft YaHei", ...options });
}

function paragraph(Paragraph, TextRun, text, options = {}) {
  return new Paragraph({
    children: [textRun(TextRun, text, options.run)],
    spacing: options.spacing || { after: 120 },
    alignment: options.alignment,
    border: options.border,
  });
}

function sectionHeading(docx, title, profile) {
  const { Paragraph, TextRun, BorderStyle } = docx;
  return paragraph(Paragraph, TextRun, title, {
    run: { bold: true, color: profile.accent, size: 24 },
    spacing: { before: 180, after: 100 },
    border: {
      bottom: {
        color: profile.isAccent ? profile.accent : "D1D5DB",
        space: 1,
        style: BorderStyle.SINGLE,
        size: profile.isAccent ? 8 : 4,
      },
    },
  });
}

function bullet(Paragraph, TextRun, text) {
  return new Paragraph({
    children: [textRun(TextRun, text, { size: 20 })],
    bullet: { level: 0 },
    spacing: { after: 70 },
  });
}

function sectionChildren(docx, sections, profile) {
  const { Paragraph, TextRun } = docx;
  const children = [];
  for (const section of sections) {
    children.push(sectionHeading(docx, section.title, profile));
    for (const item of section.items) {
      if (item.heading) {
        children.push(paragraph(Paragraph, TextRun, item.heading, {
          run: { bold: true, size: 21, color: "374151" },
          spacing: { before: 80, after: 70 },
        }));
      }
      for (const itemBullet of item.bullets) {
        children.push(bullet(Paragraph, TextRun, itemBullet));
      }
    }
  }
  return children;
}

function noBorder(BorderStyle) {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };
}

function buildResumeWordDocument({ docx, structuredResume, templateId }) {
  const {
    AlignmentType,
    Document,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    BorderStyle,
  } = docx;
  const profile = getWordTemplateProfile(templateId);
  const resume = normalizeStructuredResumeV1(structuredResume);
  const view = buildStructuredResumeViewModel(resume, templateId);
  const titleAlignment = profile.titleAlignment === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const title = new Paragraph({
    children: [textRun(TextRun, view.title, { bold: true, size: 34, color: profile.isAccent ? profile.accent : "111827" })],
    alignment: titleAlignment,
    spacing: { after: 100 },
  });
  const contact = view.contactItems.length
    ? paragraph(Paragraph, TextRun, view.contactItems.join(" | "), {
      alignment: titleAlignment,
      run: { size: 20, color: "4B5563" },
      spacing: { after: 160 },
    })
    : null;

  if (profile.isTwoColumn) {
    const skillSections = view.sections.filter((section) => section.title === "专业技能" || section.title === "技能证书");
    const mainSections = view.sections.filter((section) => section.title !== "专业技能" && section.title !== "技能证书");
    const sidebar = [
      title,
      ...(contact ? [contact] : []),
      ...sectionChildren(docx, skillSections, profile),
    ];
    const main = sectionChildren(docx, mainSections, profile);
    const cells = profile.isSidebarRight
      ? [
        new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: main }),
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: sidebar }),
      ]
      : [
        new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: sidebar }),
        new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: main }),
      ];
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder(BorderStyle),
      rows: [
        new TableRow({
          children: cells,
        }),
      ],
    });
    return new Document({ sections: [{ children: [table] }] });
  }

  return new Document({
    sections: [{
      children: [
        title,
        ...(contact ? [contact] : []),
        ...sectionChildren(docx, view.sections, profile),
      ],
    }],
  });
}

module.exports = {
  buildResumeWordDocument,
  getResumeWordFileName,
  getWordTemplateProfile,
};

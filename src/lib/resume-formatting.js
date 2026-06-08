const SECTION_TITLES = new Map([
  ["个人信息", "个人信息"],
  ["基本信息", "个人信息"],
  ["联系方式", "个人信息"],
  ["求职意向", "求职意向"],
  ["教育经历", "教育经历"],
  ["教育背景", "教育经历"],
  ["工作经历", "工作经历"],
  ["实习经历", "实习经历"],
  ["项目经历", "项目经历"],
  ["项目经验", "项目经历"],
  ["校园经历", "校园经历"],
  ["社团经历", "校园经历"],
  ["科研经历", "科研经历"],
  ["获奖经历", "获奖经历"],
  ["荣誉奖项", "获奖经历"],
  ["技能", "技能"],
  ["专业技能", "技能"],
  ["技能证书", "技能证书"],
  ["证书", "技能证书"],
  ["自我评价", "自我评价"],
  ["个人总结", "自我评价"],
  ["Education", "教育经历"],
  ["Educational Background", "教育经历"],
  ["Experience", "工作经历"],
  ["Work Experience", "工作经历"],
  ["Professional Experience", "工作经历"],
  ["Internship Experience", "实习经历"],
  ["Projects", "项目经历"],
  ["Project Experience", "项目经历"],
  ["Skills", "技能"],
  ["Technical Skills", "技能"],
  ["Awards", "获奖经历"],
  ["Honors", "获奖经历"],
  ["Summary", "自我评价"],
]);

const INFO_LABELS = new Set([
  "姓名",
  "性别",
  "电话",
  "手机",
  "邮箱",
  "Email",
  "E-mail",
  "微信",
  "年龄",
  "出生",
  "现居地",
  "所在地",
  "求职意向",
  "目标岗位",
  "政治面貌",
]);

const HEADING_SECTIONS = new Set([
  "教育经历",
  "工作经历",
  "实习经历",
  "项目经历",
  "校园经历",
  "科研经历",
  "获奖经历",
  "技能",
  "技能证书",
  "自我评价",
]);

const DATE_RANGE_SOURCE = String.raw`(?:\d{4}[.年/-]\d{1,2}[.月]?)\s*[-~—–至到]\s*(?:\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current)`;

function cleanModelMarkdown(markdown) {
  let text = String(markdown || "").replace(/\r\n?/g, "\n").trim();
  text = text.replace(/^\s*(以下是|下面是|这是).{0,24}(优化后|修改后|整理后).{0,16}简历[：:]\s*/i, "");

  const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) text = fenced[1].trim();

  text = text
    .replace(/^```(?:markdown|md)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return text;
}

function normalizeDateRanges(line) {
  return line
    .replace(
      /(\d{4}[.年/-]\d{1,2}[.月]?)\s*[-~—–至到]\s*(\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current)/gi,
      (_, start, end) => `${normalizeDateText(start)} - ${normalizeDateText(end)}`
    );
}

function normalizeDateText(value) {
  return String(value)
    .replace(/Present|Current/gi, "Present")
    .replace(/年/g, ".")
    .replace(/月/g, "")
    .replace(/\//g, ".")
    .replace(/\.$/, "");
}

function restoreCollapsedImportLines(text) {
  const source = String(text || "").replace(/\s+/g, " ").trim();
  if (!source) return "";
  const existingLineCount = String(text || "").split("\n").filter((line) => line.trim()).length;
  const hasResumeSignals = /(个人信息|电话[：:]|手机[：:]|邮箱[：:]|求职意向[：:]|教育经历|教育背景|工作经历|项目经历|项目经验)/.test(source);
  if (existingLineCount > 2 || !hasResumeSignals) return text;

  const reorderedSource = source.replace(
    new RegExp(`([。；;.!?])\\s+((?:(?:[^。\\n]{2,60}(?:大学|学院|学校)[^。\\n]{0,60}\\s+(?:本科|专科|硕士|博士|MBA|学士)[^。\\n]{0,60}\\s+${DATE_RANGE_SOURCE}\\s*){1,4}))\\s+(教育经历|教育背景)(?=\\s|$)`, "gi"),
    "$1 $3 $2"
  );

  const sectionPattern = Array.from(SECTION_TITLES.keys())
    .filter((key) => /[\u4e00-\u9fa5]/.test(key))
    .sort((a, b) => b.length - a.length)
    .map((key) => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  let output = reorderedSource
    .replace(new RegExp(`\\s+(${sectionPattern})(?=\\s|$)`, "g"), "\n\n$1")
    .replace(new RegExp(`\\n\\n(${sectionPattern})\\s+(?=\\S)`, "g"), "\n\n$1\n")
    .replace(/\s+([\u4e00-\u9fa5A-Za-z&/（）()]{2,16})[：:]\s+/g, "\n$1：")
    .replace(/\s+(电话|手机|邮箱|Email|E-mail|微信|现居地|所在地|求职意向|目标岗位|政治面貌)[：:]/g, "\n$1：")
    .replace(/\s+((?:\d{4}[.年/-]\d{1,2}[.月]?)\s*(?:[-~—–至到])\s*(?:\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current))/gi, "\n$1")
    .replace(/\s+(负责|参与|协同|推动|主导|分析|输出|完成|优化|搭建|管理|制定|跟进|支持|整理|设计并|开发|测试|维护|提升|降低|沉淀|对接)/g, "\n$1");

  output = output
    .replace(
      new RegExp(`([^\\n]*(?:大学|学院|学校)[^\\n]*(?:本科|专科|硕士|博士|MBA|学士)[^\\n]*)\\n(${DATE_RANGE_SOURCE})\\s+([^\\n]*(?:大学|学院|学校))`, "gi"),
      "$1 $2\n$3"
    )
    .replace(
      new RegExp(`([^\\n]*(?:大学|学院|学校)[^\\n]*(?:本科|专科|硕士|博士|MBA|学士)[^\\n]*)\\n(${DATE_RANGE_SOURCE})`, "gi"),
      "$1 $2"
    );

  output = output.replace(/^([\u4e00-\u9fa5A-Za-z·\s]{2,24})\s+(?=个人信息|电话[：:]|手机[：:]|邮箱[：:])/u, "$1\n");
  return output.trim();
}

function splitEmbeddedLabelParagraphs(text) {
  return String(text || "")
    .replace(
      /([。；;.!?])\s+((?:自我评价|个人总结|专业技能|技能|项目经验|项目经历|工作经历|教育经历|教育背景)(?:\s+(?:自我评价|个人总结|专业技能|技能|项目经验|项目经历|工作经历|教育经历|教育背景)){1,6})(?=\s|$)/g,
      (_, punctuation, sections) => `${punctuation}\n${sections.trim().split(/\s+/).join("\n")}`
    )
    .replace(
      new RegExp(`([。；;.!?])\\s+((?:(?:[^。\\n]{2,60}(?:大学|学院|学校)[^。\\n]{0,60}\\s+(?:本科|专科|硕士|博士|MBA|学士)[^。\\n]{0,60}\\s+${DATE_RANGE_SOURCE}\\s*){1,4}))\\s+(教育经历|教育背景)(?=\\s|$)`, "gi"),
      "$1\n$3\n$2"
    )
    .replace(
      /([^\n]*?\S)\s{2,}([^\n：:]{2,60}(?:项目|系统|平台|工程|重构|迁移|银行|公司|中心|产品|App|APP|小程序|官网)[^\n：:]{0,30})\s{2,}([^\n：:]{2,24}(?:工程师|经理|专员|顾问|分析师|负责人|实习生|架构师|测试|开发|产品|运营))\s{2,}((?:\d{4}[.年/-]\d{1,2}[.月]?)\s*[-~—–至到]\s*(?:\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current))/gi,
      (_, prefix, title, role, date) => `${prefix.trim()}\n${title.trim()}｜${role.trim()}｜${date.trim()}`
    )
    .replace(
      /((?:\d{4}[.年/-]\d{1,2}[.月]?)\s*[-~—–至到]\s*(?:\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current))\s+([\u4e00-\u9fa5A-Za-z&/（）()]{2,16})[：:]\s+/gi,
      "$1\n$2："
    )
    .replace(
      /([。；;.!?])\s+([^\n：:]{4,40})\s+([^\n：:]{2,24}(?:工程师|经理|专员|顾问|分析师|负责人|实习生|架构师|测试|开发|产品|运营|组长))\s+((?:\d{4}[.年/-]\d{1,2}[.月]?)\s*[-~—–至到]\s*(?:\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current))/gi,
      (_, punctuation, title, role, date) => `${punctuation}\n${title.trim()}｜${role.trim()}｜${date.trim()}`
    )
    .replace(
      /([。.!?])\s+([\u4e00-\u9fa5A-Za-z&/（）()]{2,16})[：:]\s+/g,
      "$1\n$2："
    )
    .replace(
      /\s{2,}([\u4e00-\u9fa5A-Za-z&/（）()]{2,16})[：:]\s+/g,
      "\n$1："
    )
    .replace(/^##\s+([^\n#-][^\n]*?)\s+-\s+(.+)$/gm, "## $1\n- $2");
}

function stripBullet(line) {
  return line.replace(/^\s*[-*•●▪◦]\s*/, "").trim();
}

function isMarkdownHeading(line) {
  return /^#{1,6}\s+\S/.test(line);
}

function sectionName(line) {
  const compact = stripBullet(line).replace(/[：:]\s*$/, "").trim();
  return SECTION_TITLES.get(compact) || SECTION_TITLES.get(compact.replace(/\s+/g, " ")) || "";
}

function oneLineProfile(line, index, hasMarkdownTitle) {
  if (index > 1 || hasMarkdownTitle) return null;
  if (!/[|｜]/.test(line)) return null;
  if (/\d{4}[.年/-]\d{1,2}[.月]?\s*[-~—–至到]\s*(?:\d{4}[.年/-]\d{1,2}[.月]?|至今|现在|Present|Current)/i.test(line)) return null;
  const parts = line.split(/[|｜]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3 || parts.length > 8) return null;
  const [name, ...items] = parts;
  if (!/^[\u4e00-\u9fa5A-Za-z·\s]{2,30}$/.test(name)) return null;

  const bullets = [];
  for (const item of items) {
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(item)) bullets.push(`- **邮箱**：${item}`);
    else if (/^(?:\+?86[-\s]?)?1\d{10}$/.test(item.replace(/\s+/g, ""))) bullets.push(`- **电话**：${item}`);
    else if (/^[\u4e00-\u9fa5A-Za-z\s]{2,20}$/.test(item) && /省|市|区|县|上海|北京|广州|深圳|杭州|成都|南京|武汉|西安|苏州|天津|重庆/.test(item)) bullets.push(`- **现居地**：${item}`);
    else bullets.push(`- **求职意向**：${item}`);
  }

  return [`# ${name}`, "", "## 个人信息", ...bullets];
}

function infoMatch(line) {
  const clean = stripBullet(line).replace(/^\*\*(.+?)\*\*[：:]\s*(.*)$/, "$1：$2");
  const match = clean.match(/^([\u4e00-\u9fa5A-Za-z-]{2,8})[：:]\s*(.+)$/);
  if (!match) return null;
  const label = match[1].trim();
  if (!INFO_LABELS.has(label)) return null;
  return { label, value: match[2].trim() };
}

function labelParagraphMatch(line) {
  const clean = stripBullet(line);
  const match = clean.match(/^([\u4e00-\u9fa5A-Za-z&/（）()]{2,16})[：:]\s*(.{8,})$/);
  if (!match) return null;
  const label = match[1].trim();
  if (INFO_LABELS.has(label) || SECTION_TITLES.has(label)) return null;
  return { label, value: match[2].trim() };
}

function looksLikeName(line, index, hasMarkdownTitle) {
  const clean = stripBullet(line).replace(/^姓名[：:]\s*/, "").trim();
  return index <= 2 && !hasMarkdownTitle && /^[\u4e00-\u9fa5A-Za-z·\s]{2,24}$/.test(clean) && !sectionName(clean);
}

function looksLikeTitleLine(line, currentSection) {
  const clean = stripBullet(line);
  if (!currentSection || currentSection === "个人信息" || currentSection === "技能" || currentSection === "自我评价") return false;
  if (/^#{1,6}\s+/.test(clean)) return false;
  if (/^(负责|参与|协同|推动|主导|分析|输出|完成|优化|搭建|管理|制定|跟进|支持|整理|设计并|开发|测试|维护|提升|降低|沉淀|对接)/.test(clean)) return false;
  if (/^(Built|Analyzed|Delivered|Led|Owned|Created|Improved|Reduced|Managed|Designed|Developed|Maintained|Supported|Collaborated)\b/i.test(clean)) return false;
  if (/^[\d一二三四五六七八九十]+[.、)]/.test(clean)) return false;
  if (/[,，。；;]$/.test(clean)) return false;
  if (/[|｜].*(\d{4}\.\d{1,2}\s+-\s+(?:\d{4}\.\d{1,2}|至今|现在|Present))/.test(clean)) return true;
  if (clean.length > 42) return false;
  if (currentSection === "项目经历" && /^[A-Z][A-Za-z0-9+&/ -]{3,40}$/.test(clean)) return true;
  return /项目|公司|大学|学院|实验室|中心|平台|系统|工具|活动|社团|协会|奖|证书|本科|硕士|博士|专员|经理|工程师|实习生|运营|产品|研发|设计|分析/.test(clean);
}

function looksLikeResultSentence(line) {
  const clean = stripBullet(line).replace(/^#{1,6}\s+/, "").trim();
  if (clean.length > 80) return true;
  if (/[，,。；;]$/.test(clean)) return true;
  return /^(通过|负责|参与|协同|推动|主导|分析|输出|完成|优化|搭建|管理|制定|跟进|支持|整理|设计并|开发|测试|维护|提升|降低|沉淀|对接|进行|确保|解决|实现)/.test(clean);
}

function splitPrefixedSectionBullet(line) {
  const clean = stripBullet(line);
  const match = clean.match(/^(自我评价|个人总结|专业技能|技能|项目经验|项目经历|工作经历|教育经历|教育背景)\s+(.+)$/);
  if (!match) return null;
  const section = SECTION_TITLES.get(match[1]) || match[1];
  return { section, rest: match[2].trim() };
}

function splitEducationEntries(line) {
  const clean = stripBullet(line).replace(/\s{2,}/g, " ").trim();
  const entries = [];
  const pattern = new RegExp(`([^\n]*?(?:大学|学院|学校)[^\n]*?${DATE_RANGE_SOURCE})`, "gi");
  let match;
  while ((match = pattern.exec(clean))) entries.push(normalizeDateRanges(match[1].trim()));
  return entries.length ? entries : null;
}

function mergeBrokenResultTails(lines) {
  const merged = [];
  for (const line of lines) {
    const previous = merged[merged.length - 1] || "";
    const headingTail = line.match(/^###\s+(.{1,4}[。.!?])\s+(.+)$/);
    if (headingTail && /^(###|[-*•●▪◦])\s+/.test(previous)) {
      merged[merged.length - 1] = `${previous}${headingTail[1].trim()}`;
      merged.push(`### ${headingTail[2].trim()}`);
      continue;
    }
    if (/^[-*•●▪◦]\s+.{1,4}[。.!?]$/.test(line) && /^(###|[-*•●▪◦])\s+/.test(previous)) {
      const tail = stripBullet(line);
      merged[merged.length - 1] = `${previous}${tail}`;
      continue;
    }
    merged.push(line);
  }
  return merged;
}

function looksLikeDateLine(line) {
  return /^\d{4}[.年/-]\d{1,2}[.月]?\s*[-~—–至到]\s*(\d{4}[.年/-]\d{1,2}[.月]?|至今|现在)/.test(stripBullet(line));
}

function shouldBullet(line, currentSection) {
  if (!currentSection) return false;
  if (currentSection === "个人信息") return false;
  if (isMarkdownHeading(line)) return false;
  if (/^[-*•●▪◦]\s+/.test(line)) return true;
  if (looksLikeDateLine(line)) return false;
  return true;
}

function compactBlankLines(lines) {
  const output = [];
  for (const line of lines) {
    if (!line && output[output.length - 1] === "") continue;
    output.push(line);
  }
  while (output[0] === "") output.shift();
  while (output[output.length - 1] === "") output.pop();
  return output;
}

function normalizeResumeMarkdown(markdown) {
  const cleaned = splitEmbeddedLabelParagraphs(restoreCollapsedImportLines(cleanModelMarkdown(markdown)));
  if (!cleaned) return "";

  const rawLines = mergeBrokenResultTails(cleaned
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => normalizeDateRanges(line.trim()))
    .filter((line, index, lines) => line || lines[index - 1]));

  const hasMarkdownTitle = rawLines.some((line) => /^#\s+\S/.test(line));
  const output = [];
  let currentSection = "";

  rawLines.forEach((line, index) => {
    const clean = stripBullet(line);

    if (!clean) {
      output.push("");
      return;
    }

    if (isMarkdownHeading(line)) {
      const headingText = line.replace(/^#{1,6}\s+/, "").trim();
      const headingLevel = line.match(/^(#{1,6})\s+/)?.[1].length || 2;
      const normalizedSection = SECTION_TITLES.get(headingText.replace(/[：:]$/, ""));
      if (headingLevel >= 3 && currentSection && looksLikeResultSentence(line) && !looksLikeTitleLine(headingText, currentSection)) {
        output.push(`- ${headingText}`);
        return;
      }
      currentSection = normalizedSection || (headingLevel <= 2 ? headingText.replace(/[：:]$/, "") : currentSection);
      output.push(line);
      return;
    }

    const profileLines = oneLineProfile(line, index, hasMarkdownTitle);
    if (profileLines && !output.some((item) => /^#\s+/.test(item))) {
      output.push(...profileLines);
      currentSection = "个人信息";
      return;
    }

    const info = infoMatch(line);
    if (info?.label === "姓名" && !hasMarkdownTitle && !output.some((item) => /^#\s+/.test(item))) {
      output.push(`# ${info.value}`);
      currentSection = "个人信息";
      return;
    }

    if (looksLikeName(line, index, hasMarkdownTitle) && !output.some((item) => /^#\s+/.test(item))) {
      output.push(`# ${clean}`);
      currentSection = "个人信息";
      return;
    }

    const detectedSection = sectionName(line);
    if (detectedSection) {
      currentSection = detectedSection;
      output.push("");
      output.push(`## ${detectedSection}`);
      return;
    }

    const prefixedSection = splitPrefixedSectionBullet(line);
    if (prefixedSection) {
      currentSection = prefixedSection.section;
      output.push("");
      output.push(`## ${prefixedSection.section}`);
      const restInfoMatch = prefixedSection.rest.match(/\s+(求职意向|目标岗位)[：:]\s*(.+)$/);
      const restWithoutInfo = prefixedSection.rest.replace(/\s+(求职意向|目标岗位)[：:].*$/, "").trim();
      if (restWithoutInfo) output.push(`- ${restWithoutInfo}`);
      if (restInfoMatch) output.push(`- **${restInfoMatch[1]}**：${restInfoMatch[2].trim()}`);
      return;
    }

    if (info) {
      if (!currentSection) currentSection = "个人信息";
      output.push(`- **${info.label}**：${info.value}`);
      return;
    }

    const labelParagraph = currentSection === "技能" ? null : labelParagraphMatch(line);
    if (labelParagraph) {
      currentSection = labelParagraph.label;
      output.push("");
      output.push(`## ${labelParagraph.label}`);
      output.push(`- ${labelParagraph.value}`);
      return;
    }

    if (looksLikeDateLine(line)) {
      output.push(`**${clean.replace(/^(\d{4}[.\d]*\s+-\s+(?:\d{4}[.\d]*|至今|现在))/, "$1**")}`);
      return;
    }

    const educationEntries = currentSection === "教育经历" ? splitEducationEntries(line) : null;
    if (educationEntries) {
      educationEntries.forEach((entry) => output.push(`### ${entry}`));
      return;
    }

    if (looksLikeTitleLine(line, currentSection)) {
      output.push(`### ${clean.replace(/^#+\s*/, "")}`);
      return;
    }

    if (shouldBullet(line, currentSection)) {
      output.push(`- ${clean}`);
      return;
    }

    output.push(clean);
  });

  return compactBlankLines(output).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

module.exports = {
  cleanModelMarkdown,
  normalizeResumeMarkdown,
  HEADING_SECTIONS,
};

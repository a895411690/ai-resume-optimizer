function stripBold(value) {
  return String(value || "").replace(/\*\*/g, "").trim();
}

function parseContactItem(line) {
  const clean = line.replace(/^[-*]\s+/, "").trim();
  const match = clean.match(/^\*\*(.+?)\*\*[：:]\s*(.+)$/);
  if (match) return `${match[1].trim()}：${match[2].trim()}`;
  return stripBold(clean);
}

function renderResumePreviewMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const titleLine = lines.find((line) => /^#\s+/.test(line));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : "";

  let start = -1;
  let end = -1;
  const firstContentIndex = lines.findIndex((line) => line.trim());
  const titleIndex = titleLine ? lines.indexOf(titleLine) : -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+个人信息\s*$/.test(lines[index].trim())) {
      start = index;
      break;
    }
    if (index > 0 && /^##\s+/.test(lines[index].trim())) break;
  }

  const profileIsLeading = start >= 0 && (titleIndex === -1 || start > titleIndex) && start <= Math.max(firstContentIndex + 3, 3);
  if (!profileIsLeading) {
    return { title, contactItems: [], bodyMarkdown: lines.filter((line) => line !== titleLine).join("\n").trim() };
  }

  end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }

  const contactItems = lines
    .slice(start + 1, end)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map(parseContactItem)
    .filter(Boolean);

  const bodyLines = lines.filter((line, index) => line !== titleLine && (index < start || index >= end));
  return {
    title,
    contactItems,
    bodyMarkdown: bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
  };
}

module.exports = {
  renderResumePreviewMarkdown,
};

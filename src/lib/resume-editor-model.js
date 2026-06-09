// eslint-disable-next-line @typescript-eslint/no-require-imports
const { normalizeStructuredResumeV1 } = require("./resume-schema.js");

const ARRAY_SECTIONS = new Set(["education", "work", "projects"]);
const SKILL_FIELDS = new Set(["skill_hard", "skill_soft", "skill_level", "certificate_list"]);
const OPTIONAL_ARRAY_FIELDS = new Set(["campus_exp", "self_evaluation", "manage_exp"]);

const EMPTY_ITEMS = {
  education: { time_range: "", school: "", major: "", degree: "", gpa: "", courses: [], honors: [] },
  work: { time_range: "", company: "", position: "", job_content: "", job_result: [] },
  projects: { project_name: "", role: "", project_intro: "", duty: "", achievement: [] },
};

function splitValues(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  return value.split(/[\n、,，；;|｜/]/).map((item) => item.trim()).filter(Boolean);
}

function editableCopy(resume) {
  const source = resume && typeof resume === "object" ? resume : {};
  const normalized = normalizeStructuredResumeV1(source);
  for (const section of ARRAY_SECTIONS) {
    if (Array.isArray(source[section])) normalized[section] = source[section];
  }
  return normalized;
}

function updateBasicsField(resume, key, value) {
  const current = editableCopy(resume);
  return normalizeStructuredResumeV1({
    ...current,
    basics: { ...current.basics, [key]: typeof value === "string" ? value : String(value ?? "") },
  });
}

function updateArrayItem(resume, section, index, patch) {
  if (!ARRAY_SECTIONS.has(section)) return editableCopy(resume);
  const current = editableCopy(resume);
  const sourceItems = Array.isArray(resume?.[section]) ? resume[section] : current[section];
  const items = Array.isArray(sourceItems) ? [...sourceItems] : [];
  if (index < 0 || index >= items.length) return current;
  items[index] = { ...items[index], ...(patch || {}) };
  return { ...current, [section]: items };
}

function addArrayItem(resume, section) {
  if (!ARRAY_SECTIONS.has(section)) return editableCopy(resume);
  const current = editableCopy(resume);
  const items = Array.isArray(current[section]) ? current[section] : [];
  return { ...current, [section]: [...items, { ...EMPTY_ITEMS[section] }] };
}

function removeArrayItem(resume, section, index) {
  if (!ARRAY_SECTIONS.has(section)) return editableCopy(resume);
  const current = editableCopy(resume);
  const sourceItems = Array.isArray(resume?.[section]) ? resume[section] : current[section];
  const items = Array.isArray(sourceItems) ? sourceItems : [];
  return { ...current, [section]: items.filter((_, itemIndex) => itemIndex !== index) };
}

function updateSkillsField(resume, key, values) {
  if (!SKILL_FIELDS.has(key)) return editableCopy(resume);
  const current = editableCopy(resume);
  return {
    ...current,
    skills: { ...current.skills, [key]: splitValues(values) },
  };
}

function updateOptionalField(resume, key, value) {
  const current = editableCopy(resume);
  const nextValue = OPTIONAL_ARRAY_FIELDS.has(key) ? splitValues(value) : (typeof value === "string" ? value : String(value ?? ""));
  return {
    ...current,
    optional: { ...current.optional, [key]: nextValue },
  };
}

module.exports = {
  addArrayItem,
  removeArrayItem,
  updateArrayItem,
  updateBasicsField,
  updateOptionalField,
  updateSkillsField,
};

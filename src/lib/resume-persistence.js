/* eslint-disable @typescript-eslint/no-require-imports */
const { EMPTY_STRUCTURED_RESUME, migrateMarkdownToStructuredResumeV1, normalizeStructuredResumeV1 } = require("./resume-schema.js");
const { DEFAULT_TEMPLATE_ID, normalizeResumeTemplateId } = require("./resume-templates.js");
const { normalizeResumeMarkdown } = require("./resume-formatting.js");

function sanitizeResume(resume = {}) {
  const originalContent = normalizeResumeMarkdown(resume.original_content || "");
  const optimizedContent = normalizeResumeMarkdown(resume.optimized_content || "");
  const structuredResume = resume.structuredResume && resume.structuredResume.basics
    ? normalizeStructuredResumeV1(resume.structuredResume)
    : (originalContent ? migrateMarkdownToStructuredResumeV1(originalContent) : EMPTY_STRUCTURED_RESUME);
  return {
    title: resume.title || "我的简历",
    position: resume.position || "",
    original_content: originalContent,
    optimized_content: optimizedContent,
    structuredResume,
    optimizedStructuredResume: resume.optimizedStructuredResume ? normalizeStructuredResumeV1(resume.optimizedStructuredResume) : null,
    templateId: normalizeResumeTemplateId(resume.templateId || DEFAULT_TEMPLATE_ID),
  };
}

/**
 * @param {{
 *   resume: Record<string, any>,
 *   user: { id: string, email?: string },
 *   currentResumeId?: string | null,
 *   userType?: string,
 *   workflowMode?: string,
 *   strength?: string,
 *   diagnosis?: any,
 *   optimization?: any,
 *   jdText?: string,
 * }} params
 */
function serializeResumeForDatabase({
  resume,
  user,
  currentResumeId = null,
  userType = "auto",
  workflowMode = "fast",
  strength = "professional",
  diagnosis = null,
  optimization = null,
  jdText = "",
}) {
  const normalized = sanitizeResume(resume);
  const payload = {
    user_id: user.id,
    title: normalized.title,
    position: normalized.position,
    original_content: normalized.original_content,
    optimized_content: normalized.optimized_content,
    target_jd: jdText || "",
    structured_resume: normalized.structuredResume,
    optimized_structured_resume: normalized.optimizedStructuredResume,
    template_id: normalized.templateId,
    user_type: userType,
    workflow_mode: workflowMode,
    strength,
    diagnosis,
    optimization,
  };
  if (currentResumeId) payload.id = currentResumeId;
  return payload;
}

function deserializeResumeFromDatabase(row = {}) {
  const originalContent = normalizeResumeMarkdown(row.original_content || "");
  const optimizedContent = normalizeResumeMarkdown(row.optimized_content || "");
  const structuredResume = row.structured_resume
    ? normalizeStructuredResumeV1(row.structured_resume)
    : (originalContent ? migrateMarkdownToStructuredResumeV1(originalContent) : EMPTY_STRUCTURED_RESUME);
  const optimizedStructuredResume = row.optimized_structured_resume
    ? normalizeStructuredResumeV1(row.optimized_structured_resume)
    : (optimizedContent ? migrateMarkdownToStructuredResumeV1(optimizedContent) : null);
  return {
    id: row.id || null,
    resume: {
      title: row.title || "我的简历",
      position: row.position || "",
      original_content: originalContent,
      optimized_content: optimizedContent,
      structuredResume,
      optimizedStructuredResume,
      templateId: normalizeResumeTemplateId(row.template_id || DEFAULT_TEMPLATE_ID),
    },
    userType: row.user_type || "auto",
    workflowMode: row.workflow_mode || "fast",
    strength: row.strength || "professional",
    diagnosis: row.diagnosis || null,
    optimization: row.optimization || null,
    jdText: row.target_jd || "",
  };
}

async function listUserResumes(client) {
  const { data, error } = await client
    .from("resumes")
    .select("id,title,position,template_id,updated_at,created_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message || "简历列表加载失败");
  return data || [];
}

async function fetchUserResume(client, id) {
  const { data, error } = await client
    .from("resumes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message || "简历加载失败");
  return deserializeResumeFromDatabase(data);
}

async function saveUserResume(client, payload) {
  const query = payload.id
    ? client.from("resumes").update(payload).eq("id", payload.id).select("*").single()
    : client.from("resumes").insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) throw new Error(error.message || "简历保存失败");
  return data;
}

async function deleteUserResume(client, id) {
  const { error } = await client.from("resumes").delete().eq("id", id);
  if (error) throw new Error(error.message || "简历删除失败");
  return { id };
}

function getResumeStateAfterCloudDelete({ deletedResumeId, currentResumeId, emptyResume, currentResume }) {
  if (deletedResumeId !== currentResumeId) {
    return { currentResumeId, resume: currentResume };
  }
  return { currentResumeId: null, resume: emptyResume };
}

async function saveResumeWithPersistence({ isDemo, resume, saveLocal, saveCloud }) {
  if (isDemo) {
    saveLocal(resume);
    return { mode: "local" };
  }
  const saved = await saveCloud(resume);
  return { mode: "cloud", saved };
}

module.exports = {
  deleteUserResume,
  deserializeResumeFromDatabase,
  fetchUserResume,
  getResumeStateAfterCloudDelete,
  listUserResumes,
  saveResumeWithPersistence,
  saveUserResume,
  serializeResumeForDatabase,
};

"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  GitCompare,
  LayoutTemplate,
  Loader2,
  LogOut,
  Monitor,
  Sparkles,
  Stethoscope,
  Target,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ResumePreview } from "@/components/resume-preview";
import { StructuredResumeEditor } from "@/components/structured-resume-editor";
import { ResumeTemplateCenter } from "@/components/resume-template-center";
import { ResumeTemplateSelector } from "@/components/resume-template-selector";
import { recommendResumeTemplates } from "@/lib/resume-template-recommendation.js";
import { normalizeResumeMarkdown } from "@/lib/resume-formatting.js";
import {
  deleteUserResume,
  fetchUserResume,
  getResumeStateAfterCloudDelete,
  listOptimizationRecords,
  listUserResumes,
  saveResumeWithPersistence,
  saveUserResume,
  saveOptimizationRecord,
  serializeResumeForDatabase,
} from "@/lib/resume-persistence.js";
import { DEFAULT_TEMPLATE_ID, getResumeTemplate, normalizeResumeTemplateId, RESUME_TEMPLATES } from "@/lib/resume-templates.js";
import { renderTemplateExportHtml } from "@/lib/resume-template-rendering.js";
import {
  EMPTY_STRUCTURED_RESUME,
  migrateMarkdownToStructuredResumeV1,
  normalizeStructuredResumeV1,
  renderStructuredResumeV1Markdown,
} from "@/lib/resume-schema.js";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "resume_demo";

type Version = "original" | "optimized";
type EditorMode = "structured" | "markdown";
type WorkflowMode = "fast" | "professional";
type UserType = "auto" | "fresh_graduate" | "junior" | "career_switcher" | "senior";
type Strength = "conservative" | "professional" | "strong";
type CloudSaveStatus = "idle" | "saving" | "saved" | "failed";

type ResumeState = {
  title: string;
  position: string;
  original_content: string;
  optimized_content: string;
  structuredResume: Record<string, unknown>;
  optimizedStructuredResume: Record<string, unknown> | null;
  templateId: string;
};

type User = { id: string; email: string };
type ResumeListItem = {
  id: string;
  title: string | null;
  position: string | null;
  template_id: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type DimensionScore = { name: string; score: number; reason: string };
type TopIssue = {
  severity: "high" | "medium" | "low";
  section: string;
  originalExcerpt: string;
  problem: string;
  suggestion: string;
};
type Diagnosis = {
  userType: Exclude<UserType, "auto">;
  userTypeReason: string;
  overallScore: number;
  dimensionScores: DimensionScore[];
  topIssues: TopIssue[];
  jdMatch: {
    enabled: boolean;
    matchScore: number;
    hardRequirements: string[];
    matchedKeywords: string[];
    missingKeywords: string[];
    recommendations: string[];
  };
  riskNotes: string[];
};
type EditExplanation = {
  originalExcerpt: string;
  revisedExcerpt: string;
  reason: string;
  requiresUserConfirmation: boolean;
  confirmationPrompt?: string;
};
type Optimization = {
  optimizedMarkdown: string;
  editSummary: string[];
  editExplanations: EditExplanation[];
  riskNotes: string[];
};

const USER_TYPES: Array<{ value: UserType; label: string; note: string }> = [
  { value: "auto", label: "AI 自动判断", note: "适合不确定阶段" },
  { value: "fresh_graduate", label: "应届生", note: "校园/项目/潜力" },
  { value: "junior", label: "1-3 年职场人", note: "贡献/量化/成长" },
  { value: "career_switcher", label: "转行求职者", note: "迁移能力/叙事" },
  { value: "senior", label: "中高级人才", note: "影响力/规模/决策" },
];

const STRENGTHS: Array<{ value: Strength; label: string }> = [
  { value: "conservative", label: "保守润色" },
  { value: "professional", label: "专业增强" },
  { value: "strong", label: "强岗位匹配" },
];

const EMPTY_RESUME: ResumeState = {
  title: "我的简历",
  position: "",
  original_content: "",
  optimized_content: "",
  structuredResume: EMPTY_STRUCTURED_RESUME,
  optimizedStructuredResume: null,
  templateId: DEFAULT_TEMPLATE_ID,
};

function loadResume(): ResumeState {
  if (typeof window === "undefined") return EMPTY_RESUME;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? { ...EMPTY_RESUME, ...JSON.parse(data) } : EMPTY_RESUME;
    const originalContent = normalizeResumeMarkdown(parsed.original_content || "");
    const optimizedContent = normalizeResumeMarkdown(parsed.optimized_content || "");
    const structuredResume = parsed.structuredResume && parsed.structuredResume.basics
      ? normalizeStructuredResumeV1(parsed.structuredResume)
      : (originalContent ? migrateMarkdownToStructuredResumeV1(originalContent) : EMPTY_STRUCTURED_RESUME);
    return {
      ...parsed,
      original_content: originalContent,
      optimized_content: optimizedContent,
      structuredResume,
      optimizedStructuredResume: parsed.optimizedStructuredResume ? normalizeStructuredResumeV1(parsed.optimizedStructuredResume) : null,
      templateId: normalizeResumeTemplateId(parsed.templateId),
    };
  } catch {
    return EMPTY_RESUME;
  }
}

function saveResume(data: ResumeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "未知错误";
}

function formatImportedText(text: string) {
  return normalizeResumeMarkdown(text);
}

function severityClass(severity: TopIssue["severity"]) {
  if (severity === "high") return "text-red-600 bg-red-50 border-red-100";
  if (severity === "medium") return "text-amber-700 bg-amber-50 border-amber-100";
  return "text-slate-600 bg-slate-50 border-slate-100";
}

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [resume, setResume] = useState<ResumeState>(loadResume);
  const [version, setVersion] = useState<Version>("original");
  const [editorMode, setEditorMode] = useState<EditorMode>("structured");
  const [editorOpen, setEditorOpen] = useState(true);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("fast");
  const [userType, setUserType] = useState<UserType>("auto");
  const [jdEnabled, setJdEnabled] = useState(false);
  const [jdText, setJdText] = useState("");
  const [strength, setStrength] = useState<Strength>("professional");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [diagnosisMarkdown, setDiagnosisMarkdown] = useState("");
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [busy, setBusy] = useState<"diagnose" | "optimize" | "flow" | "import" | null>(null);
  const [optimizingModule, setOptimizingModule] = useState<string | null>(null);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [recommendTargetRole, setRecommendTargetRole] = useState("");
  const [recommendWorkYears, setRecommendWorkYears] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<Array<{ id: string; type: string; input_summary: string; output_summary: string; model_tier: string; created_at: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [error, setError] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [templateCenterOpen, setTemplateCenterOpen] = useState(false);
  const [resumeListOpen, setResumeListOpen] = useState(false);
  const [resumeList, setResumeList] = useState<ResumeListItem[]>([]);
  const [resumeListLoading, setResumeListLoading] = useState(false);
  const [resumeListError, setResumeListError] = useState("");
  const [currentResumeId, setCurrentResumeId] = useState<string | null>(null);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<CloudSaveStatus>("idle");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const hasOriginal = Boolean(resume.original_content.trim());
  const hasOptimized = Boolean(resume.optimized_content.trim());
  const currentMarkdown = version === "original" ? resume.original_content : resume.optimized_content;
  const currentStructuredResume = version === "optimized"
    ? (resume.optimizedStructuredResume || (resume.optimized_content ? migrateMarkdownToStructuredResumeV1(resume.optimized_content) : resume.structuredResume))
    : resume.structuredResume;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted || !data.session?.user) return;
      setUser({
        id: data.session.user.id,
        email: data.session.user.email || "",
      });
      setDemo(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  function updateResume(next: ResumeState | ((current: ResumeState) => ResumeState)) {
    setCloudSaveStatus("idle");
    setResume((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      saveResume(resolved);
      return resolved;
    });
  }

  function updateCurrentMarkdown(content: string) {
    const structured = migrateMarkdownToStructuredResumeV1(content);
    const next = version === "original"
      ? { ...resume, original_content: content, structuredResume: structured }
      : { ...resume, optimized_content: content, optimizedStructuredResume: structured };
    updateResume(next);
  }

  function handleStructuredResumeChange(nextStructuredResume: Record<string, unknown>) {
    const markdown = renderStructuredResumeV1Markdown(nextStructuredResume);
    updateResume((current) => version === "original"
      ? { ...current, structuredResume: nextStructuredResume, original_content: markdown }
      : { ...current, optimizedStructuredResume: nextStructuredResume, optimized_content: markdown });
  }

  function formatCurrentMarkdown() {
    const formatted = normalizeResumeMarkdown(currentMarkdown);
    if (!formatted) return;
    updateCurrentMarkdown(formatted);
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("import");
    setError("");

    try {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".pdf") && !fileName.endsWith(".docx") && !fileName.endsWith(".txt") && !fileName.endsWith(".md") && !fileName.endsWith(".markdown")) {
        throw new Error(".doc 暂不支持，请上传 PDF、DOCX、TXT 或 Markdown 文件。");
      }

      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "文件解析失败");

      const formatted = formatImportedText(data.markdown || data.text || "");
      if (formatted.length < 30) throw new Error("文件解析出的文本过少，请改为粘贴简历正文。");
      const structured = data.structured ? normalizeStructuredResumeV1(data.structured) : migrateMarkdownToStructuredResumeV1(formatted);
      const compatMarkdown = data.markdown || renderStructuredResumeV1Markdown(structured);
      updateResume({ ...resume, original_content: normalizeResumeMarkdown(compatMarkdown), structuredResume: structured });
      setVersion("original");
    } catch (exception) {
      setError(`导入失败：${getErrorMessage(exception)}`);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function signIn() {
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.session?.user) {
          setUser({ id: data.session.user.id, email: data.session.user.email || email });
        } else {
          setAuthError("注册成功，请切换到登录模式登录");
          setAuthMode("login");
        }
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("认证失败");
      setUser({ id: data.user.id, email: data.user.email || email });
      setDemo(false);
    } catch (exception) {
      setAuthError(getErrorMessage(exception));
    } finally {
      setAuthLoading(false);
    }
  }

  function enterDemo() {
    setDemo(true);
    setUser({ id: "demo", email: "demo" });
    setCurrentResumeId(null);
    setCloudSaveStatus("idle");
    setResume(loadResume());
  }

  async function handleLogout() {
    if (!demo) await supabase.auth.signOut();
    setDemo(false);
    setUser(null);
    setCurrentResumeId(null);
    setCloudSaveStatus("idle");
    setResumeListOpen(false);
    setResumeList([]);
  }

  async function requestDiagnosis() {
    if (!hasOriginal) return null;
    setBusy("diagnose");
    setError("");

    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: resume.original_content,
          structuredResume: resume.structuredResume,
          userType,
          targetRole: resume.position,
          jdText: jdEnabled ? jdText : "",
        }),
      });
      const data = await response.json();
     if (!response.ok || data.error) throw new Error(data.error || "诊断失败");
     setDiagnosis(data.structured);
     setDiagnosisMarkdown(data.diagnosis || "");
      saveRecord("diagnose", resume.position || "简历诊断", `得分 ${data.structured?.overallScore ?? "?"}`, data.modelTier || "");
     return data.structured as Diagnosis;
    } catch (exception) {
      setError(getErrorMessage(exception));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function requestOptimization(inputDiagnosis?: Diagnosis | null) {
    if (!hasOriginal) return;
    setBusy("optimize");
    setError("");

    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: resume.original_content,
          structuredResume: resume.structuredResume,
          userType,
          targetRole: resume.position,
          jdText: jdEnabled ? jdText : "",
          strength: workflowMode === "fast" ? "professional" : strength,
          structuredDiagnosis: inputDiagnosis || diagnosis,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "优化失败");
      const result = data.optimization as Optimization;
      const optimizedMarkdown = normalizeResumeMarkdown(result.optimizedMarkdown || data.optimized || "");
      const optimizedStructuredResume = data.structuredResume
        ? normalizeStructuredResumeV1(data.structuredResume)
        : migrateMarkdownToStructuredResumeV1(optimizedMarkdown);
      setOptimization(result);
      updateResume({ ...resume, optimized_content: optimizedMarkdown, optimizedStructuredResume });
      setVersion("optimized");
      saveRecord("optimize", resume.position || "简历优化", result.editSummary?.slice(0, 2).join("；") || "优化完成", data.modelTier || "");
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setBusy(null);
    }
  }

  async function runFullFlow() {
    setBusy("flow");
    setError("");
    const nextDiagnosis = await requestDiagnosis();
    if (nextDiagnosis) await requestOptimization(nextDiagnosis);
    setBusy(null);
  }

  function downloadPdf() {
    if (!currentMarkdown) return;
    const html = renderTemplateExportHtml({ title: resume.title, structuredResume: currentStructuredResume, templateId: resume.templateId });
    const windowRef = window.open("", "_blank");
    if (!windowRef) return;
    windowRef.document.write(html);
    windowRef.document.close();
    setTimeout(() => windowRef.print(), 300);
  }

  async function handleOptimizeModule(moduleName: string) {
    setOptimizingModule(moduleName);
    setError("");
    try {
      const response = await fetch("/api/optimize-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module: moduleName,
          structuredResume: resume.structuredResume,
          userType,
          targetRole: resume.position,
          jdText: jdEnabled ? jdText : "",
          strength: workflowMode === "fast" ? "professional" : strength,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "模块优化失败");
      const nextStructured = { ...resume.structuredResume, [moduleName]: data.optimizedModule };
      const markdown = renderStructuredResumeV1Markdown(nextStructured);
      updateResume({ ...resume, structuredResume: nextStructured, original_content: normalizeResumeMarkdown(markdown) });
      setOptimization((prev) => prev ? { ...prev, editSummary: [...(data.optimization?.editSummary || []), ...(prev.editSummary || [])] } : null);
    } catch (exception) {
      setError(getErrorMessage(exception));
    } finally {
      setOptimizingModule(null);
    }
  }

  async function downloadWord() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");
    const resume = normalizeStructuredResumeV1(currentStructuredResume);
    const children: InstanceType<typeof Paragraph>[] = [];
    if (resume.basics.name) children.push(new Paragraph({ text: resume.basics.name, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
    const contactParts = [resume.basics.phone, resume.basics.email, resume.basics.location].filter(Boolean);
    if (contactParts.length) children.push(new Paragraph({ children: [new TextRun({ text: contactParts.join(" | "), size: 20 })], alignment: AlignmentType.CENTER }));
    if (resume.basics.job_target) children.push(new Paragraph({ children: [new TextRun({ text: `求职意向：${resume.basics.job_target}`, size: 20 })], alignment: AlignmentType.CENTER }));
    children.push(new Paragraph({ text: "" }));
    const addSection = (title: string) => children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
    const addBullet = (text: string) => children.push(new Paragraph({ text: `• ${text}`, spacing: { after: 60 } }));
    addSection("教育经历");
    for (const education of resume.education) {
      const parts = [education.school, education.major, education.degree, education.time_range].filter(Boolean);
      if (parts.length) children.push(new Paragraph({ children: [new TextRun({ text: parts.join(" - "), bold: true, size: 22 })] }));
      if (education.gpa) addBullet(`GPA: ${education.gpa}`);
      if (education.courses?.length) addBullet(`主修课程: ${education.courses.join("、")}`);
    }
    addSection("工作/实习经历");
    for (const work of resume.work) {
      const parts = [work.company, work.position, work.time_range].filter(Boolean);
      if (parts.length) children.push(new Paragraph({ children: [new TextRun({ text: parts.join(" - "), bold: true, size: 22 })] }));
      if (work.job_content) addBullet(work.job_content);
      if (work.job_result?.length) for (const r of work.job_result) if (r) addBullet(r);
    }
    addSection("项目经历");
    for (const project of resume.projects) {
      const parts = [project.project_name, project.role].filter(Boolean);
      if (parts.length) children.push(new Paragraph({ children: [new TextRun({ text: parts.join(" - "), bold: true, size: 22 })] }));
      if (project.project_intro) addBullet(project.project_intro);
      if (project.duty) addBullet(project.duty);
      if (project.achievement?.length) for (const a of project.achievement) if (a) addBullet(a);
    }
    addSection("专业技能");
    if (resume.skills.skill_hard?.length) addBullet(`硬技能: ${resume.skills.skill_hard.join("、")}`);
    if (resume.skills.skill_soft?.length) addBullet(`软技能: ${resume.skills.skill_soft.join("、")}`);
    if (resume.skills.certificate_list?.length) addBullet(`证书: ${resume.skills.certificate_list.join("、")}`);
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resume.basics.name || "简历"}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveResume() {
    if (!user) return;
    setCloudSaveStatus("saving");
    setError("");

    try {
      const result = await saveResumeWithPersistence({
        isDemo: demo,
        resume,
        saveLocal: saveResume,
        saveCloud: async () => {
          const payload = serializeResumeForDatabase({
            resume,
            user,
            currentResumeId,
            userType,
            workflowMode,
            strength,
            diagnosis,
            optimization,
            jdText: jdEnabled ? jdText : "",
          });
          return saveUserResume(supabase, payload);
        },
      });
      saveResume(resume);
      if (result.mode === "cloud" && result.saved?.id) {
        setCurrentResumeId(result.saved.id);
      }
      setCloudSaveStatus("saved");
    } catch (exception) {
      setCloudSaveStatus("failed");
      setError(`保存失败：${getErrorMessage(exception)}`);
    }
  }

  async function openResumeList() {
    setResumeListOpen(true);
    setResumeListError("");
    if (demo) {
      setResumeList([]);
      return;
    }

    setResumeListLoading(true);
    try {
      const rows = await listUserResumes(supabase);
      setResumeList(rows);
    } catch (exception) {
      setResumeListError(getErrorMessage(exception));
    } finally {
      setResumeListLoading(false);
    }
  }

  async function loadCloudResume(id: string) {
    setResumeListError("");
    try {
      const loaded = await fetchUserResume(supabase, id);
      setResume(loaded.resume);
      saveResume(loaded.resume);
      setCurrentResumeId(id);
      setUserType(loaded.userType as UserType);
      setWorkflowMode(loaded.workflowMode as WorkflowMode);
      setStrength(loaded.strength as Strength);
      setDiagnosis(loaded.diagnosis);
      setOptimization(loaded.optimization);
      setJdText(loaded.jdText || "");
      setJdEnabled(Boolean(loaded.jdText));
      setVersion("original");
      setCloudSaveStatus("saved");
      setResumeListOpen(false);
    } catch (exception) {
      setResumeListError(getErrorMessage(exception));
    }
  }

  async function removeCloudResume(id: string) {
    setResumeListError("");
    try {
      await deleteUserResume(supabase, id);
      setResumeList((current) => current.filter((item) => item.id !== id));
      const next = getResumeStateAfterCloudDelete({
        deletedResumeId: id,
        currentResumeId,
        emptyResume: EMPTY_RESUME,
        currentResume: resume,
      });
      setCurrentResumeId(next.currentResumeId);
      if (next.resume !== resume) {
        setResume(next.resume);
        saveResume(next.resume);
        setDiagnosis(null);
        setOptimization(null);
        setDiagnosisMarkdown("");
        setVersion("original");
      }
      setCloudSaveStatus("idle");
    } catch (exception) {
      setResumeListError(getErrorMessage(exception));
    }
  }

  function cloudSaveLabel() {
    if (cloudSaveStatus === "saving") return "保存中";
    if (cloudSaveStatus === "saved") return "已保存";
    if (cloudSaveStatus === "failed") return "保存失败";
    return "保存";
  }

  function formatCloudTime(value: string | null) {
    if (!value) return "未知时间";
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  function getTemplateName(templateId: string | null) {
    return getResumeTemplate(normalizeResumeTemplateId(templateId || DEFAULT_TEMPLATE_ID)).name;
  }

  function resetResume() {
    updateResume(EMPTY_RESUME);
    setCurrentResumeId(null);
    setCloudSaveStatus("idle");
    setVersion("original");
    setDiagnosis(null);
    setDiagnosisMarkdown("");
    setError("");
    setOptimization(null);
  }

  async function openHistory() {
    setHistoryOpen(true);
    setHistoryError("");
    if (demo) {
      setHistoryList([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const rows = await listOptimizationRecords(supabase, { resumeId: currentResumeId || undefined });
      setHistoryList(rows);
    } catch (exception) {
      setHistoryError(getErrorMessage(exception));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveRecord(type: string, inputSummary: string, outputSummary: string, modelTier: string) {
    if (demo || !user) return;
    try {
      await saveOptimizationRecord(supabase, {
        userId: user.id,
        resumeId: currentResumeId || undefined,
        type,
        inputSummary: inputSummary.slice(0, 500),
        outputSummary: outputSummary.slice(0, 500),
        modelTier,
      });
    } catch {
      // non-critical, silent
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-lg border bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 mb-3">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold">AI 简历优化工具</h1>
            <p className="text-sm text-muted-foreground mt-1">可信诊断，可解释优化</p>
          </div>
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault();
            signIn();
          }}>
            <Input placeholder="邮箱地址" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input placeholder="密码" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {authError && <p className={`text-xs ${authError.includes("成功") ? "text-green-600" : "text-destructive"}`}>{authError}</p>}
            <Button className="w-full" type="submit" disabled={authLoading}>
              {authLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {authMode === "login" ? "登录" : "注册"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {authMode === "login" ? "没有账号？" : "已有账号？"}
              <button type="button" className="text-primary hover:underline" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                {authMode === "login" ? "注册" : "登录"}
              </button>
            </p>
          </form>
          <Separator className="my-4" />
          <Button className="w-full" type="button" variant="outline" onClick={enterDemo}>
            <Monitor className="mr-2 h-4 w-4" />
            体验 Demo（无需登录）
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-950 md:h-screen md:flex-row md:overflow-hidden">
      <aside className="flex w-full flex-col border-b bg-white md:h-full md:w-[320px] md:flex-shrink-0 md:border-b-0 md:border-r">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">简历优化 AI</span>
            {demo && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Demo</span>}
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">简历标题</Label>
              <Input className="h-8 text-xs" value={resume.title} onChange={(event) => updateResume({ ...resume, title: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">目标岗位</Label>
              <Input className="h-8 text-xs" placeholder="例如：数据分析师" value={resume.position} onChange={(event) => updateResume({ ...resume, position: event.target.value })} />
            </div>
          </div>
        </div>

        <div className="max-h-[52svh] flex-1 overflow-auto p-4 space-y-5 md:max-h-none">
          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">模式</p>
            <div className="grid grid-cols-2 gap-2">
              {(["fast", "professional"] as WorkflowMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setWorkflowMode(mode)}
                  className={`rounded-md border px-3 py-2 text-left text-xs transition ${workflowMode === mode ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <span className="block font-semibold">{mode === "fast" ? "快速模式" : "专业模式"}</span>
                  <span className="text-[10px] text-muted-foreground">{mode === "fast" ? "一键出结果" : "诊断与解释"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">用户阶段</p>
            <div className="space-y-1.5">
              {USER_TYPES.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setUserType(item.value)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${userType === item.value ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{item.note}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">JD 匹配</p>
              <button className="text-xs text-blue-600" onClick={() => setJdEnabled(!jdEnabled)}>
                {jdEnabled ? "关闭" : "开启"}
              </button>
            </div>
            {jdEnabled && (
              <Textarea
                className="min-h-28 text-xs"
                placeholder="粘贴目标 JD，短文本会作为岗位方向处理"
                value={jdText}
                onChange={(event) => setJdText(event.target.value)}
              />
            )}
          </section>

          {workflowMode === "professional" && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">优化强度</p>
              <div className="space-y-1.5">
                {STRENGTHS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setStrength(item.value)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-xs font-medium transition ${strength === item.value ? "border-blue-600 bg-blue-50 text-blue-700" : "hover:bg-slate-50"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-2">
            <Button className="w-full justify-start" disabled={!hasOriginal || busy === "flow"} onClick={runFullFlow}>
              {busy === "flow" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              诊断并优化
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={!hasOriginal || busy === "diagnose"} onClick={requestDiagnosis}>
                {busy === "diagnose" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Stethoscope className="mr-1 h-3 w-3" />}
                只诊断
              </Button>
              <Button variant="outline" size="sm" disabled={!hasOriginal || busy === "optimize"} onClick={() => requestOptimization()}>
                {busy === "optimize" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Target className="mr-1 h-3 w-3" />}
                只优化
              </Button>
            </div>
            {error && (
              <div className="rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}
          </section>
        </div>

        <div className="border-t p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={version === "original" ? "default" : "outline"} size="sm" onClick={() => setVersion("original")}>原始版</Button>
            <Button variant={version === "optimized" ? "default" : "outline"} size="sm" disabled={!hasOptimized} onClick={() => setVersion("optimized")}>优化版</Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" size="sm" disabled={!hasOptimized} onClick={() => setCompareOpen(true)}><GitCompare className="mr-1 h-3 w-3" />对比</Button>
            <Button variant="ghost" size="sm" disabled={!currentMarkdown} onClick={downloadPdf}><Download className="mr-1 h-3 w-3" />PDF</Button>
            <Button variant="ghost" size="sm" disabled={!currentMarkdown} onClick={downloadWord}><FileText className="mr-1 h-3 w-3" />Word</Button>
            <Button variant="ghost" size="sm" onClick={resetResume}><Trash2 className="mr-1 h-3 w-3" />清空</Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-1 h-3 w-3" />退出</Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col md:h-full">
        <header className="flex flex-wrap items-start gap-2 border-b bg-white px-3 py-3 sm:items-center sm:gap-3 sm:px-4 md:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{resume.title || "我的简历"}</h2>
            <p className="text-xs text-muted-foreground">
              {version === "original" ? "原始版" : "优化版"}{resume.position ? ` · ${resume.position}` : ""}
            </p>
          </div>
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.markdown" onChange={importFile} disabled={busy === "import"} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy === "import"}>
            {busy === "import" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
            导入
          </Button>
          <ResumeTemplateSelector value={resume.templateId} onChange={(templateId) => updateResume({ ...resume, templateId })} />
          <Button variant="outline" size="sm" onClick={() => setTemplateCenterOpen(true)}>
            <LayoutTemplate className="mr-1 h-3 w-3" />
            <span>模板中心</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRecommendOpen(true)}>
            <Sparkles className="mr-1 h-3 w-3" />
            <span>智能推荐</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openResumeList}>
            <FileText className="mr-1 h-3 w-3" />
            <span>我的简历</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openHistory}>
            <Clock className="mr-1 h-3 w-3" />
            <span>优化记录</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(!editorOpen)}>
            {editorOpen ? <Eye className="mr-1 h-3 w-3" /> : <Edit3 className="mr-1 h-3 w-3" />}
            {editorOpen ? "预览" : "编辑"}
          </Button>
          <Button size="sm" onClick={handleSaveResume} disabled={cloudSaveStatus === "saving"}>
            {cloudSaveStatus === "saving" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileText className="mr-1 h-3 w-3" />}
            {cloudSaveLabel()}
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          {!currentMarkdown ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <div className="max-w-md text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <h3 className="font-semibold">导入或粘贴一份简历</h3>
                <p className="mt-1 text-sm text-muted-foreground">支持 PDF、DOCX、TXT 和 Markdown；完整内容越多，诊断越可信。</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
              <div className="min-w-0">
                <ResumePreview structuredResume={currentStructuredResume} title={resume.title} templateId={resume.templateId} />
              </div>
              <aside className="min-w-0 space-y-4">
                {diagnosis && (
                  <section className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">诊断分</p>
                        <p className="text-3xl font-bold text-blue-600">{diagnosis.overallScore}</p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="text-xs text-slate-600">{diagnosis.userTypeReason}</p>
                    <Separator className="my-3" />
                    <div className="space-y-2">
                      {diagnosis.dimensionScores.map((item) => (
                        <div key={item.name}>
                          <div className="flex justify-between text-xs">
                            <span>{item.name}</span>
                            <span className="font-semibold">{item.score}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded bg-slate-100">
                            <div className="h-1.5 rounded bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {diagnosis?.topIssues?.length ? (
                  <section className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">关键问题</p>
                    <div className="space-y-3">
                      {diagnosis.topIssues.map((issue, index) => (
                        <div key={`${issue.section}-${index}`} className="rounded-md border p-3">
                          <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${severityClass(issue.severity)}`}>{issue.severity}</span>
                          <p className="mt-2 text-xs font-semibold">{issue.section}</p>
                          <p className="mt-1 text-xs text-slate-700">{issue.problem}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{issue.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {diagnosis?.jdMatch?.enabled && (
                  <section className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">JD 匹配</p>
                    <p className="text-2xl font-bold">{diagnosis.jdMatch.matchScore}</p>
                    <div className="mt-3 space-y-2 text-xs">
                      <p><span className="font-semibold">已匹配：</span>{diagnosis.jdMatch.matchedKeywords.join("、") || "暂无"}</p>
                      <p><span className="font-semibold">缺口：</span>{diagnosis.jdMatch.missingKeywords.join("、") || "暂无"}</p>
                    </div>
                  </section>
                )}

                {optimization?.editSummary?.length ? (
                  <section className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">优化摘要</p>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {optimization.editSummary.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </section>
                ) : null}

                {workflowMode === "professional" && optimization?.editExplanations?.length ? (
                  <section className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">可解释编辑</p>
                    <div className="space-y-3">
                      {optimization.editExplanations.map((item, index) => (
                        <div key={`${item.originalExcerpt}-${index}`} className="rounded-md border p-3 text-xs">
                          <p className="font-semibold">为什么改</p>
                          <p className="mt-1 text-slate-700">{item.reason}</p>
                          {item.requiresUserConfirmation && (
                            <p className="mt-2 flex items-start gap-1 text-amber-700">
                              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                              {item.confirmationPrompt || "该修改需要用户确认事实。"}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {(diagnosis?.riskNotes?.length || optimization?.riskNotes?.length) ? (
                  <section className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground">风险提示</p>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {[...(diagnosis?.riskNotes || []), ...(optimization?.riskNotes || [])].map((item, index) => <li key={`${item}-${index}`}>- {item}</li>)}
                    </ul>
                  </section>
                ) : null}
              </aside>
            </div>
          )}
        </div>

        {editorOpen && (
          <div className="flex h-[38svh] min-h-48 flex-col border-t bg-white md:h-56">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">简历编辑器</span>
                <div className="inline-flex rounded-md border bg-slate-50 p-0.5">
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-[11px] font-medium ${editorMode === "structured" ? "bg-white text-blue-700 shadow-sm" : "text-muted-foreground hover:text-slate-900"}`}
                    onClick={() => setEditorMode("structured")}
                  >
                    结构化
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-[11px] font-medium ${editorMode === "markdown" ? "bg-white text-blue-700 shadow-sm" : "text-muted-foreground hover:text-slate-900"}`}
                    onClick={() => setEditorMode("markdown")}
                  >
                    Markdown兼容
                  </button>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{version === "original" ? "编辑原始简历" : "编辑优化版本"}</span>
                {editorMode === "markdown" && (
                  <Button className="h-6 px-2 text-[10px]" variant="ghost" size="sm" disabled={!currentMarkdown.trim()} onClick={formatCurrentMarkdown}>
                    <Wand2 className="mr-1 h-3 w-3" />
                    格式化
                  </Button>
                )}
              </div>
            </div>
            {editorMode === "structured" ? (
              <StructuredResumeEditor structuredResume={currentStructuredResume} userType={userType} onChange={handleStructuredResumeChange} onOptimizeModule={handleOptimizeModule} optimizingModule={optimizingModule} />
            ) : (
              <Textarea
                className="flex-1 resize-none rounded-none border-0 p-3 font-mono text-xs leading-relaxed focus-visible:ring-0 sm:p-4"
                placeholder="# 我的简历&#10;&#10;## 个人信息&#10;- **姓名**：张三&#10;- **电话**：13800138000&#10;&#10;## 项目经历&#10;- 描述你的真实经历、行动和结果"
                value={currentMarkdown}
                onChange={(event) => updateCurrentMarkdown(event.target.value)}
              />
            )}
          </div>
        )}
      </main>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1rem)] max-w-6xl overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>版本对比</DialogTitle>
            <DialogDescription>左侧为原始简历，右侧为优化版本。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">原始版</h4>
              <div className="max-h-[70vh] overflow-auto rounded-md border bg-white p-4 text-xs"><ReactMarkdown>{normalizeResumeMarkdown(resume.original_content)}</ReactMarkdown></div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">优化版</h4>
              <div className="max-h-[70vh] overflow-auto rounded-md border bg-white p-4 text-xs"><ReactMarkdown>{normalizeResumeMarkdown(resume.optimized_content)}</ReactMarkdown></div>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setCompareOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResumeTemplateCenter
        open={templateCenterOpen}
        value={resume.templateId}
        userType={userType}
        targetRole={resume.position}
        structuredResume={currentStructuredResume}
        onOpenChange={setTemplateCenterOpen}
        onSelect={(templateId) => {
          updateResume((current) => ({ ...current, templateId }));
          setTemplateCenterOpen(false);
        }}
      />

      <Dialog open={recommendOpen} onOpenChange={setRecommendOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1rem)] max-w-2xl overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>AI 智能模板推荐</DialogTitle>
            <DialogDescription>填写基本信息，AI 会为你推荐最合适的简历模板。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">目标岗位</Label>
                <Input className="h-8 text-xs" placeholder="例如：产品经理" value={recommendTargetRole} onChange={(e) => setRecommendTargetRole(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">工作年限</Label>
                <Input className="h-8 text-xs" placeholder="例如：3年" value={recommendWorkYears} onChange={(e) => setRecommendWorkYears(e.target.value)} />
              </div>
            </div>
            {(recommendTargetRole || recommendWorkYears) && (() => {
              const recommendations = recommendResumeTemplates({
                userType: recommendWorkYears.includes("应届") || recommendWorkYears.includes("实习") ? "fresh_graduate"
                  : recommendWorkYears.includes("10") || recommendWorkYears.includes("资深") || recommendWorkYears.includes("高级") ? "senior"
                  : userType,
                targetRole: recommendTargetRole || resume.position,
                structuredResume: currentStructuredResume,
              });
              return (
                <div className="space-y-3">
                  {recommendations.map((rec) => {
                    const template = RESUME_TEMPLATES.find((t: { id: string }) => t.id === rec.templateId);
                    if (!template) return null;
                    const isCurrent = resume.templateId === rec.templateId;
                    return (
                      <div key={rec.templateId} className="rounded-md border bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{template.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{template.description}</p>
                            <p className="mt-2 text-xs text-blue-700">推荐理由：{rec.reason}</p>
                          </div>
                          <Button
                            size="sm"
                            variant={isCurrent ? "outline" : "default"}
                            disabled={isCurrent}
                            onClick={() => {
                              updateResume((current) => ({ ...current, templateId: rec.templateId }));
                              setRecommendOpen(false);
                            }}
                          >
                            {isCurrent ? "使用中" : "选用"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setRecommendOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resumeListOpen} onOpenChange={setResumeListOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1rem)] max-w-3xl overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>我的简历</DialogTitle>
            <DialogDescription>
              {demo ? "Demo 模式仅保存在本机浏览器；登录后可保存到云端。" : "打开、删除或继续编辑你保存过的云端简历。"}
            </DialogDescription>
          </DialogHeader>

          {demo ? (
            <div className="rounded-md border bg-amber-50 p-4 text-sm text-amber-800">
              当前是 Demo 模式，保存按钮会继续写入本机 localStorage，不会调用 Supabase。
            </div>
          ) : (
            <div className="space-y-3">
              {resumeListLoading && (
                <div className="flex items-center gap-2 rounded-md border bg-white p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载云端简历
                </div>
              )}

              {resumeListError && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {resumeListError}
                </div>
              )}

              {!resumeListLoading && !resumeList.length && !resumeListError && (
                <div className="rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">
                  暂无云端简历，点击工作台右上角保存后会出现在这里。
                </div>
              )}

              {resumeList.map((item) => (
                <div key={item.id} className="rounded-md border bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.title || "我的简历"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.position || "未填写目标岗位"} · 模板：{getTemplateName(item.template_id)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        更新时间：{formatCloudTime(item.updated_at || item.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                      <Button size="sm" variant="outline" onClick={() => loadCloudResume(item.id)}>
                        打开
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => removeCloudResume(item.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setResumeListOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(diagnosisMarkdown) && workflowMode === "fast"} onOpenChange={() => setDiagnosisMarkdown("")}>
        <DialogContent className="max-h-[85svh] w-[calc(100vw-1rem)] max-w-2xl overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>快速诊断报告</DialogTitle>
            <DialogDescription>本次快速模式生成的结构化诊断摘要。</DialogDescription>
          </DialogHeader>
          <div className="text-sm"><ReactMarkdown>{diagnosisMarkdown}</ReactMarkdown></div>
          <DialogFooter>
            <Button size="sm" onClick={() => setDiagnosisMarkdown("")}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[92svh] w-[calc(100vw-1rem)] max-w-2xl overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>优化记录</DialogTitle>
            <DialogDescription>
              {demo ? "Demo 模式不保存操作记录。" : "查看诊断和优化操作的历史记录。"}
            </DialogDescription>
          </DialogHeader>

          {demo ? (
            <div className="rounded-md border bg-amber-50 p-4 text-sm text-amber-800">
              当前是 Demo 模式，操作记录仅登录后可见。
            </div>
          ) : (
            <div className="space-y-3">
              {historyLoading && (
                <div className="flex items-center gap-2 rounded-md border bg-white p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在加载操作记录
                </div>
              )}

              {historyError && (
                <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {historyError}
                </div>
              )}

              {!historyLoading && !historyList.length && !historyError && (
                <div className="rounded-md border bg-slate-50 p-4 text-sm text-muted-foreground">
                  暂无操作记录。
                </div>
              )}

              {historyList.map((record) => (
                <div key={record.id} className="rounded-md border bg-white p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${record.type === "diagnose" ? "text-blue-700 bg-blue-50 border-blue-100" : "text-green-700 bg-green-50 border-green-100"}`}>
                          {record.type === "diagnose" ? "诊断" : "优化"}
                        </span>
                        {record.model_tier && (
                          <span className="text-[10px] text-muted-foreground">{record.model_tier}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-700 truncate">{record.input_summary || "无摘要"}</p>
                      <p className="mt-1 text-xs text-slate-500 truncate">{record.output_summary || "无输出摘要"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatCloudTime(record.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setHistoryOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

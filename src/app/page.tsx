"use client";

import { ChangeEvent, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  GitCompare,
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
import { normalizeResumeMarkdown } from "@/lib/resume-formatting.js";

const STORAGE_KEY = "resume_demo";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Version = "original" | "optimized";
type WorkflowMode = "fast" | "professional";
type UserType = "auto" | "fresh_graduate" | "junior" | "career_switcher" | "senior";
type Strength = "conservative" | "professional" | "strong";

type ResumeState = {
  title: string;
  position: string;
  original_content: string;
  optimized_content: string;
};

type User = { id: string; email: string };

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
};

function loadResume(): ResumeState {
  if (typeof window === "undefined") return EMPTY_RESUME;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? { ...EMPTY_RESUME, ...JSON.parse(data) } : EMPTY_RESUME;
    return {
      ...parsed,
      original_content: normalizeResumeMarkdown(parsed.original_content || ""),
      optimized_content: normalizeResumeMarkdown(parsed.optimized_content || ""),
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [demo, setDemo] = useState(false);
  const [resume, setResume] = useState<ResumeState>(loadResume);
  const [version, setVersion] = useState<Version>("original");
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
  const [error, setError] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const hasOriginal = Boolean(resume.original_content.trim());
  const hasOptimized = Boolean(resume.optimized_content.trim());
  const currentMarkdown = version === "original" ? resume.original_content : resume.optimized_content;

  function updateResume(next: ResumeState) {
    setResume(next);
    saveResume(next);
  }

  function updateCurrentMarkdown(content: string) {
    const next = version === "original"
      ? { ...resume, original_content: content }
      : { ...resume, optimized_content: content };
    updateResume(next);
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
      updateResume({ ...resume, original_content: formatted });
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
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setAuthError("Supabase 环境变量未配置，请检查 .env.local");
      return;
    }

    setAuthLoading(true);
    try {
      const endpoint = authMode === "register"
        ? `${SUPABASE_URL}/auth/v1/signup`
        : `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || data.msg || "认证失败");
      if (authMode === "register") {
        setAuthError("注册成功，请切换到登录模式登录");
        setAuthMode("login");
      } else {
        setUser({ id: data.user.id, email: data.user.email });
      }
    } catch (exception) {
      setAuthError(getErrorMessage(exception));
    } finally {
      setAuthLoading(false);
    }
  }

  function enterDemo() {
    setDemo(true);
    setUser({ id: "demo", email: "demo" });
    setResume(loadResume());
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
          userType,
          targetRole: resume.position,
          jdText: jdEnabled ? jdText : "",
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "诊断失败");
      setDiagnosis(data.structured);
      setDiagnosisMarkdown(data.diagnosis || "");
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
      setOptimization(result);
      updateResume({ ...resume, optimized_content: optimizedMarkdown });
      setVersion("optimized");
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
    const html = escapeHtml(normalizeResumeMarkdown(currentMarkdown))
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/\n/g, "<br/>")
      .replace(/((?:<li>.*<\/li><br\/>)+)/g, "<ul>$1</ul>");
    const windowRef = window.open("", "_blank");
    if (!windowRef) return;
    windowRef.document.write(`<html><head><meta charset="utf-8"><title>${escapeHtml(resume.title)}</title><style>body{font-family:Arial,sans-serif;max-width:794px;margin:40px auto;padding:20px;font-size:13px;line-height:1.6;color:#111827}h1{text-align:center;border-bottom:2px solid #111827;padding-bottom:12px;font-size:20px}h2{border-bottom:1px solid #d1d5db;margin-top:20px;padding-bottom:4px;font-size:15px}h3{font-size:14px}li{margin-bottom:3px}strong{color:#111827}</style></head><body>${html}</body></html>`);
    windowRef.document.close();
    setTimeout(() => windowRef.print(), 300);
  }

  function resetResume() {
    updateResume(EMPTY_RESUME);
    setVersion("original");
    setDiagnosis(null);
    setOptimization(null);
    setDiagnosisMarkdown("");
    setError("");
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
    <div className="flex h-screen bg-slate-100 text-slate-950">
      <aside className="w-[320px] flex-shrink-0 border-r bg-white flex flex-col">
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

        <div className="flex-1 overflow-auto p-4 space-y-5">
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
            <Button variant="ghost" size="sm" onClick={resetResume}><Trash2 className="mr-1 h-3 w-3" />清空</Button>
            <Button variant="ghost" size="sm" onClick={() => { setDemo(false); setUser(null); }}><LogOut className="mr-1 h-3 w-3" />退出</Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b bg-white px-6 py-3">
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
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(!editorOpen)}>
            {editorOpen ? <Eye className="mr-1 h-3 w-3" /> : <Edit3 className="mr-1 h-3 w-3" />}
            {editorOpen ? "预览" : "编辑"}
          </Button>
          <Button size="sm" onClick={() => saveResume(resume)}>
            <FileText className="mr-1 h-3 w-3" />
            保存
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {!currentMarkdown ? (
            <div className="flex h-full min-h-80 items-center justify-center">
              <div className="max-w-md text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <h3 className="font-semibold">导入或粘贴一份简历</h3>
                <p className="mt-1 text-sm text-muted-foreground">支持 PDF、DOCX、TXT 和 Markdown；完整内容越多，诊断越可信。</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
              <div className="min-w-0">
                <ResumePreview markdown={currentMarkdown} title={resume.title} />
              </div>
              <aside className="space-y-4">
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
          <div className="h-56 border-t bg-white flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Markdown 编辑器</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{version === "original" ? "编辑原始简历" : "编辑优化版本"}</span>
                <Button className="h-6 px-2 text-[10px]" variant="ghost" size="sm" disabled={!currentMarkdown.trim()} onClick={formatCurrentMarkdown}>
                  <Wand2 className="mr-1 h-3 w-3" />
                  格式化
                </Button>
              </div>
            </div>
            <Textarea
              className="flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs leading-relaxed focus-visible:ring-0"
              placeholder="# 我的简历&#10;&#10;## 个人信息&#10;- **姓名**：张三&#10;- **电话**：13800138000&#10;&#10;## 项目经历&#10;- 描述你的真实经历、行动和结果"
              value={currentMarkdown}
              onChange={(event) => updateCurrentMarkdown(event.target.value)}
            />
          </div>
        )}
      </main>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>版本对比</DialogTitle>
            <DialogDescription>左侧为原始简历，右侧为优化版本。</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
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

      <Dialog open={Boolean(diagnosisMarkdown) && workflowMode === "fast"} onOpenChange={() => setDiagnosisMarkdown("")}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto">
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
    </div>
  );
}

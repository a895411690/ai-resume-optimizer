"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Wand2, Target, GitCompare, Stethoscope, Download, Trash2, Eye, Edit3, LogOut,
  Loader2, FileText, Sparkles, Monitor,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";

type Version = "original" | "optimized";
interface ResumeData { id?: string; title: string; position: string; original_content: string; optimized_content: string; target_jd?: string; }

const DEMO_KEY = "resume_optimizer_demo_data";

function loadDemoData(): ResumeData {
  if (typeof window === "undefined") return { title: "我的简历", position: "", original_content: "", optimized_content: "" };
  try { const d = localStorage.getItem(DEMO_KEY); return d ? JSON.parse(d) : { title: "我的简历", position: "", original_content: "", optimized_content: "" }; }
  catch { return { title: "我的简历", position: "", original_content: "", optimized_content: "" }; }
}
function saveDemoData(d: ResumeData) { if (typeof window !== "undefined") localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }

function ResumePreview({ markdown }: { markdown: string }) {
  if (!markdown) return (<div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground text-sm">请在下方 Markdown 编辑器中输入简历内容</div>);
  return (
    <div className="max-w-[794px] mx-auto bg-white shadow-md rounded p-10 text-sm leading-relaxed print:shadow-none print:p-0">
      <ReactMarkdown components={{
        h1: ({ ...p }) => <h1 className="text-xl font-bold text-center mb-4 pb-3 border-b-2 border-gray-800 tracking-wide" {...p} />,
        h2: ({ ...p }) => <h2 className="text-base font-bold mt-5 mb-2 pb-1 border-b border-gray-300 text-gray-800" {...p} />,
        h3: ({ ...p }) => <h3 className="text-sm font-semibold mt-3 mb-1.5 text-gray-700" {...p} />,
        p: ({ children }) => { const txt = typeof children === 'string' ? children : ''; if (txt.includes("|")) { const parts = txt.split(/(\*\*[^*]+\*\*)/g); return <p className="mb-1 text-xs text-gray-600">{parts.map((part,i)=>part.startsWith("**")&&part.endsWith("**")?<strong key={i} className="text-gray-900">{part.slice(2,-2)}</strong>:<span key={i}>{part}</span>)}</p>; } return <p className="mb-1 text-xs text-gray-700">{children}</p>; },
        li: ({ ...p }) => <li className="mb-0.5 text-xs text-gray-700 ml-4 list-disc" {...p} />,
        ul: ({ ...p }) => <ul className="mb-2" {...p} />,
        strong: ({ ...p }) => <strong className="text-gray-900 font-semibold" {...p} />,
        em: ({ ...p }) => <em className="text-gray-500 italic text-xs" {...p} />,
      }}>{markdown}</ReactMarkdown>
    </div>
  );
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [resume, setResume] = useState<ResumeData>({ title: "我的简历", position: "", original_content: "", optimized_content: "" });
  const [activeVersion, setActiveVersion] = useState<Version>("original");
  const [showEditor, setShowEditor] = useState(true);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showPK, setShowPK] = useState(false);
  const [showDiagnosis, setShowDiagnosis] = useState("");
  const [showJdDialog, setShowJdDialog] = useState(false);
  const [jdText, setJdText] = useState("");
  const [authMode, setAuthMode] = useState<"login"|"register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authError, setAuthError] = useState("");

  // Try Supabase session first
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) { setUser(session.user); setIsDemo(false); } });
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => { if (s) { setUser(s.user); setIsDemo(false); } else { setUser(null); setIsDemo(false); } });
    return () => l.subscription.unsubscribe();
  }, []);

  // Load resume when user changes
  useEffect(() => { if (user) loadResume(); }, [user]);

  // Auto-save demo data
  useEffect(() => { if (isDemo && resume.original_content) saveDemoData(resume); }, [resume, isDemo]);

  async function loadResume() {
    if (isDemo) { setResume(loadDemoData()); return; }
    const { data } = await supabase.from("resumes").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1);
    if (data?.length) { const r = data[0]; setResume({ id: r.id, title: r.title, position: r.position, original_content: r.original_content||"", optimized_content: r.optimized_content||"", target_jd: r.target_jd }); }
  }

  function saveResume() {
    if (!resume.original_content) return;
    if (isDemo) { saveDemoData(resume); return; }
    if (!user) return;
    const p = { user_id: user.id, title: resume.title, position: resume.position, original_content: resume.original_content, optimized_content: resume.optimized_content, target_jd: resume.target_jd };
    if (resume.id) supabase.from("resumes").update(p).eq("id", resume.id);
    else supabase.from("resumes").insert(p).select("id").single().then(({data}) => { if (data) setResume(r=>({...r,id:data.id})); });
  }

  const getContent = () => activeVersion === "original" ? resume.original_content : resume.optimized_content;
  const setContent = (v: string) => { if (activeVersion === "original") setResume(r=>({...r,original_content:v})); else setResume(r=>({...r,optimized_content:v})); };

  async function optimize(mode: "general"|"targeted") {
    if (!resume.original_content) return;
    setIsOptimizing(true);
    try {
      const r = await fetch("/api/optimize", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({markdown:resume.original_content,mode,targetJd:mode==="targeted"?jdText:undefined}) });
      const d = await r.json();
      if (d.optimized) { setResume(r=>({...r,optimized_content:d.optimized})); setActiveVersion("optimized"); setTimeout(()=>saveDemoData({...resume,optimized_content:d.optimized}),100); }
    } catch(e){ console.error(e); }
    finally { setIsOptimizing(false); }
  }

  async function runDiagnosis() {
    if (!resume.original_content) return;
    setIsDiagnosing(true);
    try {
      const r = await fetch("/api/diagnose", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({markdown:resume.original_content}) });
      const d = await r.json();
      setShowDiagnosis(d.diagnosis||"诊断完成");
    } catch(e){console.error(e);}
    finally{setIsDiagnosing(false);}
  }

  async function handleAuth() {
    setAuthError("");
    if (authMode==="login") {
      const { error } = await supabase.auth.signInWithPassword({email:authEmail,password:authPass});
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({email:authEmail,password:authPass});
      if (error) setAuthError(error.message);
      else setAuthError("注册成功！请检查邮箱确认。");
    }
  }

  function enterDemo() {
    setIsDemo(true);
    setUser({ id: "demo-user", email: "demo@example.com" });
    setResume(loadDemoData());
  }

  function exitDemo() {
    setIsDemo(false);
    setUser(null);
    setResume({ title: "我的简历", position: "", original_content: "", optimized_content: "" });
  }

  function downloadPDF() {
    const content = getContent(); if (!content) return;
    const w = window.open("","_blank")!;
    w.document.write(`<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:794px;margin:40px auto;padding:20px;font-size:13px;line-height:1.6}h1{text-align:center;border-bottom:2px solid #333;padding-bottom:12px;font-size:20px}h2{border-bottom:1px solid #ccc;margin-top:20px;padding-bottom:4px;font-size:15px}li{margin-bottom:3px}strong{color:#222}</style></head><body>${content.replace(/\n/g,"<br/>").replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/^## (.+)$/gm,"<h2>$1</h2>").replace(/^# (.+)$/gm,"<h1>$1</h1>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/^- (.+)/gm,"<li>$1</li>").replace(/((?:<li>.*<\/li>\s*)+)/g,"<ul>$1</ul>")}</body></html>`);
    w.document.close(); setTimeout(()=>w.print(),300);
  }

  const hasContent = Boolean(resume.original_content);
  const hasOptimized = Boolean(resume.optimized_content);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="w-full max-w-sm p-8 bg-white rounded-xl shadow-lg border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">AI 简历优化工具</h1>
            <p className="text-sm text-muted-foreground mt-1">登录以使用 AI 优化您的简历</p>
          </div>
          <div className="space-y-3">
            <Input placeholder="邮箱地址" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} />
            <Input placeholder="密码" type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} />
            {authError && <p className="text-xs text-destructive">{authError}</p>}
            <Button className="w-full" onClick={handleAuth}>{authMode==="login"?"登录":"注册"}</Button>
            <p className="text-xs text-center text-muted-foreground">
              {authMode==="login"?(<>没有账号？<button className="text-primary hover:underline" onClick={()=>setAuthMode("register")}>注册</button></>):(<>已有账号？<button className="text-primary hover:underline" onClick={()=>setAuthMode("login")}>登录</button></>)}
            </p>
          </div>
          <Separator className="my-4" />
          <Button className="w-full" variant="outline" onClick={enterDemo}>
            <Monitor className="mr-2 h-4 w-4" /> 体验 Demo（无需登录）
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            配置 Supabase 后可正常注册登录
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-muted/30">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">简历优化AI</span>
            {isDemo && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Demo</span>}
          </div>
          <div className="space-y-2">
            <Input className="h-8 text-xs" placeholder="简历标题" value={resume.title} onChange={e=>setResume(r=>({...r,title:e.target.value}))} />
            <Input className="h-8 text-xs" placeholder="求职职位" value={resume.position} onChange={e=>setResume(r=>({...r,position:e.target.value}))} />
            <div className="text-xs text-muted-foreground">
              <span>版本：<strong>{activeVersion==="original"?"原始版":"优化版"}</strong></span>
              {resume.position && <span> · {resume.position}</span>}
            </div>
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">AI 优化</p>
          <Button className="w-full justify-start h-8 text-xs" size="sm" disabled={!hasContent||isOptimizing} onClick={()=>optimize("general")}>
            {isOptimizing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Wand2 className="mr-2 h-3 w-3" />} 通用优化
          </Button>
          <Button className="w-full justify-start h-8 text-xs" variant="outline" size="sm" disabled={!hasContent||isOptimizing}
            onClick={()=>{setJdText("");setShowJdDialog(true);}}>
            <Target className="mr-2 h-3 w-3" /> 专岗优化
          </Button>
        </div>
        <Separator />
        <div className="p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">版本切换</p>
          <div className="flex rounded-md border overflow-hidden">
            <button onClick={()=>setActiveVersion("original")} className={`flex-1 py-1.5 text-xs font-medium transition-colors ${activeVersion==="original"?"bg-primary text-primary-foreground":""}`}>原始版</button>
            <button onClick={()=>setActiveVersion("optimized")} className={`flex-1 py-1.5 text-xs font-medium transition-colors ${activeVersion==="optimized"?"bg-primary text-primary-foreground":""}`} disabled={!hasOptimized}>优化版</button>
          </div>
        </div>
        <Separator />
        <div className="p-3 space-y-1 flex-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">更多</p>
          <Button className="w-full justify-start h-8 text-xs" variant="ghost" size="sm" disabled={!hasOptimized} onClick={()=>setShowPK(true)}><GitCompare className="mr-2 h-3 w-3" /> 版本PK</Button>
          <Button className="w-full justify-start h-8 text-xs" variant="ghost" size="sm" disabled={!hasContent||isDiagnosing} onClick={runDiagnosis}>{isDiagnosing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Stethoscope className="mr-2 h-3 w-3" />} 简历诊断</Button>
          <Button className="w-full justify-start h-8 text-xs" variant="ghost" size="sm" disabled={!getContent()} onClick={downloadPDF}><Download className="mr-2 h-3 w-3" /> 下载PDF</Button>
          <Button className="w-full justify-start h-8 text-xs" variant="ghost" size="sm" onClick={()=>{setResume({title:"我的简历",position:"",original_content:"",optimized_content:""});saveDemoData({title:"我的简历",position:"",original_content:"",optimized_content:""});}}><Trash2 className="mr-2 h-3 w-3" /> 删除简历</Button>
        </div>
        <Separator />
        <div className="p-3">
          <Button className="w-full justify-start h-8 text-xs" variant="ghost" size="sm"
            onClick={isDemo ? exitDemo : async()=>{await supabase.auth.signOut();}}>
            <LogOut className="mr-2 h-3 w-3" /> {isDemo ? "退出 Demo" : "退出登录"}
          </Button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
          <div className="flex-1">
            <h2 className="text-sm font-semibold">{resume.title||"我的简历"}</h2>
            {resume.position && <p className="text-xs text-muted-foreground">职位：{resume.position}</p>}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={()=>setShowEditor(!showEditor)}>
            {showEditor ? <Eye className="mr-1 h-3 w-3" /> : <Edit3 className="mr-1 h-3 w-3" />} {showEditor?"预览模式":"编辑模式"}
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={saveResume}><FileText className="mr-1 h-3 w-3" /> 保存</Button>
        </div>
        <div className="flex-1 overflow-auto p-6"><ResumePreview markdown={getContent()} /></div>
        {showEditor && (
          <div className="border-t bg-card h-56 flex flex-col">
            <div className="flex items-center px-4 py-1.5 border-b"><span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Markdown 编辑器</span></div>
            <Textarea className="flex-1 border-0 rounded-none resize-none font-mono text-xs p-4 focus-visible:ring-0 leading-relaxed"
              placeholder="# 我的简历\n\n## 个人信息\n- **姓名**：张三\n- **电话**：13800138000\n\n## 自我评价\n- 有X年XX行业经验..."
              value={getContent()} onChange={e=>setContent(e.target.value)} />
          </div>
        )}
      </div>

      {/* JD Dialog */}
      <Dialog open={showJdDialog} onOpenChange={setShowJdDialog}>
        <DialogContent><DialogHeader><DialogTitle>专岗优化</DialogTitle><DialogDescription>粘贴目标职位JD，AI将针对性优化</DialogDescription></DialogHeader>
          <Textarea placeholder="粘贴职位描述（JD）..." value={jdText} onChange={e=>setJdText(e.target.value)} rows={8} className="text-xs" />
          <DialogFooter><Button variant="outline" size="sm" onClick={()=>setShowJdDialog(false)}>取消</Button><Button size="sm" onClick={()=>{setShowJdDialog(false);optimize("targeted");}} disabled={!jdText||isOptimizing}>开始优化</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {/* PK Dialog */}
      <Dialog open={showPK} onOpenChange={setShowPK}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-auto"><DialogHeader><DialogTitle>版本对比</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div><h4 className="text-xs font-semibold text-muted-foreground mb-2">原始版</h4><div className="border rounded p-4 text-xs max-h-[70vh] overflow-auto bg-white"><ReactMarkdown>{resume.original_content}</ReactMarkdown></div></div>
            <div><h4 className="text-xs font-semibold text-muted-foreground mb-2">优化版</h4><div className="border rounded p-4 text-xs max-h-[70vh] overflow-auto bg-white"><ReactMarkdown>{resume.optimized_content}</ReactMarkdown></div></div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Diagnosis Dialog */}
      <Dialog open={Boolean(showDiagnosis)} onOpenChange={()=>setShowDiagnosis("")}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto"><DialogHeader><DialogTitle>简历诊断报告</DialogTitle></DialogHeader><div className="text-sm"><ReactMarkdown>{showDiagnosis}</ReactMarkdown></div></DialogContent>
      </Dialog>
    </div>
  );
}

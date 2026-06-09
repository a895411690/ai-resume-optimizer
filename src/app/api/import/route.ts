import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";
import {
  buildFallbackStructuredResume,
  normalizeStructuredResume,
  renderStructuredResumeMarkdown,
} from "@/lib/resume-structured-extraction.js";
import { safeParseJsonObject } from "@/lib/ai-resume-contract.js";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "解析失败";
const require = createRequire(import.meta.url);
const PDF_PARSE_MODULE_PATH = require.resolve("pdf-parse");

const EXTRACT_PROMPT = `你是简历信息抽取引擎。你必须输出严格 JSON，不要 Markdown，不要解释性前后缀。

任务：基于用户上传文件中抽取出的纯文本，进行深度语义理解，将任意排版的非结构化简历文本转换为结构化简历数据。

边界：
- 输入已经是 PDF、Word、TXT 等可编辑文本格式抽取出的纯文本；不要假设存在 OCR，不要处理扫描件图片信息。
- 不得编造姓名、联系方式、学校、学历、公司、项目、日期、技能、证书或成果。
- 不确定字段留空，并在 meta.warnings 写明。
- 自动识别姓名、联系方式、教育背景、工作经历、项目经验、技能标签、证书、自我评价等实体。
- 对日期、学历层次等标准字段尽量规范化；保持学校与学历、公司与职位、项目与角色之间的对应关系。

返回 JSON schema：
{
  "basics": { "name": "", "phone": "", "email": "", "location": "", "targetRole": "" },
  "education": [{ "school": "", "degree": "", "major": "", "startDate": "", "endDate": "", "bullets": [] }],
  "work": [{ "organization": "", "title": "", "startDate": "", "endDate": "", "description": "", "bullets": [] }],
  "projects": [{ "name": "", "role": "", "startDate": "", "endDate": "", "description": "", "bullets": [] }],
  "skills": [],
  "certificates": [],
  "summary": [],
  "meta": { "warnings": [] }
}`;

async function callDeepSeekForExtraction(text: string) {
  if (!DEEPSEEK_API_KEY) return null;
  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: EXTRACT_PROMPT },
        { role: "user", content: `纯文本简历：\n${text.slice(0, 18000)}` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  const parsed = safeParseJsonObject(data.choices?.[0]?.message?.content || "");
  return parsed ? normalizeStructuredResume({ ...parsed, meta: { ...(parsed.meta || {}), source: "deepseek" } }) : null;
}

const PDF_PARSE_SCRIPT = join(tmpdir(), "pdf_parse_worker.js");
try {
  writeFileSync(PDF_PARSE_SCRIPT, `
const pdfModulePath = process.argv[4];
const pdf = require(pdfModulePath);
const fs = require('fs');
const file = process.argv[2];
const out = process.argv[3];
try {
  const buffer = fs.readFileSync(file);
  const parse = async () => {
    if (typeof pdf === 'function') return pdf(buffer);
    if (typeof pdf.default === 'function') return pdf.default(buffer);
    if (typeof pdf.PDFParse === 'function') {
      const parser = new pdf.PDFParse({ data: buffer });
      try { return await parser.getText(); }
      finally { await parser.destroy(); }
    }
    throw new Error('Unsupported pdf-parse export');
  };
  parse().then(d => {
    fs.writeFileSync(out, JSON.stringify({text: d.text || ''}));
  }).catch(e => {
    fs.writeFileSync(out, JSON.stringify({error: e.message}));
  });
} catch(e) {
  fs.writeFileSync(out, JSON.stringify({error: e.message}));
}
`);
} catch {}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "未上传文件" }, { status: 400 });

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (fileName.endsWith(".pdf")) {
      const tmpFile = join(tmpdir(), `imp_${Date.now()}.pdf`);
      const outFile = join(tmpdir(), `imp_${Date.now()}.json`);
      writeFileSync(tmpFile, new Uint8Array(buffer));
      try {
        const c = await import("child_process");
        c.execSync(`node ${JSON.stringify(PDF_PARSE_SCRIPT)} ${JSON.stringify(tmpFile)} ${JSON.stringify(outFile)} ${JSON.stringify(PDF_PARSE_MODULE_PATH)}`, { timeout: 60000, maxBuffer: 1024*1024 });
        const out = JSON.parse(readFileSync(outFile, "utf-8"));
        if (out.error) throw new Error(out.error);
        text = out.text || "";
      } finally {
        try { unlinkSync(tmpFile); unlinkSync(outFile); } catch {}
      }
    } else if (fileName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".markdown")) {
      text = new TextDecoder("utf-8").decode(buffer);
    } else {
      return NextResponse.json({ error: `格式不支持: ${fileName.split(".").pop()}` }, { status: 400 });
    }

    const rawText = text.replace(/\r\n/g,"\n").replace(/\n{4,}/g,"\n\n\n").trim();
    const modelStructured = await callDeepSeekForExtraction(rawText);
    const structured = modelStructured || buildFallbackStructuredResume(rawText);
    const markdown = renderStructuredResumeMarkdown(structured);

    return NextResponse.json({
      text: rawText,
      markdown,
      structured,
      extractionMode: modelStructured ? "deepseek" : "fallback-rules",
      fileName,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }
}

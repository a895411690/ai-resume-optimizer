import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import {
  buildFallbackStructuredResume,
  normalizeStructuredResume,
  renderStructuredResumeMarkdown,
} from "@/lib/resume-structured-extraction.js";
import { safeParseJsonObject } from "@/lib/ai-resume-contract.js";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "解析失败";

function installPdfNodePolyfills() {
  const globalScope = globalThis as Record<string, unknown>;
  const pdfGlobalScope = globalScope as Record<string, unknown>;

  if (!globalScope.DOMMatrix) {
    pdfGlobalScope.DOMMatrix = class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;

      constructor(init?: number[]) {
        if (Array.isArray(init) && init.length >= 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
    };
  }
  if (!globalScope.ImageData) {
    pdfGlobalScope.ImageData = class ImageData {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    };
  }
  if (!globalScope.Path2D) {
    pdfGlobalScope.Path2D = class Path2D {};
  }
}

type PdfLoopbackEvent = { data: unknown };
type PdfLoopbackListener = (event: PdfLoopbackEvent) => void;
type PdfLoopbackOptions = { signal?: AbortSignal } | null;
type PdfWorkerMessageHandler = { initializeFromPort(port: PdfLoopbackPort): void };
type PdfWorkerInstance = { destroy(): void };
type PdfWorkerConstructor = new (params: { port: PdfLoopbackPort }) => PdfWorkerInstance;

class PdfLoopbackPort {
  #listeners = new Map<PdfLoopbackListener, (() => void) | null>();
  #deferred = Promise.resolve();

  postMessage(obj: unknown, transfer?: Transferable[]) {
    const event = {
      data: structuredClone(obj, transfer ? { transfer } : undefined),
    };
    this.#deferred.then(() => {
      for (const listener of this.#listeners.keys()) {
        listener.call(this, event);
      }
    });
  }

  addEventListener(_name: string, listener: PdfLoopbackListener, options: PdfLoopbackOptions = null) {
    let removeAbortListener: (() => void) | null = null;
    if (options?.signal) {
      if (options.signal.aborted) return;
      const onAbort = () => this.removeEventListener(_name, listener);
      removeAbortListener = () => options.signal?.removeEventListener("abort", onAbort);
      options.signal.addEventListener("abort", onAbort);
    }
    this.#listeners.set(listener, removeAbortListener);
  }

  removeEventListener(_name: string, listener: PdfLoopbackListener) {
    this.#listeners.get(listener)?.();
    this.#listeners.delete(listener);
  }

  terminate() {
    for (const removeAbortListener of this.#listeners.values()) {
      removeAbortListener?.();
    }
    this.#listeners.clear();
  }
}

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

async function extractPdfText(buffer: Buffer) {
  installPdfNodePolyfills();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { WorkerMessageHandler } = await import("pdfjs-dist/legacy/build/pdf.worker.mjs") as {
    WorkerMessageHandler: PdfWorkerMessageHandler;
  };
  const workerPort = new PdfLoopbackPort();
  WorkerMessageHandler.initializeFromPort(workerPort);
  const PdfWorker = pdfjs.PDFWorker as unknown as PdfWorkerConstructor;
  const worker = new PdfWorker({ port: workerPort });
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    worker,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as Record<string, unknown>);
  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => "str" in item ? item.str : "")
        .filter(Boolean)
        .join(" ");
      pages.push(pageText);
    }
    return pages.join("\n");
  } finally {
    await loadingTask.destroy();
    worker.destroy();
    workerPort.terminate();
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "未上传文件" }, { status: 400 });

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (fileName.endsWith(".pdf")) {
      text = await extractPdfText(buffer);
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

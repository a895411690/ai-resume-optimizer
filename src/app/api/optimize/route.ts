import { NextRequest, NextResponse } from "next/server";
import {
  buildFallbackDiagnosis,
  normalizeOptimization,
  normalizeUserType,
  safeParseJsonObject,
} from "@/lib/ai-resume-contract.js";
import { chooseDeepSeekModel } from "@/lib/deepseek-model-router.js";
import { migrateMarkdownToStructuredResumeV1, normalizeStructuredResumeV1, renderStructuredResumeV1Markdown } from "@/lib/resume-schema.js";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "优化失败";

const OPTIMIZE_PROMPT = `你是一位资深简历优化专家。你必须输出严格 JSON，不要 Markdown 前后缀，不要解释性文本。

核心规则：
- 可信优先，不得编造公司、学校、学历、证书、头衔、项目名、日期、薪资、团队规模、指标、工具或成果。
- 如某个指标会提升表达但原简历没有，必须使用 [请补充具体数据] 或 [请补充具体信息]。
- 保留原简历事实，除非用户明确要求改写。
- 按用户阶段和目标岗位调整表达标准。
- 如果提供 JD，只优化已有事实与 JD 的匹配表达，不得声称未被简历支持的技能。
- 每个有意义的改动都要进入 editExplanations，说明原文、改文、原因和是否需用户确认。
- optimizedMarkdown 必须是干净的简历 Markdown：姓名用一级标题；个人信息/教育经历/工作经历/项目经历/技能等用二级标题；公司、学校、项目名用三级标题；职责和成果用无序列表。
- 不要输出 \`\`\`markdown 代码块，不要输出“以下是优化后的简历”等解释性前缀。

返回 JSON schema：
{
  "optimizedMarkdown": "# ...",
  "editSummary": [],
  "editExplanations": [
    {
      "originalExcerpt": "...",
      "revisedExcerpt": "...",
      "reason": "...",
      "requiresUserConfirmation": true,
      "confirmationPrompt": "..."
    }
  ],
  "riskNotes": []
}`;

async function callDeepSeek(messages: Array<{ role: "system" | "user"; content: string }>, model: string) {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.25,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "AI 优化服务暂时不可用");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const structuredResume = body.structuredResume ? normalizeStructuredResumeV1(body.structuredResume) : null;
    const markdown = String(body.markdown || (structuredResume ? renderStructuredResumeV1Markdown(structuredResume) : "")).trim();
    const targetRole = String(body.targetRole || body.position || "").trim();
    const jdText = String(body.jdText || body.targetJd || "").trim();
    const userType = normalizeUserType(body.userType);
    const strength = body.strength || (body.mode === "targeted" ? "professional" : "conservative");
    const diagnosis = body.structuredDiagnosis || body.diagnosis || buildFallbackDiagnosis({ markdown, userType, targetRole, jdText });
    const routing = chooseDeepSeekModel({
      scene: jdText.length > 300 || strength === "strong" ? "optimize_deep" : "module_optimize",
      textLength: markdown.length,
      jdLength: jdText.length,
      workItemCount: structuredResume?.work?.length || 0,
      userTier: body.userTier || "free",
      userType,
      proQuotaRemaining: body.proQuotaRemaining,
    });

    if (markdown.length < 40) {
      return NextResponse.json({ error: "简历内容过短，请补充更多信息后再优化。" }, { status: 400 });
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: "DeepSeek API Key 未配置，请在 .env.local 中设置 DEEPSEEK_API_KEY。" },
        { status: 500 }
      );
    }

    const userMessage = `优化强度：${strength}
用户阶段：${userType}
目标岗位：${targetRole || "未填写"}
JD：
${jdText || "未提供"}

结构化诊断：
${typeof diagnosis === "string" ? diagnosis : JSON.stringify(diagnosis)}

原始简历 Markdown：
${markdown}

结构化简历数据：
${structuredResume ? JSON.stringify(structuredResume) : "未提供"}`;

    let parsed = safeParseJsonObject(await callDeepSeek([
      { role: "system", content: OPTIMIZE_PROMPT },
      { role: "user", content: userMessage },
    ], routing.model));

    if (!parsed) {
      const repaired = await callDeepSeek([
        { role: "system", content: "把用户提供的内容修复为严格 JSON 对象，必须符合优化 schema，不要输出 Markdown 外壳。" },
        { role: "user", content: JSON.stringify({ optimizedMarkdown: markdown, editSummary: [], editExplanations: [], riskNotes: [] }) },
      ], routing.model);
      parsed = safeParseJsonObject(repaired);
    }

    if (!parsed) {
      return NextResponse.json({ error: "AI 返回格式无法解析，请稍后重试。" }, { status: 502 });
    }

    const optimization = normalizeOptimization(parsed, { markdown, diagnosis, strength, targetRole });
    const optimizedStructuredResume = migrateMarkdownToStructuredResumeV1(optimization.optimizedMarkdown);
    return NextResponse.json({
      optimized: optimization.optimizedMarkdown,
      optimization,
      structuredResume: optimizedStructuredResume,
      modelTier: routing.tier,
      routingReason: routing.reason,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

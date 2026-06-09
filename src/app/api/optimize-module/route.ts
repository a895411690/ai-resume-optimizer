import { NextRequest, NextResponse } from "next/server";
import {
  normalizeOptimization,
  normalizeUserType,
  safeParseJsonObject,
} from "@/lib/ai-resume-contract.js";
import { chooseDeepSeekModel } from "@/lib/deepseek-model-router.js";
import { normalizeStructuredResumeV1, renderStructuredResumeV1Markdown } from "@/lib/resume-schema.js";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "优化失败";

const MODULE_LABELS: Record<string, string> = {
  basics: "个人信息",
  education: "教育经历",
  work: "工作/实习经历",
  projects: "项目经历",
  skills: "专业技能",
  optional: "补充信息",
};

const MODULE_OPTIMIZE_PROMPT = `你是一位资深简历优化专家，当前只优化用户指定的单个模块。你必须输出严格 JSON。

核心规则：
- 只优化指定模块内容，不要改写其他模块。
- 可信优先，不得编造公司、学校、学历、证书、头衔、项目名、日期、数据或成果。
- 如需数据但原文没有，使用 [请补充具体数据] 占位。
- 每个有意义的改动都要进入 editExplanations。
- optimizedModule 必须是完整的该模块 JSON 对象（与输入结构一致），不是 Markdown。
- 不要输出 Markdown 代码块，不要输出解释性前缀。

返回 JSON schema：
{
  "optimizedModule": { ... },
  "editSummary": ["..."],
  "editExplanations": [
    { "originalExcerpt": "...", "revisedExcerpt": "...", "reason": "...", "requiresUserConfirmation": false }
  ],
  "riskNotes": []
}`;

async function callDeepSeek(messages: Array<{ role: "system" | "user"; content: string }>, model: string) {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.25,
      max_tokens: 3072,
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
    const moduleName = String(body.module || "").trim();
    if (!moduleName || !MODULE_LABELS[moduleName]) {
      return NextResponse.json({ error: "请指定要优化的模块：basics/education/work/projects/skills/optional" }, { status: 400 });
    }

    const structuredResume = body.structuredResume ? normalizeStructuredResumeV1(body.structuredResume) : null;
    if (!structuredResume) {
      return NextResponse.json({ error: "请提供结构化简历数据" }, { status: 400 });
    }

    const moduleData = (structuredResume as Record<string, unknown>)[moduleName];
    if (!moduleData) {
      return NextResponse.json({ error: `模块 ${moduleName} 无内容可优化` }, { status: 400 });
    }

    const targetRole = String(body.targetRole || "").trim();
    const jdText = String(body.jdText || "").trim();
    const userType = normalizeUserType(body.userType);
    const strength = body.strength || "professional";
    const routing = chooseDeepSeekModel({
      scene: "module_optimize",
      textLength: JSON.stringify(moduleData).length,
      jdLength: jdText.length,
      workItemCount: structuredResume.work?.length || 0,
      userTier: body.userTier || "free",
      userType,
    });

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "DeepSeek API Key 未配置" }, { status: 500 });
    }

    const moduleMarkdown = renderStructuredResumeV1Markdown(structuredResume);
    const userMessage = `优化模块：${MODULE_LABELS[moduleName]}（${moduleName}）
优化强度：${strength}
用户阶段：${userType}
目标岗位：${targetRole || "未填写"}
${jdText ? `JD：${jdText}` : ""}

当前模块数据：
${JSON.stringify(moduleData, null, 2)}

完整简历参考（不要优化其他模块，仅参考上下文）：
${moduleMarkdown}`;

    const parsed = safeParseJsonObject(await callDeepSeek([
      { role: "system", content: MODULE_OPTIMIZE_PROMPT },
      { role: "user", content: userMessage },
    ], routing.model));

    if (!parsed) {
      return NextResponse.json({ error: "AI 返回格式无法解析，请稍后重试" }, { status: 502 });
    }

    const optimization = normalizeOptimization(parsed, {
      markdown: moduleMarkdown,
      diagnosis: null,
      strength,
      targetRole,
    });

    return NextResponse.json({
      module: moduleName,
      optimizedModule: parsed.optimizedModule || moduleData,
      optimization: {
        editSummary: optimization.editSummary,
        editExplanations: optimization.editExplanations,
        riskNotes: optimization.riskNotes,
      },
      modelTier: routing.tier,
      routingReason: routing.reason,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

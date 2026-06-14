import { NextRequest, NextResponse } from "next/server";
import { normalizeUserType, safeParseJsonObject } from "@/lib/ai-resume-contract.js";
import { chooseDeepSeekModel } from "@/lib/deepseek-model-router.js";
import { normalizeStructuredResumeV1, renderStructuredResumeV1Markdown } from "@/lib/resume-schema.js";
import { RESUME_TEMPLATES } from "@/lib/resume-templates.js";
import {
  normalizeTemplateRecommendations,
  recommendResumeTemplates,
} from "@/lib/resume-template-recommendation.js";
import { requireAuthenticatedUser } from "@/lib/api-auth";
import { DEFAULT_AI_FETCH_TIMEOUT_MS, fetchWithTimeout } from "@/lib/fetch-with-timeout";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const TEMPLATE_RECOMMEND_PROMPT = `你是一位资深简历顾问和排版顾问。你必须只从给定模板 catalog 中推荐 3-5 个模板，输出严格 JSON。

原则：
- 只能返回 catalog 中存在的 templateId，不得自造模板 id。
- 推荐理由必须解释岗位、阶段、简历内容与模板特点之间的关系。
- 优先理解 family：fresh_graduate 候选人优先 campus_intern，senior 优先 executive_expert；产品/数据/技术/运营优先 modern_professional；外企、银行、网申、海投、ATS 关键词优先 ats。
- 不要输出 Markdown，不要解释性前后缀。

返回 JSON schema：
{
  "recommendations": [
    { "templateId": "template id", "reason": "short Chinese reason" }
  ]
}`;

async function callDeepSeek(messages: Array<{ role: "system" | "user"; content: string }>, model: string) {
  const response = await fetchWithTimeout(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  }, DEFAULT_AI_FETCH_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "AI 模板推荐服务暂时不可用");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req);
    if ("response" in auth) return auth.response;

    const body = await req.json();
    const structuredResume = body.structuredResume ? normalizeStructuredResumeV1(body.structuredResume) : null;
    const markdown = structuredResume ? renderStructuredResumeV1Markdown(structuredResume) : "";
    const targetRole = String(body.targetRole || "").trim();
    const workYears = String(body.workYears || "").trim();
    const userType = normalizeUserType(body.userType);
    const fallbackRecommendations = recommendResumeTemplates({
      userType,
      targetRole,
      structuredResume: structuredResume || {},
      templates: RESUME_TEMPLATES,
    }).slice(0, 5);
    const routing = chooseDeepSeekModel({
      scene: "template_recommend",
      textLength: markdown.length,
      workItemCount: structuredResume?.work?.length || 0,
      userTier: body.userTier || "free",
      userType,
      proQuotaRemaining: body.proQuotaRemaining,
    });

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({
        recommendations: fallbackRecommendations,
        source: "fallback",
        modelTier: "fallback",
        routingReason: "DeepSeek API Key 未配置，已使用规则推荐。",
      });
    }

    const templateCatalog = RESUME_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      tags: template.tags,
      scenarios: template.scenarios,
      audience: template.audience,
      strengths: template.strengths,
      family: template.family,
      density: template.density,
      atsLevel: template.atsLevel,
      marketTags: template.marketTags,
      contentPriority: template.contentPriority,
      layout: template.layout,
    }));

    const userMessage = `用户阶段：${userType}
目标岗位：${targetRole || "未填写"}
工作年限：${workYears || "未填写"}

结构化简历 Markdown 摘要：
${markdown.slice(0, 3000) || "未提供"}

模板 catalog：
${JSON.stringify(templateCatalog, null, 2)}`;

    const parsed = safeParseJsonObject(await callDeepSeek([
      { role: "system", content: TEMPLATE_RECOMMEND_PROMPT },
      { role: "user", content: userMessage },
    ], routing.model));
    const normalized = normalizeTemplateRecommendations(parsed?.recommendations, RESUME_TEMPLATES);

    return NextResponse.json({
      recommendations: normalized.length ? normalized : fallbackRecommendations,
      source: normalized.length ? "deepseek" : "fallback",
      modelTier: routing.tier,
      routingReason: normalized.length ? routing.reason : "AI 返回格式无法使用，已使用规则推荐。",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "模板推荐失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

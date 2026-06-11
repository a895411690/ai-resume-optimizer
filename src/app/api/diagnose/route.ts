import { NextRequest, NextResponse } from "next/server";
import {
  buildFallbackDiagnosis,
  normalizeDiagnosis,
  normalizeUserType,
  safeParseJsonObject,
} from "@/lib/ai-resume-contract.js";
import { chooseDeepSeekModel } from "@/lib/deepseek-model-router.js";
import { normalizeStructuredResumeV1, renderStructuredResumeV1Markdown } from "@/lib/resume-schema.js";
import { getOptionalAuthenticatedUser } from "@/lib/api-auth";
import { reserveDemoDiagnosisAccess } from "@/lib/ai-access-control";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const errorMessage = (error: unknown) => error instanceof Error ? error.message : "诊断失败";

type DimensionScore = { name: string; score: number; reason: string };
type TopIssue = {
  severity: string;
  section: string;
  originalExcerpt: string;
  problem: string;
  suggestion: string;
};
type StructuredDiagnosis = {
  userType: string;
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

const DIAGNOSE_PROMPT = `你是一位资深 HR、招聘经理和简历评审专家。你必须输出严格 JSON，不要 Markdown，不要解释性前后缀。

评估原则：
- 先诊断，再建议，不直接编造优化内容。
- 按用户阶段调整标准：应届生看校园/项目/潜力证据；1-3 年看职责贡献、量化和成长；转行看可迁移能力和叙事；中高级看业务影响、规模、领导力和复杂决策。
- 不得编造公司、学校、学历、证书、头衔、项目名、日期、团队规模、预算、指标或成果。
- 如果信息缺失或不确定，必须写入 riskNotes 或 suggestion。
- JD 很短时只当作目标方向，不当作完整 JD 匹配。

返回 JSON schema：
{
  "userType": "fresh_graduate | junior | career_switcher | senior",
  "userTypeReason": "short Chinese explanation",
  "overallScore": 0,
  "dimensionScores": [
    { "name": "role_fit", "score": 0, "reason": "short Chinese explanation" },
    { "name": "evidence_strength", "score": 0, "reason": "short Chinese explanation" },
    { "name": "structure_clarity", "score": 0, "reason": "short Chinese explanation" }
  ],
  "topIssues": [
    {
      "severity": "high | medium | low",
      "section": "section name",
      "originalExcerpt": "original excerpt",
      "problem": "problem",
      "suggestion": "specific suggestion"
    }
  ],
  "jdMatch": {
    "enabled": true,
    "matchScore": 0,
    "hardRequirements": [],
    "matchedKeywords": [],
    "missingKeywords": [],
    "recommendations": []
  },
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
      temperature: 0.2,
      max_tokens: 3072,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "AI 诊断服务暂时不可用");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function diagnosisToMarkdown(diagnosis: StructuredDiagnosis) {
  const issues = diagnosis.topIssues
    .map((issue, index) => `${index + 1}. **${issue.section}**（${issue.severity}）：${issue.problem}\n   - 原文：${issue.originalExcerpt}\n   - 建议：${issue.suggestion}`)
    .join("\n");
  const dimensions = diagnosis.dimensionScores
    .map((item) => `- ${item.name}: ${item.score} 分，${item.reason}`)
    .join("\n");
  const jd = diagnosis.jdMatch.enabled
    ? `\n\n## JD 匹配\n- 匹配分：${diagnosis.jdMatch.matchScore}\n- 已匹配：${diagnosis.jdMatch.matchedKeywords.join("、") || "暂无"}\n- 缺口：${diagnosis.jdMatch.missingKeywords.join("、") || "暂无"}`
    : "";
  return `## 诊断概览\n- 总分：${diagnosis.overallScore}\n- 用户阶段：${diagnosis.userTypeReason}\n\n## 维度评分\n${dimensions}\n\n## 关键问题\n${issues}${jd}\n\n## 风险提示\n${diagnosis.riskNotes.map((note) => `- ${note}`).join("\n")}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getOptionalAuthenticatedUser(req);
    if ("response" in auth) return auth.response;
    if (!auth.user) {
      const demoAccess = await reserveDemoDiagnosisAccess(req);
      if (!demoAccess.allowed) return demoAccess.response;
    }

    const body = await req.json();
    const structuredResume = body.structuredResume ? normalizeStructuredResumeV1(body.structuredResume) : null;
    const markdown = String(body.markdown || (structuredResume ? renderStructuredResumeV1Markdown(structuredResume) : "")).trim();
    const targetRole = String(body.targetRole || body.position || "").trim();
    const jdText = String(body.jdText || body.targetJd || "").trim();
    const userType = normalizeUserType(body.userType);
    const routing = chooseDeepSeekModel({
      scene: jdText.length > 300 ? "jd_match" : "diagnose_basic",
      textLength: markdown.length,
      jdLength: jdText.length,
      workItemCount: structuredResume?.work?.length || 0,
      userTier: body.userTier || "free",
      userType,
      proQuotaRemaining: body.proQuotaRemaining,
    });

    if (markdown.length < 40) {
      return NextResponse.json({ error: "简历内容过短，请补充更多经历、项目或教育信息后再诊断。" }, { status: 400 });
    }

    const fallbackInput = { markdown, userType, targetRole, jdText };

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        { error: "DeepSeek API Key 未配置，请在 .env.local 中设置 DEEPSEEK_API_KEY。" },
        { status: 500 }
      );
    }

    const userMessage = `用户阶段：${userType}
目标岗位：${targetRole || "未填写"}
JD：
${jdText || "未提供"}

简历 Markdown：
${markdown}

结构化简历数据：
${structuredResume ? JSON.stringify(structuredResume) : "未提供"}`;

    let parsed = safeParseJsonObject(await callDeepSeek([
      { role: "system", content: DIAGNOSE_PROMPT },
      { role: "user", content: userMessage },
    ], routing.model));

    if (!parsed) {
      const fallback = buildFallbackDiagnosis(fallbackInput);
      const repaired = await callDeepSeek([
        { role: "system", content: "把用户提供的内容修复为严格 JSON 对象，必须符合诊断 schema，不要输出 Markdown。" },
        { role: "user", content: JSON.stringify(fallback) },
      ], routing.model);
      parsed = safeParseJsonObject(repaired);
    }

    if (!parsed) {
      return NextResponse.json({ error: "AI 返回格式无法解析，请稍后重试。" }, { status: 502 });
    }

    const structured = normalizeDiagnosis(parsed, fallbackInput) as StructuredDiagnosis;
    return NextResponse.json({
      diagnosis: diagnosisToMarkdown(structured),
      structured,
      modelTier: routing.tier,
      routingReason: routing.reason,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

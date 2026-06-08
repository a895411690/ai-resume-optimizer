import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const DIAGNOSE_PROMPT = `你是一位资深的HR和简历评审专家。请对以下简历进行全面诊断，从以下角度分析：

1. **内容完整性**：是否缺少关键部分
2. **语言表达**：是否有平淡、冗余、不专业的表达
3. **量化程度**：成果是否充分量化
4. **关键词覆盖**：是否包含足够行业关键词
5. **结构排版**：Markdown结构是否合理
6. **针对性**：技能和经历是否聚焦

请用清晰的结构化格式输出诊断报告，每条问题给出具体建议。`;

export async function POST(req: NextRequest) {
  try {
    const { markdown } = await req.json();

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: DIAGNOSE_PROMPT },
          { role: "user", content: `请诊断以下简历：\n${markdown}` },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    const data = await response.json();
    const diagnosis = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ diagnosis });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

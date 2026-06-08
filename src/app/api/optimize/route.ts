import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY!;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

const GENERAL_PROMPT = `你是一位资深的简历优化专家，专注于中文简历的美化和专业化提升。请根据以下原则优化简历：

1. **语言美化**：将平铺直叙的表达改为更有冲击力的专业表达
2. **成果量化**：尽可能将描述中的成果用具体数字量化
3. **结构优化**：保持原有Markdown结构，确保排版整齐
4. **关键词丰富**：适当增加行业关键词，提升ATS筛选通过率
5. **STAR法则**：经历部分采用情境-任务-行动-结果的结构

请直接输出优化后的完整Markdown简历，不要加任何额外说明。`;

const TARGETED_PROMPT = `你是一位资深的简历优化专家，需要根据目标职位要求对简历进行针对性优化。请：

1. 仔细分析目标JD中的关键词和技能要求
2. 调整简历中的技能描述，匹配目标岗位需求
3. 突出相关经验和项目经历
4. 保持原有Markdown结构
5. 使用STAR法则描述经历

请直接输出优化后的完整Markdown简历，不要加任何额外说明。`;

export async function POST(req: NextRequest) {
  try {
    const { markdown, mode, targetJd } = await req.json();
    const systemPrompt = mode === "general" ? GENERAL_PROMPT : TARGETED_PROMPT;
    const userMessage = mode === "targeted" && targetJd
      ? `目标职位JD：\n${targetJd}\n\n我的简历（Markdown格式）：\n${markdown}`
      : `请优化以下简历（Markdown格式）：\n${markdown}`;

    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    const optimized = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ optimized });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

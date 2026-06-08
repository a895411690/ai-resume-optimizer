export interface Resume {
  id: string;
  user_id: string;
  type: "original" | "optimized";
  title: string;
  position: string;
  markdown_content: string;
  optimized_content?: string;
  target_jd?: string;
  created_at: string;
  updated_at: string;
}

export interface AiOptimizeRequest {
  markdown: string;
  mode: "general" | "targeted";
  targetJd?: string;
}

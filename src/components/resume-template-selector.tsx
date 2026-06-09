"use client";

import { Palette } from "lucide-react";
import { RESUME_TEMPLATES } from "@/lib/resume-templates.js";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function ResumeTemplateSelector({ value, onChange }: Props) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-md border bg-white p-1" aria-label="简历模板选择">
      <Palette className="ml-1 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      {RESUME_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          title={`${template.name}：${template.description}`}
          onClick={() => onChange(template.id)}
          className={`h-7 rounded px-2 text-[11px] font-medium transition ${value === template.id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {template.name}
        </button>
      ))}
    </div>
  );
}

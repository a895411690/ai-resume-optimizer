"use client";
import { Children } from "react";
import ReactMarkdown from "react-markdown";
import { normalizeResumeMarkdown } from "@/lib/resume-formatting.js";
import { renderResumePreviewMarkdown } from "@/lib/resume-preview-layout.js";

interface Props {
  markdown: string;
  title?: string;
}

export function ResumePreview({ markdown, title }: Props) {
  const formatted = normalizeResumeMarkdown(markdown || "");
  const layout = renderResumePreviewMarkdown(formatted);

  return (
    <div className="h-full overflow-auto" aria-label={title ? `${title}预览` : "简历预览"}>
      <div className="max-w-[794px] mx-auto bg-white shadow-lg p-12 min-h-[1123px] text-sm leading-relaxed print:shadow-none print:p-0">
        {layout.title && (
          <header className="mb-6 border-b-2 border-gray-800 pb-4 text-center">
            <h1 className="text-2xl font-bold text-gray-950">{layout.title}</h1>
            {layout.contactItems.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
                {layout.contactItems.map((item) => <span key={item}>{item}</span>)}
              </div>
            )}
          </header>
        )}
        <ReactMarkdown
          components={{
            h1: ({ ...props }) => <h1 className="text-2xl font-bold text-center mb-6 pb-4 border-b-2 border-gray-800" {...props} />,
            h2: ({ ...props }) => <h2 className="text-lg font-bold mt-6 mb-3 pb-1 border-b border-gray-300 text-gray-800 [&:not(:first-of-type)]:mt-8" {...props} />,
            h3: ({ ...props }) => <h3 className="text-base font-semibold mt-4 mb-2 text-gray-700" {...props} />,
            p: ({ children, ...props }) => (
              <p className="mb-2 text-gray-700" {...props}>
                {Children.map(children, (child) => {
                  if (typeof child === "string" && child.includes("**")) {
                    const parts = child.split(/(\*\*[^*]+\*\*)/g);
                    return parts.map((part, i) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return <strong key={i} className="text-gray-900">{part.slice(2, -2)}</strong>;
                      }
                      return <span key={i}>{part}</span>;
                    });
                  }
                  return child;
                })}
              </p>
            ),
            li: ({ children, ...props }) => <li className="mb-1 text-gray-700 ml-4 list-disc" {...props}>{children}</li>,
            ul: ({ ...props }) => <ul className="mb-3" {...props} />,
            strong: ({ ...props }) => <strong className="text-gray-900 font-semibold" {...props} />,
            em: ({ ...props }) => <em className="text-gray-500 italic" {...props} />,
          }}
        >
          {layout.bodyMarkdown || formatted}
        </ReactMarkdown>
      </div>
    </div>
  );
}

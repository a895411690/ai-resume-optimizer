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
    <div className="h-full min-w-0 overflow-auto" aria-label={title ? `${title}预览` : "简历预览"}>
      <div className="mx-auto min-w-0 bg-white p-4 text-sm leading-relaxed shadow-sm sm:p-8 md:max-w-[794px] md:p-12 md:shadow-lg lg:min-h-[1123px] print:shadow-none print:p-0">
        {layout.title && (
          <header className="mb-6 border-b-2 border-gray-800 pb-4 text-center">
            <h1 className="break-words text-xl font-bold text-gray-950 sm:text-2xl">{layout.title}</h1>
            {layout.contactItems.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
                {layout.contactItems.map((item) => <span className="break-words" key={item}>{item}</span>)}
              </div>
            )}
          </header>
        )}
        <ReactMarkdown
          components={{
            h1: ({ ...props }) => <h1 className="mb-5 break-words border-b-2 border-gray-800 pb-3 text-center text-xl font-bold sm:mb-6 sm:pb-4 sm:text-2xl" {...props} />,
            h2: ({ ...props }) => <h2 className="mb-3 mt-5 break-words border-b border-gray-300 pb-1 text-base font-bold text-gray-800 sm:mt-6 sm:text-lg [&:not(:first-of-type)]:mt-7 sm:[&:not(:first-of-type)]:mt-8" {...props} />,
            h3: ({ ...props }) => <h3 className="mb-2 mt-4 break-words text-sm font-semibold text-gray-700 sm:text-base" {...props} />,
            p: ({ children, ...props }) => (
              <p className="mb-2 break-words text-gray-700" {...props}>
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
            li: ({ children, ...props }) => <li className="mb-1 ml-4 break-words text-gray-700 list-disc" {...props}>{children}</li>,
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

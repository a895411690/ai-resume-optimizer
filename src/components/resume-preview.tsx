"use client";

import { buildStructuredResumeViewModel, getPreviewTemplateClasses } from "@/lib/resume-template-rendering.js";
import { getResumeTemplate, normalizeResumeTemplateId } from "@/lib/resume-templates.js";

interface Props {
  structuredResume: Record<string, unknown>;
  title?: string;
  templateId?: string;
}

type ResumeViewSection = { title: string; items: Array<{ heading: string; bullets: string[] }> };
type ResumeViewModel = { title: string; contactItems: string[]; skills: string[]; sections: ResumeViewSection[] };

function SectionList({ sections, sectionTitleClass, accentColor, isSingleAccent }: { sections: Array<{ title: string; items: Array<{ heading: string; bullets: string[] }> }>; sectionTitleClass: string; accentColor: string; isSingleAccent: boolean }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.title} className="break-inside-avoid">
          <h2 className={sectionTitleClass} style={isSingleAccent ? { color: accentColor, borderBottomColor: accentColor } : { borderBottomColor: accentColor }}>{section.title}</h2>
          <div className="space-y-3">
            {section.items.map((item, index) => (
              <div key={`${section.title}-${item.heading}-${index}`}>
                {item.heading && <h3 className="mb-2 mt-3 break-words text-sm font-semibold text-gray-700 sm:text-base">{item.heading}</h3>}
                {item.bullets.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {item.bullets.map((bullet, bulletIndex) => (
                      <li key={`${bullet}-${bulletIndex}`} className="ml-4 break-words text-gray-700 list-disc">{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export function ResumePreview({ structuredResume, title, templateId }: Props) {
  const layout = buildStructuredResumeViewModel(structuredResume) as ResumeViewModel;
  const classes = getPreviewTemplateClasses(templateId);
  const template = getResumeTemplate(normalizeResumeTemplateId(templateId));
  const accent = template.preview.accent;
  const isTwoColumn = template.layout === "two-column";
  const isSingleAccent = template.layout === "single-accent";
  const nonSkillSections = layout.sections.filter((section) => section.title !== "专业技能");

  return (
    <div className="h-full min-w-0 overflow-auto" aria-label={title ? `${title}预览` : "简历预览"}>
      <div className={classes.page}>
        {template.layout === "sidebar-right" ? (
          <div className={classes.body}>
            <main className={classes.main}>
              <SectionList sections={nonSkillSections} sectionTitleClass={classes.sectionTitle} accentColor={accent} isSingleAccent={false} />
            </main>
            <aside className={classes.sidebar} style={{ backgroundColor: accent }}>
              <header className="mb-5">
                <h1 className="break-words text-xl font-bold sm:text-2xl">{layout.title}</h1>
                {layout.contactItems.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs md:text-slate-300">
                    {layout.contactItems.map((item) => <div className="break-words" key={item}>{item}</div>)}
                  </div>
                )}
              </header>
              {layout.skills.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest md:text-slate-300">专业技能</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {layout.skills.map((skill) => <span key={skill} className="break-words rounded border border-slate-300 px-2 py-1 text-[11px] md:border-slate-600">{skill}</span>)}
                  </div>
                </section>
              )}
            </aside>
          </div>
        ) : isTwoColumn ? (
          <div className={classes.body}>
            <aside className={classes.sidebar} style={{ backgroundColor: accent }}>
              <header className="mb-5">
                <h1 className="break-words text-xl font-bold sm:text-2xl">{layout.title}</h1>
                {layout.contactItems.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs md:text-slate-300">
                    {layout.contactItems.map((item) => <div className="break-words" key={item}>{item}</div>)}
                  </div>
                )}
              </header>
              {layout.skills.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest md:text-slate-300">专业技能</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {layout.skills.map((skill) => <span key={skill} className="break-words rounded border border-slate-300 px-2 py-1 text-[11px] md:border-slate-600">{skill}</span>)}
                  </div>
                </section>
              )}
            </aside>
            <main className={classes.main}>
              <SectionList sections={nonSkillSections} sectionTitleClass={classes.sectionTitle} accentColor={accent} isSingleAccent={false} />
            </main>
          </div>
        ) : template.layout === "timeline" ? (
          <div>
            <header className={classes.header} style={{ borderBottomColor: accent }}>
              <h1 className="break-words text-xl font-bold text-gray-950 sm:text-2xl">{layout.title}</h1>
              {layout.contactItems.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
                  {layout.contactItems.map((item) => <span className="break-words" key={item}>{item}</span>)}
                </div>
              )}
            </header>
            <div className={classes.main}>
              {layout.sections.map((section) => (
                <section key={section.title} className="break-inside-avoid">
                  <h2 className={classes.sectionTitle} style={{ borderBottomColor: accent }}>{section.title}</h2>
                  <div className="space-y-3">
                    {section.items.map((item, index) => (
                      <div key={`${section.title}-${item.heading}-${index}`} className="relative border-l-2 pl-4" style={{ borderColor: accent }}>
                        <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                        {item.heading && <h3 className="mb-2 mt-3 break-words text-sm font-semibold text-gray-700 sm:text-base">{item.heading}</h3>}
                        {item.bullets.length > 0 && (
                          <ul className="mb-3 space-y-1">
                            {item.bullets.map((bullet, bulletIndex) => (
                              <li key={`${bullet}-${bulletIndex}`} className="ml-4 break-words text-gray-700 list-disc">{bullet}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : template.layout === "infographic" ? (
          <div>
            <div className="p-6 text-center text-white md:rounded-none" style={{ backgroundColor: accent }}>
              <h1 className="break-words text-xl font-bold sm:text-2xl">{layout.title}</h1>
              {layout.contactItems.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-white/80">
                  {layout.contactItems.map((item) => <span className="break-words" key={item}>{item}</span>)}
                </div>
              )}
              {layout.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {layout.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] text-white">{skill}</span>
                  ))}
                </div>
              )}
            </div>
            <div className={classes.main}>
              <SectionList sections={layout.sections} sectionTitleClass={classes.sectionTitle} accentColor={accent} isSingleAccent={false} />
            </div>
          </div>
        ) : (
          <>
            <header className={classes.header} style={isSingleAccent ? { borderLeftColor: accent } : { borderBottomColor: accent }}>
              <h1 className="break-words text-xl font-bold text-gray-950 sm:text-2xl">{layout.title}</h1>
              {layout.contactItems.length > 0 && (
                <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 ${isSingleAccent ? "" : "justify-center"}`}>
                  {layout.contactItems.map((item) => <span className="break-words" key={item}>{item}</span>)}
                </div>
              )}
            </header>
            <SectionList sections={layout.sections} sectionTitleClass={classes.sectionTitle} accentColor={accent} isSingleAccent={isSingleAccent} />
          </>
        )}
      </div>
    </div>
  );
}

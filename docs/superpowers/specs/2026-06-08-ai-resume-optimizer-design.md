# AI Resume Optimizer Product Design

Date: 2026-06-08
Project: Independent AI resume optimization tool
Status: Draft approved direction, pending implementation plan

## Goal

Build an independent AI resume optimization tool that is stronger than generic "AI resume rewriting" products by being trustworthy, explainable, and tailored to different job-seeker stages.

The product should serve four user groups through one unified workflow:

- Fresh graduates
- 1-3 year professionals
- Career switchers
- Mid/senior professionals

The selected product direction is a combined flow:

- Fast mode by default for low-friction results.
- Professional mode for users who want deeper diagnosis, JD matching, and explainable edits.

## Positioning

The product should not compete as a broad job-search platform. It should focus on one job well:

> Help users understand what is weak in their resume and generate a credible, explainable, role-fit optimized version.

Key promise:

- Diagnose before rewriting.
- Explain edits instead of only producing a polished final result.
- Avoid fabricating experience, companies, schools, certificates, metrics, or achievements.
- Adapt evaluation criteria to the user's career stage.
- Support both quick results and deeper professional refinement.

## Product Principles

1. Trust over exaggeration
   The AI must mark uncertain or missing data instead of inventing it.

2. One tool, multiple standards
   All users share the same product surface, but diagnosis criteria change by user type.

3. Fast first, depth available
   Users should get value quickly, then choose whether to inspect or refine further.

4. Explain every meaningful change
   The product should make it clear what changed, why it changed, and whether user confirmation is needed.

5. Keep MVP focused
   Do not build a full job-search suite, template marketplace, payment system, or human consulting workflow in the first implementation phase.

## User Types And Evaluation Focus

### Fresh Graduates

Main problem: limited work experience and weak translation of academic or campus experience into job-relevant ability.

Diagnosis focus:

- Education and major relevance
- Internship experience
- Campus projects, competitions, research, club work
- Skill clarity
- Potential and learning ability
- Role fit from non-work experience

Optimization focus:

- Convert coursework, projects, competitions, and internships into role-relevant evidence.
- Strengthen action-result structure without inventing achievements.
- Replace vague self-evaluation with concrete evidence.

### 1-3 Year Professionals

Main problem: real experience exists, but responsibilities and outcomes are mixed together or expressed too weakly.

Diagnosis focus:

- Responsibility versus contribution
- Quantified outcomes
- Business impact
- Growth trajectory
- Professional wording
- Role-specific keywords

Optimization focus:

- Rewrite "did tasks" into "solved problems and produced results".
- Clarify ownership, scope, and measurable impact.
- Improve wording while preserving credibility.

### Career Switchers

Main problem: previous experience does not obviously match the target role.

Diagnosis focus:

- Transferable skills
- Missing target-role keywords
- Narrative consistency
- Irrelevant detail density
- Motivation and transition logic
- Evidence that supports the target direction

Optimization focus:

- Reorder and reframe experience around transferable ability.
- Reduce unrelated details.
- Build a coherent career-change story.
- Highlight target-role evidence already present in the resume.

### Mid/Senior Professionals

Main problem: resume reads like execution history instead of showing business influence, leadership, and complexity.

Diagnosis focus:

- Business impact
- Team, project, budget, or system scale
- Decision complexity
- Cross-functional collaboration
- Management or technical leadership
- Methodology and strategic thinking

Optimization focus:

- Upgrade execution descriptions into business outcomes.
- Surface leadership, scale, and decision quality.
- Emphasize repeatable methods and senior-level judgment.

## Core User Flow

### Entry

The first screen should make the product usable immediately.

Primary action: Start fast optimization.

Secondary action: Enter professional mode.

Fast mode fields:

- Resume content via upload or paste.
- User type selection with "AI auto-detect" as an option.
- Target role input.
- Optional JD paste.

Professional mode fields:

- User type selection.
- Resume content via upload or paste.
- Target role.
- Optional target company.
- JD paste.
- Optimization strength.

### Fast Mode Result

Fast mode should return a useful result in one pass:

- Overall score.
- Key issue summary, limited to the most important 5 issues.
- Optimized resume.
- Edit summary.
- Risk and missing-data notes.
- Call to inspect professional details.

### Professional Mode Result

Professional mode should expose the reasoning layer:

- Resume score breakdown.
- Career-stage-specific diagnosis.
- JD match analysis when JD is present.
- Section-by-section issue list.
- Original text, revised text, reason, and confidence.
- User confirmation markers for uncertain metrics or missing facts.
- Final optimized resume.

## Feature Scope

### P0: First Strong Release

P0 should be small enough to implement with the existing app structure.

- Resume import or paste
  - PDF
  - DOCX
  - TXT
  - Markdown

- User type selection
  - Fresh graduate
  - 1-3 year professional
  - Career switcher
  - Mid/senior professional
  - AI auto-detect

- Target role input

- Optional JD paste

- AI diagnosis
  - Overall score
  - Dimension scores
  - Top issues
  - Missing-data warnings
  - User type detected or selected

- AI optimization
  - Optimized Markdown resume
  - Edit summary
  - Risk notes

- Side-by-side comparison
  - Original resume
  - Optimized resume

- PDF download

### P1: Differentiation Layer

- Optimization strength
  - Conservative polish
  - Professional enhancement
  - Strong role-fit packaging

- Explainable edit cards
  - Original excerpt
  - Revised text
  - Why it changed
  - User confirmation needed or not

- JD matching details
  - Hard requirements
  - Skill keywords
  - Soft-skill keywords
  - Missing points
  - Suggested evidence to add

- AI auto-detection of user type with visible explanation.

### P2: Later Expansion

- Resume history
- Multi-resume management
- Saved JD library
- Export to DOCX
- Template styling
- Payment and quota system
- Human review workflow

## Page Structure

The current app already has a left sidebar and main preview/editor area. The first implementation can preserve that pattern but should make the main flow clearer.

Recommended layout:

- Left panel: workflow controls
  - Resume title
  - User type
  - Target role
  - JD toggle and textarea
  - Mode selector: Fast / Professional
  - Primary action: Diagnose and Optimize

- Main panel: output workspace
  - Before upload: import/paste prompt
  - After diagnosis: score and issue summary
  - After optimization: resume preview
  - Comparison dialog or split view

- Bottom editor
  - Markdown editing for original or optimized content
  - Import action

The UI should avoid becoming a dashboard. The product should feel focused: one resume, one target, one optimization run.

## AI Output Contracts

The AI API should return structured JSON instead of only Markdown wherever possible. This makes the UI reliable and testable.

### Diagnosis Response

```json
{
  "userType": "fresh_graduate | junior | career_switcher | senior",
  "userTypeReason": "short explanation",
  "overallScore": 78,
  "dimensionScores": [
    { "name": "role_fit", "score": 72, "reason": "short explanation" }
  ],
  "topIssues": [
    {
      "severity": "high | medium | low",
      "section": "Project Experience",
      "originalExcerpt": "...",
      "problem": "...",
      "suggestion": "..."
    }
  ],
  "jdMatch": {
    "enabled": true,
    "matchScore": 70,
    "hardRequirements": [],
    "matchedKeywords": [],
    "missingKeywords": [],
    "recommendations": []
  },
  "riskNotes": [
    "..."
  ]
}
```

### Optimization Response

```json
{
  "optimizedMarkdown": "# ...",
  "editSummary": [
    "Strengthened project impact descriptions",
    "Added role-specific keywords already supported by the resume"
  ],
  "editExplanations": [
    {
      "originalExcerpt": "...",
      "revisedExcerpt": "...",
      "reason": "...",
      "requiresUserConfirmation": true,
      "confirmationPrompt": "Please confirm the actual metric before using this line."
    }
  ],
  "riskNotes": [
    "Some metrics need user confirmation before export."
  ]
}
```

## Prompting Rules

All optimization prompts must enforce these rules:

- Do not invent companies, schools, degrees, certificates, titles, awards, project names, dates, salary, team size, metrics, or tools.
- If a metric would improve the resume but is not present, use a placeholder such as `[请补充具体数据]`.
- Preserve facts from the original resume unless the user explicitly asks to rewrite them.
- Use the selected user type to decide what good looks like.
- If JD is provided, optimize for role fit but do not claim skills that the resume does not support.
- Return structured JSON for diagnosis and explanations, and Markdown for the final resume body.

## Error Handling

- Unsupported file types should be rejected before upload or parsing.
- `.doc` should not appear as supported unless conversion is implemented.
- If PDF parsing returns too little text, the user should be asked to paste text manually.
- If AI returns invalid JSON, retry once with a stricter repair prompt; if still invalid, show a readable failure message.
- If the resume is too short, ask the user to add more content before diagnosis.
- If JD is very short, treat it as target-role context rather than full JD matching.
- If API keys are missing, show a configuration error without exposing secrets.

## Data Flow

1. User imports or pastes resume content.
2. App normalizes text into Markdown-ish content.
3. User selects or auto-detects career stage.
4. User enters target role and optional JD.
5. App calls diagnosis endpoint.
6. App renders scores, issues, and risk notes.
7. App calls optimization endpoint with resume, diagnosis, target role, JD, user type, and strength.
8. App renders optimized resume and edit summary.
9. User edits final Markdown if needed.
10. User downloads PDF.

## Testing Focus

P0 should be verified with focused manual and automated checks:

- Import a TXT resume and run fast mode.
- Paste Markdown manually and run fast mode.
- Run with each user type and confirm diagnosis labels differ.
- Run with and without JD.
- Confirm unsupported `.doc` handling is consistent with the UI.
- Confirm optimized output does not silently invent metrics.
- Confirm PDF download still works with optimized content.
- Confirm empty resume and short resume errors are readable.

## Open Implementation Notes

- The current page component is large and combines authentication, import, editing, diagnosis, optimization, and dialogs. Implementation should consider extracting focused components as part of the feature work.
- Existing endpoints can be evolved, but structured response endpoints may be cleaner than overloading the current Markdown-only optimize response.
- The existing Demo mode is useful for adoption and should remain unless it blocks the new flow.

## Out Of Scope For This Design

- Building AI job search, AI auto-fill, interview prep, or job tracking.
- Human expert consultation.
- Membership, payment, or quota management.
- Full resume template marketplace.
- Bulk resume generation.


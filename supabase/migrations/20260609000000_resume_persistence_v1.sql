-- Resume persistence V1 additive fields

ALTER TABLE resumes
  ADD COLUMN IF NOT EXISTS structured_resume JSONB,
  ADD COLUMN IF NOT EXISTS optimized_structured_resume JSONB,
  ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS workflow_mode TEXT DEFAULT 'fast',
  ADD COLUMN IF NOT EXISTS strength TEXT DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS diagnosis JSONB,
  ADD COLUMN IF NOT EXISTS optimization JSONB;

CREATE INDEX IF NOT EXISTS idx_resumes_template_id ON resumes(template_id);

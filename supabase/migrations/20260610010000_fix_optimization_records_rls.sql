CREATE TABLE IF NOT EXISTS optimization_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'optimize',
  input_summary TEXT DEFAULT '',
  output_summary TEXT DEFAULT '',
  model_tier TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_records_user_id ON optimization_records(user_id);
CREATE INDEX IF NOT EXISTS idx_optimization_records_resume_id ON optimization_records(resume_id);
CREATE INDEX IF NOT EXISTS idx_optimization_records_created_at ON optimization_records(created_at DESC);

ALTER TABLE optimization_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'optimization_records'
      AND policyname = 'Users can manage their own optimization records'
  ) THEN
    CREATE POLICY "Users can manage their own optimization records" ON optimization_records
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

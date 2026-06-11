CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vip_expires_at TIMESTAMPTZ,
  free_optimization_used BOOLEAN NOT NULL DEFAULT false,
  free_optimization_event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('diagnose', 'optimize', 'optimize_module')),
  mode TEXT NOT NULL DEFAULT 'authenticated' CHECK (mode IN ('authenticated', 'demo')),
  entitlement_source TEXT NOT NULL CHECK (entitlement_source IN ('authenticated', 'demo_daily', 'free_once', 'vip')),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed', 'blocked')),
  demo_day DATE,
  demo_ip_hash TEXT,
  demo_client_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE user_entitlements
  ADD CONSTRAINT user_entitlements_free_event_fk
  FOREIGN KEY (free_optimization_event_id) REFERENCES ai_usage_events(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS demo_diagnosis_usage_daily (
  usage_day DATE NOT NULL,
  ip_hash TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  diagnosis_count INTEGER NOT NULL DEFAULT 0,
  last_event_id UUID REFERENCES ai_usage_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usage_day, ip_hash, client_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_vip_expires_at ON user_entitlements(vip_expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_id ON ai_usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_action_created_at ON ai_usage_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_demo_lookup ON ai_usage_events(demo_day, demo_ip_hash, demo_client_hash);
CREATE INDEX IF NOT EXISTS idx_demo_diagnosis_usage_daily_updated_at ON demo_diagnosis_usage_daily(updated_at DESC);

CREATE TRIGGER set_user_entitlements_updated_at BEFORE UPDATE ON user_entitlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_demo_diagnosis_usage_daily_updated_at BEFORE UPDATE ON demo_diagnosis_usage_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_diagnosis_usage_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_entitlements'
      AND policyname = 'Users can view own entitlement'
  ) THEN
    CREATE POLICY "Users can view own entitlement" ON user_entitlements
      FOR SELECT USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_usage_events'
      AND policyname = 'Users can view own AI usage events'
  ) THEN
    CREATE POLICY "Users can view own AI usage events" ON ai_usage_events
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT ON user_entitlements TO authenticated;
GRANT SELECT ON ai_usage_events TO authenticated;
GRANT ALL ON user_entitlements TO service_role;
GRANT ALL ON ai_usage_events TO service_role;
GRANT ALL ON demo_diagnosis_usage_daily TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS public.demo_import_usage_daily (
  usage_day DATE NOT NULL,
  ip_hash TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  import_count INTEGER NOT NULL DEFAULT 0,
  last_event_id UUID REFERENCES public.ai_usage_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usage_day, ip_hash, client_hash)
);

CREATE INDEX IF NOT EXISTS idx_demo_import_usage_daily_updated_at
  ON public.demo_import_usage_daily(updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_demo_import_usage_daily_updated_at'
      AND tgrelid = 'public.demo_import_usage_daily'::regclass
  ) THEN
    CREATE TRIGGER set_demo_import_usage_daily_updated_at
      BEFORE UPDATE ON public.demo_import_usage_daily
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.demo_import_usage_daily ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.demo_import_usage_daily TO service_role;

CREATE OR REPLACE FUNCTION private.reserve_optimization_credit(uid UUID, event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed BOOLEAN := false;
BEGIN
  UPDATE public.user_entitlements
  SET optimization_credits = optimization_credits - 1
  WHERE user_id = uid
    AND optimization_credits >= 1
  RETURNING true INTO claimed;

  IF claimed THEN
    RETURN true;
  END IF;

  UPDATE public.ai_usage_events
  SET status = 'blocked',
      completed_at = NOW()
  WHERE id = event_id
    AND user_id = uid
    AND status = 'reserved';

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.refund_optimization_credit(uid UUID, event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  refunded BOOLEAN := false;
BEGIN
  UPDATE public.user_entitlements
  SET optimization_credits = optimization_credits + 1
  WHERE user_id = uid
    AND EXISTS (
      SELECT 1
      FROM public.ai_usage_events
      WHERE id = event_id
        AND user_id = uid
        AND entitlement_source = 'credits'
        AND status = 'failed'
    )
  RETURNING true INTO refunded;

  RETURN COALESCE(refunded, false);
END;
$$;

CREATE OR REPLACE FUNCTION private.reserve_demo_diagnosis(
  usage_day_input DATE,
  ip_hash_input TEXT,
  client_hash_input TEXT,
  max_count INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
  next_count INTEGER;
BEGIN
  WITH bumped AS (
    INSERT INTO public.demo_diagnosis_usage_daily (
      usage_day,
      ip_hash,
      client_hash,
      diagnosis_count
    )
    VALUES (
      usage_day_input,
      ip_hash_input,
      client_hash_input,
      1
    )
    ON CONFLICT (usage_day, ip_hash, client_hash)
    DO UPDATE SET
      diagnosis_count = public.demo_diagnosis_usage_daily.diagnosis_count + 1
    WHERE public.demo_diagnosis_usage_daily.diagnosis_count < max_count
    RETURNING diagnosis_count
  )
  SELECT diagnosis_count INTO next_count FROM bumped;

  IF next_count IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.ai_usage_events (
    action,
    mode,
    entitlement_source,
    status,
    demo_day,
    demo_ip_hash,
    demo_client_hash,
    completed_at
  )
  VALUES (
    'diagnose',
    'demo',
    'demo_daily',
    'completed',
    usage_day_input,
    ip_hash_input,
    client_hash_input,
    NOW()
  )
  RETURNING id INTO event_id;

  UPDATE public.demo_diagnosis_usage_daily
  SET last_event_id = event_id
  WHERE usage_day = usage_day_input
    AND ip_hash = ip_hash_input
    AND client_hash = client_hash_input;

  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.reserve_demo_import(
  usage_day_input DATE,
  ip_hash_input TEXT,
  client_hash_input TEXT,
  max_count INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_id UUID;
  next_count INTEGER;
BEGIN
  WITH bumped AS (
    INSERT INTO public.demo_import_usage_daily (
      usage_day,
      ip_hash,
      client_hash,
      import_count
    )
    VALUES (
      usage_day_input,
      ip_hash_input,
      client_hash_input,
      1
    )
    ON CONFLICT (usage_day, ip_hash, client_hash)
    DO UPDATE SET
      import_count = public.demo_import_usage_daily.import_count + 1
    WHERE public.demo_import_usage_daily.import_count < max_count
    RETURNING import_count
  )
  SELECT import_count INTO next_count FROM bumped;

  IF next_count IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.ai_usage_events (
    action,
    mode,
    entitlement_source,
    status,
    demo_day,
    demo_ip_hash,
    demo_client_hash,
    metadata,
    completed_at
  )
  VALUES (
    'diagnose',
    'demo',
    'demo_daily',
    'completed',
    usage_day_input,
    ip_hash_input,
    client_hash_input,
    jsonb_build_object('kind', 'import'),
    NOW()
  )
  RETURNING id INTO event_id;

  UPDATE public.demo_import_usage_daily
  SET last_event_id = event_id
  WHERE usage_day = usage_day_input
    AND ip_hash = ip_hash_input
    AND client_hash = client_hash_input;

  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.finalize_payment_order(
  order_no_input TEXT,
  expected_money NUMERIC,
  xddpay_order_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.payment_orders%ROWTYPE;
BEGIN
  SELECT *
  INTO order_row
  FROM public.payment_orders
  WHERE order_no = order_no_input
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF order_row.status = 'paid' THEN
    RETURN jsonb_build_object('status', 'already_paid');
  END IF;

  IF order_row.status <> 'pending' THEN
    RETURN jsonb_build_object('status', 'ignored');
  END IF;

  IF ROUND(COALESCE(expected_money, 0), 2) <> ROUND(order_row.money, 2) THEN
    RETURN jsonb_build_object('status', 'money_mismatch');
  END IF;

  UPDATE public.payment_orders
  SET status = 'paid',
      paid_at = NOW(),
      xddpay_order = NULLIF(xddpay_order_input, ''),
      real_money = expected_money
  WHERE id = order_row.id
    AND status = 'pending';

  IF order_row.lifetime_vip_granted THEN
    INSERT INTO public.user_entitlements (user_id, lifetime_vip)
    VALUES (order_row.user_id, true)
    ON CONFLICT (user_id)
    DO UPDATE SET
      lifetime_vip = true,
      updated_at = NOW();
  ELSIF order_row.credits_granted > 0 THEN
    INSERT INTO public.user_entitlements (user_id, optimization_credits)
    VALUES (order_row.user_id, order_row.credits_granted)
    ON CONFLICT (user_id)
    DO UPDATE SET
      optimization_credits = public.user_entitlements.optimization_credits + EXCLUDED.optimization_credits,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object('status', 'paid');
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_optimization_credit(uid UUID, event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  RETURN private.reserve_optimization_credit(uid, event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_optimization_credit(uid UUID, event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  RETURN private.refund_optimization_credit(uid, event_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_demo_diagnosis(
  usage_day_input DATE,
  ip_hash_input TEXT,
  client_hash_input TEXT,
  max_count INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  RETURN private.reserve_demo_diagnosis(usage_day_input, ip_hash_input, client_hash_input, max_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_demo_import(
  usage_day_input DATE,
  ip_hash_input TEXT,
  client_hash_input TEXT,
  max_count INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  RETURN private.reserve_demo_import(usage_day_input, ip_hash_input, client_hash_input, max_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_payment_order(
  order_no_input TEXT,
  expected_money NUMERIC,
  xddpay_order_input TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, private
AS $$
BEGIN
  RETURN private.finalize_payment_order(order_no_input, expected_money, xddpay_order_input);
END;
$$;

REVOKE EXECUTE ON FUNCTION private.reserve_optimization_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.refund_optimization_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.reserve_demo_diagnosis(DATE, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.reserve_demo_import(DATE, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.finalize_payment_order(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.reserve_optimization_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION private.refund_optimization_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION private.reserve_demo_diagnosis(DATE, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION private.reserve_demo_import(DATE, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION private.finalize_payment_order(TEXT, NUMERIC, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_optimization_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_optimization_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_demo_diagnosis(DATE, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_demo_import(DATE, TEXT, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_payment_order(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_optimization_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_optimization_credit(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_demo_diagnosis(DATE, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_demo_import(DATE, TEXT, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payment_order(TEXT, NUMERIC, TEXT) TO service_role;

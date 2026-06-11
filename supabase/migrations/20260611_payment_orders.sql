-- Payment orders table for tracking VIP purchases
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pay_type smallint NOT NULL DEFAULT 43,
  money numeric(10,2) NOT NULL,
  real_money numeric(10,2),
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','failed')),
  xddpay_order text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);

-- RLS
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Users can only see their own orders
CREATE POLICY "Users can view own payment orders"
  ON public.payment_orders FOR SELECT
  USING (auth.uid() = user_id);

-- Service role has full access (used by API routes)
CREATE POLICY "Service role full access on payment_orders"
  ON public.payment_orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow inserts for authenticated users (creating orders)
CREATE POLICY "Users can create own payment orders"
  ON public.payment_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create webhook audit table used by DM Champ and SocialDrive webhook routes.
-- This table existed in an older taskifiai-migration.sql but was never applied as a numbered migration.

CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_source ON public.webhooks(source_product);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON public.webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON public.webhooks(created_at);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON public.webhooks;
CREATE POLICY "Allow all operations for authenticated users"
  ON public.webhooks
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

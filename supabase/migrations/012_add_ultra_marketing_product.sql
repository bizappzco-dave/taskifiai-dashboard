-- Add the Ultra Marketing Assistant product toggle/access model.
-- This is local schema state only; apply through the normal Supabase migration flow.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_clients_features_gin
  ON public.clients USING GIN (features);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_subscriptions_client_product_status
  ON public.subscriptions (client_id, product_id, status);

INSERT INTO public.products (
  name,
  slug,
  description,
  base_price_monthly,
  setup_fee,
  currency,
  features,
  active
) VALUES (
  'Ultra Marketing Assistant',
  'ultra-marketing',
  '24/7 AI marketing assistant workspace with source-backed reports, draft campaigns, approval queues, and managed TaskifiAI access.',
  NULL,
  0,
  'EUR',
  '["24/7 AI marketing workspace", "Source-backed marketing reports", "Social, email, GBP and review draft workflows", "Approval-required external actions", "Shared tenant-isolated TaskifiAI runtime"]'::jsonb,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  active = true;

INSERT INTO public.activity_types (type_name, category, description, default_title_template)
VALUES
  ('ultra_marketing_enabled', 'operations', 'Ultra Marketing Assistant enabled for a client', 'Ultra Marketing enabled'),
  ('ultra_marketing_paused', 'operations', 'Ultra Marketing Assistant access paused for a client', 'Ultra Marketing paused')
ON CONFLICT (type_name) DO NOTHING;

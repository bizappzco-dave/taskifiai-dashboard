-- Billing + invoices support for subscription fees and payment confirmation docs

-- 1) Store custom subscription text on client setup
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS subscription_description TEXT;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS monthly_revenue NUMERIC(12,2);

-- Product/subscription tables live in the older root taskifiai-migration.sql on
-- some environments. Keep this migration self-contained so dashboard billing
-- and product toggles can be applied through the normal Supabase migration flow.
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  base_price_monthly NUMERIC(12,2),
  setup_fee NUMERIC(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  features JSONB DEFAULT '[]'::jsonb,
  api_base_url TEXT,
  api_key TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  plan TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  monthly_price NUMERIC(12,2),
  setup_fee_paid NUMERIC(12,2) DEFAULT 0,
  external_account_id TEXT,
  external_login_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON public.subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON public.subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view active products" ON public.products;
CREATE POLICY "Users can view active products"
  ON public.products FOR SELECT
  TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Users can view subscriptions for their clients" ON public.subscriptions;
CREATE POLICY "Users can view subscriptions for their clients"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      WHERE c.user_id = auth.uid()
      OR c.id IN (
        SELECT csa.client_id
        FROM public.client_staff_access csa
        WHERE csa.user_id = auth.uid()
          AND COALESCE(csa.invitation_accepted, false) = true
      )
    )
  );

INSERT INTO public.products (name, slug, description, base_price_monthly, setup_fee, currency, features, api_base_url, active)
VALUES
  ('Lite-Sites', 'lite-sites', '2-3 page websites, 48-hour launch', 49.00, 0, 'EUR', '["2-3 page website", "Mobile-optimized", "48-hour launch", "Contact form", "QR code", "Google Maps"]'::jsonb, NULL, true),
  ('SocialDrive AI', 'socialdrive-ai', 'AI-powered social media content', 99.00, 0, 'EUR', '["AI caption generation", "Multi-platform posting", "Content calendar", "Brand voice matching", "Post → DM sync"]'::jsonb, 'https://socialdrive-ai.vercel.app/api', true),
  ('DM Champ', 'dm-champ', 'WhatsApp + social DM automation', 179.00, 0, 'EUR', '["Unified inbox", "AI auto-replies", "30-second response", "Lead nurturing", "Campaign tracking"]'::jsonb, 'https://api.dmchamp.com/v1', true)
ON CONFLICT (slug) DO NOTHING;

-- subscriptions table now stores billing mode and a human description
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_model TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS plan_description TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS external_payment_id TEXT;

-- Invoice documents for confirmed payments
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  billing_model TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT,
  provider_payment_id TEXT,
  description TEXT,
  document_html TEXT,
  metadata JSONB,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_payment_id_key
  ON public.invoices(provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_client_created_at
  ON public.invoices(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription
  ON public.invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_product
  ON public.invoices(product_id);

-- Optional RLS for invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices for their clients"
  ON public.invoices FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
      OR id IN (
        SELECT client_id FROM public.client_staff_access
        WHERE user_id = auth.uid()
          AND COALESCE(invitation_accepted, false) = true
      )
    )
  );

CREATE POLICY "Users can create invoices for their clients"
  ON public.invoices FOR INSERT
  WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
      OR id IN (
        SELECT client_id FROM public.client_staff_access
        WHERE user_id = auth.uid()
          AND COALESCE(invitation_accepted, false) = true
      )
    )
  );

CREATE POLICY "Users can update invoices for their clients"
  ON public.invoices FOR UPDATE
  USING (
    client_id IN (
      SELECT id FROM public.clients
      WHERE user_id = auth.uid()
      OR id IN (
        SELECT client_id FROM public.client_staff_access
        WHERE user_id = auth.uid()
          AND COALESCE(invitation_accepted, false) = true
      )
    )
  );

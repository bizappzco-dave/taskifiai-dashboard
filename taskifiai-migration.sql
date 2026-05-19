-- TaskifiAI Database Migration
-- Run in: https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf/sql/new

-- 1. Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  
  -- Social Media
  instagram_handle TEXT,
  facebook_page TEXT,
  linkedin_url TEXT,
  
  -- Business Details
  industry TEXT,
  timezone TEXT DEFAULT 'Europe/Dublin',
  
  -- Brand Profile (JSONB for flexibility)
  brand_profile JSONB DEFAULT '{}',
  
  -- Product Subscriptions
  lite_sites_enabled BOOLEAN DEFAULT false,
  lite_sites_url TEXT,
  lite_sites_status TEXT,
  
  socialdrive_enabled BOOLEAN DEFAULT false,
  socialdrive_account_id TEXT,
  socialdrive_upload_url TEXT,
  socialdrive_dashboard_url TEXT,
  socialdrive_status TEXT DEFAULT 'inactive',
  
  dmchamp_enabled BOOLEAN DEFAULT false,
  dmchamp_account_id TEXT,
  dmchamp_login_url TEXT DEFAULT 'https://app.dmchamp.com',
  dmchamp_status TEXT DEFAULT 'inactive',
  
  -- Subscription & Billing
  subscription_tier TEXT DEFAULT 'starter',
  monthly_revenue DECIMAL(10,2) DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly',
  next_billing_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active',
  onboarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_industry ON clients(industry);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON clients;
CREATE POLICY "Allow all operations for authenticated users"
  ON clients
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 2. Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  base_price_monthly DECIMAL(10,2),
  setup_fee DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  features JSONB DEFAULT '[]',
  api_base_url TEXT,
  api_key TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed products
INSERT INTO products (name, slug, description, base_price_monthly, setup_fee, features, api_base_url) VALUES
  ('Lite-Sites', 'lite-sites', '2-3 page websites, 48-hour launch', 49.00, 0, 
   '["2-3 page website", "Mobile-optimized", "48-hour launch", "Contact form", "QR code", "Google Maps"]',
   NULL),
  ('SocialDrive AI', 'socialdrive-ai', 'AI-powered social media content', 99.00, 0,
   '["AI caption generation", "Multi-platform posting", "Content calendar", "Brand voice matching", "Post → DM sync"]',
   'https://socialdrive-ai.vercel.app/api'),
  ('DM Champ', 'dm-champ', 'WhatsApp + social DM automation', 179.00, 0,
   '["Unified inbox", "AI auto-replies", "30-second response", "Lead nurturing", "Campaign tracking"]',
   'https://api.dmchamp.com/v1')
ON CONFLICT (slug) DO NOTHING;

-- 3. Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  plan TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'active',
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  monthly_price DECIMAL(10,2),
  setup_fee_paid DECIMAL(10,2) DEFAULT 0,
  external_account_id TEXT,
  external_login_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON subscriptions(product_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON subscriptions;
CREATE POLICY "Allow all operations for authenticated users"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  product TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_client_id ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_product ON activities(product);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON activities;
CREATE POLICY "Allow all operations for authenticated users"
  ON activities
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_product TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_source ON webhooks(source_product);
CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_at ON webhooks(created_at);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON webhooks;
CREATE POLICY "Allow all operations for authenticated users"
  ON webhooks
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

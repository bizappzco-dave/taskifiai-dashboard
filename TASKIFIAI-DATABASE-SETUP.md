# TaskifiAI Database Setup

**Created:** 2026-05-13  
**Status:** Ready to deploy

---

## Supabase Project

**Project Name:** TaskifiAI Dashboard  
**URL:** https://dqhnxzaktnejasqlfrjf.supabase.co (reusing existing project)  
**Dashboard:** https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf

---

## Database Schema

### 1. `clients` Table (Master Client List)

```sql
-- Create clients table
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
  -- Example structure:
  -- {
  --   "voice": "Professional, aspirational",
  --   "target_audience": "Aspiring barbers, students",
  --   "hashtags": ["#NoLabel", "#BarberEducation"],
  --   "content_styles": ["Short Statement", "Mission Post"],
  --   "competitors": ["Other barber academies"],
  --   "services": "Barber training courses"
  -- }
  
  -- Product Subscriptions
  lite_sites_enabled BOOLEAN DEFAULT false,
  lite_sites_url TEXT,
  lite_sites_status TEXT, -- 'building', 'live', 'maintenance'
  
  socialdrive_enabled BOOLEAN DEFAULT false,
  socialdrive_account_id TEXT,
  socialdrive_upload_url TEXT,
  socialdrive_dashboard_url TEXT,
  socialdrive_status TEXT DEFAULT 'inactive', -- 'active', 'paused', 'cancelled'
  
  dmchamp_enabled BOOLEAN DEFAULT false,
  dmchamp_account_id TEXT,
  dmchamp_login_url TEXT DEFAULT 'https://app.dmchamp.com',
  dmchamp_status TEXT DEFAULT 'inactive', -- 'active', 'paused', 'cancelled'
  
  -- Subscription & Billing
  subscription_tier TEXT DEFAULT 'starter', -- 'starter', 'pro', 'enterprise'
  monthly_revenue DECIMAL(10,2) DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly',
  next_billing_date DATE,
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'paused', 'cancelled', 'churned'
  onboarded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_industry ON clients(industry);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to do everything
CREATE POLICY "Allow all operations for authenticated users"
  ON clients
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

### 2. `products` Table (Product Catalog)

```sql
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Product Info
  name TEXT NOT NULL, -- 'Lite-Sites', 'SocialDrive AI', 'DM Champ'
  slug TEXT UNIQUE NOT NULL, -- 'lite-sites', 'socialdrive-ai', 'dm-champ'
  description TEXT,
  
  -- Pricing
  base_price_monthly DECIMAL(10,2),
  setup_fee DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  
  -- Features
  features JSONB DEFAULT '[]',
  -- Example:
  -- [
  --   "AI content generation",
  --   "Multi-platform posting",
  --   "30-second DM response"
  -- ]
  
  -- API Config
  api_base_url TEXT,
  api_key TEXT, -- Store in Vault or env vars in production
  
  -- Status
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed initial products
INSERT INTO products (name, slug, description, base_price_monthly, setup_fee, features, api_base_url) VALUES
  ('Lite-Sites', 'lite-sites', '2-3 page websites, 48-hour launch', 49.00, 0, 
   '["2-3 page website", "Mobile-optimized", "48-hour launch", "Contact form", "QR code", "Google Maps"]',
   NULL),
  
  ('SocialDrive AI', 'socialdrive-ai', 'AI-powered social media content', 99.00, 0,
   '["AI caption generation", "Multi-platform posting", "Content calendar", "Brand voice matching", "Post → DM sync"]',
   'https://socialdrive-ai.vercel.app/api'),
  
  ('DM Champ', 'dm-champ', 'WhatsApp + social DM automation', 179.00, 0,
   '["Unified inbox", "AI auto-replies", "30-second response", "Lead nurturing", "Campaign tracking"]',
   'https://api.dmchamp.com/v1');
```

---

### 3. `subscriptions` Table (Client → Product Mapping)

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  -- Subscription Details
  plan TEXT DEFAULT 'standard', -- 'starter', 'standard', 'premium'
  status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'paused', 'past_due'
  
  -- Dates
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Pricing (snapshot at time of subscription)
  monthly_price DECIMAL(10,2),
  setup_fee_paid DECIMAL(10,2) DEFAULT 0,
  
  -- External Account IDs
  external_account_id TEXT, -- Their account ID in the product system
  external_login_url TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_client_id ON subscriptions(client_id);
CREATE INDEX idx_subscriptions_product_id ON subscriptions(product_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS Policy
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

### 4. `activities` Table (Unified Activity Feed)

```sql
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Activity Info
  product TEXT NOT NULL, -- 'lite-sites', 'socialdrive-ai', 'dm-champ'
  activity_type TEXT NOT NULL, -- 'client_created', 'content_uploaded', 'message_sent', etc.
  title TEXT,
  description TEXT,
  
  -- Details (JSONB for flexibility)
  details JSONB DEFAULT '{}',
  -- Examples:
  -- {"post_count": 7, "platforms": ["instagram", "facebook"]}
  -- {"message_count": 156, "leads_captured": 23}
  -- {"site_url": "https://nolabel.ie", "status": "live"}
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX idx_activities_client_id ON activities(client_id);
CREATE INDEX idx_activities_product ON activities(product);
CREATE INDEX idx_activities_created_at ON activities(created_at);

-- RLS Policy
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users"
  ON activities
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

### 5. `webhooks` Table (Incoming Webhook Logs)

```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source
  source_product TEXT NOT NULL, -- 'socialdrive-ai', 'dm-champ'
  event_type TEXT NOT NULL, -- 'client.created', 'content.uploaded', etc.
  
  -- Payload
  payload JSONB NOT NULL,
  
  -- Processing
  status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'failed'
  processed_at TIMESTAMP,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_source ON webhooks(source_product);
CREATE INDEX idx_webhooks_status ON webhooks(status);
CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);

-- RLS Policy
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations for authenticated users"
  ON webhooks
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

---

## Migration Script

Save as: `taskifiai-migrations.sql`

```sql
-- Run all the CREATE TABLE statements above in this order:
-- 1. clients
-- 2. products
-- 3. subscriptions
-- 4. activities
-- 5. webhooks

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
```

---

## Next Steps

1. **Run migration in Supabase SQL Editor**
2. **Test with sample client** (No Label Academy)
3. **Build API endpoints** for client creation + product enablement
4. **Build simple UI** for client management

---

**Ready to deploy!**

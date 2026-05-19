-- Add No Label Academy as first client
-- Run in: https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf/sql/new

INSERT INTO clients (
  business_name,
  contact_name,
  email,
  phone,
  website,
  instagram_handle,
  facebook_page,
  linkedin_url,
  industry,
  timezone,
  brand_profile,
  subscription_tier,
  status,
  socialdrive_enabled,
  socialdrive_status
) VALUES (
  'No Label Academy',
  'Glenn',
  'glenn@nolabel.ie',
  '+353 87 123 4567',
  'https://nolabel.ie',
  '@nolabelacademy',
  '@nolabelacademy',
  NULL,
  'Education',
  'Europe/Dublin',
  '{
    "voice": "Professional, aspirational, inspiring",
    "target_audience": "Aspiring barbers, career changers, skill seekers",
    "services": "Barber training courses, advanced techniques, business coaching",
    "hashtags": ["#NoLabel", "#BarberEducation", "#BarberTraining", "#NoLabelAcademy"],
    "brand_values": "Excellence, community, craftsmanship"
  }'::jsonb,
  'pro',
  'active',
  true,
  'active'
);

-- Verify it was created
SELECT 
  id,
  business_name,
  contact_name,
  email,
  instagram_handle,
  subscription_tier,
  socialdrive_enabled,
  created_at
FROM clients 
WHERE business_name = 'No Label Academy';

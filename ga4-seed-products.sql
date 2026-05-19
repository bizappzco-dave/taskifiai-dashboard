-- Update product descriptions to include Google Analytics setup
-- Run in: https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf/sql/new

UPDATE products 
SET description = '2-3 page websites with Google Analytics + Search Console included. Track visitors and SEO from day one.',
    features = '["2-3 page website", "Mobile-optimized", "48-hour launch", "Contact form", "QR code", "Google Maps", "Google Analytics setup", "Search Console setup"]'
WHERE slug = 'lite-sites';

UPDATE products 
SET description = 'AI-powered social media content with Google Analytics on landing pages. Measure campaign performance.',
    features = '["AI caption generation", "Multi-platform posting", "Content calendar", "Brand voice matching", "Post → DM sync", "Google Analytics on landing pages"]'
WHERE slug = 'socialdrive-ai';

UPDATE products 
SET description = 'WhatsApp + social DM automation with full analytics stack. Unified reporting across all properties.',
    features = '["Unified inbox", "AI auto-replies", "30-second response", "Lead nurturing", "Campaign tracking", "Full analytics stack", "Unified reporting"]'
WHERE slug = 'dm-champ';

-- Verify updates
SELECT name, slug, description, features FROM products WHERE active = true;

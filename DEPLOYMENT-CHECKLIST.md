# TaskifiAI Dashboard - Deployment Checklist

**Status:** Ready to deploy  
**Created:** 2026-05-13

---

## ✅ Step 1: Run Database Migration

**Action:**
1. Go to https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf/sql/new
2. Copy contents of `taskifiai-migration.sql`
3. Click "Run" or press Cmd/Ctrl + Enter
4. Verify success message

**Expected Result:**
- ✅ 5 tables created: `clients`, `products`, `subscriptions`, `activities`, `webhooks`
- ✅ 3 products seeded: Lite-Sites, SocialDrive AI, DM Champ
- ✅ Indexes created for fast lookups
- ✅ Row Level Security policies enabled

**Verify:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('clients', 'products', 'subscriptions', 'activities', 'webhooks');

-- Check products seeded
SELECT name, slug, base_price_monthly FROM products;
```

---

## ✅ Step 2: Install Dependencies

**Action:**
```bash
cd /home/dpmcg/.openclaw/workspace/taskifiai-dashboard
npm install
```

**Expected Result:**
- ✅ Next.js installed
- ✅ Supabase client installed
- ✅ React installed
- ✅ `node_modules` folder created

---

## ✅ Step 3: Set Environment Variables

**Action:**
Create `.env.local` file:

```bash
cp .env.example .env.local
```

**Edit `.env.local`:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://dqhnxzaktnejasqlfrjf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-your-service-role-key-here

# Product APIs
SOCIALDRIVE_API_URL=https://socialdrive-ai.vercel.app/api
DMCHAMP_API_URL=https://api.dmchamp.com/v1
DMCHAMP_API_KEY=paste-your-dmchamp-api-key-here
```

**Get Supabase Keys:**
1. Go to https://supabase.com/dashboard/project/dqhnxzaktnejasqlfrjf/settings/api
2. Copy `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

---

## ✅ Step 4: Test Locally

**Action:**
```bash
npm run dev
```

**Expected Result:**
- ✅ Server starts on http://localhost:3000
- ✅ No errors in terminal

**Test API:**
```bash
# Test 1: Get clients (should be empty)
curl http://localhost:3000/api/clients

# Expected: []

# Test 2: Create a test client
curl -X POST http://localhost:3000/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Test Client",
    "contact_name": "Test User",
    "email": "test@example.com",
    "phone": "+353871234567",
    "industry": "Retail"
  }'

# Expected: Client object with ID
```

---

## ✅ Step 5: Deploy to Vercel

**Action:**
```bash
vercel login
vercel --prod
```

**Set Environment Variables in Vercel:**
1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all variables from `.env.local`
3. Click "Save"

**Expected Result:**
- ✅ Deployment successful
- ✅ Production URL: `https://taskifiai-dashboard.vercel.app`

---

## ✅ Step 6: Test Production

**Test API:**
```bash
# Replace with your actual Vercel URL
curl https://taskifiai-dashboard.vercel.app/api/clients

# Should return: []
```

---

## ✅ Step 7: Create First Client (No Label Academy)

**Option A: Via API**
```bash
curl -X POST https://taskifiai-dashboard.vercel.app/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "No Label Academy",
    "contact_name": "Glenn",
    "email": "glenn@nolabel.ie",
    "phone": "+353871234567",
    "instagram_handle": "@nolabelacademy",
    "website": "https://nolabel.ie",
    "industry": "Education",
    "brand_profile": {
      "voice": "Professional, aspirational",
      "target_audience": "Aspiring barbers, students",
      "services": "Barber training courses",
      "hashtags": ["#NoLabel", "#BarberEducation"]
    },
    "subscription_tier": "pro"
  }'
```

**Option B: Via Dashboard** (once UI is built)
1. Open dashboard
2. Click "Add Client"
3. Fill in form
4. Click "Create"

---

## ✅ Step 8: Enable Products for No Label Academy

**Enable SocialDrive AI:**
```bash
curl -X POST https://taskifiai-dashboard.vercel.app/api/clients/{CLIENT_ID}/enable-socialdrive
```

**Expected:**
- ✅ Sub-account created in SocialDrive AI
- ✅ `socialdrive_enabled: true` in database
- ✅ Upload URL and dashboard URL stored

**Enable DM Champ:** (once API key is configured)
```bash
curl -X POST https://taskifiai-dashboard.vercel.app/api/clients/{CLIENT_ID}/enable-dmchamp
```

**Expected:**
- ✅ Sub-account created in DM Champ
- ✅ `dmchamp_enabled: true` in database
- ✅ Login URL stored

---

## 📊 Post-Deployment Checklist

- [ ] Database migration run successfully
- [ ] Environment variables set
- [ ] Local testing passed
- [ ] Vercel deployment successful
- [ ] Production API tested
- [ ] First client created (No Label Academy)
- [ ] SocialDrive AI enabled for No Label
- [ ] DM Champ enabled for No Label (when API key ready)
- [ ] Welcome email sent to client
- [ ] Client dashboard shows correct status

---

## 🎯 Next Steps After Deployment

### Phase 1: Basic Client Management (Done)
- ✅ Create clients
- ✅ Enable/disable products
- ✅ View client list

### Phase 2: UI Dashboard (Next)
- [ ] Client list page with search/filter
- [ ] Client detail page
- [ ] "Enable Product" buttons
- [ ] Activity feed per client
- [ ] Revenue dashboard

### Phase 3: Automation (Future)
- [ ] Webhook handlers for both products
- [ ] Automated welcome emails
- [ ] Monthly billing automation
- [ ] Usage tracking + alerts

---

## 📞 Troubleshooting

### "Table does not exist"
- Run the migration SQL in Supabase dashboard
- Check table names match exactly

### "API returns 500 error"
- Check environment variables are set correctly
- Verify Supabase keys are valid
- Check Vercel logs for error details

### "SocialDrive API fails"
- Verify `SOCIALDRIVE_API_URL` is correct
- Check SocialDrive AI is deployed and accessible
- Ensure client has valid email/phone

### "DM Champ API fails"
- Verify `DMCHAMP_API_KEY` is set
- Check DM Champ API is accessible
- Ensure email format is valid

---

**Ready to deploy!** 🚀

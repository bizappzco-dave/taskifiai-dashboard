# TaskifiAI CRM - Development Brief

**Date:** 2026-06-08  
**Project:** TaskifiAI Dashboard (Integrated CRM)  
**Status:** Priority 1 activity logging verified in production; webhook audit table added and production webhook routes confirmed working  
**Next Session:** Move to Priority 2 RLS, or optionally add preview env vars if preview deployments need full build parity

---

## 🎯 Architecture Decision

**CRM is INTEGRATED into TaskifiAI Dashboard** - NOT a separate "Social-Hub" project.

**Why:**
- Shared data model (clients, contacts, activities)
- One login, one dashboard for clients
- CRM is a Pro tier feature, not standalone product
- Development efficiency (one codebase, one deployment)

**Routes:**
- Main Dashboard: `/`
- Lead Pipeline: `/pipeline`
- Client Detail: `/clients/[id]`
- Activity Feed: `/clients/[id]/activity` (TODO)

---

## ✅ What's Done (Working)

### Database Schema
- [x] `leads` table - 7-stage pipeline, 7 sources
- [x] `lead_creation_rules` table - Auto-create configuration
- [x] `contacts` table - Single customer record
- [x] `activities` table - Unified event feed
- [x] `tasks` table - Follow-ups tied to leads
- [x] `notes` table - Conversation history
- [x] `activity_types` table - 26 predefined activity types

### Auto-Create System
- [x] Trigger on `activities` INSERT
- [x] Rule engine (configurable per user)
- [x] Deduplication (no duplicate leads in 24h)
- [x] Auto-assign to client owner
- [x] Default rules for all users (18 rules created)

### UI Components
- [x] Kanban board (`/pipeline`)
- [x] 7 columns (New Lead → Contacted → Qualified → Quoted → Follow-up → Won → Lost)
- [x] Lead cards (contact name, business, source badge, value, follow-up date)
- [x] Quick actions (Call, Email, WhatsApp buttons)
- [x] Status dropdown (change stage without drag-and-drop)
- [x] Lead detail modal (read-only view)
- [x] Filter by source
- [x] Dashboard integration ("Lead Pipeline" button in header)

### Security
- [x] RLS policies on `leads` table (users see only their clients' leads)
- [ ] RLS on `activity_types` (DISABLED - SECURITY RISK)
- [ ] RLS on `lead_creation_rules` (DISABLED - SECURITY RISK)

---

## 🚧 What's Missing (Prioritized)

### **Priority 1: Activity Logging Integration** (COMPLETED)

**Resolved:**
- DM Champ webhook route now logs normalized CRM activities and processed webhook records
- SocialDrive webhook route now logs normalized CRM activities and processed webhook records
- Lead auto-create now reads the live activity payload shape (`contact_id`, `details`, `client_id`)
- Deduplication verified: repeat inbound messages within 24h do not create duplicate leads
- Missing `public.webhooks` table was added via migration `005_create_webhooks_table`

**Production verification completed:**
1. DM Champ production route returned `{"success":true,"activity_logged":true}`
2. Activity created in `public.activities` with `activity_type = 'whatsapp_received'`
3. Lead created in `public.leads` for a fresh contact
4. Second inbound message for the same contact kept `lead_count = 1`
5. SocialDrive production route returned `{"success":true,"activity_logged":true}`
6. Review webhook created `activity_type = 'review_received'`

**Files modified:**
- `/src/app/api/webhooks/dmchamp/route.ts`
- `/src/app/api/webhooks/socialdrive/route.ts`
- `/src/lib/activities/webhook-events.ts`
- `/src/lib/queries.ts`
- `/supabase/migrations/003_activity_logging_integration_fix.sql`
- `/supabase/migrations/004_lead_assignment_fk_guard.sql`
- `/supabase/migrations/005_create_webhooks_table.sql`

**Notes:**
- Production env-backed deployment now builds and `/pipeline` loads successfully
- Preview deploys still need preview env vars if you want preview builds to pass the same `/pipeline` prerender step

---

### **Priority 2: RLS Security Fix** (CRITICAL - Security Risk)

**Problem:** Supabase advisory warning - 2 tables have RLS disabled:
- `public.activity_types` - Fully public (anyone can read/modify)
- `public.lead_creation_rules` - Fully public (anyone can read/modify)

**What Needs Done:**

1. **Enable RLS:**
```sql
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_creation_rules ENABLE ROW LEVEL SECURITY;
```

2. **Add Policies for `activity_types`:**
```sql
-- Anyone can read activity types (it's reference data)
CREATE POLICY "Anyone can read activity types"
  ON activity_types FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can modify (or disable modifications entirely)
CREATE POLICY "Admins can manage activity types"
  ON activity_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.email LIKE '%@taskifiai.com'
    )
  );
```

3. **Add Policies for `lead_creation_rules`:**
```sql
-- Users can read own rules
CREATE POLICY "Users can read own rules"
  ON lead_creation_rules FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can manage own rules
CREATE POLICY "Users can manage own rules"
  ON lead_creation_rules FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Why Critical:** Currently anyone with the anon key can read/modify ALL rules and activity types. This is a security vulnerability.

---

### **Priority 3: Activity Feed UI** (HIGH)

**Status:** Database ready, no UI

**What Needs Done:**

1. **Create Activity Timeline Component**
   - Location: `/src/components/activity-feed.tsx`
   - Display: Chronological list of activities for a client
   - Group by: Date (Today, Yesterday, This Week, Older)
   - Icons per activity type (post, email, call, review, etc.)

2. **Add to Client Detail Page**
   - Location: `/clients/[id]/page.tsx` or `/clients/[id]/activity`
   - Tab: "Activity" or "Timeline"
   - Filter: By type, date range, source

3. **Activity Card Design:**
```
┌─────────────────────────────────────────┐
│ 📸 Instagram Post Published             │
│ No Label Academy • 2 hours ago          │
│ ─────────────────────────────────────── │
│ "Check out our new summer collection!"  │
│ [View Post]                             │
└─────────────────────────────────────────┘
```

4. **Integration with Lead Detail**
   - When viewing a lead, show related activities
   - Filter: `WHERE contact_id = lead.contact_id`

**Why High Priority:** This is the "unified view" that makes the CRM valuable. Clients see all interactions in one place.

---

### **Priority 4: Add Lead Modal** (MEDIUM)

**Status:** "Add Lead" button exists, does nothing

**What Needs Done:**

1. **Create Modal Component**
   - Location: `/src/components/add-lead-modal.tsx`
   - Trigger: "Add Lead" button in `/pipeline`

2. **Form Fields:**
   - Contact (search existing or create new)
     - Name, email, phone, company
   - Client (dropdown of user's clients)
   - Source (dropdown: WhatsApp, Gmail, Instagram, etc.)
   - Value (£)
   - Next follow-up date
   - Notes (textarea)

3. **On Submit:**
   - Create contact (if new)
   - Create lead
   - Optionally create initial activity
   - Redirect to pipeline or close modal

**Why Medium Priority:** Auto-create should handle 80% of leads, but manual entry needed for referrals, events, etc.

---

### **Priority 5: Lead Detail Improvements** (MEDIUM)

**Status:** Basic read-only modal exists

**What Needs Done:**

1. **Edit Notes**
   - Textarea with save button
   - Auto-save on blur (optional)

2. **Edit Quote Value**
   - Number input with £ symbol
   - Save button

3. **Won/Lost Reason**
   - When status changed to "won" or "lost"
   - Show required dropdown/text input
   - Common reasons: "Price too high", "Went with competitor", "Not ready yet", "Perfect fit", etc.

4. **Create Task from Lead**
   - "Add Follow-up" button
   - Due date picker
   - Task type (Call, Email, Meeting, etc.)
   - Notes

5. **Edit Contact Info**
   - Inline edit or separate modal
   - Update name, email, phone

**Why Medium Priority:** Power users need to manage leads, not just view them.

---

### **Priority 6: Growth Score Metrics** (LOW - Post-MVP)

**Status:** Not started

**What Needs Done:**

1. **Calculate Scores**
   - Visibility Score (GBP presence, social activity)
   - Engagement Score (posts, responses, DMs)
   - Reputation Score (reviews, ratings)
   - Lead Capture Score (forms, inquiries)

2. **Display on Client Cards**
   - Badge or progress bar
   - Trend indicator (↑ ↓ →)

3. **Track Over Time**
   - Store historical scores
   - Show graph in client detail

**Why Low Priority:** Nice-to-have differentiator, not needed for MVP functionality.

---

## 📊 Database Schema Reference

### Leads Table
```sql
CREATE TABLE leads (
  id uuid PRIMARY KEY,
  contact_id uuid REFERENCES contacts(id),
  client_id uuid REFERENCES clients(id),
  source lead_source (gmail, whatsapp, instagram_dm, facebook_dm, website_form, gbp_call, manual),
  activity_id uuid REFERENCES activities(id),
  assigned_user_id uuid REFERENCES auth.users(id),
  value numeric(10,2) DEFAULT 0,
  status lead_stage (new_lead, contacted, qualified, quoted, follow_up, won, lost),
  next_follow_up_date timestamptz,
  notes text DEFAULT '',
  won_lost_reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Auto-Create Flow
```
Activity INSERT
    ↓
Trigger: auto_create_lead_from_activity()
    ↓
Check lead_creation_rules (matches activity_type?)
    ↓
Check deduplication (lead exists for contact in 24h?)
    ↓
INSERT INTO leads (status = 'new_lead')
```

---

## 🧪 Testing Checklist

### Activity Logging
- [ ] Create test activity via SQL
- [ ] Verify lead auto-created (check `leads` table)
- [ ] Verify lead appears in `/pipeline`
- [ ] Verify deduplication works (create same activity twice)

### Lead Management
- [ ] Create lead manually (once modal exists)
- [ ] Change status via dropdown
- [ ] Add/edit notes
- [ ] Set follow-up date
- [ ] Close as won/lost with reason

### Activity Feed
- [ ] View client activity timeline
- [ ] Filter by type
- [ ] Click activity → see details
- [ ] Verify activities from all sources appear

### Security (RLS)
- [ ] User A cannot see User B's leads
- [ ] User A cannot modify User B's lead rules
- [ ] Service role can still access everything

---

## 🔧 Technical Details

### Supabase Project
- **Project ID:** `nmebpawvnhrokouksvir`
- **URL:** https://nmebpawvnhrokouksvir.supabase.co
- **Tables:** 16 total (11 existing + 5 CRM tables)

### Vercel Deployment
- **Project:** taskifiai-dashboard
- **URL:** https://taskifiai-dashboard.vercel.app
- **Pipeline:** https://taskifiai-dashboard.vercel.app/pipeline

### Environment Variables (Vercel)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://nmebpawvnhrokouksvir.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[REDACTED]
SUPABASE_SERVICE_ROLE_KEY=[REDACTED]
UPLOAD_POST_API_KEY=[REDACTED]
UPLOAD_POST_BASE_URL=https://api.upload-post.com/api/uploadposts
UPLOAD_POST_PROFILE_USERNAME=Taskifi-AI
```

### Key Files
- Main Dashboard: `/src/app/page.tsx`
- Pipeline: `/src/app/pipeline/page.tsx`
- Auth Callback: `/src/app/auth/callback/page.tsx`
- Supabase Client: `/src/lib/supabase.ts`
- CRM Spec: `/docs/LEAD-PIPELINE-SPEC.md`
- Design Handoff: `/docs/DESIGN-HANDOFF.md` (for Codex)

---

## 🎯 Next Session Starting Points

### Option A: Finish CRM Backend (Recommended)
1. Provide valid `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
2. Re-run local webhook POST tests against `/api/webhooks/dmchamp` and `/api/webhooks/socialdrive`
3. Confirm activities appear in the feed and lead auto-create works through the app path
4. Then move to Priority 2 RLS hardening

### Option B: UI Polish with Codex
1. Let Codex redesign main dashboard
2. Let Codex polish pipeline UI
3. We keep building backend (activity logging, Instagram)

### Option C: Instagram Integration
1. Set up Upload-Post profiles for No Label + Kitchens Direct
2. Test posting flow
3. Hook posting into activities table

---

## 📝 Session Restart Instructions

**For Next Session:**

1. **Load this brief** - It has all context needed
2. **Check git status** - Review the Priority 1 webhook + migration changes before adding more
3. **Fix local env first** - `.env.local` currently contains placeholder values for required Supabase vars, which blocks `/pipeline` build/prerender and local webhook testing
4. **Priority 1 status** - DM Champ + SocialDrive webhook activity mapping is implemented; live SQL verification confirmed `whatsapp_received` creates one lead and dedupes the second activity within 24h
5. **Next priority** - After env-backed verification, continue with Priority 2 (RLS on `activity_types` and `lead_creation_rules`)

**Current Branch:** `main`  
**Last Known Blocker:** local runtime/build fail with `NEXT_PUBLIC_SUPABASE_URL is not set` because `.env.local` values are placeholders  
**Live DB:** migrations `003_activity_logging_integration_fix` and `004_lead_assignment_fk_guard` applied to project `nmebpawvnhrokouksvir`

---

**Good luck! 🚀**

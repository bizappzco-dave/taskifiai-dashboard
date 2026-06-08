# Lead Pipeline Specification

**Version:** 1.0 (MVP)  
**Date:** 2026-06-08  
**Platform:** TaskifiAI / SocialDrive AI

---

## 🎯 Core Concept

**Not "Sales Pipeline" — "Lead Pipeline"**

For local businesses, this feels more natural. Most CRMs start with a pipeline and hope users fill it in manually. **Your version auto-creates pipeline items from activity.**

---

## 📊 Pipeline Stages (Kanban)

1. **New Lead** - Initial contact received
2. **Contacted** - First outreach completed
3. **Qualified** - Budget, timeline, need confirmed
4. **Quoted** - Proposal/quote sent
5. **Follow-up** - Awaiting response
6. **Won** - Closed (customer)
7. **Lost** - Closed (not customer)

---

## 🔗 Data Model

### Leads Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `contact_id` | uuid | FK → contacts.id |
| `client_id` | uuid | FK → clients.id |
| `source` | text | Gmail, WhatsApp, Instagram DM, Facebook DM, Website Form, GBP Call, Manual Entry |
| `activity_id` | uuid | FK → activities.id (triggering event) |
| `assigned_user_id` | uuid | FK → auth.users.id |
| `value` | numeric | Quote/deal value (£) |
| `status` | text | One of 7 pipeline stages |
| `next_follow_up_date` | timestamptz | When to follow up |
| `notes` | text | Free-form notes |
| `won_lost_reason` | text | Why won/lost (if closed) |
| `created_at` | timestamptz | When lead was created |
| `updated_at` | timestamptz | Last modified |

### Auto-Creation Triggers

| Activity Type | → Lead Stage | Source |
|--------------|--------------|--------|
| `whatsapp_message_received` (inbound) | New Lead | WhatsApp |
| `email_received` (Gmail) | New Lead | Gmail |
| `instagram_dm_received` | New Lead | Instagram DM |
| `facebook_dm_received` | New Lead | Facebook DM |
| `website_form_submitted` | New Lead | Website Form |
| `gbp_call_received` | New Lead | GBP Call |
| Manual entry | New Lead | Manual Entry |

---

## 🎨 MVP Feature Set

### Kanban Board
- Drag-and-drop cards between stages
- Filter by source, assigned user, date range
- Search by contact name, business, notes

### Lead Card
- Contact name + business
- Source badge (color-coded)
- Quote value (£)
- Next follow-up date (highlight if overdue)
- Quick actions: Call, WhatsApp, Email

### Lead Detail View
- Full contact info
- Activity history (from unified activities table)
- Notes (add/edit)
- Tasks/follow-ups
- Quote value (editable)
- Won/lost reason (when closed)

### Auto-Lead Creation
- **Rule engine:** When activity of type X arrives → create lead
- **Deduplication:** Don't create if lead already exists for contact
- **Configurable:** Toggle auto-create per source

---

## 🏗️ Architecture

### Integration Points

1. **Unified Activities Table** - Single source of truth for all events
2. **Contacts Table** - Single customer record (no duplicates)
3. **Clients Table** - Business/client association
4. **Tasks Table** - Follow-ups tied to leads
5. **Notes Table** - Conversation notes tied to leads

### Auto-Creation Flow

```
Activity Created (any source)
       ↓
Rule Engine Checks: Is this a lead signal?
       ↓
Yes → Check: Does lead already exist for this contact?
       ↓
No → Create Lead (status = "New Lead")
       ↓
Link: activity_id → lead.id
       ↓
Notify: Assigned user (email/in-app)
```

### Rule Configuration

```json
{
  "auto_create_leads": true,
  "sources": {
    "whatsapp": true,
    "gmail": true,
    "instagram": true,
    "facebook": true,
    "website_form": true,
    "gbp_call": true,
    "manual": false
  },
  "deduplicate_by": "contact_id",
  "default_assigned_user": "owner"
}
```

---

## 📱 UI Components

### Pipeline Board
- 7 columns (one per stage)
- Cards sorted by next_follow_up_date (urgent first)
- Stage counts (e.g., "New Lead (12)")

### Lead Card
```
┌─────────────────────────────────┐
│ Sarah M.                        │
│ No Label Academy                │
│ ─────────────────────────────── │
│ 💬 WhatsApp                     │
│ £2,500                          │
│ 📅 Follow up: Tomorrow          │
│ ─────────────────────────────── │
│ [📞] [💬] [✉️]                  │
└─────────────────────────────────┘
```

### Lead Detail Modal
- Left: Contact info + activity timeline
- Right: Notes + tasks + quote value
- Bottom: Won/lost reason (if closed)

---

## 🔐 RLS Policies

```sql
-- Users can see leads for their clients
CREATE POLICY "Users can view own leads"
ON leads FOR SELECT
USING (
  client_id IN (
    SELECT id FROM clients 
    WHERE owner_id = auth.uid()
  )
);

-- Users can create leads for their clients
CREATE POLICY "Users can create own leads"
ON leads FOR INSERT
WITH CHECK (
  client_id IN (
    SELECT id FROM clients 
    WHERE owner_id = auth.uid()
  )
);

-- Users can update leads they own
CREATE POLICY "Users can update own leads"
ON leads FOR UPDATE
USING (
  client_id IN (
    SELECT id FROM clients 
    WHERE owner_id = auth.uid()
  )
);
```

---

## 🚀 Implementation Phases

### Phase 1: Database Schema (2 hours)
- [ ] Create `leads` table
- [ ] Add `lead_stage` enum type
- [ ] Create RLS policies
- [ ] Add indexes (contact_id, client_id, status, next_follow_up_date)

### Phase 2: Auto-Creation Rules (2 hours)
- [ ] Create `lead_creation_rules` table
- [ ] Build rule engine function (trigger on activity insert)
- [ ] Deduplication logic
- [ ] Test with sample activities

### Phase 3: Kanban UI (4 hours)
- [ ] Pipeline board component
- [ ] Drag-and-drop (dnd-kit or similar)
- [ ] Lead card component
- [ ] Stage update on drop

### Phase 4: Lead Detail View (3 hours)
- [ ] Modal/side panel
- [ ] Activity timeline integration
- [ ] Notes CRUD
- [ ] Tasks/follow-ups CRUD
- [ ] Quote value editor
- [ ] Won/lost reason selector

### Phase 5: Notifications (1 hour)
- [ ] Email on new lead assigned
- [ ] In-app notification
- [ ] Daily digest (optional)

**Total MVP:** ~12 hours

---

## 🎯 Success Metrics

- **Auto-created leads:** % of leads created from activities vs. manual
- **Pipeline velocity:** Avg. time from New Lead → Won
- **Conversion rate:** Won / (Won + Lost)
- **Follow-up compliance:** % of leads with overdue follow-ups

---

## 🔮 Future Enhancements (Post-MVP)

- **Lead scoring:** Auto-prioritize hot leads
- **Email templates:** Quick responses from pipeline
- **WhatsApp templates:** Pre-approved messages
- **Reporting:** Pipeline value by stage, source performance
- **Automation:** Move to "Follow-up" after quote sent, move to "Lost" after 30 days no activity

---

## 📝 Notes

- **Keep it simple:** This is an add-on to existing platform, not a standalone CRM
- **Auto-create is the magic:** Manual entry should be the exception, not the rule
- **Tie to activities:** Every lead should have a triggering event (except manual)
- **Mobile-first:** Local business owners check pipeline on phone

---

**Reference:** Existing CRM architecture (`taskifi-crm-architecture` skill) - unified activity feed, single customer record, event-driven design.

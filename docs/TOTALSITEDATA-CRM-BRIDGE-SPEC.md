# TotalSiteData CRM Bridge Spec

Date: 2026-06-09
Status: Draft v1
Owner: Hermes
Repository: /home/dpmcg/.openclaw/workspace/taskifiai-dashboard

## Goal

Accept warm / qualified prospects from TotalSiteData and create or update the right CRM records in TaskifiAI without creating duplicate clients, contacts, or leads.

## Important Rule

Do not create a TaskifiAI `client` by default.

Default bridge behavior:
1. match or create `contact`
2. create `activity`
3. create or update `lead`
4. optionally create `task`
5. store backlink metadata to TotalSiteData prospect

A `client` should only be created later when the lead becomes a real onboarded customer.

---

## Input Contract

The bridge should accept a normalized JSON payload from TotalSiteData.

```json
{
  "source": "TotalSiteData",
  "source_detail": "outbound_scan",
  "prospect_id": "uuid",
  "business_name": "Example Business",
  "domain": "example.ie",
  "email": "owner@example.ie",
  "phone": "+353...",
  "category": "Kitchen Remodeler",
  "location": "Dublin",
  "lead_score": 78,
  "pain_score": 82,
  "fit_score": 74,
  "warmth_status": "warm",
  "promotion_reason": "Replied to report outreach",
  "report_links": {
    "free_preview_html": "...",
    "full_report_pdf": "..."
  },
  "scan_summary": {
    "top_issues": [
      "No recent GBP posts",
      "Weak service page coverage",
      "Mobile performance below threshold"
    ]
  }
}
```

## Suggested Endpoint

Add a protected internal route or server-side function:

- `POST /api/internal/totalsitedata/promote`

Requirements:
- not public
- authenticated with shared secret / service credential
- idempotent for repeated promotion attempts

---

## Bridge Flow

### Step 1: Validate payload
Reject if missing all contact paths:
- no domain
- no email
- no phone
- no business_name

### Step 2: Dedupe lookup
Run in this order:
1. existing lead/contact linked to same `prospect_id`
2. domain match
3. email match
4. phone match
5. normalized business name + location match

### Step 3: Resolve contact
If existing contact found:
- update missing fields only
- do not overwrite better CRM-owned fields blindly

If no contact found:
- create contact with source attribution `TotalSiteData`

### Step 4: Create activity
Always create an activity for the promotion event.

Suggested activity type:
- `website_form_submitted` for inbound report requests, or
- new type like `totalsitedata_promoted`

Activity details should include:
- prospect_id
- source_detail
- promotion_reason
- lead_score
- pain_score
- fit_score
- report links
- top issues summary

### Step 5: Create or update lead
If active lead exists for this contact:
- append activity only, or
- update lead notes / source context / assigned owner

If no active lead exists:
- create lead in `New Lead` or `Qualified` depending on trigger source

Recommended default stage mapping:
- free report request → `Qualified`
- reply to outreach → `Qualified`
- booked call → `Qualified`
- threshold-only promotion → `New Lead`

### Step 6: Optional follow-up task
For strong warm leads, create follow-up task:
- content: `Review TotalSiteData lead and follow up`
- due: same day or next business day
- assignee: David / client owner

---

## Recommended Metadata Storage

Wherever possible, preserve these values in CRM details JSON:
- `totalsitedata_prospect_id`
- `totalsitedata_source_detail`
- `totalsitedata_promotion_reason`
- `totalsitedata_report_links`
- `totalsitedata_scores`

This enables future:
- traceability
- analytics
- de-dupe
- activity timeline context

---

## Idempotency Rules

The route must be safe to call more than once.

Recommended idempotency key:
- `prospect_id + promotion_reason + source_detail`

Behavior:
- if same promotion already processed, return existing CRM object IDs
- do not create duplicate leads for repeated retries

---

## File Targets

Likely implementation files:
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/app/api/internal/totalsitedata/promote/route.ts`
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/lib/activities/`
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/src/lib/queries.ts`
- `/home/dpmcg/.openclaw/workspace/taskifiai-dashboard/supabase/migrations/` (if metadata columns or activity types are needed)

## Possible Database Additions

If current CRM schema lacks a safe backlink field, add one of:

### Option A — JSON details only
Store all TotalSiteData metadata inside `activities.details` and `leads.notes`.

Pros:
- fastest
- minimal migration risk

Cons:
- weaker querying later

### Option B — explicit backlink fields
Add optional columns such as:
- `leads.external_source text`
- `leads.external_source_id text`
- `contacts.external_source text`
- `contacts.external_source_id text`

Pros:
- better analytics and dedupe

Cons:
- requires migration and code updates

Recommendation:
- MVP: Option A
- Phase 2 hardening: Option B

---

## Stage Mapping Recommendation

Use this default map:

- `free_report_request` → `Qualified`
- `reply` → `Qualified`
- `booking` → `Qualified`
- `manual_approval` → `Qualified`
- `score_threshold_only` → `New Lead`

Reason:
A TotalSiteData promotion should already be warmer than ordinary raw inbound noise.

---

## Safety / Collision Guidance

This bridge work is backend-safe to run in parallel with UI/design work as long as the UI agent is not editing:
- the same API route
- the same CRM lead data types
- the same payload-dependent page components

If the other Codex agent is only on design/UI, do not stop.
Pause only when backend payloads need to be wired into screens they are actively changing.

---

## Immediate Next Step

Implement route stub and shared payload validator after schema review.

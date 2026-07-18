# TotalSiteData → TaskifiAI promotion contract

Route
- `POST /api/internal/totalsitedata/promote`

Authentication
- Preferred: `Authorization: Bearer <TOTALSITEDATA_INTERNAL_SECRET>`
- Also supported: `x-totalsitedata-secret: <TOTALSITEDATA_INTERNAL_SECRET>`

Required environment
- `TOTALSITEDATA_INTERNAL_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) must be available to the Next.js runtime
- `SUPABASE_SERVICE_ROLE_KEY` must be available to the Next.js runtime

TotalSiteData production bridge environment
- `TOTALSITEDATA_CRM_BRIDGE_URL=https://taskifiai-dashboard.vercel.app/api/internal/totalsitedata/promote`
- `TOTALSITEDATA_CRM_BRIDGE_SECRET=<same value as TOTALSITEDATA_INTERNAL_SECRET in taskifiai-dashboard production>`
- `TOTALSITEDATA_TARGET_CLIENT_ID=<real client UUID anchor>`

Dedicated production anchor for TotalSiteData inbound leads
- `015946cb-2513-43af-872d-7364175ee8d5` (`TotalSiteData Incoming Leads`)

Previous temporary verification anchor
- `9712967a-c4c9-4f4e-90f6-687c0ab00e6f` (`Test Client`)

Sample payload fixture
- `tests/fixtures/totalsitedata-promotion.payload.json`

Minimum required body fields
- `source`
- `prospect_id` (UUID)
- `business_name`
- `promotion_reason`
- `target_client_id` is not required by the validator, but the current CRM route returns `409 target_client_id_required` without it because contacts/activities/leads still require a `client_id` anchor.

Recommended request
```bash
curl -X POST http://127.0.0.1:3010/api/internal/totalsitedata/promote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOTALSITEDATA_INTERNAL_SECRET" \
  --data @tests/fixtures/totalsitedata-promotion.payload.json
```

Smoke test helper
- `scripts/smoke-totalsitedata-promotion.sh`

Usage
```bash
PROMOTION_SECRET=your-secret \
CLIENT_ID=real-client-uuid \
PROSPECT_ID=$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
) \
./scripts/smoke-totalsitedata-promotion.sh
```

Expected success response shape
```json
{
  "success": true,
  "deduplicated": false,
  "client_id": "<uuid>",
  "contact_id": "<uuid>",
  "activity_id": "<uuid>",
  "lead_id": "<uuid>",
  "stage": "qualified",
  "assigned_user_id": "<uuid|null>"
}
```

Expected dedupe response shape
```json
{
  "success": true,
  "deduplicated": true,
  "client_id": "<uuid>",
  "activity_id": "<uuid>",
  "lead_id": "<uuid|null>",
  "contact_id": "<uuid|null>"
}
```

Live production verification completed on 2026-06-13
- `https://totalsitedata.com/api/capture-lead` returned `crm.promoted: true`
- CRM insert created:
  - `contact_id: e972872b-b627-4d6f-85a7-4eb525132a99`
  - `activity_id: d0fa6fbd-f9b8-4ebc-ac9b-86bafa84278e`
  - `lead_id: 754b9bb9-d304-4bdb-be54-e37091a22ce1`
- Source mapping confirmed in Supabase:
  - `contacts.metadata.source = totalsitedata`
  - `leads.source = website_form`
  - `leads.status = qualified`

Dedicated anchor verification completed on 2026-06-13
- `https://totalsitedata.com/api/capture-lead` with `taskifiai+tsd-anchor@gmail.com` returned:
  - `crm.result.client_id = 015946cb-2513-43af-872d-7364175ee8d5`
  - `contact_id = 1bc0c372-7924-46a5-81ec-111a2918c595`
  - `activity_id = 71887492-6558-4673-9796-480370ab4889`
  - `lead_id = 2244a164-efae-4be7-a076-d2478722cfca`
- Supabase verification confirmed the new contact and lead were written under client anchor `015946cb-2513-43af-872d-7364175ee8d5`

Expected error responses
- `401 Unauthorized` — missing or wrong secret
- `400 Invalid payload` — body validation failed
- `409 target_client_id_required` — route is live but CRM still needs a client anchor
- `500` — missing secret config or downstream database failure

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

Expected error responses
- `401 Unauthorized` — missing or wrong secret
- `400 Invalid payload` — body validation failed
- `409 target_client_id_required` — route is live but CRM still needs a client anchor
- `500` — missing secret config or downstream database failure

# TotalSiteData → TaskifiAI promotion contract

Route
- `POST /api/internal/totalsitedata/promote`
- `POST /api/internal/totalsitedata/scan` (async queue enqueue)
- `GET /api/internal/totalsitedata/scan/process` (queue observability/health)
- `POST /api/internal/totalsitedata/scan/process` (queue worker processor)

Authentication
- Preferred: `Authorization: Bearer <TOTALSITEDATA_INTERNAL_SECRET>`
- Also supported: `x-totalsitedata-secret: <TOTALSITEDATA_INTERNAL_SECRET>`
- Alternative internal header: `x-internal-secret` (same value)

Required environment
- `TOTALSITEDATA_INTERNAL_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) must be available to the Next.js runtime
- `SUPABASE_SERVICE_ROLE_KEY` must be available to the Next.js runtime
- Optional queue tuning environment:
  - `TOTALSITEDATA_SCAN_RATE_LIMIT_WINDOW_SECONDS` (default `60`)
  - `TOTALSITEDATA_SCAN_RATE_LIMIT_MAX_REQUESTS` (default `120`)
  - `TOTALSITEDATA_SCAN_MAX_RETRIES` (default `3`)
  - `TOTALSITEDATA_SCAN_DEDUPE_TTL_SECONDS` (default `3600`)
  - `TOTALSITEDATA_SCAN_RESPONSE_CACHE_TTL_SECONDS` (default `30`)

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
  -H "Authorization: Bearer <TOTALSITEDATA_INTERNAL_SECRET>" \\
  --data @tests/fixtures/totalsitedata-promotion.payload.json
```

Smoke test helper
- `scripts/smoke-totalsitedata-promotion.sh`
- `scripts/smoke-totalsitedata-scan.sh`

Contract verification commands
- `npm run totalsitedata:contract:test`
- `npm run totalsitedata:smoke:promote`
- `npm run totalsitedata:smoke:scan`
- `npm run totalsitedata:smoke` (includes `totalsitedata:preflight`)
- `npm run totalsitedata:preflight`
- `npm run totalsitedata:verify`
- `npm run totalsitedata:ci` (default safe for local dev)
  - Runs typecheck and build, then contract tests.
  - Skips `totalsitedata:verify` unless `TOTALSITEDATA_CI_VERIFY=1` or CI env var is set.
- `TOTALSITEDATA_CI_SKIP_VERIFY=1 npm run totalsitedata:ci`
  - Explicitly force safe mode locally.
- `TOTALSITEDATA_CI_VERIFY=1 npm run totalsitedata:ci`
  - Force full strict mode (including live verify) even outside CI.
- `npm run totalsitedata:ci:local`
  - Alias for `TOTALSITEDATA_CI_SKIP_VERIFY=1 npm run totalsitedata:ci`.
- `npm run totalsitedata:ci:strict`
  - Alias for `TOTALSITEDATA_CI_VERIFY=1 npm run totalsitedata:ci`.

Note: `totalsitedata:verify` and smoke scripts require a reachable Supabase backend via `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` and intentionally run preflight checks first. Misconfigured placeholders (for example `example.supabase.co` or `public-*` keys) fail fast with a clear message before running smoke tests.

Failure interpretation
- **Build/setup/config boundary (non-backend-data):**
  - `npx tsc --noEmit` / `npm run build` failures usually indicate code or required environment not available during compile-time (`NEXT_PUBLIC_SUPABASE_URL` missing, bad TS types).
  - `totalsitedata:preflight` failures and explicit placeholder checks (for example `example.supabase.co`, `public-*` keys) are setup/config issues, not route regressions.
- **Contract boundary:**
  - `npm run totalsitedata:contract:test` failures indicate an API contract shape/auth expectation mismatch.
- **Live backend-data boundary:**
  - `500` with `PGRST116` + "Cannot coerce the result to a single JSON object" means the expected seeded anchor/client row was not found in Supabase.
  - `23503` FK violations during scan enqueue mean payload/client id references do not exist in seed data.
  - `409 target_client_id_required` means CRM route still needs a real client anchor for the current live data model.

Use `TOTALSITEDATA_CI_VERIFY=1` only in seeded/validated environments; otherwise use `totalsitedata:ci:local` or the SKIP flag for safer local checks.
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

One-shot verification run
```bash
# Start the app first (example):
# npm run dev -- --port 3010

PROMOTION_SECRET=your-secret \
SUPABASE_URL=https://your-real-supabase-ref.supabase.co \
SUPABASE_ANON_KEY=ey... \
SUPABASE_SERVICE_ROLE_KEY=ey... \
TOTALSITEDATA_INTERNAL_SECRET=your-secret \
npm run totalsitedata:verify
```

Scan-queue enqueue usage
```bash
# Wrapper script (scan + post in one command)
# Requires PROMOTION_SECRET and, for real environments, a reachable API base with Supabase seeded.
cd /home/dpmcg/workspace/repos/taskifiai-dashboard

PROMOTION_SECRET=<TOTALSITEDATA_INTERNAL_SECRET> \
TARGET_CLIENT_ID=<client uuid> \
PROSPECT_ID=$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
) \
bash scripts/website-checker-scan-and-post.sh example.com

curl -X POST http://127.0.0.1:3010/api/internal/totalsitedata/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOTAL...RET>" \
  --data @tests/fixtures/totalsitedata-promotion.payload.json
```

Worker processing usage
```bash
curl -X POST http://127.0.0.1:3010/api/internal/totalsitedata/scan/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOTALSITEDATA_INTERNAL_SECRET>" \
  --data '{"limit":5}'
```

Worker health/observability usage
```bash
curl -X GET "http://127.0.0.1:3010/api/internal/totalsitedata/scan/process?window_seconds=3600" \
  -H "Authorization: Bearer <TOTALSITEDATA_INTERNAL_SECRET>"
```

Expected scan process response shape
```json
{
  "success": true,
  "processed": 1,
  "results": [
    {
      "task_id": "<uuid>",
      "status": "completed|requeued|cancelled",
      "success": true,
      "result": {
        "success": true
      }
    }
  ],
  "queue": {
    "kind": "totalsitedata_scan",
    "pending": 0,
    "in_progress": 0,
    "completed": 1,
    "cancelled": 0,
    "retry_waiting": 0,
    "dead_lettered_pending_24h": 0,
    "recent_completed_24h": 1
  }
}
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

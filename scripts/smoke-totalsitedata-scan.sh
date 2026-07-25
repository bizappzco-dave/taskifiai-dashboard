#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3010}"
PROMOTION_SECRET="${PROMOTION_SECRET:-${TOTALSITEDATA_INTERNAL_SECRET:-}}"
FIXTURE_PATH="${FIXTURE_PATH:-tests/fixtures/totalsitedata-promotion.payload.json}"
CLIENT_ID="${CLIENT_ID:-}"
PROSPECT_ID="${PROSPECT_ID:-}"
AUTH_MODE="${AUTH_MODE:-bearer}"
RESPONSE_PATH="${RESPONSE_PATH:-/tmp/totalsitedata-scan-response.json}"
QUEUE_RESPONSE_PATH="${QUEUE_RESPONSE_PATH:-/tmp/totalsitedata-scan-queue-response.json}"

if [[ -z "$PROMOTION_SECRET" ]]; then
  echo "Set PROMOTION_SECRET or TOTALSITEDATA_INTERNAL_SECRET before running this smoke test." >&2
  exit 1
fi

if [[ ! -f "$FIXTURE_PATH" ]]; then
  echo "Fixture not found: $FIXTURE_PATH" >&2
  exit 1
fi

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT

python3 - <<'PY' "$FIXTURE_PATH" "$payload_file" "$CLIENT_ID" "$PROSPECT_ID"
import json
import sys
from pathlib import Path

fixture_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
client_id = sys.argv[3].strip()
prospect_id = sys.argv[4].strip()

payload = json.loads(fixture_path.read_text())
if client_id:
    payload['target_client_id'] = client_id
if prospect_id:
    payload['prospect_id'] = prospect_id
out_path.write_text(json.dumps(payload))
PY

headers=(-H "Content-Type: application/json")
if [[ "$AUTH_MODE" == "bearer" ]]; then
  headers+=(-H "Authorization: Bearer ${PROMOTION_SECRET}")
elif [[ "$AUTH_MODE" == "header" ]]; then
  headers+=(-H "x-totalsitedata-secret: ${PROMOTION_SECRET}")
else
  echo "Unsupported AUTH_MODE: $AUTH_MODE (use bearer or header)" >&2
  exit 1
fi

echo "POST ${API_BASE_URL}/api/internal/totalsitedata/scan"
http_code="$(curl -sS -o "$RESPONSE_PATH" -w '%{http_code}'   -X POST "${API_BASE_URL}/api/internal/totalsitedata/scan"   "${headers[@]}"   --data @"${payload_file}")"

echo "Scan enqueue HTTP ${http_code}"
cat "$RESPONSE_PATH"
printf '\n'

if ! grep -q '"queued"\s*:\s*true\|"deduplicated"\s*:\s*true' "$RESPONSE_PATH"; then
  echo "Scan enqueue response did not indicate queue activity." >&2
  exit 1
fi

sleep 1

echo "POST ${API_BASE_URL}/api/internal/totalsitedata/scan/process?limit=5"
process_http_code="$(curl -sS -o "$QUEUE_RESPONSE_PATH" -w '%{http_code}'   -X POST "${API_BASE_URL}/api/internal/totalsitedata/scan/process?limit=5"   "${headers[@]}"   -H "Content-Type: application/json"   --data '{"stopOnError":false}')"

echo "Worker HTTP ${process_http_code}"
cat "$QUEUE_RESPONSE_PATH"
printf '\n'

echo "Smoke check complete"

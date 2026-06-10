#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3010}"
ROUTE_PATH="/api/internal/totalsitedata/promote"
FIXTURE_PATH="${FIXTURE_PATH:-tests/fixtures/totalsitedata-promotion.payload.json}"
AUTH_MODE="${AUTH_MODE:-bearer}"
PROMOTION_SECRET="${PROMOTION_SECRET:-${TOTALSITEDATA_INTERNAL_SECRET:-}}"
CLIENT_ID="${CLIENT_ID:-}"
PROSPECT_ID="${PROSPECT_ID:-}"
RESPONSE_PATH="${RESPONSE_PATH:-/tmp/totalsitedata-promotion-response.json}"

if [[ ! -f "$FIXTURE_PATH" ]]; then
  echo "Fixture not found: $FIXTURE_PATH" >&2
  exit 1
fi

if [[ -z "$PROMOTION_SECRET" ]]; then
  echo "Set PROMOTION_SECRET or TOTALSITEDATA_INTERNAL_SECRET before running this smoke test." >&2
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

echo "POST ${API_BASE_URL}${ROUTE_PATH}"
echo "Using fixture: ${FIXTURE_PATH}"
if [[ -n "$CLIENT_ID" ]]; then
  echo "Override client_id: ${CLIENT_ID}"
fi
if [[ -n "$PROSPECT_ID" ]]; then
  echo "Override prospect_id: ${PROSPECT_ID}"
fi

http_code="$(curl -sS -o "$RESPONSE_PATH" -w '%{http_code}'   -X POST "${API_BASE_URL}${ROUTE_PATH}"   "${headers[@]}"   --data @"${payload_file}")"

echo "HTTP ${http_code}"
cat "$RESPONSE_PATH"
printf '\'

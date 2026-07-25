#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: website-checker-scan-and-post.sh <domain-or-url>" >&2
  echo "Optional envs: API_BASE_URL, AUTH_MODE, PROMOTION_SECRET, TOTALSITEDATA_INTERNAL_SECRET, SOURCE, SOURCE_DETAIL, PROMOTION_REASON, PROMOTION_TRIGGER, TARGET_CLIENT_ID, PROSPECT_ID, BUSINESS_NAME, WEBSITE_CHECKER_CMD, RUN_PROCESS, PROCESS_LIMIT, RESPONSE_PATH" >&2
  exit 1
fi

URL="$1"
WEBSITE_URL="$URL"

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3010}"
AUTH_MODE="${AUTH_MODE:-bearer}"
PROMOTION_SECRET="${PROMOTION_SECRET:-${TOTALSITEDATA_INTERNAL_SECRET:-}}"
SOURCE="${SOURCE:-totalsitedata}"
SOURCE_DETAIL="${SOURCE_DETAIL:-totalsitedata_website_checker}"
PROMOTION_REASON="${PROMOTION_REASON:-Automated website compliance scan from CLI}"
PROMOTION_TRIGGER="${PROMOTION_TRIGGER:-free_report_request}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-${TOTALSITEDATA_TARGET_CLIENT_ID:-}}"
PROSPECT_ID="${PROSPECT_ID:-}"
BUSINESS_NAME="${BUSINESS_NAME:-}"
WEBSITE_CHECKER_CMD="${WEBSITE_CHECKER_CMD:-/home/dpmcg/.local/bin/website-checker}"
RUN_PROCESS="${RUN_PROCESS:-0}"
PROCESS_LIMIT="${PROCESS_LIMIT:-5}"
RESPONSE_PATH="${RESPONSE_PATH:-/tmp/totalsitedata-scan-wrapper-response.json}"
PROCESS_RESPONSE_PATH="${PROCESS_RESPONSE_PATH:-/tmp/totalsitedata-scan-wrapper-queue-response.json}"

if [[ -z "$PROMOTION_SECRET" ]]; then
  echo "Set PROMOTION_SECRET or TOTALSITEDATA_INTERNAL_SECRET before running this script." >&2
  exit 1
fi

if ! command -v "$WEBSITE_CHECKER_CMD" >/dev/null 2>&1; then
  echo "website-checker not found: $WEBSITE_CHECKER_CMD" >&2
  exit 1
fi

scan_payload_file="$(mktemp)"
final_payload_file="$(mktemp)"
trap 'rm -f "$scan_payload_file" "$final_payload_file"' EXIT

"$WEBSITE_CHECKER_CMD" "$URL" --json --totalsitedata-payload > "$scan_payload_file"

python3 - "$scan_payload_file" "$final_payload_file" "$SOURCE" "$SOURCE_DETAIL" "$PROMOTION_REASON" "$PROMOTION_TRIGGER" "$TARGET_CLIENT_ID" "$PROSPECT_ID" "$BUSINESS_NAME" "$WEBSITE_URL" <<'PY'
import json
import sys
import uuid
from urllib.parse import urlparse

scan_payload_path, out_path, source, source_detail, promotion_reason, promotion_trigger, target_client_id, prospect_id, business_name, requested_url = sys.argv[1:]

scan_payload = json.loads(open(scan_payload_path).read())

normalized_domain = scan_payload.get("domain")
if not normalized_domain and requested_url:
    parsed = urlparse(requested_url if "://" in requested_url else f"https://{requested_url}")
    normalized_domain = parsed.netloc

final_business_name = (business_name.strip() if business_name else "") or scan_payload.get("business_name") or "Unknown"
final_prospect_id = prospect_id.strip() if prospect_id else ""
if not final_prospect_id:
    final_prospect_id = str(uuid.uuid4())

payload = dict(scan_payload)
payload.update(
    {
        "source": source,
        "source_detail": source_detail,
        "business_name": final_business_name,
        "domain": normalized_domain,
        "promotion_reason": promotion_reason,
        "promotion_trigger": promotion_trigger,
        "prospect_id": final_prospect_id,
    }
)

if target_client_id:
    payload["target_client_id"] = target_client_id

with open(out_path, "w") as out:
    json.dump(payload, out)
PY

headers=(-H "Content-Type: application/json")
if [[ "$AUTH_MODE" == "bearer" ]]; then
  headers+=( -H "Authorization: Bearer ${PROMOTION_SECRET}" )
elif [[ "$AUTH_MODE" == "header" ]]; then
  headers+=( -H "x-totalsitedata-secret: ${PROMOTION_SECRET}" )
elif [[ "$AUTH_MODE" == "internal" ]]; then
  headers+=( -H "x-internal-secret: ${PROMOTION_SECRET}" )
else
  echo "Unsupported AUTH_MODE: $AUTH_MODE (use bearer, header, or internal)" >&2
  exit 1
fi

echo "POST ${API_BASE_URL}/api/internal/totalsitedata/scan"
http_code="$(curl -sS -o "$RESPONSE_PATH" -w '%{http_code}'   -X POST "${API_BASE_URL}/api/internal/totalsitedata/scan"   "${headers[@]}"   --data @"${final_payload_file}")"

echo "Enqueue HTTP ${http_code}"
cat "$RESPONSE_PATH"
printf '\n'

explain_scan_api_error() {
  local response_file="$1"
  local status="$2"
  local target_client_id="$3"

  python3 - "$status" "$target_client_id" "$response_file" <<'PY'
import json
import re
import sys

status = sys.argv[1]
target_client_id = (sys.argv[2] or "").strip()
response_file = sys.argv[3]

try:
    body_text = open(response_file, "r", encoding="utf-8").read()
except Exception:
    body_text = ""

message = body_text
text = ""
try:
    data = json.loads(body_text)
    if isinstance(data, dict):
        message = " ".join(
            str(part)
            for part in [
                data.get("error") if data.get("error") is not None else "",
                data.get("message") if data.get("message") is not None else "",
                data.get("details") if data.get("details") is not None else "",
                data.get("detail") if data.get("detail") is not None else "",
            ]
            if part
        ).strip()
    else:
        message = str(data)
except Exception:
    message = body_text.strip()

if message:
    text = message

hint_lines = []
if "target_client_id must be a valid UUID" in text:
    hint_lines.append("Hint: TARGET_CLIENT_ID must be a valid UUID. Provide a full UUID string (for example: aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee).")

if "target_client_id_required" in text or "Please provide target_client_id" in text:
    hint_lines.append("Hint: target_client_id is missing. Set TARGET_CLIENT_ID (or TOTALSITEDATA_STAGING_CLIENT_ID for staging fallback) to continue.")

if "foreign key constraint \"tasks_client_id_fkey\"" in text:
    match = re.search(r"Key \(client_id\)=\(([^)]+)\)", text)
    missing_client = match.group(1) if match else ""
    hint_lines.append(
        "Hint: client_id does not exist in Supabase `clients` table."
        + (f" Missing id: {missing_client}." if missing_client else "")
    )
    hint_lines.append("Hint: use an existing client UUID for TARGET_CLIENT_ID or seed that client in the DB first.")

if "23503" in text or status == "500":
    if target_client_id:
        hint_lines.append(f"Hint: verify TARGET_CLIENT_ID={target_client_id} resolves to a real clients.id.")

if hint_lines:
    for line in hint_lines:
        print(line)

if not hint_lines:
    # No custom interpretation available; provide response summary.
    summary = text if text else "(no body returned)"
    print(f"Raw failure: {summary}")
PY
}

if [[ ! "$http_code" =~ ^2 ]]; then
  explain_scan_api_error "$RESPONSE_PATH" "$http_code" "$TARGET_CLIENT_ID"
  echo "Request failed with HTTP ${http_code}" >&2
  exit 1
fi
if [[ "$RUN_PROCESS" == "1" ]]; then
  echo "POST ${API_BASE_URL}/api/internal/totalsitedata/scan/process?limit=${PROCESS_LIMIT}"
  process_code="$(curl -sS -o "$PROCESS_RESPONSE_PATH" -w '%{http_code}'   -X POST "${API_BASE_URL}/api/internal/totalsitedata/scan/process?limit=${PROCESS_LIMIT}"   "${headers[@]}"   -H "Content-Type: application/json"   --data '{"stopOnError":false}')"
  echo "Process HTTP ${process_code}"
  cat "$PROCESS_RESPONSE_PATH"
  printf '\n'
fi

echo "Done."

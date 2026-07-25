#!/usr/bin/env bash
set -euo pipefail

if [[ "${TOTALSITEDATA_SKIP_PREFLIGHT:-0}" == "1" ]]; then
  printf '⚠️  Skipping TotalSiteData verification preflight (TOTALSITEDATA_SKIP_PREFLIGHT=1)\n'
  exit 0
fi

get_supabase_url() {
  if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
    echo "$NEXT_PUBLIC_SUPABASE_URL"
    return 0
  fi
  if [[ -n "${SUPABASE_URL:-}" ]]; then
    echo "$SUPABASE_URL"
    return 0
  fi
  return 1
}

SUPABASE_URL_RESOLVED="${TOTALSITEDATA_VERIFY_URL:-$(get_supabase_url || true)}"
PROMOTION_SECRET_VAL="${PROMOTION_SECRET:-${TOTALSITEDATA_INTERNAL_SECRET:-}}"
SUPABASE_SERVICE_ROLE_KEY_VAL="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_ANON_KEY_VAL="${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"

if [[ -z "$SUPABASE_URL_RESOLVED" ]]; then
  echo "Missing Supabase URL. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL." >&2
  exit 1
fi

if [[ -z "$SUPABASE_SERVICE_ROLE_KEY_VAL" ]]; then
  echo "Missing SUPABASE_SERVICE_ROLE_KEY." >&2
  exit 1
fi

if [[ -z "$SUPABASE_ANON_KEY_VAL" ]]; then
  echo "Missing Supabase anon key. Set SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY." >&2
  exit 1
fi

if [[ -z "$PROMOTION_SECRET_VAL" ]]; then
  echo "Missing verification auth secret. Set PROMOTION_SECRET or TOTALSITEDATA_INTERNAL_SECRET." >&2
  exit 1
fi

if [[ "$SUPABASE_URL_RESOLVED" == *"example.com"* || "$SUPABASE_URL_RESOLVED" == *"iana.org"* ]]; then
  echo "Refusing placeholder SUPABASE URL: ${SUPABASE_URL_RESOLVED}." >&2
  exit 1
fi

if [[ "$SUPABASE_SERVICE_ROLE_KEY_VAL" == public-* ]]; then
  echo "Refusing placeholder SUPABASE_SERVICE_ROLE_KEY value." >&2
  exit 1
fi

if [[ "$SUPABASE_ANON_KEY_VAL" == public-* ]]; then
  echo "Refusing placeholder Supabase anon key value." >&2
  exit 1
fi

if [[ "$SUPABASE_SERVICE_ROLE_KEY_VAL" != eyJ* || ${#SUPABASE_SERVICE_ROLE_KEY_VAL} -lt 100 ]]; then
  echo "Refusing malformed SUPABASE_SERVICE_ROLE_KEY value (expected a JWT-like token)." >&2
  exit 1
fi

if [[ "$SUPABASE_ANON_KEY_VAL" != eyJ* || ${#SUPABASE_ANON_KEY_VAL} -lt 100 ]]; then
  echo "Refusing malformed SUPABASE_ANON_KEY value (expected a JWT-like token)." >&2
  exit 1
fi

python3 - <<'PY' "$SUPABASE_URL_RESOLVED"
import socket
from urllib.parse import urlparse
import sys

raw = sys.argv[1]
parsed = urlparse(raw)
host = parsed.hostname
if not host:
    raise SystemExit("Unable to resolve Supabase URL host from '%s'" % raw)

normalized_host = host.lower()
is_localhost_host = normalized_host in {"localhost", "127.0.0.1", "::1"}
if not is_localhost_host and not normalized_host.endswith('.supabase.co'):
    raise SystemExit(
        "SUPABASE URL must be a Supabase project URL (e.g. <project>.supabase.co) unless explicitly local. "
        f"Got host '{normalized_host}' from '{raw}'."
    )

try:
    socket.gethostbyname(host)
except Exception:
    raise SystemExit(f"Cannot resolve Supabase host '{host}' from '{raw}'")
PY

printf '✓ TotalSiteData verification preflight passed\n'

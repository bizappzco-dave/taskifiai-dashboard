#!/usr/bin/env bash
set -euo pipefail

run_stage() {
  local name="$1"
  shift
  echo "=== [START] ${name} ==="
  if ! "$@"; then
    echo "=== [FAIL] ${name} ==="
    exit 1
  fi
  echo "=== [PASS] ${name} ==="
}

if [ -f ./.env.ci ]; then
  set -a
  source ./.env.ci
  set +a
  echo "Loaded .env.ci"
else
  echo "No .env.ci found; continuing with existing environment"
fi

# Keep full verification in CI by default, while allowing local/optional safety mode.
if [[ "${TOTALSITEDATA_CI_VERIFY:-}" == "1" ]]; then
  RUN_LIVE_VERIFY="1"
elif [[ "${TOTALSITEDATA_CI_VERIFY:-}" == "0" ]]; then
  RUN_LIVE_VERIFY="0"
elif [[ "${CI:-0}" == "1" || "${GITHUB_ACTIONS:-0}" == "1" ]]; then
  RUN_LIVE_VERIFY="1"
else
  RUN_LIVE_VERIFY="0"
fi

if [[ "${TOTALSITEDATA_CI_SKIP_VERIFY:-0}" == "1" ]]; then
  RUN_LIVE_VERIFY=0
fi

run_stage "TypeScript check" npx tsc --noEmit
run_stage "Build" npm run build
run_stage "TotalsiteData contract tests" npm run totalsitedata:contract:test

if [[ "${RUN_LIVE_VERIFY}" == "1" ]]; then
  run_stage "TotalsiteData verify" npm run totalsitedata:verify
else
  echo "=== [SKIP] TotalsiteData verify (set TOTALSITEDATA_CI_VERIFY=1 to force local run) ==="
fi

echo "=== ALL CHECKS PASSED ==="

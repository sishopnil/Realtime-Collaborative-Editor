#!/usr/bin/env bash
set -euo pipefail

CHAOS_KEY=${CHAOS_KEY:-changeme}
BASE_URL=${BASE_URL:-http://localhost:4000}

PAYLOAD='{"enabled":false}'

curl -sS -H "x-chaos-key: ${CHAOS_KEY}" -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  "${BASE_URL}/api/chaos/config" | jq . || true

echo "Chaos disabled"


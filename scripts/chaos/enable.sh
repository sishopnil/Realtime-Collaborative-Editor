#!/usr/bin/env bash
set -euo pipefail

CHAOS_KEY=${CHAOS_KEY:-changeme}
BASE_URL=${BASE_URL:-http://localhost:4000}

PAYLOAD='{"enabled":true,"http":{"failureRate":0.05,"minLatencyMs":50,"maxLatencyMs":300,"includePaths":["^/api/"],"excludePaths":["/health","/api/metrics"]},"ws":{"disconnectRate":0.01,"dropPresenceRate":0.1}}'

curl -sS -H "x-chaos-key: ${CHAOS_KEY}" -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  "${BASE_URL}/api/chaos/config" | jq . || true

echo "Chaos enabled"


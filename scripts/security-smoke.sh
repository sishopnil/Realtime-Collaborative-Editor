#!/usr/bin/env bash
set -euo pipefail

base_api="http://localhost:4000"

echo "[1] Check health and security headers"
headers=$(curl -sD - -o /dev/null "$base_api/health")
echo "$headers" | grep -i "content-security-policy" >/dev/null || { echo "Missing CSP"; exit 1; }
echo "$headers" | grep -i "x-content-type-options: nosniff" >/dev/null || { echo "Missing X-Content-Type-Options"; exit 1; }

echo "[2] Unauthorized access should be blocked"
code=$(curl -s -o /dev/null -w "%{http_code}" "$base_api/api/workspaces")
if [ "$code" -lt 400 ] || [ "$code" -ge 500 ]; then echo "Expected 401/403, got $code"; exit 1; fi

echo "[3] Rate limit behavior (basic)"
fail=0
for i in $(seq 1 6); do
  c=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$base_api/api/auth/login" -H 'Content-Type: application/json' --data '{"email":"nope@example.com","password":"bad"}')
  if [ "$c" -ne 401 ] && [ "$c" -ne 429 ]; then fail=1; fi
done
if [ $fail -ne 0 ]; then echo "Login rate/lockout unexpected"; exit 1; fi

echo "Security smoke passed"


#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] Starting API E2E tests"
pushd api >/dev/null
npm test -- --runInBand || { echo "[smoke] API tests failed"; exit 1; }
popd >/dev/null

echo "[smoke] (Optional) Web tests"
if [ -d web ]; then
  pushd web >/dev/null
  npm test -- --watchAll=false || echo "[smoke] Web tests reported failures (non-blocking)"
  popd >/dev/null
fi

echo "[smoke] Done"


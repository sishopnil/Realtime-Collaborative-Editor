# k6 Performance Tests

These k6 scripts exercise core API paths and simulate realistic user behavior. They can run locally via Docker or directly if you have k6 installed.

- Base URL: defaults to `http://localhost:4000` (Docker Compose). Override with `BASE_URL`.
- Users: scripts use `/api/auth/oauth` to create/login a throwaway user per VU.
- Thresholds: built-in to fail runs on regressions (p(95) latency and error rate).

## Quick Start (Docker)

Run from repo root with API up (via `docker compose up`):

- Baseline health/metrics:
  docker run --rm -i -e BASE_URL=http://host.docker.internal:4000 grafana/k6 run - < tests/load/k6/baseline.js

- Comments workflow (realistic user behavior):
  docker run --rm -i -e BASE_URL=http://host.docker.internal:4000 -e VUS=50 -e DURATION=1m grafana/k6 run - < tests/load/k6/comments.js

- Search endpoints:
  docker run --rm -i -e BASE_URL=http://host.docker.internal:4000 -e VUS=60 -e DURATION=1m grafana/k6 run - < tests/load/k6/search.js

Note: on Linux, replace `host.docker.internal` with your host IP or network alias.

## Parameters

- BASE_URL: API origin (default `http://localhost:4000`).
- VUS: virtual users (default 20; comments.js supports higher e.g. 200).
- DURATION: test duration (default `30s`).

## Interpreting Results

- Thresholds cause non-zero exit code on regressions:
  - `http_req_failed: rate<0.02` (less than 2% errors)
  - `http_req_duration: p(95)<800` (baseline.js stricter at 300ms)

## CI (manual)

A GitHub Actions workflow (`.github/workflows/performance.yml`) enables manual runs against a provided `BASE_URL`.

## WebSocket Soak

See `tests/load/ws/soak.js` for a Socket.IO-based soak that opens 200 connections per document and emits presence updates. Requires `socket.io-client` locally.

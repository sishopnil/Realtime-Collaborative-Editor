# Performance Testing & Monitoring

This repo includes k6-based load tests and a Socket.IO WS soak script.

- k6 scripts: `tests/load/k6/*.js` with thresholds to detect regressions.
- WS soak: `tests/load/ws/soak.js` (requires `socket.io-client`).

## Run Locally

- Ensure API is running (`docker compose up`).
- Baseline: `npm run perf:k6:baseline`
- Comments: `npm run perf:k6:comments` (configure `VUS`/`DURATION`)
- Search: `npm run perf:k6:search`
- WebSocket: `BASE_URL=http://localhost:4000 VUS=200 node tests/load/ws/soak.js`

## Dashboards & Alerting (Suggested)

- Export `/api/metrics` into Prometheus via a simple exporter (scrape JSON) or add a Prometheus client as a follow-up.
- Build Grafana panels:
  - WS: `ws:connections:total`, `metrics:presence:sent`, `metrics:presence:dropped`
  - Comments: `metrics:comments:*`
  - Search: `metrics:search:queries`, `metrics:search:clicks`
- Alerts:
  - Latency: P95 http request duration (k6 threshold/CI failure)
  - Error rate: `http_req_failed` > 2%
  - Redis/Mongo health: alert on connection failures
  - Update-log growth: track `metrics:yupdate:*` if exported

## Notes

- Tune WS settings via envs: `WS_ROOM_CAPACITY`, `WS_BATCH_MS`, `WS_COMPRESS_THRESHOLD`, `WS_UPDATE_MAX_BYTES`, `WS_IDLE_PRUNE_MS`, `WS_PRESENCE_MIN_MS`, `WS_PRESENCE_TTL_SEC`.
- Caching already applied for comments/search. Adjust TTLs in controllers or Redis config as needed.

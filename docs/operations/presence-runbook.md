# Presence Runbook

## Health Checks
- Verify WS connectivity: check `api/src/ws/ws.gateway.ts` and try `ws:ping` event.
- Redis availability: `PING` must respond; check logs for `redis pub/sub error`.

## Common Issues
- No presence received: confirm client joined room (`doc:join`), CORS origin allowed, and JWT valid.
- Missing snapshot: ensure `ws:presence:doc:<docId>:users` and per-user keys exist with TTL.
- Flooding: inspect `WS_PRESENCE_MIN_MS` and rate-limits; check `metrics:presence:dropped`.

## Recovery
- Clear stale presence: delete `ws:presence:doc:<docId>:*` keys.
- Restart gateway instance; verify it registers in `ws:instances`.

## Metrics to Watch
- `metrics:presence:sent`, `metrics:presence:dropped`
- `metrics:yupdate:*:count` and `*:bytes`

## Load Testing
- Use Artillery plan in `scripts/presence-load.artillery.yml` to simulate presence bursts.


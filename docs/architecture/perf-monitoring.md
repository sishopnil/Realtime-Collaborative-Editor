# Performance & Monitoring

## Targets
- Typing latency: p50 < 70ms, p95 < 150ms
- Concurrency: 200 users per document

## Key Metrics
- `metrics:yupdate:<docId>:{count,bytes}`: Yjs update fanout volume.
- `metrics:presence:{sent,dropped}`: Presence flow control effect.
- Jobs: `/api/jobs/health` counters and BullMQ UI when enabled.
- DB: Mongoose slow query plugin logs `[mongo:slow]` entries when queries exceed threshold.

## Load Testing
- Use k6/Locust to simulate WS clients sending `y-update` at varied rates.
- Validate cache hit rates via Redis keys `cache:y:*` counters.


# Troubleshooting Guide

General
- Check `/health` and logs for errors (JSON with trace IDs).
- Verify Redis and Mongo connectivity.

Auth
- Ensure JWT secret and cookie settings match environment.

WebSockets
- Confirm CORS origins and token validity.
- Inspect presence metrics `metrics:presence:*`.

Performance
- Use k6 scripts under `tests/load/k6/*`.
- Review Prometheus graphs for latency and error rates.

Chaos
- Ensure `CHAOS_KEY` and config are correct; disable if SLOs breached.

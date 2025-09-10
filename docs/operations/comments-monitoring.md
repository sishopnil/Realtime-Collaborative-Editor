# Comments Monitoring & Alerts

Metrics (via Redis counters, exposed at `GET /api/metrics`):

- `metrics:comments:created`
- `metrics:comments:replied`
- `metrics:comments:resolved`
- `metrics:comments:deleted`
- `metrics:comments:reacted`

Suggested alerts:

- Sudden drop to zero for `created` and `replied` during business hours.
- Spike in `deleted` or `resolved` rates compared to 7-day baseline.
- Error rates for comments API endpoints (5xx rate > 1%).
- Latency P95 for `GET /comments/doc/:documentId` > 500ms sustained.

Dashboards should include top documents by comment volume and average time-to-resolution (from creation to resolvedAt).


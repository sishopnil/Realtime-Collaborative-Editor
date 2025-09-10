# Comments Runbook

This runbook covers operations for the comment system.

- Health checks:
  - API health: `GET /health`
  - Metrics: `GET /api/metrics` (includes `metrics:comments:*` counters)
- Common tasks:
  - List threads: `GET /comments/doc/:documentId`
  - Search: `GET /comments/search?documentId=<id>&q=<query>`
  - Analytics: `GET /comments/analytics/:documentId`
  - Resolve thread: `POST /comments/:id/resolve`
  - Approve/Reject: `POST /comments/:id/approve` or `/reject`
  - Assign: `POST /comments/:id/assign` with `{ assigneeId }`
  - Set due date: `POST /comments/:id/due` with `{ dueAt }`
  - Escalate: `POST /comments/:id/escalate`
- Jobs:
  - Archival: `comments.archive` run by `MaintenanceService`. Env `COMMENT_ARCHIVE_DAYS` controls threshold.
- Caching:
  - Redis JSON caches for list/search/analytics. If stale results appear, clear with `DEL comments:list:*` or wait for TTL.
- Permissions:
  - Access enforced via document-level roles and workspace membership. If threads don't appear, verify document permissions.

Escalations: pager triggers on abnormal error rate, latency spikes, or rapid growth in `metrics:comments:*` counters.


# Comments Troubleshooting Guide

- Users cannot see comments:
  - Verify they have access to the document (owner, explicit permission, or workspace member).
  - Check `GET /comments/doc/:documentId` without filters; ensure no client-side filters applied.
- Mentions not working:
  - Ensure `@` mentions use valid emails registered in the system.
  - Validate `GET /comments/mentions/search?q=<email>&documentId=<id>` returns the user.
- Realtime updates missing:
  - Check Redis pub/sub connectivity; verify events on `ws:room:<documentId>`.
  - Inspect web console/WebSocket connection health.
- High latency or load:
  - Confirm Redis is healthy (slow log, memory pressure).
  - Inspect MongoDB indexes; run `index.maintain` job.
  - Review caches hit rate; adjust TTLs if needed.
- Archival/cleanup:
  - Old threads not archiving: check `COMMENT_ARCHIVE_DAYS` and `comments.archive` job registration.

Collect diagnostics: API logs, Redis INFO, `GET /api/metrics`, MongoDB serverStatus, and recent audit entries.


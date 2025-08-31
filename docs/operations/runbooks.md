# Operations Runbook

## Incidents
- Authentication failures: check `security-alerts` pub/sub and `audit-log`. Block IPs are set under `block:ip:*`.
- WebSocket congestion: monitor `metrics:presence:*`, `ws:connections:total`, and per-doc `metrics:yupdate:*`.
- Job backlog: check `/api/jobs/health`, Redis `rce-jobs` queue stats if BullMQ is enabled.

## Common Tasks
- Rebuild document state: POST `/api/docs/:id/repair` then verify via GET `/api/docs/:id/y`.
- Rollback document: POST `/api/docs/:id/rollback` with snapshotId from GET `/api/docs/:id/snapshots`.
- Clear cache: Jobs run `cache.cleanup` every minute; to force, delete keys `docs:ws:*` and `doc:y:*`.

## Backups
- Use `api/src/scripts/backup.ts` and `restore.ts`. Configure `MONGO_URL` env and run via node.


# Production Readiness Checklist

This checklist validates that the system is ready for production.

- Performance
  - Load tests pass thresholds (k6): baseline, comments, search
  - WebSocket soak: 200+ concurrent per document stable
- Security & Compliance
  - RBAC enforced on workspace and document endpoints
  - Audit events recorded for auth, role updates, WS connections
  - JWT secrets rotated via `JwtKeysService` (configure in env)
  - Rate limiting in place for HTTP and WS
  - Privacy analytics endpoint available and minimal
- Reliability
  - Backups: Mongo snapshots (replica set), Redis RDB/AOF
  - Disaster recovery: document how to restore Mongo and Redis
  - Background jobs healthy (`/api/jobs/health`)
- Monitoring & Alerts
  - Scrape `/api/metrics`; alert on error rates and latency
  - WS presence metrics: `metrics:presence:*`
  - Comments counters: `metrics:comments:*`
  - Search counters: `metrics:search:*`
- Operations
  - Runbooks updated under `docs/operations/*`
  - Deployment checklist executed

## Backup & Restore Notes

- MongoDB: use `mongodump` with replica set secondary; restore via `mongorestore`.
- Redis: enable AOF or scheduled RDB snapshots; restore from latest dump.
- Files (MinIO/S3): lifecycle policy + versioning; verify access keys.

## Deployment Checklist

- [ ] Secrets configured (.env from templates)
- [ ] HTTPS/WSS enabled; correct CORS origins
- [ ] Redis and Mongo endpoints reachable with auth
- [ ] Background jobs processing started
- [ ] Health checks green; metrics scraped
- [ ] Canary load test run post-deploy

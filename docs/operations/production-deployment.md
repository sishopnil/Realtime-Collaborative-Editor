# Production Deployment

Infrastructure
- API (NestJS) and Web (Next.js) behind a reverse proxy (Nginx/Caddy) with TLS.
- MongoDB replica set with backups (point-in-time if available).
- Redis with persistence (AOF) and monitoring.
- CDN in front of Web for static assets; long cache for immutable builds.

Security
- Enforce HTTPS and secure cookies; strict CORS allowlist.
- Security headers enabled (HSTS, CSP, frame-ancestors none).
- Secrets via environment or vault; rotate JWT via `JwtKeysService`.

Deploy Steps (example)
- Build images and push: API/Web.
- Apply DB migrations, run `api` postbuild hooks (generates OpenAPI, runs migrations).
- Roll out API, then Web; health checks must pass.
- Verify: `/health`, `/api/metrics`, `/` (Swagger UI).

Configs
- API env: `NODE_ENV=production`, `PORT`, `MONGO_URL`, `REDIS_URL`, `CORS_ORIGIN`, `JWT_*`, `CHAOS_KEY`, `FEATURE_KEY`.
- Web env: `NODE_ENV=production`, `NEXT_PUBLIC_API_URL=https://api.example.com`.

Rollback
- Keep previous image versions; rollback via deployment tool.
- Restore DB from snapshot if migrations break (ensure backups before deploy).

Monitoring
- Prometheus scraping `/api/metrics/prometheus`.
- Logs to centralized aggregator; trace via `x-trace-id`.

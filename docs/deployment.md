# Deployment Guide (Overview)

- Environments: development (Compose), staging, production.
- Images: build per service with `APP_ENV` arg for env-specific config.
- Blue/Green: run two stacks (blue/green) behind a router; switch traffic after health passes.

## Staging
- Build: `docker compose build --no-cache` with `APP_ENV=staging`.
- Env: copy `api/.env.staging.example` and `web/.env.staging.example` to real `.env`.
- Health: API exposes `/health` and `/ready`.

## Production
- Build: use CI to build and push images with `APP_ENV=production`.
- Secrets: provide via environment or a secrets manager (never commit to repo).
- Rollback: keep N-1 image tags; switch router back on failure.

This doc is a starter; integrate with your infra (Kubernetes, ECS, or VM hosts) as needed.

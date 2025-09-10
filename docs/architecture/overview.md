# System Architecture Overview

Components
- Web (Next.js): editor UI, authentication (NextAuth), REST calls, WebSocket client.
- API (NestJS): REST endpoints, WebSocket gateway, jobs, search, comments.
- MongoDB: primary datastore (documents, comments, snapshots).
- Redis: cache, pub/sub fanout, rate limits, presence state, queues.
- BullMQ: background jobs (maintenance, archival).
- MinIO/S3: attachments (optional).

Realtime Flow
- Web clients connect via Socket.IO with JWT auth.
- Join per-document room; receive initial Yjs state, presence lists, and claims.
- Yjs updates deduped, ordered, batched, persisted, and broadcast.
- Presence throttled; stored in Redis with TTL; fanout across instances.

Security
- RBAC with workspace/document guards; share links scoped per document.
- Global rate limits and CAPTCHA challenges for auth under pressure.

Operations
- Health: `/health`.
- Metrics: `/api/metrics` (JSON), `/api/metrics/prometheus` (Prom text).
- Jobs: `/api/jobs/health`.
- Chaos controls: `/api/chaos/config`.

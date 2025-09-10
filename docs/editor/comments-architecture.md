# Comment System Architecture

This document outlines the architecture for the comment system.

- Storage: MongoDB `comments` collection via Mongoose schema defined in `api/src/database/schemas/comment.schema.ts`.
- Access control: `AuthGuard` with per-document checks using document owner, permissions, and workspace membership.
- Endpoints: `api/src/comments/comments.controller.ts` exposes list/create/reply/update/resolve/delete/react/anchor, search, analytics, and workflow endpoints (approve/reject/assign/due/escalate).
- Realtime: WebSocket notifications are published to Redis channels `ws:room:<documentId>` and `ws:notify` for UI updates and user notifications.
- Caching: Read endpoints cache via `CacheService` (Redis JSON keys). Invalidations and TTLs tune performance.
- Analytics: `GET /comments/analytics/:documentId` provides engagement, activity, participation, and basic sentiment/quality scoring.
- Metrics: Redis counters under `metrics:comments:*` are incremented on key events (created, replied, resolved, deleted, reacted) and are exposed by `GET /api/metrics`.
- Archival: Background job `comments.archive` archives old resolved threads beyond `COMMENT_ARCHIVE_DAYS`.

See also `docs/operations/comments-runbook.md` and `docs/operations/comments-monitoring.md`.


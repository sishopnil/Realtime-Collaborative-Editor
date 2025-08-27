# Realtime Collaborative Editor

Realtime Collaborative Editor is a self-hostable, web-based document editor built for low‑latency multi-user collaboration. It delivers a familiar Notion/Google Docs–style writing experience while prioritizing production-grade reliability, robust offline behavior, and fine‑grained access controls. The codebase doubles as a practical reference for building realtime CRDT-backed applications with modern web tooling.

Why it exists: many teams need a private, extensible editor they can deploy themselves—one that works reliably with spotty networks, scales to busy documents, and provides the operational guardrails required in production.

Who it’s for: small teams and startups, product/documentation squads, and developers exploring Yjs/CRDT patterns who want a solid starting point they can customize.

At a glance:
- Realtime presence: shared cursors, selections, and typing indicators.
- Offline-first: local caching and conflict-free merges on reconnect.
- Collaboration tools: inline comments, threads, mentions, resolve/reopen.
- History you can trust: automatic and named snapshots with restore.
- Access you can audit: workspaces, roles, protected links, per-document permissions.
- Findability: full-text search with filters (owner, tag, updated).
- Built for ops: rate limits, idempotency, outbox + retries, health checks.
- Modern stack: Next.js frontend, NestJS API (REST + WebSockets), Yjs (CRDT), MongoDB, Redis, BullMQ, all containerized with Docker.

## Overview
- Audience: small teams, startups, developers.
- Goals: low-latency collaboration, offline-first, comments/mentions, versions, access control, observability, and production-grade reliability.
- Non-goals (v1): site publishing, heavy media editing, native mobile apps, enterprise SSO (beyond OAuth providers).

## Features
- Realtime editing: shared cursors, selections, awareness, typing indicators.
- Offline-first: IndexedDB cache, queued mutations, conflict-free merges on reconnect.
- Comments & mentions: inline threads, resolve/reopen, optional email notifications.
- Version history: automatic and named snapshots, diff/restore, audit trail.
- Access & sharing: workspaces, roles, invites, protected links, per-document permissions.
- Search: full-text search in workspace with filters (tag/owner/updated).
- Reliability: idempotency, outbox, retries, rate limits, graceful shutdown.
- Observability: distributed tracing, RED metrics, structured logs, health checks.

## Tech Stack
- Frontend: Next.js (App Router), TipTap/ProseMirror, next-auth, SWR/React Query.
- Backend: NestJS (REST + WebSocket), class-validator, helmet, CORS.
- Realtime/CRDT: Yjs for document state and awareness protocol.
- Data: MongoDB for metadata and CRDT snapshots/updates.
- Cache & Fanout: Redis for sessions, rate limits, presence, and pub/sub across instances.
- Jobs: BullMQ for background work (snapshots, email, search indexing, cleanup).
- Files: S3-compatible storage with signed URLs for attachments.
- Infra: Docker for all services; Docker Compose for local; optional k8s manifests.

## Architecture
- Client editor holds a Yjs document; server relays binary updates and awareness events over WebSocket.
- Persist periodic snapshots with append-only updates; background compaction to bound CRDT size.
- REST API for auth, workspaces, documents, comments, sharing, versions, search, exports.
- Redis enables multi-instance fanout for doc rooms, presence TTL, and rate limiting/backpressure.
- Observability via OpenTelemetry traces, RED metrics, and structured logs with request IDs.

## System Targets
- Performance: typing latency p50 < 70ms, p95 < 150ms; join room < 500ms.
- Scale: ~200 concurrent users per document; ~10k docs/workspace; target 1M users.
- Availability: 99.9% monthly; degrade gracefully to offline mode.
- Security: OWASP hardening, input validation, JWT rotation, RBAC checks, at-rest encryption for sensitive fields.

## Data Model (high level)
- Users, Workspaces, Memberships
- Documents (metadata), Document Access (per-user/link role)
- Doc Content (snapshot binary + updates[] with monotonic seq)
- Comments (range-anchored threads), Versions (labels, snapshot refs)
- Invites, Audit Logs

## API (MVP)
- Auth: register, login, refresh, logout, OAuth callbacks, email verification, password reset.
- Workspaces: CRUD workspaces, manage members.
- Documents: CRUD, archive, share, link tokens, versions (list/create/restore).
- Comments: list/create, update, resolve.
- Search: GET search with query and filters.
- Exports: request and fetch exports.

## Realtime (WebSocket)
- Namespace: `/ws/docs`
- Events: `join_room`, `leave_room`, `awareness_update`, `doc_update` (binary Yjs), `comment_add`, `comment_update`, `presence_ping`
- Backpressure & limits: throttle awareness, batch updates above threshold, per-connection rate limits.
- Idempotency: deduplicate by `(docId, clientId, clock)`.

## Local Development
All services are containerized. A Docker Compose stack is planned for local development.

Quick start (when Compose is present):
1) Copy environment examples and adjust as needed: `cp web/.env.example web/.env` and `cp api/.env.example api/.env`.
2) Start the stack: `docker compose up --build`.
3) Access web at `http://localhost:3000`, API at `http://localhost:4000`.

Planned services in Compose:
- web (Next.js) with hot reload
- api (NestJS) with hot reload
- mongo (MongoDB)
- redis (Redis)
- mailhog (local email testing)
- minio (optional S3-compatible storage)

Common npm scripts to expect:
- Web: `dev`, `build`, `start`, `lint`, `typecheck`
- API: `start:dev`, `build`, `start:prod`, `test`, `lint`

## Configuration
- Env files: each service reads from its own `.env` (keep examples committed; real secrets uncommitted).
- Typical vars (to be finalized):
  - Web: `NEXT_PUBLIC_API_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OAUTH_*`
  - API: `MONGO_URL`, `REDIS_URL`, `JWT_SECRET`, `EMAIL_*`, `S3_*`

## Security & Compliance
- Transport security: HTTPS/WSS, secure cookies for sessions.
- Headers: CSP, HSTS, and CORS allowlist.
- Abuse controls: flood control on comments/mentions; request/connection rate limits.
- Secrets: vault-ready; rotate JWT signing keys; `.env.example` included, real `.env` ignored.

## Observability & Ops
- Traces: OpenTelemetry spans for REST/WS; propagate `traceparent`.
- Metrics: `http_request_duration`, `ws_active_connections`, `doc_update_rate`, `job_latency`.
- Logs: JSON with `requestId`, `userId`, `tenantId`, route, latency.
- Health: `/health` (liveness), `/ready` (readiness), DB/Redis checks.

## Contributing
- Open issues for features/bugs; propose changes via PRs.
- Keep changes focused; include brief context in PR description.
- Follow existing code style and add tests where applicable.

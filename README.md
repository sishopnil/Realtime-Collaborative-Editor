# Realtime Collaborative Editor

Realtime Collaborative Editor is a fast, self‑hostable docs app for teams that want Google‑Docs–style collaboration without giving up control. Move ideas from draft to done with live cursors, in‑context comments, dependable offline editing, and secure sharing—backed by production‑ready performance and observability.

Who it’s for: small teams, startups, and product/documentation squads that need a private, extensible editor they can run on their own infrastructure.

Why choose it:
- Own your data: deploy privately, integrate with your stack, and keep control.
- Works anywhere: keep writing offline; changes sync and merge automatically.
- Built for scale: responsive under load with smart backpressure and rate limits.

At a glance:
- Live collaboration: see teammates’ cursors and selections as they type.
- Works offline: local caching with conflict‑free merges on reconnect.
- Comment in context: threads, mentions, resolve/reopen decisions.
- Version history: name snapshots, compare changes, restore confidently.
- Simple, secure sharing: workspaces, roles, and protected links.
- Find anything: fast full‑text search with filters.
- Production‑ready: retries, idempotency, outbox, health checks, structured logs.
- Modern stack: Next.js + NestJS + Yjs, MongoDB, Redis, BullMQ; Dockerized.

## Overview
- Audience: small teams, startups, and product/documentation squads.
- What you get: low‑latency collaboration, offline‑first editing, comments and mentions, version history, granular access, and built‑in observability.
- Not in scope for v1: rich site publishing, heavy media editing, native mobile apps, and enterprise SSO beyond OAuth providers.

## Features
- Collaborate in real time: see teammates’ cursors and selections as they type.
- Keep working offline: edits are saved locally and merge cleanly when you’re back online.
- Discuss in place: comment on selections, @‑mention teammates, resolve or reopen threads.
- Never lose context: automatic and named versions with restore and audit trail.
- Share securely: invite by email, assign roles, or use protected links with scoped access.
- Find it fast: full‑text search with filters for tag, owner, and last updated.
- Built to run 24/7: idempotent operations, outbox + retries, rate limits, graceful shutdown.
- Operable from day one: tracing, RED metrics, structured logs, and health checks.

## Platform
- Frontend: Next.js (App Router), TipTap/ProseMirror editor, next‑auth, SWR/React Query.
- Backend: NestJS (REST + WebSocket), class‑validator, helmet, CORS.
- Realtime/CRDT: Yjs powers document state and awareness.
- Data: MongoDB stores metadata plus CRDT snapshots/updates.
- Cache & Fanout: Redis for sessions, rate limits, presence, and pub/sub across instances.
- Jobs: BullMQ processes snapshots, emails, search indexing, and cleanup.
- Files: S3‑compatible storage via signed URLs for attachments.
- Infra: Dockerized services with Compose for local; optional k8s manifests.

## How It Works
- The editor runs on Yjs: every keystroke updates a shared CRDT document.
- A WebSocket gateway relays binary updates and presence across all clients.
- The server persists snapshots and append‑only updates; background jobs compact history to keep documents snappy.
- REST endpoints cover auth, workspaces, documents, comments, sharing, versions, search, and exports.
- Redis coordinates presence, rate limiting, and pub/sub fanout across instances.
- OpenTelemetry, metrics, and structured logs provide end‑to‑end visibility.

## Performance & Scale
- Snappy by design: target p50 typing latency < 70ms, p95 < 150ms; room join < 500ms.
- Grows with your team: ~200 concurrent editors per document; ~10k docs per workspace; designed for 1M users.
- Resilient: 99.9% monthly availability with graceful degradation to offline mode.
- Secure by default: OWASP hardening, strict input validation, JWT rotation, RBAC checks, and encryption of sensitive fields at rest.

## Data Model (Brief)
- Core: Users, Workspaces, Memberships.
- Documents: metadata plus per‑user/link access roles.
- Content: snapshot (binary) with append‑only updates and monotonic sequence.
- Collaboration: Comments (range‑anchored threads), Versions (labels + snapshot refs).
- Governance: Invites and Audit Logs.

## APIs
- Auth: register/login, token refresh/logout, OAuth callbacks, verify email, reset password.
- Workspaces: create/manage workspaces and members.
- Documents: create/edit/archive, share via roles or link tokens, list/create/restore versions.
- Comments: create/list, update, resolve.
- Search: query with filters.
- Exports: request and fetch document exports.

## Realtime Sync
- WebSocket namespace: `/ws/docs` for document rooms.
- Events: join/leave, awareness updates (presence), binary Yjs document updates, comment events, presence ping.
- Smooth under pressure: throttled awareness, batched updates when needed, and per‑connection rate limits.
- Conflict‑free: idempotent updates deduplicated by `(docId, clientId, clock)`.

## Run It Locally
All services are containerized for a one‑command startup via Docker Compose.

Quick start:
1) Copy environment examples and adjust as needed: `cp web/.env.example web/.env` and `cp api/.env.example api/.env`.
2) Start everything: `docker compose up --build`.
3) Open the web app at `http://localhost:3000` and the API at `http://localhost:4000`.
4) Health: API exposes `/health` and `/ready`; compose waits for API before starting web.

Compose services:
- web (Next.js) with hot reload
- api (NestJS) with hot reload
- mongo (MongoDB)
- redis (Redis)
- mailhog (local email testing)
- minio (optional S3‑compatible storage)

Useful npm scripts:
- Web: `dev`, `build`, `start`, `lint`, `typecheck`
- API: `start:dev`, `build`, `start:prod`, `test`, `lint`

## Configuration
- Environment files: each service reads from its own `.env` (examples committed, real secrets ignored).
- Typical vars (to be finalized):
  - Web: `NEXT_PUBLIC_API_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OAUTH_*`
  - API: `MONGO_URL`, `REDIS_URL`, `JWT_SECRET`, `EMAIL_*`, `S3_*`

## Security & Compliance
- Private by default: deploy behind HTTPS/WSS with secure cookies.
- Safer browsing: strict CSP, HSTS, and a tight CORS allowlist.
- Abuse‑resistant: flood control on comments/mentions and request/connection rate limits.
- Secret management: vault‑ready; rotate JWT signing keys; `.env.example` included, real `.env` ignored.

## Monitoring & Operations
- Tracing: OpenTelemetry spans for REST/WS with `traceparent` propagation.
- Metrics: key RED signals like `http_request_duration`, `ws_active_connections`, `doc_update_rate`, `job_latency`.
- Logging: JSON logs with `requestId`, `userId`, `tenantId`, route, and latency.
- Health: `/health` (liveness) and `/ready` (readiness) with DB/Redis checks.

## Contributing
- Open issues for features/bugs; propose changes via PRs.
- Keep changes focused; include brief context in PR description.
- Follow existing code style and add tests where applicable.

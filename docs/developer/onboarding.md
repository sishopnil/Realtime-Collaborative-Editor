# Developer Onboarding Guide

Prereqs
- Node.js 18+, Docker, Docker Compose
- MongoDB/Redis (or use Compose stack)

Setup
- Install: `npm install && npm -w api install && npm -w web install`
- Run stack: `docker compose up --build`
- Dev locally: `npm run dev` (API+Web)
- Seed data: `npm run seed` (API workspace/doc)

Testing
- API tests: `cd api && npm test`
- Web tests: `cd web && npm test`
- E2E highlights: see `api/src/e2e/*.e2e.spec.ts`

Docs
- Swagger UI: API root `/`
- OpenAPI JSON: `openapi/openapi.json` (generated post-build)
- WebSocket events: `docs/ws/events.md`

Contrib & Workflow
- Conventional commits; keep PRs focused
- Lint/format: `npm run lint`, Prettier configured
- Branch from `main`; request reviews; include testing notes

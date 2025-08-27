# Development Workflow

- Install deps: `npm install` then `npm -w web install && npm -w api install`.
- Start stack (Compose): `docker compose up --build`.
- Start apps locally without Compose: `npm run dev` (starts API and Web with hot reload).
- Health: API `/health` and `/ready`; Swagger at `/api/docs`.
- Seed data: `npm run seed` (creates a demo user/workspace/doc).
- Debug API: use VSCode config "Attach API (ts-node-dev)".
- Tests: `npm -w api run test`, `npm -w web run test`.

Tips
- Change API port with `PORT` in `api/.env`; keep `NEXT_PUBLIC_API_URL` in sync.
- When using Compose, Mongo/Redis/MailHog/MinIO are available for local development.

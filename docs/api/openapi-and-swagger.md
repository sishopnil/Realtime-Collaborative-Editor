# API Documentation (OpenAPI & Swagger)

- Interactive docs: visit `/` on the API server (Swagger UI).
- JSON spec: generated post-build at `openapi/openapi.json`.
- Regenerate manually:
  - From `api`: `npm run build && npm run build:docs`
  - Or: `ts-node-dev --transpile-only src/scripts/generate-openapi.ts`

Conventions
- All routes sit under `/api/*` except health `/health`.
- Auth: JWT Bearer via `Authorization: Bearer <token>`; refresh via cookie.
- Versioning: `v1` implicit in this release; future: header `x-api-version` or URL prefix `/api/v1`.

Rate Limiting
- Per-IP and per-user defaults: see `RATE_*` envs.
- Comments POST tighter limits. WS messages gated via token-bucket.

SDKs
- Use the OpenAPI JSON with generators (e.g., `openapi-generator-cli`).
- Example: `openapi-generator-cli generate -i openapi/openapi.json -g typescript-axios -o sdk/js`.

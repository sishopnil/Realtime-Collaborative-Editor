# Secure Coding Guidelines

- Validate all inputs with DTOs; whitelist fields; reject unknown.
- Sanitize user-facing rich text; strip HTML where not needed.
- Enforce RBAC at controllers; use guards with explicit role decorators.
- Avoid building queries from strings; prefer typed repos and parameterized filters.
- Use `bcrypt` with cost >=12; never log secrets or PII.
- Encrypt sensitive fields at rest; derive keys from env and rotate as needed.
- Add rate limiting to auth and write-heavy endpoints; admin bypass only when justified.
- Log security-relevant events; avoid logging credentials/tokens.
- Keep dependencies updated; review `npm audit` and CI scan results.
- Default-deny CORS; set strict CSP and security headers.


# Security Architecture Overview

- API: NestJS with Helmet, CSP, HSTS, CORS allowlist, DTO validation, rate limiting, RBAC guards, field encryption (AES-256-GCM), bcrypt (12+).
- Web: Next.js with strict security headers and CSP.
- Data: MongoDB with indexes; sensitive fields encrypted; Redis for sessions/rate.
- Transport: TLS 1.3+ enforced in containers.
- Monitoring: Audit interceptor, denial logs, alerts via Redis pubsub, admin dashboard.
- DDoS/Abuse: Emergency per-IP clamp, bot heuristics, per-IP concurrency, Trivy, ZAP in CI.

Trust boundaries: Internet → Web → API → Mongo/Redis. Admin endpoints restricted via email allowlist.


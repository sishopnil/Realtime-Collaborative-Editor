# Security Test Scenarios

- Authentication
  - Brute force/lockout: repeated invalid logins → lock + alert.
  - MFA admins: missing/invalid OTP rejected.
- Authorization
  - Access workspace/doc without membership → 403.
  - Role escalation attempts via API payload → denied and logged.
- Injection
  - NoSQL operators in body/query stripped by sanitizer.
  - Rich text sanitization removes `<script>` and `javascript:` URLs.
- Rate Limiting & DDoS
  - Per-IP and per-user global limits enforce 429.
  - Docs endpoint rate (100/min) and comment flood (10/min).
  - Emergency clamp via env.
- Headers & Transport
  - CSP present, HSTS in prod, frame denied, nosniff.
- Privacy
  - Export returns user-owned data only; delete anonymizes.

Use CI smoke (`scripts/security-smoke.sh`) and ZAP baseline scans; schedule deeper manual tests with ZAP full scan.


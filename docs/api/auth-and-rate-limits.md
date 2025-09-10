# Authentication & Rate Limiting

Auth
- Login: `/api/auth/login` (email/password); OAuth via `/api/auth/oauth`.
- Access token: JWT Bearer; Refresh token: HttpOnly cookie at `/api/auth/refresh`.
- Sessions: `/api/auth/sessions` returns active refresh sessions.

Rate Limits
- HTTP: global defaults per IP/user; tighter for `/comments` POST, search.
- WS: token bucket via Redis; presence updates throttled (server drops bursts).
- Env knobs: `RATE_*`, `WS_MSGS_PER_SEC`, `COMMENT_RATE_PER_MIN`.

Abuse Protections
- Request sanitization, validation, role guards, and audit logging.
- WAF/CSP via Helmet; OTP for admin emails via `MFA_TOTP_SECRET`.

# Production Security Configuration

- Secrets provider: `SECRETS_PROVIDER=vault` (use Vault integration; fallback `env`).
- JWT rotation: `JWT_ROTATE_DAYS=30` (default); ensure Redis persistence for key store.
- CORS allowlist: set `CORS_ORIGIN=https://app.example.com`.
- Cookies: run behind TLS; set `NODE_ENV=production`, trust proxy enabled.
- Headers: Helmet/HSTS/CSP already configured; adjust CSP connect-src to API origin.
- Rate limits: tune `RATE_*` envs; set `EMERGENCY_RATE_LIMIT_PER_IP` for clamp mode.
- Monitoring: subscribe SIEM to Redis `security-alerts` channel; scrape `audit-log`.
- Backups: schedule `npm run db:backup` or use secure script; store offsite with encryption.
- Certificates: manage via ingress (Caddy/Traefik/Nginx) with Let’s Encrypt; automate renewal.


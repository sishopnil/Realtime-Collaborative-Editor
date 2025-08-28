# DDoS Protection Integration

- Cloudflare: Run behind Cloudflare proxy, enable WAF, Bot Fight Mode, and rate limiting rules (e.g., 100 req/min per IP to `/api/*`). Set `trust proxy` enabled (already set in production) so IPs resolve from `CF-Connecting-IP`.
- AWS Shield/ALB: Place API behind ALB + Shield Advanced with AWS WAF rules. Enable rate-based rules and IP reputation lists. Ensure `X-Forwarded-For` is forwarded; app already respects it.
- Emergency switch: Set `EMERGENCY_RATE_LIMIT_PER_IP` in API env to instantly clamp per-IP traffic.

Operational runbook:
- Monitor Redis `audit-log` entries for `abuse.*` events.
- Temporarily raise block durations by increasing thresholds or manually `SET block:ip:{ip} 1 EX 3600`.


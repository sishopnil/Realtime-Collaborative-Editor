# Threat Model

- Assets: user data (PII), documents, credentials, tokens.
- Adversaries: external attackers, malicious tenants, bots.
- Entry points: Web, API endpoints, WebSockets.
- Risks: auth bypass, RBAC escalation, injection, XSS, CSRF, brute force, DDoS.
- Mitigations: Auth guards, RBAC guards, DTO validation, sanitization, CSP/HSTS, rate limits, CAPTCHA, audit/alerts, field encryption.
- Residual risks: Zero-day dependencies, insider misuse; monitored via audit.

Data flows: login → JWT, refresh via cookie; Redis stores session metadata.


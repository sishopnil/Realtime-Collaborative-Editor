# Security Validation Checklist

- Auth
  - [ ] Login, refresh, logout flows
  - [ ] Admin MFA enforced
  - [ ] Lockout and CAPTCHA behavior
- RBAC
  - [ ] Workspace guards (viewer/editor/admin)
  - [ ] Document guard inheritance and overrides
- Input
  - [ ] DTO validation rejects extra fields
  - [ ] Sanitization strips `$` operators and dangerous HTML
- Headers
  - [ ] CSP/HSTS/XFO/Nosniff/Referrer-Policy
- Rate limits & DDoS
  - [ ] Per-IP, per-user, docs, comments
  - [ ] Emergency clamp and bot blocking
- Crypto
  - [ ] Bcrypt cost >=12
  - [ ] Field encryption works
  - [ ] JWT kid present and rotation functional
- Privacy
  - [ ] Export/delete endpoints function


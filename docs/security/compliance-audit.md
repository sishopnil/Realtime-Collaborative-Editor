# Compliance & Audit Procedures

- GDPR: Right to access/export and deletion/anonymization supported by `/api/privacy` endpoints.
- Data Minimization: Only necessary PII stored; optional fields encrypted; analytics anonymized.
- Retention: Audit logs retained up to `AUDIT_LOG_MAX`; rotate keys and purge sessions periodically.
- Audit: Use `GET /api/security/audit` and `.../alerts` plus external SIEM ingestion via Redis pubsub.
- Change Management: Use PRs with security checks (CodeQL, ZAP, Trivy, npm audit) in CI.


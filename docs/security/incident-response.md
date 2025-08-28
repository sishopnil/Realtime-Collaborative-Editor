# Incident Response Procedures

1) Detection: Alerts on `security-alerts` channel, dashboards, external WAF signals.
2) Triage: Identify scope, affected users, impacted assets.
3) Containment: Enable `EMERGENCY_RATE_LIMIT_PER_IP`, add WAF rules, block offending IPs.
4) Eradication: Patch vulnerable components, rotate keys, revoke sessions.
5) Recovery: Restore services, monitor for recurrence.
6) Postmortem: Document timeline, root cause, actions.

Runbook snippets:
- Block IP: `SET block:ip:{ip} 1 EX 3600` in Redis.
- Increase login threshold: `AUTH_FAIL_BLOCK_THRESHOLD` env.


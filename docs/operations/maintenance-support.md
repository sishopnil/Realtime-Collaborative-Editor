# Maintenance & Support Procedures

Routine
- Weekly dependency review and security updates.
- Monitor DB and Redis resource usage; adjust capacity.
- Rotate JWT keys via `JwtKeysService` schedule.

Backups
- Verify Mongo snapshots daily; test restores monthly.
- Ensure Redis persistence (AOF) and backup configs.

SLOs
- Availability 99.9% monthly; error rate < 2%.
- Incident response: acknowledge in 15m, resolve in 2h (P1).

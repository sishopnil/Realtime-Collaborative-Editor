# Launch Strategy & Rollout Plan

Phased Rollout
- Internal (10%), early adopters (25%), general (50%), full (100%).
- Control via feature flags (`/api/features`) and allowlists.

Feature Flags
- Admin config: `GET/POST /api/features/config` with `x-feature-key`.
- Client evaluation: `GET /api/features` (per-user).

Rollback
- Toggle flags off; scale down problematic services.
- Roll back deployment to previous image.
- Restore DB if necessary from last snapshot.

Monitoring & Success Metrics
- Track signup/activation, doc creation, collaboration sessions, error rate, latency p95, WS stability.
- Alerts configured in Grafana/Alertmanager.

Communications
- Announce to stakeholders; in-app banner for rollout stages.
- Document changes and link to user guides.

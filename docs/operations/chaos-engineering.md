# Chaos Engineering & Resilience Testing

This guide describes how to inject controlled failures and validate resilience.

## Controls

- API Chaos Config (requires `CHAOS_KEY` env on API):
  - `GET/POST /api/chaos/config` with header `x-chaos-key: $CHAOS_KEY`
  - Example payload:
    ```json
    {
      "enabled": true,
      "http": { "failureRate": 0.05, "minLatencyMs": 50, "maxLatencyMs": 500, "includePaths": ["^/api/"], "excludePaths": ["/health", "/api/metrics"] },
      "ws": { "disconnectRate": 0.01, "dropPresenceRate": 0.1 }
    }
    ```
- Toxiproxy (network faults):
  - Compose overlay: `infra/chaos/docker-compose.chaos.yml`
  - Proxies: `infra/chaos/toxiproxy.json` (mongo@27019, redis@6380)
  - Apply toxics:
    ```bash
    # add 500ms latency, 30% variance to Mongo
    curl -sX POST localhost:8474/proxies/mongo/toxics -d '{"name":"latency","type":"latency","attributes":{"latency":500,"jitter":150}}'
    # cut Redis in half (limit bandwidth)
    curl -sX POST localhost:8474/proxies/redis/toxics -d '{"name":"limit","type":"limit_data","attributes":{"rate":10240}}'
    # down Redis
    curl -sX POST localhost:8474/proxies/redis/toxics -d '{"name":"down","type":"timeout","attributes":{"timeout":60000}}'
    ```

## Scenarios

- DB outage: disable Mongo proxy; verify API degrades gracefully and recovers.
- Redis partition: add timeout toxic; validate WS reconnection and presence recovery.
- WS chaos: enable `disconnectRate` and `dropPresenceRate`; observe client retry logic and UI behavior.
- Consistency after partition: perform edits/comments across split; verify state after healing.

## Automation & Scheduling

- Use a cron or workflow to toggle chaos configs during off-peak; run smoke tests (k6 + E2E) and auto-rollback if SLOs violated.

## Metrics & Success Criteria

- Error rate < 5% under chaos; P95 latency within relaxed SLO.
- Recovery time under RTO; no data loss beyond RPO.
- Alerting fires appropriately; runbooks followed.

## Disaster Recovery Validation

- Execute backup/restore and failover drills quarterly; document outcomes and remediation.

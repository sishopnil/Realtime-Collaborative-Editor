# Observability Stack (Production)

This guide outlines a pragmatic setup for metrics, logs, and traces.

## Components

- Prometheus: scrapes API at `/api/metrics/prometheus`.
- Grafana: dashboards for API/WS/Jobs/DB, alerting.
- Jaeger: distributed tracing backend (trace IDs propagated via `x-trace-id`).
- Centralized Logging: JSON logs to stdout; aggregate with Loki/Promtail or ELK.
- Error Tracking: Sentry (optional) for exceptions and aggregation.

## API Instrumentation

- HTTP metrics and latency histogram via Redis-backed middleware.
- Prometheus endpoint: `GET /api/metrics/prometheus`.
- JSON request logs with `x-trace-id` for correlation.
- UX vitals ingestion: `POST /api/ux/vitals` (LCP, FID, CLS).

## Prometheus Scrape Example

```
# prometheus.yml
scrape_configs:
  - job_name: 'rce-api'
    metrics_path: /api/metrics/prometheus
    static_configs:
      - targets: ['api:4000']
```

## Docker Compose (add-on)

Create `docker-compose.observability.yml` and run with `docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d`.

```
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./infra/observability/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports: ["9090:9090"]
  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana
  jaeger:
    image: jaegertracing/all-in-one:1.57
    ports: ["16686:16686"]
  loki:
    image: grafana/loki:2.9.0
    ports: ["3100:3100"]
  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - ./infra/observability/promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

volumes:
  grafana-data:
```

## Suggested Dashboards & Alerts

- API HTTP: request rate, error rate, latency p95/p99; status breakdown; WS presence metrics.
- Jobs: processed vs failed; queue latency.
- DB: Mongo connections, ops/sec (via exporters), slow queries.
- Redis: memory, ops/sec, keyspace hits/misses.
- Alerts:
  - Error rate > 2% (5m)
  - P95 latency > SLO (5m)
  - Jobs failed spike (1m)
  - DB/Redis exporter down

## Incident Response

- PagerDuty/Webhooks from Grafana/Alertmanager.
- Runbooks under `docs/operations/*`.
- Post-mortem template and retrospective after critical incidents.

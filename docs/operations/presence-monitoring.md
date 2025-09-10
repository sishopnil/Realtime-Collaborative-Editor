# Presence Monitoring & Alerts

## Key Indicators
- Presence sent rate: `metrics:presence:sent`
- Presence dropped (throttle): `metrics:presence:dropped`
- Yjs update count/bytes: `metrics:yupdate:*`
- Active online set size: `ws:online:doc:<docId>`

## Dashboards
- Display per-document presence and update metrics
- Alert on dropped presence spiking or update bytes exceeding threshold

## Alerts
- High dropped presence -> investigate client spam or reduce PRESENCE_MIN_MS
- No presence for document over 1m during activity -> check WS connectivity


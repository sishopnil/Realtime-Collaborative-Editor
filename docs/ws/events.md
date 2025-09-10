# WebSocket Events & Payloads

Namespace: Socket.IO default. Auth via `auth: { token }` (JWT access token).

Join/Leave
- emit `doc:join` -> { documentId }
- on `doc:joined` -> { documentId }
- emit `doc:leave` -> { documentId }
- on `doc:left` -> { documentId }

Presence
- emit `presence` -> { documentId, anchor: number, head: number, typing: boolean }
- on `presence` -> { documentId, userId, anchor, head, typing, ts }
- on `presence:list` -> { documentId, list: Presence[] }

Yjs
- on `y-init` -> { documentId, updateB64, vectorB64, gz }
- emit `y-update` -> { documentId, updateB64, msgId?, seq? }
- on `ack` -> { msgId, status }
- emit `y-sync` -> { documentId, vectorB64? }
- on `y-sync` -> { documentId, updateB64, vectorB64, gz }

Messaging
- emit `doc:msg` -> { documentId, content, msgId? }
- on `doc:msg` -> { documentId, content, from, ts }

Claims (soft edit locks)
- emit `section:claim` -> { documentId, from, to, ttlSec? }
- on `section:claimed` -> { claimId, documentId, from, to, userId, ts, ttl }
- emit `section:release` -> { documentId, claimId }
- on `section:released` -> { claimId, documentId, by }
- on `section:list` -> { documentId, claims }

Health
- emit `ws:ping` -> {}
- on `ws:pong` -> { ts, redis }

Notices
- on `doc:notice` -> { documentId, type, data }

Notes
- Respect room capacity; server may error `Room capacity reached`.
- Presence is rate-limited; bursts may be dropped but aggregated via Redis.
- Offline users receive queued messages on next join (ephemeral, TTL 1 day).

# Presence Architecture & APIs

This document outlines the presence system used by the collaborative editor.

## Overview

- Client emits presence (cursor, selection, typing) over WebSocket.
- Server (NestJS Gateway) fans out presence to room peers and persists a TTL snapshot in Redis for joiners and aggregation.
- Presence is read-only and ephemeral; document content sync remains via Yjs updates.

## WebSocket Events

- `doc:join { documentId }`: join room; server returns `doc:joined`, `y-init`, `presence:list` and (if any) `section:list`.
- `presence { documentId, anchor, head, typing? }`: client -> server; server echoes to room as `presence`.
- `y-update { documentId, updateB64, msgId?, seq? }`: Yjs updates (separate from presence).
- `section:claim` / `section:release`: soft ownership; server fans out `section:claimed` / `section:released`.
- `doc:metric { documentId, name }`: lightweight counters (conflicts, etc.).

## Redis Keys

- `ws:presence:doc:<docId>:users` Set(userId) – users with recent presence
- `ws:presence:doc:<docId>:<userId>` JSON { userId, anchor, head, typing, ts } (EX: 60s)
- `ws:online:doc:<docId>` Set(userId)
- `ws:room:<docId>` Pub/Sub channel for multi-instance fanout
- `ws:section:doc:<docId>:<claimId>` JSON claim { claimId, from, to, userId } (EX)
- `ws:section:doc:<docId>` Set(keys)
- Metrics: `metrics:presence:*`, `metrics:yupdate:*`

## Accessibility

- Announce presence actions via `aria-live` region (optional TTS).
- Keyboard navigation for active collaborators list with jump-to-cursor on Enter.

## Performance Notes

- Client throttles and deduplicates presence updates.
- Server rate-limits WS messages and drops overly-frequent presence.
- Overlay renders in compact mode on small screens.


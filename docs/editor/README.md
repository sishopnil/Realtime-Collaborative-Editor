# Editor API & Usage

- Components:
  - `Editor`: standalone TipTap editor with toolbar, accessibility, i18n.
  - `EditorCollab`: collaborative editor bound to Yjs `Doc` with offline sync.
- Provider:
  - `SimpleYProvider` handles Yjs updates, batching, IndexedDB persistence, BroadcastChannel sync, and API persistence.
  - Status: subscribe via `onStatus(cb)`; events also emitted on `window` as `doc-sync-status`.
- Config:
  - Env `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_DOC_TTL_MS` (cache TTL in ms).
  - Theme persisted in `localStorage` under `editorTheme`.
- Export:
  - Use ref on `EditorCollab` to call `getHTML()`/`getJSON()`; see page `/workspaces/[id]/documents/[docId]/edit`.

## WebSocket Preparation
- `SimpleYProvider` is structured to allow swapping transport: add a y-websocket client and forward updates.
- Keep using API persistence for snapshots and recovery.


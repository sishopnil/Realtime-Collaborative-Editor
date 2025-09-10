# Comments API

Endpoints

- POST `/comments` – Create comment
  - Body: { documentId, authorId, text, anchor? { from, to, vectorB64? }, parentId?, threadId?, status?, tags?, priority? }
  - If `parentId` omitted, creates a thread root; include `anchor`.
- GET `/comments/doc/:documentId` – List threads with replies
  - Query: `status?`, `q?`
  - Returns: array of { ...thread, replies: [] }
- POST `/comments/:id/replies` – Reply to thread
- POST `/comments/:id/resolve` – Mark thread resolved
- PATCH `/comments/:id` – Update text/status/tags/priority
- DELETE `/comments/:id` – Soft delete
- POST `/comments/:id/anchor` – Update anchor range

Range Anchors

- Anchors store `from`/`to` document positions and optional Yjs state vector (`vectorB64`).
- Clients should repair anchors after large edits using ProseMirror mappings and submit updated anchors via the anchor endpoint.

WebSocket (planned)

- `comment:created`, `comment:updated`, `comment:deleted`, `comment:resolved` for real-time UX.


# @Mentions & Notifications

## Mentions
- Syntax: `@email@example.com` inside comment text.
- Lookup: `GET /comments/mentions/search?q=<term>&documentId=<docId>` returns users with access to the document.
- Validation: Mentions are validated against document access (owner, doc permission, workspace member).

## Notifications
- Storage: Mongo `NotificationDoc` per user; fields include type, documentId, commentId, threadId, readAt.
- Preferences: `GET/POST /notifications/prefs` stores web/email/digest flags in Redis.
- Listing: `GET /notifications` returns recent notifications; `POST /notifications/read` marks as read.
- Real-time: WS `notify` event to room `user:<userId>` when a mention/reply occurs.

## WebSocket
- Client listens for `notify` and shows a toast (and optional TTS if enabled).
- Server: Publishes cross-instance via Redis channel `ws:notify`; WS gateway delivers to `user:<id>`.


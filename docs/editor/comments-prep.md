# Comments System Preparation

This document describes the initial scaffolding for the upcoming comments system.

## Goals
- Threaded comments tied to document positions (Yjs-relative or logical anchors)
- @mentions with user search
- Notifications (in-app; optional email later)

## Events and APIs (planned)
- GET `/comments/doc/:documentId` – list threads and comments
- POST `/comments` – create a new comment { documentId, pos, text, parentId? }
- POST `/comments/:id/replies` – add a reply
- POST `/comments/:id/resolve` – resolve a thread
- GET `/mentions/search?q=` – user search for @mentions

## Data Model (draft)
- Comment { id, documentId, authorId, text, createdAt, parentId?, resolvedAt?, pos }
- Thread = top-level Comment with children

## UI Framework
- Sidebar list of threads
- Inline markers with popover editor
- @mention picker integrated with user search

## Activity Tracking
- Track comment creates/replies/resolves per document to feed analytics


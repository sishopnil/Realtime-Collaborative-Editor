# Editor Debugging & Monitoring

- Subscribe to sync events:
  ```js
  window.addEventListener('doc-sync-status', (e) => console.log('sync', e.detail));
  ```
- Use Export buttons in the editor page to dump HTML/Markdown.
- Call `cleanupLocalDocCaches()` from `web/src/lib/yjsProvider` to prune caches.
- Inspect IndexedDB `doc-<id>` and `localStorage` keys `doc-meta:*`, `doc-queue:*`.


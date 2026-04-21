## Synchronization methods

The prototype currently compares four client-facing synchronization approaches:

- polling
- long polling
- Server-Sent Events (SSE)
- WebSocket

Polling and long polling are request-based approaches where clients repeatedly or conditionally request updates from the backend.

SSE and WebSocket are persistent connection-based approaches where the backend forwards database changes to connected clients.

## Backend event propagation

For event-driven transports, the backend uses PostgreSQL triggers and LISTEN/NOTIFY to detect newly inserted rows in the sync_events table. A dedicated PostgreSQL listener client receives NOTIFY messages and forwards the corresponding events to connected SSE or WebSocket clients.

In this prototype, database-triggered notification is treated as a backend propagation mechanism rather than a separate browser-facing synchronization method.
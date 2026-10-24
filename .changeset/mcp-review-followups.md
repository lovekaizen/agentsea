---
'@lov3kaizen/agentsea-core': patch
---

MCP: a disconnect during the legacy `initialize` handshake fails with a clear error, not a `TypeError`.

- `initialize()` reads the transport once after the response. If `disconnect()` ran in between, it throws `MCP connection closed during the initialize handshake`.
- Probe tests cover a disconnect between the initialize response and `notifications/initialized`, and reconnect on the modern path, which closes the old transport, fails waiting calls with `Client disconnected`, and emits no `disconnect` event.

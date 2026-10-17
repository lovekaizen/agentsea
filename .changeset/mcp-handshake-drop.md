---
'@lov3kaizen/agentsea-core': patch
---

MCP: a connection that drops during the legacy `initialize` handshake now fails `connect()` with `MCP connection closed during the initialize handshake`, instead of a `TypeError`.

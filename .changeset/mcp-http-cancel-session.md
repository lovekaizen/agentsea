---
'@lov3kaizen/agentsea-core': minor
---

MCP: timed-out requests are cancelled, and Streamable HTTP carries 2025-03-26 session ids.

- A request that times out rejects with `MCPTimeoutError` and is cancelled. `initialize` is never cancelled. Streamable HTTP aborts the HTTP request. Every transport sends `notifications/cancelled`, with the version metadata for modern servers.
- `requestTimeoutMs` on the server config sets the wait, which defaults to 30 seconds.
- Over `transport: 'http'`, a server that does not answer `server/discover` falls back to the legacy `initialize` handshake. A timeout fails the connection at 15 seconds instead.
- The transport sends back the `Mcp-Session-Id` a server assigns, and the negotiated `MCP-Protocol-Version`. It sends a best-effort `DELETE` on disconnect, bounded to 2 seconds.
- Not yet implemented: re-initializing after a session expires. After a 404 the next request fails until you reconnect.

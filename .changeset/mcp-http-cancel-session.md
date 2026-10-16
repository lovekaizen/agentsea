---
'@lov3kaizen/agentsea-core': minor
---

MCP Streamable HTTP: timed-out requests are cancelled, and 2025-03-26 session ids are carried.

- A request that times out is cancelled. Streamable HTTP aborts the HTTP request, and both transports send `notifications/cancelled`. `initialize` is never cancelled.
- Servers that do not answer `server/discover` over `transport: 'http'` fall back to the legacy `initialize` handshake. The transport sends back the `Mcp-Session-Id` a server assigns, and the negotiated `MCP-Protocol-Version`. It sends a best-effort `DELETE` on disconnect, bounded to 2 seconds.
- Not yet implemented: re-initializing after a session expires. A 404 clears the stored session, and the next request fails.

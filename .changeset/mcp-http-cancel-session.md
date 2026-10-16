---
'@lov3kaizen/agentsea-core': minor
---

MCP Streamable HTTP: requests that time out are cancelled, and 2025-03-26 servers work.

- A request that times out aborts its HTTP request. Stdio sends `notifications/cancelled`, as the spec requires.
- Servers that do not answer `server/discover` over `transport: 'http'` fall back to the legacy `initialize` handshake. The transport keeps the `Mcp-Session-Id` the server assigns, sends it on later requests, and sends the negotiated `MCP-Protocol-Version`. It sends a best-effort `DELETE` on disconnect.

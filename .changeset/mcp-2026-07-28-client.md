---
'@lov3kaizen/agentsea-core': minor
---

MCP client speaks protocol 2026-07-28.

- New `transport: 'http'` option: Streamable HTTP (one POST per message, JSON or SSE reply, no sessions). Set `url`.
- The client probes `server/discover` first. Modern servers get `_meta` on every request. Servers that do not answer the probe fall back to the 2024-11-05 `initialize` handshake, which now also sends `notifications/initialized`.
- `x-mcp-header` parameters are mirrored into `Mcp-Param-*` headers on HTTP. Tools that break the header rules are left out of `listTools()` with a `warning` event.
- A tool result with `resultType: "input_required"` rejects with `MCPInputRequiredError`. MRTR is not implemented yet.
- JSON-RPC errors reject with `MCPProtocolError`, which keeps the numeric `code`.
- Fixed: stdio stderr no longer emits `error`. It emits `stderr`. Unlistened stderr lines used to throw.
- Fixed: `getServerInfo()` returns a flat `{ name, version, protocolVersion, capabilities }` on the legacy path too.
- Fixed: request timers are cleared when a response arrives, so they no longer keep the process alive.

Not yet implemented: OAuth authorization, subscriptions, server-side MRTR, and the deprecated Roots and Sampling features.

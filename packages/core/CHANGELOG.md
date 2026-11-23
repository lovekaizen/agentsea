# @lov3kaizen/agentsea-core

## 2.0.0

### Major Changes

- **Breaking:** MCP stdio servers no longer inherit the parent process environment. They now receive only a default allow-list (HOME, LOGNAME, PATH, SHELL, TERM, USER, TMPDIR, LANG, LC_ALL, HTTP_PROXY, HTTPS_PROXY, NO_PROXY, ALL_PROXY and their lowercase forms, NODE_EXTRA_CA_CERTS, SSL_CERT_FILE, REQUESTS_CA_BUNDLE, CURL_CA_BUNDLE, plus a short Windows set), any parent variables named in the new `passEnv` option, and the explicit `env` map. Provider API keys and other secrets in the parent environment are no longer visible to MCP server processes.

  If a server relied on an inherited variable, name it: `passEnv: ['GITHUB_TOKEN']` on the server config (or `env: { KEY: '...' }`). `passEnv` must be an array; a string throws a `TypeError`. For the 2.x line, `inheritFullEnv: true` restores the old behaviour and emits a deprecation warning; it will be removed in a later major release.

  Adds `buildStdioEnv` and `StdioEnvOptions` exports.

### Minor Changes

- MCP client speaks protocol 2026-07-28.

  - New `transport: 'http'` option: Streamable HTTP (one POST per message, JSON or SSE reply, no resumption). Set `url`.
  - The client probes `server/discover` first. Modern servers get `_meta` on every request. Servers that do not answer the probe fall back to the 2024-11-05 `initialize` handshake, which now also sends `notifications/initialized`. Over `transport: 'http'`, a probe that times out fails the connection instead.
  - `x-mcp-header` parameters are mirrored into `Mcp-Param-*` headers on HTTP. Tools that break the header rules are left out of `listTools()` with a `warning` event.
  - A tool result with `resultType: "input_required"` rejects with `MCPInputRequiredError`. MRTR is not implemented yet.
  - JSON-RPC errors reject with `MCPProtocolError`, which keeps the numeric `code`.
  - Fixed: stdio stderr no longer emits `error`. It emits `stderr`. Unlistened stderr lines used to throw.
  - Fixed: `getServerInfo()` returns a flat `{ name, version, protocolVersion, capabilities }` on the legacy path too.
  - Fixed: request timers are cleared when a response arrives, so they no longer keep the process alive.

  Not yet implemented: OAuth authorization, subscriptions, server-side MRTR, and the deprecated Roots and Sampling features.

- MCP: timed-out requests are cancelled, and Streamable HTTP carries 2025-03-26 session ids.

  - A request that times out rejects with `MCPTimeoutError` and is cancelled. `initialize` is never cancelled. Streamable HTTP aborts the HTTP request. Every transport sends `notifications/cancelled`, with the version metadata for modern servers.
  - `requestTimeoutMs` on the server config sets the wait, which defaults to 30 seconds.
  - Over `transport: 'http'`, a server that answers `server/discover` with an error falls back to the legacy `initialize` handshake. An unsupported-version error does not fall back. A probe that times out fails the connection after 15 seconds, or after `requestTimeoutMs` when that is longer.
  - The transport sends back the `Mcp-Session-Id` a server assigns, and the negotiated `MCP-Protocol-Version`. It sends a best-effort `DELETE` on disconnect, bounded to 2 seconds.
  - Not yet implemented: re-initializing after a session expires. After a 404 the next request fails until you reconnect.

### Patch Changes

- MCP: a connection that drops during the legacy `initialize` handshake now fails `connect()` with `MCP connection closed during the initialize handshake`, instead of a `TypeError`.
- MCP: a disconnect during the legacy `initialize` handshake fails with a clear error, not a `TypeError`.

  - `initialize()` reads the transport once after the response. If `disconnect()` ran in between, it throws `MCP connection closed during the initialize handshake`.
  - Probe tests cover a disconnect between the initialize response and `notifications/initialized`, and reconnect on the modern path, which closes the old transport, fails waiting calls with `Client disconnected`, and emits no `disconnect` event.

## 1.2.1

- Bump for monorepo version consistency.

## 1.2.0

- Bump for monorepo version consistency.

## 1.1.1

### Patch Changes

- @lov3kaizen/agentsea-types@1.1.1

## 0.6.0

### Minor Changes

- feat: enable cli coding with commercial coding agents and local models

### Patch Changes

- 95777d7: release v0.5.1 packages
- Updated dependencies
- Updated dependencies [95777d7]
  - @lov3kaizen/agentsea-types@0.6.0

## 0.4.0

### Minor Changes

- b1a6ea1: Add model type safety, and new hooks useChat + useAgent

### Patch Changes

- Updated dependencies [b1a6ea1]
  - @lov3kaizen/agentsea-types@0.4.0

## 0.3.1

### Patch Changes

- Adds LemonFox STT/TTS Support. Also extends OpenAI provider to support custom baseUrl.
- Updated dependencies
  - @lov3kaizen/agentsea-types@0.3.1

## 0.1.0

### Initial Release

- Agent framework with multi-provider support (Anthropic, OpenAI, Google, Ollama)
- Tool system with Zod schema validation
- MCP (Model Context Protocol) integration
- Memory management (buffer, sliding window)
- Multi-tenancy support
- Workflow orchestration (sequential, parallel, supervisor patterns)
- Built-in tools: Figma, n8n integration
- Observability and logging
- Content formatting (text, markdown, HTML, React)

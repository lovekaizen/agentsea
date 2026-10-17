# MCP version negotiation matrix

How `MCPClient` in `packages/core/src/mcp` behaves against each kind of server.
Each row is asserted by `packages/core/src/mcp/__tests__/version-drift.test.ts`.

## Versions

| Name   | Version string | Path in the client                                             |
| ------ | -------------- | -------------------------------------------------------------- |
| Legacy | `2024-11-05`   | `initialize` handshake, then `notifications/initialized`       |
| Modern | `2026-07-28`   | `server/discover` probe; requests carry the version in `_meta` |

A client with `transport: 'stdio'` or `'http'` tries modern first. A client with
`transport: 'sse'` is legacy-only: the deprecated SSE transport never sends
`server/discover`.

## Matrix

| #   | Client         | Server                                                                | Outcome                                                                                                                                                                                                                                                                                      | Wire trail (client → server)                                                     |
| --- | -------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Modern         | Legacy 2024-11-05                                                     | Connects on the legacy path. `protocolVersion` is `2024-11-05`. Later requests carry no 2026 version in `_meta`.                                                                                                                                                                             | `server/discover` (refused: `-32601`), `initialize`, `notifications/initialized` |
| 2   | Modern         | Modern-only 2026-07-28                                                | Connects on the modern path. Every request after discover carries `_meta` with `2026-07-28`.                                                                                                                                                                                                 | `server/discover`                                                                |
| 3   | Modern         | Offers no `2026-07-28` (e.g. only `2027-01-01`, or only `2024-11-05`) | Fails: `MCP server does not support 2026-07-28 (offers: …)`. Does not fall back to `initialize`, even when the server offers `2024-11-05`. This is the chosen policy: a discover reply that omits 2026-07-28 is a refusal.                                                                   | `server/discover`                                                                |
| 4   | Legacy (`sse`) | Legacy 2024-11-05                                                     | Connects.                                                                                                                                                                                                                                                                                    | `initialize`, `notifications/initialized`                                        |
| 5   | Legacy (`sse`) | Modern-only 2026-07-28                                                | Fails with the server's unsupported-version error: code `-32022`, `data.supported` = `["2026-07-28"]`, `data.requested` = `2024-11-05`. The message is `MCP Error: Unsupported protocol version (-32022)`; the list is only in `error.data`. The client tears down and holds no server info. | `initialize`                                                                     |
| 6   | Modern         | Legacy 2024-11-05 that refuses discover with `-32022`                 | Fails with `-32022`. Does not fall back to `initialize`, though the server would accept it. The client holds no server info.                                                                                                                                                                 | `server/discover`                                                                |

Row 6 is a server that refuses discover with an error the client treats as a
modern-only signal. It is a test scenario, not a server the fakes model
elsewhere.

## Reading the rows

- **Row 1 is the drift that matters most.** A modern client must not assume the
  server speaks 2026-07-28. Refusal of `server/discover` by method-not-found is the
  signal to fall back. Errors in `MODERN_ERROR_CODES` (`client.ts`) are rethrown,
  so a `-32022` from discover is reported rather than retried on the legacy path
  (row 6). Other discover errors fall back to `initialize`.
- **Row 5 is the failure a legacy client must see.** It fails at the handshake with
  a code, and the server's supported list in `error.data`, rather than hanging or
  returning garbage.
- **Row 3 is a negotiation failure.** The server answers discover, so the client
  knows the server is modern and that it cannot speak the offered version. It does
  not then try the legacy handshake. This includes a server that offers only
  `2024-11-05`: the client refuses it rather than dropping to `initialize`. The
  refusal is pinned by a test, and it is a policy choice, not a spec requirement
  that has been checked.

## Streamable HTTP fallback rule

When a modern client connects over Streamable HTTP, a discover failure falls back
to `initialize` only if it is evidence of a legacy server (`client.ts`, discover):

| Discover failure over HTTP           | Outcome                                                              | Tested                                                           |
| ------------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| JSON-RPC error (e.g. `-32601`)       | Falls back to `initialize`.                                          | Yes                                                              |
| HTTP 400, 404 or 405                 | Falls back to `initialize`.                                          | Yes                                                              |
| HTTP 500 or 503                      | Reported as `MCPHttpError`, no fallback.                             | Yes                                                              |
| Network failure (no status)          | Reported, no fallback.                                               | Yes                                                              |
| No reply before the discover timeout | Reported as "did not answer server/discover within …s", no fallback. | No, by reading only (`client.ts`, the `MCPTimeoutError` branch). |

The fakes reach these cases through `transportFailure`, which makes the wire throw
the error from `send()`. That is how the HTTP transport reports a non-2xx status.

## What the fakes model, and what they do not

The fakes are `FakeMCPServer` in `__tests__/support/fake-servers.ts`.

- **Assumed, not checked.** The `-32022` code and the `data.supported` shape are
  taken from the spec description as the author read it. They have not been
  checked against a real server or against the spec text. A web search for the
  2026-07-28 spec found a draft lifecycle page that gives `-32004` for this error,
  so the code value is unresolved. No spec section is cited here because none has
  been confirmed. Row 5 and row 6 depend on this value.
- A modern-only server answers `server/discover`. A legacy server does not, and
  answers method-not-found.
- **Fixed version.** The legacy fake always answers `initialize` with
  `2024-11-05`, whatever version the client requested. It does not negotiate.

The fakes replace the transport. They do not exercise HTTP framing, SSE
streaming, or stdio process handling. Those are covered by `streamable-http.test.ts`
and `stdio-env.test.ts`. No real MCP server was tested here, so the matrix does
not show how third-party servers answer in practice.

## Mutation check

Each mutation below was applied to `client.ts`, run against
`version-drift.test.ts`, and reverted.

| Mutation (`client.ts`)                                                     | Before the new tests   | After the new tests                        |
| -------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ |
| `UNSUPPORTED_PROTOCOL_VERSION` changed to `-32023` (line 28)               | 7 of 7 pass (survives) | 1 fails (row 6)                            |
| `UNSUPPORTED_PROTOCOL_VERSION` removed from `MODERN_ERROR_CODES` (line 42) | 7 of 7 pass (survives) | 1 fails (row 6)                            |
| HTTP 404 removed from the legacy statuses (line 259)                       | not run                | 1 fails                                    |
| Every HTTP error treated as legacy (line 261)                              | not run                | 3 fail                                     |
| `-32601` added to `MODERN_ERROR_CODES` (line 42)                           | not run                | 3 fail (row 1, and the HTTP JSON-RPC case) |

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

| #   | Client         | Server                   | Outcome                                                                                                                                                                                 | Wire trail (client → server)                                                     |
| --- | -------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Modern         | Legacy 2024-11-05        | Connects on the legacy path. `protocolVersion` is `2024-11-05`. Later requests carry no 2026 version in `_meta`.                                                                        | `server/discover` (refused: `-32601`), `initialize`, `notifications/initialized` |
| 2   | Modern         | Modern-only 2026-07-28   | Connects on the modern path. Every request after discover carries `_meta` with `2026-07-28`.                                                                                            | `server/discover`                                                                |
| 3   | Modern         | Offers only `2027-01-01` | Fails: `MCP server does not support 2026-07-28 (offers: 2027-01-01)`. Does not fall back to `initialize`.                                                                               | `server/discover`                                                                |
| 4   | Legacy (`sse`) | Legacy 2024-11-05        | Connects.                                                                                                                                                                               | `initialize`, `notifications/initialized`                                        |
| 5   | Legacy (`sse`) | Modern-only 2026-07-28   | Fails with the server's unsupported-version error: code `-32022`, `data.supported` = `["2026-07-28"]`, `data.requested` = `2024-11-05`. The client tears down and holds no server info. | `initialize`                                                                     |

## Reading the rows

- **Row 1 is the drift that matters most.** A modern client must not assume the
  server speaks 2026-07-28. Refusal of `server/discover` by method-not-found is the
  signal to fall back. Errors in `MODERN_ERROR_CODES` (`client.ts`) are rethrown,
  so a `-32022` from discover is reported rather than retried on the legacy path.
  Other discover errors fall back to `initialize`. Over Streamable HTTP only a
  JSON-RPC error, or a 400, 404 or 405 status, does; a 5xx or a network failure
  is reported instead, so it cannot pin the connection to the legacy path.
- **Row 5 is the failure a legacy client must see.** It fails at the handshake with
  a code and the server's supported list, rather than hanging or returning
  garbage.
- **Row 3 is a negotiation failure.** The server answers discover, so the client
  knows the server is modern and that it cannot speak the offered version. It does
  not then try the legacy handshake.

## What the fakes model, and what they do not

The fakes are `FakeMCPServer` in `__tests__/support/fake-servers.ts`. They follow
the behaviour the MCP spec describes for the cases above:

- A server that does not serve a version answers with `-32022` and lists the
  versions it does serve under `data.supported`.
- A modern server implements `server/discover`. A legacy server does not, so it
  answers method-not-found.

The fakes replace the transport. They do not exercise HTTP framing, SSE
streaming, or stdio process handling. Those are covered by `streamable-http.test.ts`
and `stdio-env.test.ts`. No real MCP server was tested here, so the matrix does
not show how third-party servers answer in practice.

## Mutation check

Adding `-32601` to `MODERN_ERROR_CODES` makes row 1 fail, so the fallback tests
detect a regression of the legacy fallback.

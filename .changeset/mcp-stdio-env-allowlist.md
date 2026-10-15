---
'@lov3kaizen/agentsea-core': minor
---

**Behaviour change:** MCP stdio servers no longer inherit the parent process environment. They now receive only HOME, LOGNAME, PATH, SHELL, TERM and USER (plus a short Windows set), any parent variables named in the new `passEnv` option, and the explicit `env` map. Provider API keys and other secrets in the parent environment are no longer visible to MCP server processes.

If a server relied on an inherited variable, name it: `passEnv: ['HTTPS_PROXY']` on the server config (or `env: { KEY: '...' }`). For one minor release, `inheritFullEnv: true` restores the old behaviour and emits a deprecation warning; it will be removed in a later release. Adds `buildStdioEnv` and `StdioEnvOptions` exports.

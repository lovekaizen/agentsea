---
'@lov3kaizen/agentsea-core': major
---

**Breaking:** MCP stdio servers no longer inherit the parent process environment. They now receive only a default allow-list (HOME, LOGNAME, PATH, SHELL, TERM, USER, TMPDIR, LANG, LC_ALL, HTTP_PROXY, HTTPS_PROXY, NO_PROXY, ALL_PROXY and their lowercase forms, NODE_EXTRA_CA_CERTS, SSL_CERT_FILE, REQUESTS_CA_BUNDLE, CURL_CA_BUNDLE, plus a short Windows set), any parent variables named in the new `passEnv` option, and the explicit `env` map. Provider API keys and other secrets in the parent environment are no longer visible to MCP server processes.

If a server relied on an inherited variable, name it: `passEnv: ['GITHUB_TOKEN']` on the server config (or `env: { KEY: '...' }`). `passEnv` must be an array; a string throws a `TypeError`. For the 2.x line, `inheritFullEnv: true` restores the old behaviour and emits a deprecation warning; it will be removed in a later major release.

Adds `buildStdioEnv` and `StdioEnvOptions` exports.

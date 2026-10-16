import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { MCPMessage } from './types';

/**
 * Base transport interface for MCP communication
 */
export interface MCPTransport extends EventEmitter {
  connect(): Promise<void>;
  /**
   * Send one message. `headers` are extra HTTP headers for transports that
   * have them (Streamable HTTP); other transports ignore them. A returned
   * promise that rejects fails the request that was sent.
   */
  send(
    message: MCPMessage,
    headers?: Record<string, string>,
  ): void | Promise<void>;
  /** Abort the in-flight request with this id, if the transport can. */
  cancel?(id: string | number): void;
  close(): void;
  isConnected(): boolean;
}

/**
 * Environment variables a stdio server inherits from the parent by default.
 * Enough to locate, start and reach the network through a corporate proxy
 * with a private CA. None of these is a provider API key or token. Proxy URLs
 * can still embed `user:password`, so treat them as sensitive to your setup.
 */
const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
  'HOME',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TERM',
  'USER',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE',
  'ALL_PROXY',
  'all_proxy',
];

/** Extra names Windows programs need to start. Not exercised on Windows in CI. */
const WINDOWS_ENV_ALLOWLIST: readonly string[] = [
  'APPDATA',
  'COMSPEC',
  'LOCALAPPDATA',
  'PATHEXT',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'USERPROFILE',
];

export interface StdioEnvOptions {
  /**
   * Names of parent environment variables to pass through in addition to the
   * default allow-list (for example `HTTPS_PROXY`, or one specific API key the
   * server needs). Anything not named here or in `env` is not inherited.
   */
  passEnv?: string[];
  /**
   * Restore the previous behaviour: the server inherits the whole parent
   * environment, including provider API keys.
   *
   * @deprecated Escape hatch for the 2.x line while callers move to `passEnv`
   * and `env`. It will be removed in a later major release.
   */
  inheritFullEnv?: boolean;
}

/**
 * Build the environment for a stdio server. Pure: pass the parent environment
 * in. Precedence, lowest to highest: allow-listed parent variables, variables
 * named in `passEnv`, then the explicit `env` map.
 */
export function buildStdioEnv(
  parent: NodeJS.ProcessEnv,
  explicit: Record<string, string> = {},
  options: StdioEnvOptions = {},
  platform: NodeJS.Platform = process.platform,
): Record<string, string> {
  // Untyped config (JSON or YAML) can send strings or nulls where the type says
  // boolean or array. Only the literal `true` opts in to full inheritance, so
  // `"false"` cannot re-enable the leak. `null` means absent.
  const windows = platform === 'win32';
  const vars = explicit ?? {};
  if (options.inheritFullEnv === true) {
    const all: Record<string, string> = {};
    for (const [k, v] of Object.entries(parent)) {
      if (v !== undefined) all[k] = v;
    }
    return { ...all, ...vars };
  }

  const passEnv = options.passEnv ?? undefined;
  // A string here would spread into single characters and drop the variable.
  if (passEnv !== undefined && !Array.isArray(passEnv)) {
    throw new TypeError(
      'passEnv must be an array of environment variable names',
    );
  }

  // Windows environment names are case-insensitive; elsewhere they are exact.
  const fold = (name: string): string => (windows ? name.toUpperCase() : name);
  const names = [
    ...DEFAULT_ENV_ALLOWLIST,
    ...(windows ? WINDOWS_ENV_ALLOWLIST : []),
    ...(passEnv ?? []),
  ];
  const wanted = new Set(names.map(fold));

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(parent)) {
    if (v === undefined) continue;
    if (wanted.has(fold(k))) env[k] = v;
  }

  // An explicit `PATH` must replace a parent `Path`, not sit beside it.
  const explicitFolded = new Set(Object.keys(vars).map(fold));
  for (const k of Object.keys(env)) {
    if (explicitFolded.has(fold(k))) delete env[k];
  }
  return { ...env, ...vars };
}

let warnedFullEnv = false;

/**
 * STDIO transport for MCP servers
 *
 * The server process does not inherit the parent environment. See
 * {@link buildStdioEnv} and {@link StdioEnvOptions}.
 */
export class StdioTransport extends EventEmitter implements MCPTransport {
  private process: ChildProcess | null = null;
  private connected = false;
  private buffer = '';

  constructor(
    private command: string,
    private args: string[] = [],
    private env?: Record<string, string>,
    private envOptions: StdioEnvOptions = {},
  ) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.envOptions.inheritFullEnv === true && !warnedFullEnv) {
          warnedFullEnv = true;
          process.emitWarning(
            'MCP stdio servers inherit the full parent environment, including API keys. Use passEnv or env instead; inheritFullEnv will be removed.',
            'DeprecationWarning',
            'AGENTSEA_MCP_INHERIT_FULL_ENV',
          );
        }

        this.process = spawn(this.command, this.args, {
          env: buildStdioEnv(process.env, this.env, this.envOptions),
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        // stderr is free-form logging, not an error signal (2026-07-28 stdio
        // spec). Emitting it as 'error' made any unlistened stderr line throw.
        this.process.stderr?.on('data', (data: Buffer) => {
          this.emit('stderr', data.toString());
        });

        this.process.on('error', (error) => {
          this.connected = false;
          this.emit('error', error);
          reject(error);
        });

        this.process.on('exit', (code) => {
          this.connected = false;
          this.emit('disconnect', code);
        });

        this.connected = true;
        this.emit('connect');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: MCPMessage): void {
    if (!this.connected || !this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    const json = JSON.stringify(message) + '\n';
    this.process.stdin.write(json);
  }

  close(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private handleData(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as MCPMessage;
          this.emit('message', message);
        } catch (error) {
          this.emit('error', new Error(`Failed to parse message: ${line}`));
        }
      }
    }
  }
}

/**
 * SSE (Server-Sent Events) transport for MCP servers
 */
export class SSETransport extends EventEmitter implements MCPTransport {
  private eventSource: EventSource | null = null;
  private connected = false;

  constructor(private url: string) {
    super();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Note: EventSource is not available in Node.js by default
        // You would need to use a polyfill like 'eventsource' package
        if (typeof EventSource === 'undefined') {
          throw new Error(
            'EventSource not available. Install eventsource package for Node.js support.',
          );
        }

        this.eventSource = new EventSource(this.url);

        this.eventSource.onopen = () => {
          this.connected = true;
          this.emit('connect');
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as MCPMessage;
            this.emit('message', message);
          } catch (error) {
            this.emit('error', new Error('Failed to parse SSE message'));
          }
        };

        this.eventSource.onerror = (error) => {
          this.connected = false;
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  async send(message: MCPMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    // For SSE, we typically need to make HTTP POST requests
    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

const BASE64_PREFIX = '=?base64?';
const BASE64_SUFFIX = '?=';

/**
 * Encode a value for an HTTP header, per the Streamable HTTP "Value Encoding"
 * rules: visible ASCII with inner spaces passes through; anything else (or a
 * value that looks like the sentinel itself) is Base64 of its UTF-8 bytes.
 */
export function encodeHeaderValue(value: string): string {
  const plain = /^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(value);
  const looksEncoded =
    value.startsWith(BASE64_PREFIX) && value.endsWith(BASE64_SUFFIX);
  if (plain && !looksEncoded) return value;
  return `${BASE64_PREFIX}${Buffer.from(value, 'utf8').toString('base64')}${BASE64_SUFFIX}`;
}

/** Methods whose `Mcp-Name` header comes from `params.name` or `params.uri`. */
const NAME_FROM_PARAMS_NAME = new Set(['tools/call', 'prompts/get']);

/**
 * Standard request headers mirrored from the JSON-RPC body: protocol version,
 * method, and (for named operations) the target name.
 */
export function mcpRequestHeaders(message: MCPMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  const params = (message.params ?? {}) as Record<string, unknown>;
  const meta = params._meta as Record<string, unknown> | undefined;
  const version = meta?.['io.modelcontextprotocol/protocolVersion'];
  if (typeof version === 'string') headers['MCP-Protocol-Version'] = version;
  if (message.method) headers['Mcp-Method'] = message.method;

  let name: unknown;
  if (message.method === 'resources/read') name = params.uri;
  else if (message.method && NAME_FROM_PARAMS_NAME.has(message.method)) {
    name = params.name;
  }
  if (typeof name === 'string') headers['Mcp-Name'] = encodeHeaderValue(name);
  return headers;
}

const TCHAR = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const PRIMITIVE_TYPES = new Set(['string', 'integer', 'boolean']);

interface HeaderParam {
  header: string;
  path: string[];
  eligible: boolean;
}

/** Collect `x-mcp-header` properties reachable through `properties` only. */
function collectHeaderParams(
  schema: Record<string, unknown>,
  path: string[],
  out: HeaderParam[],
): void {
  const props = schema.properties as Record<string, Record<string, unknown>>;
  if (!props || typeof props !== 'object') return;
  for (const [name, prop] of Object.entries(props)) {
    if (!prop || typeof prop !== 'object') continue;
    if (typeof prop['x-mcp-header'] === 'string') {
      out.push({
        header: prop['x-mcp-header'],
        path: [...path, name],
        eligible: isHeaderEligibleType(prop),
      });
    }
    if (prop.properties) collectHeaderParams(prop, [...path, name], out);
  }
}

function countXMcpHeader(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce<number>((n, v) => n + countXMcpHeader(v), 0);
  }
  if (value && typeof value === 'object') {
    let n = 0;
    for (const [k, v] of Object.entries(value)) {
      if (k === 'x-mcp-header') n += 1;
      n += countXMcpHeader(v);
    }
    return n;
  }
  return 0;
}

/**
 * Check a tool's `x-mcp-header` annotations against the Streamable HTTP rules.
 * Returns the first problem, or null when the tool may be listed.
 */
export function invalidMcpHeaderAnnotation(
  inputSchema: Record<string, unknown>,
): string | null {
  const reachable: HeaderParam[] = [];
  collectHeaderParams(inputSchema, [], reachable);
  // An annotation anywhere the static walk cannot reach makes the tool invalid.
  if (countXMcpHeader(inputSchema) !== reachable.length) {
    return 'x-mcp-header is only allowed on statically reachable properties';
  }
  const seen = new Set<string>();
  for (const { header, eligible } of reachable) {
    if (!eligible) {
      return `x-mcp-header "${header}" must be a string, integer or boolean`;
    }
    if (!TCHAR.test(header)) return `invalid header name "${header}"`;
    const key = header.toLowerCase();
    if (seen.has(key)) return `duplicate header name "${header}"`;
    seen.add(key);
  }
  return null;
}

/**
 * Build `Mcp-Param-*` headers for the arguments of one tool call. Absent or
 * null values produce no header. A value outside JavaScript's safe integer
 * range throws rather than sending a rounded number.
 */
export function mcpParamHeaders(
  inputSchema: Record<string, unknown>,
  args: Record<string, unknown> = {},
): Record<string, string> {
  const headers: Record<string, string> = {};
  const reachable: HeaderParam[] = [];
  collectHeaderParams(inputSchema, [], reachable);

  for (const { header, path } of reachable) {
    let value: unknown = args;
    for (const key of path) {
      value = (value as Record<string, unknown> | undefined)?.[key];
    }
    if (value === undefined || value === null) continue;
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      throw new RangeError(
        `x-mcp-header value for "${header}" is not a safe integer`,
      );
    }
    headers[`Mcp-Param-${header}`] = encodeHeaderValue(String(value));
  }
  return headers;
}

/** True when a property's declared type can be mirrored into a header. */
export function isHeaderEligibleType(prop: Record<string, unknown>): boolean {
  return typeof prop.type === 'string' && PRIMITIVE_TYPES.has(prop.type);
}

/**
 * Streamable HTTP transport (protocol 2026-07-28). Each JSON-RPC message is its
 * own POST to one endpoint. The response is either one JSON body or an SSE
 * stream scoped to that request. A session id is sent only when a 2025-03-26
 * server assigns one. There is no resumption.
 */
export class StreamableHTTPTransport
  extends EventEmitter
  implements MCPTransport
{
  private connected = false;
  /**
   * Every POST still in flight. Requests are keyed by JSON-RPC id, so cancel()
   * can find them. Notifications get a private key, so close() aborts them too.
   */
  private inFlight = new Map<string | number, AbortController>();
  private postSeq = 0;
  /** Set when a 2025-03-26 server assigns `Mcp-Session-Id`. */
  private sessionId?: string;

  constructor(
    private url: string,
    private fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  /**
   * Cancel the request with this id by aborting its HTTP request. On
   * Streamable HTTP, closing the response stream is the cancel signal.
   */
  cancel(id: string | number): void {
    const controller = this.inFlight.get(id);
    if (!controller) return;
    this.inFlight.delete(id);
    controller.abort();
  }

  connect(): Promise<void> {
    if (!/^https?:\/\//i.test(this.url)) {
      return Promise.reject(new Error('Streamable HTTP needs an http(s) URL'));
    }
    this.connected = true;
    this.emit('connect');
    return Promise.resolve();
  }

  async send(
    message: MCPMessage,
    headers: Record<string, string> = {},
  ): Promise<void> {
    if (!this.connected) throw new Error('Transport not connected');

    const controller = new AbortController();
    const key = message.id ?? `notification:${++this.postSeq}`;
    this.inFlight.set(key, controller);
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          ...this.sessionHeaders(),
          ...mcpRequestHeaders(message),
          ...headers,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      const assigned = response.headers.get('mcp-session-id');
      if (assigned) this.sessionId = assigned;

      // Notifications get a bare 202; nothing to correlate.
      if (message.id === undefined) {
        if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream')) {
        await this.readEventStream(response);
        return;
      }

      // A JSON-RPC error body with an id is a real answer, even on 4xx.
      const text = await response.text();
      let parsed: MCPMessage | undefined;
      try {
        parsed = JSON.parse(text) as MCPMessage;
      } catch {
        parsed = undefined;
      }
      if (!parsed || (!response.ok && parsed.id === undefined)) {
        throw new Error(`MCP HTTP ${response.status}`);
      }
      this.emit('message', parsed);
    } finally {
      if (this.inFlight.get(key) === controller) {
        this.inFlight.delete(key);
      }
    }
  }

  private async readEventStream(response: Response): Promise<void> {
    if (!response.body) throw new Error('Empty event stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let cursor = 0; // where the next unread event starts
    const boundary = /\r?\n\r?\n/g;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      boundary.lastIndex = cursor;
      let match: RegExpExecArray | null;
      while ((match = boundary.exec(buffer)) !== null) {
        this.dispatchEvent(buffer.slice(cursor, match.index));
        cursor = match.index + match[0].length;
      }
      // One slice per chunk keeps this linear, not quadratic.
      buffer = buffer.slice(cursor);
      cursor = 0;
    }
    buffer += decoder.decode();
    if (buffer.trim()) this.dispatchEvent(buffer);
  }

  private dispatchEvent(raw: string): void {
    // Lines starting with ':' are keep-alive comments and are ignored.
    const data = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) return;
    let message: MCPMessage;
    try {
      message = JSON.parse(data) as MCPMessage;
    } catch {
      // A malformed event is skipped. The rest of the stream, including the
      // real response, still counts.
      return;
    }
    this.emit('message', message);
  }

  /** The session header, once a 2025-03-26 server has assigned one. */
  private sessionHeaders(): Record<string, string> {
    return this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {};
  }

  close(): void {
    for (const controller of this.inFlight.values()) controller.abort();
    this.inFlight.clear();
    if (this.sessionId) {
      // Best effort, and bounded so a hung server cannot hold the process open.
      const headers = this.sessionHeaders();
      this.sessionId = undefined;
      this.fetchImpl(this.url, {
        method: 'DELETE',
        headers,
        signal: AbortSignal.timeout(2_000),
      }).catch(() => undefined);
    }
    if (this.connected) {
      this.connected = false;
      this.emit('disconnect');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

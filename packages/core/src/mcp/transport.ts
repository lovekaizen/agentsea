import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { MCPMessage } from './types';

/**
 * Base transport interface for MCP communication
 */
export interface MCPTransport extends EventEmitter {
  connect(): Promise<void>;
  send(message: MCPMessage): void;
  close(): void;
  isConnected(): boolean;
}

/**
 * Environment variables a stdio server inherits from the parent by default.
 * Enough to locate and start a program; nothing that is a credential.
 */
const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
  'HOME',
  'LOGNAME',
  'PATH',
  'SHELL',
  'TERM',
  'USER',
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
   * @deprecated Escape hatch for one minor release while callers move to
   * `passEnv` and `env`. It will be removed in a later release.
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
  if (options.inheritFullEnv) {
    const all: Record<string, string> = {};
    for (const [k, v] of Object.entries(parent)) {
      if (v !== undefined) all[k] = v;
    }
    return { ...all, ...explicit };
  }

  const windows = platform === 'win32';
  const names = [
    ...DEFAULT_ENV_ALLOWLIST,
    ...(windows ? WINDOWS_ENV_ALLOWLIST : []),
    ...(options.passEnv ?? []),
  ];
  // Windows environment names are case-insensitive.
  const wanted = new Set(windows ? names.map((n) => n.toUpperCase()) : names);

  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(parent)) {
    if (v === undefined) continue;
    if (wanted.has(windows ? k.toUpperCase() : k)) env[k] = v;
  }
  return { ...env, ...explicit };
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
        if (this.envOptions.inheritFullEnv && !warnedFullEnv) {
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

        this.process.stderr?.on('data', (data: Buffer) => {
          this.emit('error', new Error(data.toString()));
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

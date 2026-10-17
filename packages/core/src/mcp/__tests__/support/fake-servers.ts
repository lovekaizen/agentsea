import { EventEmitter } from 'events';

import type { MCPTransport } from '../../transport';
import {
  MCPMessage,
  MCP_LEGACY_PROTOCOL_VERSION,
  MCP_PROTOCOL_VERSION,
} from '../../types';

/** JSON-RPC: the server does not know this method. */
const METHOD_NOT_FOUND = -32601;
/**
 * MCP: the server does not serve the protocol version the client asked for.
 * The code and the `data.supported` shape are assumed from the spec description.
 * They have not been checked against a real server or the spec text.
 */
const UNSUPPORTED_PROTOCOL_VERSION = -32022;

/**
 * How a fake server behaves on the wire.
 *
 * - `legacy-2024-11-05`: a server from before server/discover existed. It
 *   answers `initialize` and nothing newer, and refuses `server/discover` with
 *   method-not-found.
 * - `modern-2026-07-28-only`: a server that serves only 2026-07-28. It answers
 *   `server/discover`, and refuses `initialize` and any request whose `_meta`
 *   does not name 2026-07-28 with -32022, listing what it does support.
 */
export type ServerProfile = 'legacy-2024-11-05' | 'modern-2026-07-28-only';

export interface FakeServerOptions {
  name?: string;
  tools?: Array<{ name: string }>;
  /** Overrides what server/discover advertises, for negotiation tests. */
  supportedVersions?: string[];
  /** Makes server/discover fail with this JSON-RPC error instead of answering. */
  discoverError?: { code: number; message: string; data?: unknown };
  /**
   * Makes the wire fail before the server answers: the returned error is thrown
   * from send(), as the HTTP transport does for a non-2xx status. The message is
   * still recorded in `received`, because the request left the client.
   */
  transportFailure?: (message: MCPMessage) => Error | null;
}

/**
 * A scripted MCP server. It is reached through `FakeWireTransport`, which
 * stands in for a real transport: the client sends, the server replies, and
 * every message in either direction is recorded.
 */
export class FakeMCPServer {
  /** Every message the client sent, in order. */
  readonly received: MCPMessage[] = [];
  readonly name: string;
  readonly tools: Array<{ name: string }>;

  constructor(
    readonly profile: ServerProfile,
    private readonly options: FakeServerOptions = {},
  ) {
    this.name = options.name ?? `fake-${profile}`;
    this.tools = options.tools ?? [{ name: 'echo' }];
  }

  /** The versions this server serves, as the client sees them. */
  get servedVersions(): string[] {
    if (this.options.supportedVersions) return this.options.supportedVersions;
    return this.profile === 'legacy-2024-11-05'
      ? [MCP_LEGACY_PROTOCOL_VERSION]
      : [MCP_PROTOCOL_VERSION];
  }

  /** Reply to one client message. `null` means no reply (a notification). */
  handle(message: MCPMessage): MCPMessage | null {
    this.received.push(message);
    if (message.id === undefined) return null;

    const id = message.id;
    const ok = (result: unknown): MCPMessage => ({
      jsonrpc: '2.0',
      id,
      result,
    });
    const fail = (code: number, text: string, data?: unknown): MCPMessage => ({
      jsonrpc: '2.0',
      id,
      error: { code, message: text, data },
    });

    switch (message.method) {
      case 'server/discover':
        if (this.options.discoverError) {
          const { code, message: text, data } = this.options.discoverError;
          return fail(code, text, data);
        }
        if (this.profile === 'legacy-2024-11-05') {
          return fail(METHOD_NOT_FOUND, 'Method not found');
        }
        return ok({
          supportedVersions: this.servedVersions,
          serverInfo: { name: this.name, version: '1.0.0' },
          capabilities: { tools: {} },
        });

      case 'initialize': {
        const requested = (message.params as { protocolVersion?: string })
          ?.protocolVersion;
        if (this.profile === 'modern-2026-07-28-only') {
          return fail(
            UNSUPPORTED_PROTOCOL_VERSION,
            'Unsupported protocol version',
            {
              supported: this.servedVersions,
              requested,
            },
          );
        }
        // Always answers 2024-11-05, whatever version the client requested.
        // This fake does not negotiate.
        return ok({
          protocolVersion: MCP_LEGACY_PROTOCOL_VERSION,
          serverInfo: { name: this.name, version: '1.0.0' },
          capabilities: { tools: {} },
        });
      }

      case 'tools/list':
        if (!this.acceptsModernRequest(message)) {
          return this.unsupportedVersion(id, message);
        }
        return ok({ tools: this.tools });

      default:
        if (!this.acceptsModernRequest(message)) {
          return this.unsupportedVersion(id, message);
        }
        return fail(METHOD_NOT_FOUND, `Unknown method ${message.method}`);
    }
  }

  /** The error the wire should fail with for this message, if any. */
  transportFailureFor(message: MCPMessage): Error | null {
    return this.options.transportFailure?.(message) ?? null;
  }

  /**
   * A modern-only server needs every request to name its version in `_meta`.
   * A legacy server ignores `_meta` and takes requests as they come.
   */
  private acceptsModernRequest(message: MCPMessage): boolean {
    if (this.profile === 'legacy-2024-11-05') return true;
    const meta = (
      message.params as { _meta?: Record<string, unknown> } | undefined
    )?._meta;
    return (
      meta?.['io.modelcontextprotocol/protocolVersion'] === MCP_PROTOCOL_VERSION
    );
  }

  private unsupportedVersion(
    id: string | number,
    message: MCPMessage,
  ): MCPMessage {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: UNSUPPORTED_PROTOCOL_VERSION,
        message: `Unsupported protocol version for ${message.method}`,
        data: { supported: this.servedVersions },
      },
    };
  }
}

/**
 * A transport bound to one FakeMCPServer. `send` hands the message to the
 * server and delivers its reply asynchronously, as a real wire would.
 */
export class FakeWireTransport extends EventEmitter implements MCPTransport {
  /** Every message sent through this transport, with the headers it carried. */
  readonly sent: Array<{
    message: MCPMessage;
    headers?: Record<string, string>;
  }> = [];
  private connected = false;
  readonly cancelled: Array<string | number> = [];

  constructor(readonly server: FakeMCPServer) {
    super();
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  send(message: MCPMessage, headers?: Record<string, string>): void {
    if (!this.connected) throw new Error('not connected');
    this.sent.push({ message, headers });
    const failure = this.server.transportFailureFor(message);
    if (failure) {
      this.server.received.push(message);
      throw failure;
    }
    const reply = this.server.handle(message);
    if (reply) queueMicrotask(() => this.emit('message', reply));
  }

  cancel(id: string | number): void {
    this.cancelled.push(id);
  }

  close(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Hands out transports for a test. A test sets the server it wants, and every
 * transport the client creates after that talks to that server.
 */
export class FakeNetwork {
  private server: FakeMCPServer | null = null;
  readonly transports: FakeWireTransport[] = [];

  use(server: FakeMCPServer): this {
    this.server = server;
    return this;
  }

  /** Called by the mocked transport constructors. */
  createTransport(): FakeWireTransport {
    if (!this.server) throw new Error('FakeNetwork: no server selected');
    const transport = new FakeWireTransport(this.server);
    this.transports.push(transport);
    return transport;
  }

  reset(): void {
    this.server = null;
    this.transports.length = 0;
  }
}

/** The one network the drift tests share with the mocked transport constructors. */
export const network = new FakeNetwork();

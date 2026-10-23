import { EventEmitter } from 'events';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { MCPClient } from '../client';
import { MCPServerConfig } from '../types';

const MODERN = '2026-07-28';

// Each transport the client creates is taken from this factory, so a test can
// hand the client a specific fake for each connect().
const factory = vi.hoisted(() => ({ create: (): unknown => undefined }));

vi.mock('../transport', () => ({
  StdioTransport: vi.fn().mockImplementation(() => factory.create()),
  SSETransport: vi.fn().mockImplementation(() => factory.create()),
  StreamableHTTPTransport: vi.fn().mockImplementation(() => factory.create()),
  MCPHttpError: class MCPHttpError extends Error {
    constructor(readonly status: number) {
      super(`MCP HTTP ${status}`);
    }
  },
  invalidMcpHeaderAnnotation: () => undefined,
  mcpParamHeaders: () => undefined,
}));

const stdioConfig: MCPServerConfig = {
  name: 'followups',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
};

type Reply = (message: any) => unknown;

/**
 * A transport that records what it is sent. `reply` decides the answer to each
 * message; returning undefined means no answer, so the request stays pending.
 */
class FakeTransport extends EventEmitter {
  readonly sent: Array<{ message: any; headers?: Record<string, string> }> = [];
  readonly closes: Array<Record<string, string> | undefined> = [];
  private open = false;

  constructor(private readonly reply: Reply) {
    super();
  }

  async connect(): Promise<void> {
    this.open = true;
  }

  send(message: any, headers?: Record<string, string>): Promise<void> {
    this.sent.push({ message, headers });
    const response = this.reply(message);
    if (response !== undefined) {
      queueMicrotask(() => this.emit('message', response));
    }
    return Promise.resolve();
  }

  isConnected(): boolean {
    return this.open;
  }

  close(headers?: Record<string, string>): void {
    this.closes.push(headers);
    this.open = false;
  }
}

const discoverReply: Reply = (message) =>
  message.method === 'server/discover'
    ? {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          resultType: 'complete',
          supportedVersions: [MODERN],
          capabilities: {},
          serverInfo: { name: 'followups', version: '1.0.0' },
        },
      }
    : undefined;

const toolsReply =
  (name: string): Reply =>
  (message) =>
    message.method === 'tools/list'
      ? { jsonrpc: '2.0', id: message.id, result: { tools: [{ name }] } }
      : undefined;

/** Let queued microtasks run, so sent messages and their replies are delivered. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

afterEach(() => {
  factory.create = () => undefined;
  vi.clearAllMocks();
});

describe('reconnect on the modern path', () => {
  it('tears down the old session: old transport closed, waiting calls failed, no disconnect event', async () => {
    const first = new FakeTransport((message) =>
      message.method === 'tools/list' ? undefined : discoverReply(message),
    );
    const second = new FakeTransport(
      (message) => discoverReply(message) ?? toolsReply('fresh')(message),
    );
    const transports = [first, second];
    factory.create = () => transports.shift();

    const client = new MCPClient(stdioConfig);
    const onDisconnect = vi.fn();
    client.on('disconnect', onDisconnect);

    await client.connect();
    expect(client.getServerInfo()?.protocolVersion).toBe(MODERN);

    // A call that is still waiting on the first session when connect() runs again.
    const waiting = client.listTools().then(
      () => 'resolved',
      (error: unknown) => String(error),
    );
    await flush();
    expect(first.sent.map((s) => s.message.method)).toContain('tools/list');

    await client.connect();

    expect(await waiting).toContain('Client disconnected');
    expect(first.closes).toHaveLength(1);
    expect(onDisconnect).not.toHaveBeenCalled();
    expect(client.isConnected()).toBe(true);

    const tools = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['fresh']);

    // The new session's requests go to the new transport and carry modern _meta.
    const listed = second.sent.find((s) => s.message.method === 'tools/list');
    expect(listed?.message.params._meta).toBeDefined();
    expect(
      first.sent.filter((s) => s.message.method === 'tools/list'),
    ).toHaveLength(1);

    client.disconnect();
  });
});

describe('disconnect during the legacy initialize handshake', () => {
  it('fails with a clear error when disconnect() runs between the response and the initialized notification', async () => {
    const transport = new FakeTransport(() => undefined);
    const client = new MCPClient(stdioConfig);
    (client as any).transport = transport;

    // The response arrives, and disconnect() runs before initialize() resumes.
    vi.spyOn(client as any, 'sendRequest').mockImplementation(async () => {
      client.disconnect();
      return {
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'legacy', version: '1.0.0' },
          capabilities: {},
        },
      };
    });

    await expect((client as any).initialize()).rejects.toThrow(
      'MCP connection closed during the initialize handshake',
    );
    expect(
      transport.sent.filter(
        (s) => s.message.method === 'notifications/initialized',
      ),
    ).toHaveLength(0);
  });
});

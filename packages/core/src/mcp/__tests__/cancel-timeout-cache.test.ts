import { describe, it, expect, vi, afterEach } from 'vitest';
import { MCPClient, MCPTimeoutError } from '../client';
import { MCPServerConfig } from '../types';

const transport = {
  connect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
  cancel: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  setProtocolVersion: vi.fn(),
};

vi.mock('../transport', () => ({
  StdioTransport: vi.fn().mockImplementation(() => transport),
  SSETransport: vi.fn().mockImplementation(() => transport),
  StreamableHTTPTransport: vi.fn().mockImplementation(() => transport),
  invalidMcpHeaderAnnotation: () => null,
  MCPHttpError: class MCPHttpError extends Error {
    constructor(readonly status: number) {
      super(`MCP HTTP ${status}`);
    }
  },
}));

const stdioConfig: MCPServerConfig = {
  name: 'test-server',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
};

const httpConfig: MCPServerConfig = {
  name: 'test-server',
  transport: 'http',
  url: 'https://example.test/mcp',
};

let serverSpy: { mockRestore(): void } | undefined;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  serverSpy?.mockRestore();
  serverSpy = undefined;
});

/** Lets a timed-out request's cancel path run to completion. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('timeout cancel on each transport', () => {
  it('does not send notifications/cancelled over Streamable HTTP', async () => {
    vi.useFakeTimers();
    const client = new MCPClient({ ...httpConfig, requestTimeoutMs: 100 });
    (client as any).transport = transport;

    const outcome = (client as any)
      .sendRequest({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: {} })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(200);
    expect(await outcome).toBeInstanceOf(MCPTimeoutError);
    await flush();

    expect(transport.cancel).toHaveBeenCalledWith(9);
    const methods = transport.send.mock.calls.map(
      ([message]: [{ method?: string }]) => message.method,
    );
    expect(methods).not.toContain('notifications/cancelled');
  });

  it('sends notifications/cancelled over stdio', async () => {
    vi.useFakeTimers();
    const client = new MCPClient({ ...stdioConfig, requestTimeoutMs: 100 });
    (client as any).transport = transport;

    const outcome = (client as any)
      .sendRequest({ jsonrpc: '2.0', id: 10, method: 'tools/call', params: {} })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(200);
    expect(await outcome).toBeInstanceOf(MCPTimeoutError);
    await flush();

    const methods = transport.send.mock.calls.map(
      ([message]: [{ method?: string }]) => message.method,
    );
    expect(methods).toContain('notifications/cancelled');
  });
});

describe('per-request timeout', () => {
  it('lets one call override requestTimeoutMs', async () => {
    vi.useFakeTimers();
    const client = new MCPClient({ ...stdioConfig, requestTimeoutMs: 60_000 });
    (client as any).transport = transport;

    const outcome = client
      .listPrompts({ timeoutMs: 50 })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(100);
    expect(await outcome).toBeInstanceOf(MCPTimeoutError);
  });
});

describe('tool list cache', () => {
  /** Serves tools/list with the given ttlMs (or none) and a tools/call. */
  function fakeServer(ttlMs?: unknown) {
    const methods: string[] = [];
    serverSpy = vi.spyOn(MCPClient.prototype as any, 'sendRequest').mockImplementation(
      async function (this: unknown, message: { method: string }) {
        methods.push(message.method);
        if (message.method === 'tools/list') {
          return {
            result: {
              tools: [{ name: 't', inputSchema: { type: 'object' } }],
              ...(ttlMs === undefined ? {} : { ttlMs }),
            },
          };
        }
        return { result: { content: [] } };
      },
    );
    return methods;
  }

  it('re-lists before each HTTP call when the server gives no ttlMs', async () => {
    const methods = fakeServer();
    const client = new MCPClient(httpConfig);

    await client.callTool('t', {});
    await client.callTool('t', {});

    expect(methods.filter((m) => m === 'tools/list')).toHaveLength(2);
  });

  it('reuses the list while a positive ttlMs is still fresh', async () => {
    const methods = fakeServer(60_000);
    const client = new MCPClient(httpConfig);

    await client.callTool('t', {});
    await client.callTool('t', {});

    expect(methods.filter((m) => m === 'tools/list')).toHaveLength(1);
  });

  it('treats a negative ttlMs as 0', async () => {
    const methods = fakeServer(-5);
    const client = new MCPClient(httpConfig);

    await client.callTool('t', {});
    await client.callTool('t', {});

    expect(methods.filter((m) => m === 'tools/list')).toHaveLength(2);
  });

  it('marks the list stale on notifications/tools/list_changed', async () => {
    const methods = fakeServer(60_000);
    const client = new MCPClient(httpConfig);

    await client.callTool('t', {});
    (client as any).handleMessage({
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
    });
    await client.callTool('t', {});

    expect(methods.filter((m) => m === 'tools/list')).toHaveLength(2);
  });
});

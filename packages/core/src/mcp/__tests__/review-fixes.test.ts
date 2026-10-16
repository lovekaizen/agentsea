import { describe, it, expect, vi, afterEach } from 'vitest';
import { MCPClient, MCPTimeoutError } from '../client';
import { MCPServerConfig } from '../types';

const transport = {
  connect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn(),
  on: vi.fn(),
  close: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  setProtocolVersion: vi.fn(),
};

vi.mock('../transport', () => ({
  StdioTransport: vi.fn().mockImplementation(() => transport),
  SSETransport: vi.fn().mockImplementation(() => transport),
  StreamableHTTPTransport: vi.fn().mockImplementation(() => transport),
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

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('review fixes: request timeout', () => {
  it('treats a non-numeric timeout as the default, not as zero', async () => {
    vi.useFakeTimers();
    const client = new MCPClient({
      ...stdioConfig,
      requestTimeoutMs: '5s' as unknown as number,
    });
    (client as any).transport = transport;

    const pending = (client as any).sendRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    const outcome = pending.then(
      () => 'resolved',
      (error: unknown) => error,
    );

    await vi.advanceTimersByTimeAsync(1_000);
    let settled = false;
    void outcome.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(await outcome).toBeInstanceOf(MCPTimeoutError);
  });

  it('settles the caller even when cancelling the request throws', async () => {
    vi.useFakeTimers();
    const client = new MCPClient({ ...stdioConfig, requestTimeoutMs: 100 });
    (client as any).transport = {
      ...transport,
      cancel: vi.fn(() => {
        throw new Error('cancel exploded');
      }),
    };

    const pending = (client as any).sendRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    const outcome = pending.then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(await outcome).toBeInstanceOf(MCPTimeoutError);
  });
});

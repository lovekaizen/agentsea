import { describe, it, expect, vi, afterEach } from 'vitest';
import { MCPClient, MCPProtocolError, MCPTimeoutError } from '../client';
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

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('progress ceiling', () => {
  it('stops a request that sends progress forever at the hard ceiling', async () => {
    vi.useFakeTimers();
    const client = new MCPClient({
      ...stdioConfig,
      requestTimeoutMs: 1_000,
      maxRequestTimeoutMs: 5_000,
    });
    (client as any).transport = transport;

    const id = 77;
    const outcome = (client as any)
      .sendRequest({ jsonrpc: '2.0', id, method: 'tools/call', params: {} })
      .then(
        () => 'resolved',
        (error: unknown) => error,
      );

    // Progress every 500 ms: without a ceiling this would never time out.
    const progress = setInterval(() => {
      (client as any).pendingRequests.get(id)?.touch();
    }, 500);

    await vi.advanceTimersByTimeAsync(4_900);
    let settled = false;
    void outcome.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(200);
    clearInterval(progress);
    expect(await outcome).toBeInstanceOf(MCPTimeoutError);
  });
});

describe('pagination', () => {
  it('returns every tool across three pages and passes each cursor back', async () => {
    const client = new MCPClient(stdioConfig);
    const requests: unknown[] = [];
    const pages = [
      { tools: [{ name: 'a' }], nextCursor: 'c1' },
      { tools: [{ name: 'b' }], nextCursor: 'c2' },
      { tools: [{ name: 'c' }] },
    ];
    vi.spyOn(client as any, 'sendRequest').mockImplementation(
      async (message: any) => {
        requests.push(message.params);
        return { result: pages[requests.length - 1] };
      },
    );

    const tools = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['a', 'b', 'c']);
    expect(requests).toEqual([{}, { cursor: 'c1' }, { cursor: 'c2' }]);
  });

  it('fails instead of looping when the server repeats a cursor', async () => {
    const client = new MCPClient(stdioConfig);
    vi.spyOn(client as any, 'sendRequest').mockResolvedValue({
      result: { prompts: [], nextCursor: 'same' },
    });

    await expect(client.listPrompts()).rejects.toThrow('repeated nextCursor');
  });

  it('returns every prompt across pages and passes each cursor back', async () => {
    const client = new MCPClient(stdioConfig);
    const requests: unknown[] = [];
    const pages = [
      { prompts: [{ name: 'p1' }], nextCursor: 'c1' },
      { prompts: [{ name: 'p2' }] },
    ];
    vi.spyOn(client as any, 'sendRequest').mockImplementation(
      async (message: any) => {
        requests.push(message.params);
        return { result: pages[requests.length - 1] };
      },
    );

    const prompts = await client.listPrompts();

    expect(prompts.map((prompt) => prompt.name)).toEqual(['p1', 'p2']);
    expect(requests).toEqual([{}, { cursor: 'c1' }]);
  });

  it('pages resources too', async () => {
    const client = new MCPClient(stdioConfig);
    vi.spyOn(client as any, 'sendRequest')
      .mockResolvedValueOnce({
        result: { resources: [{ uri: 'x' }], nextCursor: 'p2' },
      })
      .mockResolvedValueOnce({ result: { resources: [{ uri: 'y' }] } });

    const resources = await client.listResources();
    expect(resources.map((r) => r.uri)).toEqual(['x', 'y']);
  });
});

describe('HTTP legacy fallback', () => {
  it('does not fall back to initialize on a -32020 header mismatch', async () => {
    const client = new MCPClient(httpConfig);
    (client as any).transport = transport;
    vi.spyOn(client as any, 'sendRequest').mockRejectedValue(
      new MCPProtocolError(-32020, 'Header mismatch'),
    );
    const initialize = vi
      .spyOn(client as any, 'initialize')
      .mockResolvedValue(undefined);

    await expect((client as any).discover()).rejects.toThrow('Header mismatch');
    expect(initialize).not.toHaveBeenCalled();
  });

  it('still falls back to initialize on method-not-found from a legacy server', async () => {
    const client = new MCPClient(httpConfig);
    (client as any).transport = transport;
    vi.spyOn(client as any, 'sendRequest').mockRejectedValue(
      new MCPProtocolError(-32601, 'Method not found'),
    );
    const initialize = vi
      .spyOn(client as any, 'initialize')
      .mockResolvedValue(undefined);

    await (client as any).discover();
    expect(initialize).toHaveBeenCalledOnce();
  });
});

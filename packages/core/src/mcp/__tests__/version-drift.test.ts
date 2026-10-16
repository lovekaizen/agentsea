import { describe, it, expect, vi, afterEach } from 'vitest';
import { MCPClient, MCPProtocolError } from '../client';
import { MCPServerConfig, MCP_PROTOCOL_VERSION } from '../types';
import { FakeMCPServer, network } from './support/fake-servers';

// The client builds its transports through these constructors. Each one hands
// back a FakeWireTransport wired to whichever server the test selected.
vi.mock('../transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../transport')>();
  const { network } = await import('./support/fake-servers');
  return {
    ...actual,
    StdioTransport: vi.fn(function () {
      return network.createTransport();
    }),
    SSETransport: vi.fn(function () {
      return network.createTransport();
    }),
    StreamableHTTPTransport: vi.fn(function () {
      return network.createTransport();
    }),
  };
});

/** A client that negotiates: it tries server/discover first. */
const modernClientConfig: MCPServerConfig = {
  name: 'drift-server',
  transport: 'stdio',
  command: 'fake-server',
};

/**
 * A client that only speaks the 2024-11-05 handshake. The deprecated SSE
 * transport never probes with server/discover; it goes straight to initialize.
 */
const legacyClientConfig: MCPServerConfig = {
  name: 'drift-server',
  transport: 'sse',
  url: 'http://fake.test/sse',
};

function methodsSent(server: FakeMCPServer): string[] {
  return server.received.map(
    (message) => message.method ?? `reply:${message.id}`,
  );
}

afterEach(() => {
  network.reset();
  vi.clearAllMocks();
});

describe('version drift: modern client against a legacy 2024-11-05 server', () => {
  it('falls back to the initialize handshake after server/discover is refused', async () => {
    const server = new FakeMCPServer('legacy-2024-11-05');
    network.use(server);
    const client = new MCPClient(modernClientConfig);

    await client.connect();

    expect(client.getServerInfo()).toMatchObject({
      name: 'fake-legacy-2024-11-05',
      protocolVersion: '2024-11-05',
    });
    expect(methodsSent(server)).toEqual([
      'server/discover',
      'initialize',
      'notifications/initialized',
    ]);
  });

  it('keeps requests on the legacy path: no 2026 version in _meta', async () => {
    const server = new FakeMCPServer('legacy-2024-11-05', {
      tools: [{ name: 'echo' }, { name: 'ping' }],
    });
    network.use(server);
    const client = new MCPClient(modernClientConfig);
    await client.connect();

    const tools = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['echo', 'ping']);
    const listCall = server.received.find((m) => m.method === 'tools/list')!;
    const meta = (listCall.params as { _meta?: Record<string, unknown> })._meta;
    expect(meta?.['io.modelcontextprotocol/protocolVersion']).toBeUndefined();
  });
});

describe('version drift: legacy client against a 2026-07-28-only server', () => {
  it("fails clearly with the server's unsupported-version error, and tears down", async () => {
    const server = new FakeMCPServer('modern-2026-07-28-only');
    network.use(server);
    const client = new MCPClient(legacyClientConfig);

    const error = await client.connect().then(
      () => undefined,
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(MCPProtocolError);
    expect((error as MCPProtocolError).code).toBe(-32022);
    expect((error as MCPProtocolError).data).toEqual({
      supported: [MCP_PROTOCOL_VERSION],
      requested: '2024-11-05',
    });
    expect(error).toHaveProperty('message', expect.stringContaining('-32022'));
    expect(client.isConnected()).toBe(false);
    expect(client.getServerInfo()).toBeNull();
  });

  it('a modern client negotiates the same server to 2026-07-28 instead', async () => {
    const server = new FakeMCPServer('modern-2026-07-28-only');
    network.use(server);
    const client = new MCPClient(modernClientConfig);

    await client.connect();

    expect(client.getServerInfo()).toMatchObject({
      name: 'fake-modern-2026-07-28-only',
      protocolVersion: MCP_PROTOCOL_VERSION,
    });
    // Negotiated on the discover probe. No legacy initialize was sent.
    expect(methodsSent(server)).toEqual(['server/discover']);
  });
});

describe('version drift: modern client against a modern-only server', () => {
  it('sends the 2026 version in _meta on every request after discover', async () => {
    const server = new FakeMCPServer('modern-2026-07-28-only');
    network.use(server);
    const client = new MCPClient(modernClientConfig);
    await client.connect();

    await client.listTools();

    const listCall = server.received.find((m) => m.method === 'tools/list')!;
    expect(
      (listCall.params as { _meta: Record<string, unknown> })._meta[
        'io.modelcontextprotocol/protocolVersion'
      ],
    ).toBe(MCP_PROTOCOL_VERSION);
  });
});

describe('version drift: a server offering a version this client does not speak', () => {
  it('refuses to connect and does not fall back to initialize', async () => {
    const server = new FakeMCPServer('modern-2026-07-28-only', {
      supportedVersions: ['2027-01-01'],
    });
    network.use(server);
    const client = new MCPClient(modernClientConfig);

    await expect(client.connect()).rejects.toThrow(
      `MCP server does not support ${MCP_PROTOCOL_VERSION} (offers: 2027-01-01)`,
    );
    expect(methodsSent(server)).toEqual(['server/discover']);
  });
});

describe('version drift: legacy client against a legacy server', () => {
  it('completes the 2024-11-05 handshake', async () => {
    const server = new FakeMCPServer('legacy-2024-11-05');
    network.use(server);
    const client = new MCPClient(legacyClientConfig);

    await client.connect();

    expect(client.getServerInfo()?.protocolVersion).toBe('2024-11-05');
    expect(methodsSent(server)).toEqual([
      'initialize',
      'notifications/initialized',
    ]);
  });
});

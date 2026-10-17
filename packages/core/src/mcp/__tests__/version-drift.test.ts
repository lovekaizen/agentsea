import { describe, it, expect, vi, afterEach } from 'vitest';
import { MCPClient, MCPProtocolError } from '../client';
import { MCPServerConfig, MCP_PROTOCOL_VERSION } from '../types';
import { MCPHttpError } from '../transport';
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
// `command` is required by MCPServerConfig but ignored for sse and http.
const legacyClientConfig: MCPServerConfig = {
  name: 'drift-server',
  command: '',
  transport: 'sse',
  url: 'http://fake.test/sse',
};

/** A client that negotiates over Streamable HTTP, so discover failures take the HTTP rule. */
const httpClientConfig: MCPServerConfig = {
  name: 'drift-server',
  command: '',
  transport: 'http',
  url: 'http://fake.test/mcp',
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

describe('version drift: discover refused over HTTP', () => {
  it('a JSON-RPC refusal of discover falls back to initialize', async () => {
    // The legacy fake answers discover with -32601, a JSON-RPC error.
    const server = new FakeMCPServer('legacy-2024-11-05');
    network.use(server);
    const client = new MCPClient(httpClientConfig);

    await client.connect();

    expect(client.getServerInfo()?.protocolVersion).toBe('2024-11-05');
    expect(methodsSent(server)).toEqual([
      'server/discover',
      'initialize',
      'notifications/initialized',
    ]);
  });

  it.each([400, 404, 405])(
    'an HTTP %i on discover falls back to initialize',
    async (status) => {
      const server = new FakeMCPServer('legacy-2024-11-05', {
        transportFailure: (message) =>
          message.method === 'server/discover'
            ? new MCPHttpError(status)
            : null,
      });
      network.use(server);
      const client = new MCPClient(httpClientConfig);

      await client.connect();

      expect(client.getServerInfo()?.protocolVersion).toBe('2024-11-05');
      expect(methodsSent(server)).toEqual([
        'server/discover',
        'initialize',
        'notifications/initialized',
      ]);
    },
  );

  it.each([500, 503])(
    'an HTTP %i on discover is reported, not treated as a legacy server',
    async (status) => {
      const server = new FakeMCPServer('legacy-2024-11-05', {
        transportFailure: (message) =>
          message.method === 'server/discover'
            ? new MCPHttpError(status)
            : null,
      });
      network.use(server);
      const client = new MCPClient(httpClientConfig);

      const error = await client.connect().then(
        () => undefined,
        (failure: unknown) => failure,
      );

      expect(error).toBeInstanceOf(MCPHttpError);
      expect((error as MCPHttpError).status).toBe(status);
      expect(methodsSent(server)).toEqual(['server/discover']);
      expect(client.isConnected()).toBe(false);
    },
  );

  it('a network failure on discover is reported, not treated as a legacy server', async () => {
    const server = new FakeMCPServer('legacy-2024-11-05', {
      transportFailure: (message) =>
        message.method === 'server/discover'
          ? new TypeError('fetch failed')
          : null,
    });
    network.use(server);
    const client = new MCPClient(httpClientConfig);

    await expect(client.connect()).rejects.toThrow('fetch failed');
    expect(methodsSent(server)).toEqual(['server/discover']);
    expect(client.isConnected()).toBe(false);
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

    // The -32022 code and data.supported shape are assumed from the spec
    // description. They are not checked against a real server (see the matrix).
    expect(error).toBeInstanceOf(MCPProtocolError);
    expect((error as MCPProtocolError).code).toBe(-32022);
    expect((error as MCPProtocolError).data).toEqual({
      supported: [MCP_PROTOCOL_VERSION],
      requested: '2024-11-05',
    });
    expect(error).toHaveProperty('message', expect.stringContaining('-32022'));
    expect(client.isConnected()).toBe(false);
    expect(client.getServerInfo()).toBeNull();
    // The legacy client sends only initialize, and the fake answers it with -32022.
    expect(methodsSent(server)).toEqual(['initialize']);
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

  it('refuses a discover reply that offers only 2024-11-05, and does not fall back', async () => {
    // Chosen policy: a discover reply without 2026-07-28 is a refusal, even when
    // the server also speaks the legacy version. See the matrix, row 3.
    const server = new FakeMCPServer('modern-2026-07-28-only', {
      supportedVersions: ['2024-11-05'],
    });
    network.use(server);
    const client = new MCPClient(modernClientConfig);

    await expect(client.connect()).rejects.toThrow(
      `MCP server does not support ${MCP_PROTOCOL_VERSION} (offers: 2024-11-05)`,
    );
    expect(methodsSent(server)).toEqual(['server/discover']);
    expect(client.isConnected()).toBe(false);
  });
});

describe('version drift: discover refused with -32022', () => {
  it('fails with -32022, sends no fallback, and holds no server info', async () => {
    // A legacy-speaking server that refuses discover with -32022. It would
    // accept initialize, so the test shows the client does not fall back.
    const server = new FakeMCPServer('legacy-2024-11-05', {
      discoverError: {
        code: -32022,
        message: 'Unsupported protocol version',
        data: { supported: [MCP_PROTOCOL_VERSION] },
      },
    });
    network.use(server);
    const client = new MCPClient(modernClientConfig);

    const error = await client.connect().then(
      () => undefined,
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(MCPProtocolError);
    expect((error as MCPProtocolError).code).toBe(-32022);
    expect(methodsSent(server)).toEqual(['server/discover']);
    expect(client.getServerInfo()).toBeNull();
    expect(client.isConnected()).toBe(false);
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

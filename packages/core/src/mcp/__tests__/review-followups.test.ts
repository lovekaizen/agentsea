import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { MCPClient } from '../client';
import * as transportModule from '../transport';
import { MCPMessage, MCPServerConfig, MCP_PROTOCOL_VERSION } from '../types';

// Every transport the client builds is a FakeTransport. Each test decides how
// it behaves through `onCreate`, set before the client connects.
vi.mock('../transport', async () => {
  const { EventEmitter } = await import('events');

  class FakeTransport extends EventEmitter {
    connected = true;
    connect = vi.fn(async () => undefined);
    send = vi.fn();
    close = vi.fn(() => {
      this.connected = false;
    });
    cancel = vi.fn();
    isConnected = vi.fn(() => this.connected);
  }

  const created: FakeTransport[] = [];
  let onCreate: ((transport: FakeTransport) => void) | null = null;

  function make() {
    const transport = new FakeTransport();
    created.push(transport);
    onCreate?.(transport);
    return transport;
  }

  return {
    StdioTransport: vi.fn(make),
    SSETransport: vi.fn(make),
    StreamableHTTPTransport: vi.fn(make),
    FakeTransport,
    created,
    setOnCreate(fn: ((transport: FakeTransport) => void) | null) {
      onCreate = fn;
    },
  };
});

type FakeTransport = EventEmitter & {
  connected: boolean;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
};

const fakeModule = transportModule as unknown as {
  FakeTransport: new () => FakeTransport;
  created: FakeTransport[];
  setOnCreate: (fn: ((transport: FakeTransport) => void) | null) => void;
};

const stdioConfig: MCPServerConfig = {
  name: 'test-server',
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
};

/** Attach a fake transport to a client without connecting, as connect() would. */
function attach(client: MCPClient, transport: FakeTransport) {
  (client as any).transport = transport;
  transport.on('message', (message: MCPMessage) =>
    (client as any).handleMessage(message),
  );
  return transport;
}

function reply(transport: FakeTransport, request: MCPMessage, result: unknown) {
  transport.emit('message', { jsonrpc: '2.0', id: request.id, result });
}

/** A modern (2026-07-28) server: answers server/discover, ignores the rest. */
function modernServer(name: string) {
  return (transport: FakeTransport) => {
    transport.send.mockImplementation((message: MCPMessage) => {
      if (message.method === 'server/discover') {
        reply(transport, message, {
          supportedVersions: [MCP_PROTOCOL_VERSION],
          serverInfo: { name, version: '1.0.0' },
          capabilities: {},
        });
      }
    });
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  fakeModule.setOnCreate(null);
  fakeModule.created.length = 0;
});

describe('connect probe on the modern path', () => {
  it('reconnect closes the old transport quietly and replaces it', async () => {
    const client = new MCPClient(stdioConfig);
    const disconnected = vi.fn();
    client.on('disconnect', disconnected);

    fakeModule.setOnCreate(modernServer('first'));
    await client.connect();
    const [first] = fakeModule.created;
    expect(client.getServerInfo()?.name).toBe('first');

    fakeModule.setOnCreate(modernServer('second'));
    await client.connect();
    const second = fakeModule.created[1];

    expect(first.close).toHaveBeenCalledTimes(1);
    expect(disconnected).not.toHaveBeenCalled();
    expect(client.getServerInfo()?.name).toBe('second');
    expect(client.isConnected()).toBe(true);
  });

  it('after a modern reconnect, requests go to the new transport with _meta', async () => {
    const client = new MCPClient(stdioConfig);

    fakeModule.setOnCreate(modernServer('first'));
    await client.connect();
    const [first] = fakeModule.created;

    fakeModule.setOnCreate((transport) => {
      modernServer('second')(transport);
      transport.send.mockImplementation((message: MCPMessage) => {
        if (message.method === 'server/discover') {
          reply(transport, message, {
            supportedVersions: [MCP_PROTOCOL_VERSION],
            serverInfo: { name: 'second', version: '1.0.0' },
            capabilities: {},
          });
        } else if (message.method === 'tools/list') {
          reply(transport, message, { tools: [{ name: 'fresh' }] });
        }
      });
    });
    await client.connect();
    const [, second] = fakeModule.created;
    const sentBefore = first.send.mock.calls.length;

    const tools = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['fresh']);
    expect(first.send.mock.calls.length).toBe(sentBefore);
    const listCall = second.send.mock.calls.find(
      ([m]) => m.method === 'tools/list',
    )!;
    expect(listCall[0].params._meta).toMatchObject({
      'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
    });
  });

  it('a request waiting on the old connection fails when the client reconnects', async () => {
    const client = new MCPClient(stdioConfig);

    fakeModule.setOnCreate(modernServer('first'));
    await client.connect();
    const [first] = fakeModule.created;

    // This call gets no answer, so it is still waiting when the client reconnects.
    const waiting = client.listTools().then(
      () => 'resolved',
      (error: Error) => error,
    );
    await vi.waitFor(() =>
      expect(
        first.send.mock.calls.some(([m]) => m.method === 'tools/list'),
      ).toBe(true),
    );

    fakeModule.setOnCreate(modernServer('second'));
    await client.connect();

    const outcome = await waiting;
    expect(outcome).toBeInstanceOf(Error);
    expect((outcome as Error).message).toBe('Client disconnected');
  });
});

describe('disconnect between the initialize response and its send', () => {
  it('fails connect with a clear error, not a TypeError on a cleared transport', async () => {
    const client = new MCPClient(stdioConfig);

    // A legacy server: discover is refused, initialize is answered, and the
    // client drops the connection right after reading that answer.
    fakeModule.setOnCreate((transport) => {
      transport.send.mockImplementation((message: MCPMessage) => {
        if (message.method === 'server/discover') {
          transport.emit('message', {
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: 'Method not found' },
          });
        } else if (message.method === 'initialize') {
          reply(transport, message, {
            protocolVersion: '2024-11-05',
            serverInfo: { name: 'legacy', version: '1' },
            capabilities: {},
          });
          client.disconnect();
        }
      });
    });

    const error = await client.connect().then(
      () => undefined,
      (failure: unknown) => failure,
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(TypeError);
    expect((error as Error).message).toBe(
      'MCP connection closed during the initialize handshake',
    );
    expect(client.isConnected()).toBe(false);
  });
});

import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import type { AddressInfo } from 'net';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  MCPClient,
  MCPInputRequiredError,
  MCPProtocolError,
  UNSUPPORTED_PROTOCOL_VERSION,
} from '../client';
import {
  StdioTransport,
  StreamableHTTPTransport,
  encodeHeaderValue,
  invalidMcpHeaderAnnotation,
  mcpParamHeaders,
  mcpRequestHeaders,
} from '../transport';
import { MCPMessage } from '../types';

const MODERN = '2026-07-28';

describe('encodeHeaderValue', () => {
  it('passes visible ASCII through, keeping inner spaces', () => {
    expect(encodeHeaderValue('us-west1')).toBe('us-west1');
    expect(encodeHeaderValue('New York')).toBe('New York');
  });

  it('Base64-encodes non-ASCII, padded, and sentinel-looking values', () => {
    expect(encodeHeaderValue('Hello, 世界')).toBe(
      '=?base64?SGVsbG8sIOS4lueVjA==?=',
    );
    expect(encodeHeaderValue(' padded ')).toBe('=?base64?IHBhZGRlZCA=?=');
    expect(encodeHeaderValue('line1\nline2')).toBe(
      '=?base64?bGluZTEKbGluZTI=?=',
    );
    expect(encodeHeaderValue('=?base64?literal?=')).toBe(
      '=?base64?PT9iYXNlNjQ/bGl0ZXJhbD89?=',
    );
  });
});

describe('mcpRequestHeaders', () => {
  const meta = { 'io.modelcontextprotocol/protocolVersion': MODERN };

  it('names tools/call and prompts/get by params.name', () => {
    const call: MCPMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_weather', arguments: {}, _meta: meta },
    };
    expect(mcpRequestHeaders(call)).toEqual({
      'MCP-Protocol-Version': MODERN,
      'Mcp-Method': 'tools/call',
      'Mcp-Name': 'get_weather',
    });
    expect(
      mcpRequestHeaders({
        jsonrpc: '2.0',
        id: 2,
        method: 'prompts/get',
        params: { name: 'review', _meta: meta },
      })['Mcp-Name'],
    ).toBe('review');
  });

  it('names resources/read by params.uri and omits Mcp-Name for lists', () => {
    expect(
      mcpRequestHeaders({
        jsonrpc: '2.0',
        id: 3,
        method: 'resources/read',
        params: { uri: 'file:///a.txt', _meta: meta },
      })['Mcp-Name'],
    ).toBe('file:///a.txt');
    expect(
      mcpRequestHeaders({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/list',
        params: { _meta: meta },
      }),
    ).not.toHaveProperty('Mcp-Name');
  });
});

describe('x-mcp-header validation', () => {
  it('accepts primitive properties, including nested via properties', () => {
    expect(
      invalidMcpHeaderAnnotation({
        type: 'object',
        properties: {
          region: { type: 'string', 'x-mcp-header': 'Region' },
          opts: {
            type: 'object',
            properties: {
              limit: { type: 'integer', 'x-mcp-header': 'Limit' },
            },
          },
        },
      }),
    ).toBeNull();
  });

  it('rejects number type, annotations under items, and bad or duplicate names', () => {
    const numeric = {
      type: 'object',
      properties: { n: { type: 'number', 'x-mcp-header': 'N' } },
    };
    expect(invalidMcpHeaderAnnotation(numeric)).toMatch(
      /string, integer or boolean/,
    );

    const underItems = {
      type: 'object',
      properties: {
        list: {
          type: 'array',
          items: { type: 'string', 'x-mcp-header': 'Item' },
        },
      },
    };
    expect(invalidMcpHeaderAnnotation(underItems)).toMatch(
      /statically reachable/,
    );

    const badName = {
      type: 'object',
      properties: { a: { type: 'string', 'x-mcp-header': 'Bad Name' } },
    };
    expect(invalidMcpHeaderAnnotation(badName)).toMatch(/invalid header name/);

    const dupe = {
      type: 'object',
      properties: {
        a: { type: 'string', 'x-mcp-header': 'Region' },
        b: { type: 'string', 'x-mcp-header': 'region' },
      },
    };
    expect(invalidMcpHeaderAnnotation(dupe)).toMatch(/duplicate/);
  });
});

describe('mcpParamHeaders', () => {
  const schema = {
    type: 'object',
    properties: {
      region: { type: 'string', 'x-mcp-header': 'Region' },
      opts: {
        type: 'object',
        properties: { limit: { type: 'integer', 'x-mcp-header': 'Limit' } },
      },
    },
  };

  it('builds Mcp-Param headers from the annotated paths', () => {
    expect(
      mcpParamHeaders(schema, { region: 'us-west1', opts: { limit: 42 } }),
    ).toEqual({ 'Mcp-Param-Region': 'us-west1', 'Mcp-Param-Limit': '42' });
  });

  it('omits absent and null values, and encodes non-ASCII', () => {
    expect(mcpParamHeaders(schema, { region: null })).toEqual({});
    expect(mcpParamHeaders(schema, { region: 'Zürich' })).toEqual({
      'Mcp-Param-Region': '=?base64?WsO8cmljaA==?=',
    });
  });

  it('refuses an integer outside the safe range', () => {
    expect(() => mcpParamHeaders(schema, { opts: { limit: 2 ** 60 } })).toThrow(
      RangeError,
    );
  });
});

describe('StreamableHTTPTransport', () => {
  function fakeFetch(response: Response): typeof fetch {
    return vi.fn(async () => response) as unknown as typeof fetch;
  }

  it('emits a JSON response body as one message', async () => {
    const transport = new StreamableHTTPTransport(
      'http://x/mcp',
      fakeFetch(
        new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await transport.connect();
    const got = new Promise<MCPMessage>((r) => transport.once('message', r));
    await transport.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(await got).toMatchObject({ id: 1, result: {} });
  });

  it('reads an SSE response: keep-alive comments ignored, notifications then the answer', async () => {
    const body =
      ': keep-alive\n\n' +
      'data: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}\n\n' +
      'data: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\n\n';
    const transport = new StreamableHTTPTransport(
      'http://x/mcp',
      fakeFetch(
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    );
    await transport.connect();
    const seen: MCPMessage[] = [];
    transport.on('message', (m: MCPMessage) => seen.push(m));
    await transport.send({ jsonrpc: '2.0', id: 7, method: 'tools/call' });
    expect(seen.map((m) => m.method ?? m.id)).toEqual([
      'notifications/progress',
      7,
    ]);
  });

  it('sends the required headers with every POST', async () => {
    const fetchSpy = vi.fn(
      async () => new Response(null, { status: 202 }),
    ) as unknown as ReturnType<typeof vi.fn>;
    const transport = new StreamableHTTPTransport(
      'http://x/mcp',
      fetchSpy as unknown as typeof fetch,
    );
    await transport.connect();
    await transport.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json, text/event-stream');
    expect(headers['Mcp-Method']).toBe('notifications/initialized');
  });

  it('turns a non-2xx response without an id into a send failure', async () => {
    const transport = new StreamableHTTPTransport(
      'http://x/mcp',
      fakeFetch(new Response('nope', { status: 500 })),
    );
    await transport.connect();
    await expect(
      transport.send({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
    ).rejects.toThrow('MCP HTTP 500');
  });

  it('keeps a JSON-RPC error body with an id even on 400', async () => {
    const transport = new StreamableHTTPTransport(
      'http://x/mcp',
      fakeFetch(
        new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 9,
            error: { code: -32020, message: 'HeaderMismatch' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    await transport.connect();
    const got = new Promise<MCPMessage>((r) => transport.once('message', r));
    await transport.send({ jsonrpc: '2.0', id: 9, method: 'tools/call' });
    expect(await got).toMatchObject({ error: { code: -32020 } });
  });
});

describe('MCPClient over Streamable HTTP (local server)', () => {
  let server: Server;
  let url: string;
  const seen: Array<{
    method?: string;
    headers: IncomingMessage['headers'];
    body: MCPMessage;
  }> = [];
  let mode: 'modern' | 'legacy' | 'unsupported' = 'modern';

  const weatherTool = {
    name: 'lookup_weather',
    description: 'Look up weather',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', 'x-mcp-header': 'Region' },
        query: { type: 'string' },
      },
      required: ['region', 'query'],
    },
  };
  const badTool = {
    name: 'bad_tool',
    description: 'Invalid header annotation',
    inputSchema: {
      type: 'object',
      properties: { n: { type: 'number', 'x-mcp-header': 'N' } },
    },
  };

  function send(
    res: ServerResponse,
    status: number,
    body: unknown,
    sse = false,
  ): void {
    if (sse) {
      res.writeHead(status, { 'content-type': 'text/event-stream' });
      res.end(`data: ${JSON.stringify(body)}\n\n`);
      return;
    }
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw) as MCPMessage;
        seen.push({ method: body.method, headers: req.headers, body });
        const id = body.id;
        const params = (body.params ?? {}) as Record<string, unknown>;

        if (body.method === 'server/discover') {
          if (mode === 'legacy') {
            return send(res, 404, {
              jsonrpc: '2.0',
              id,
              error: { code: -32601, message: 'Method not found' },
            });
          }
          if (mode === 'unsupported') {
            return send(res, 400, {
              jsonrpc: '2.0',
              id,
              error: {
                code: UNSUPPORTED_PROTOCOL_VERSION,
                message: 'Unsupported protocol version',
              },
            });
          }
          return send(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              resultType: 'complete',
              supportedVersions: [MODERN],
              capabilities: { tools: {} },
              serverInfo: { name: 'fake', version: '1.0.0' },
            },
          });
        }

        if (body.method === 'initialize') {
          return send(res, 200, {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: { name: 'legacy', version: '0.9' },
              capabilities: {},
            },
          });
        }

        if (body.method === 'notifications/initialized') {
          res.writeHead(202);
          return res.end();
        }

        if (body.method === 'tools/list') {
          return send(res, 200, {
            jsonrpc: '2.0',
            id,
            result: { resultType: 'complete', tools: [weatherTool, badTool] },
          });
        }

        if (body.method === 'tools/call') {
          const args = (params.arguments ?? {}) as Record<string, string>;
          if (args.query === 'needs-input') {
            return send(res, 200, {
              jsonrpc: '2.0',
              id,
              result: { resultType: 'input_required', inputRequests: {} },
            });
          }
          // Header must match the body after decoding (spec Server Validation).
          const raw = req.headers['mcp-param-region'];
          const decoded =
            typeof raw === 'string' && raw.startsWith('=?base64?')
              ? Buffer.from(raw.slice(9, -2), 'base64').toString('utf8')
              : raw;
          if (decoded !== args.region) {
            return send(res, 400, {
              jsonrpc: '2.0',
              id,
              error: { code: -32020, message: 'HeaderMismatch' },
            });
          }
          const payload = {
            jsonrpc: '2.0',
            id,
            result: {
              resultType: 'complete',
              content: [{ type: 'text', text: `weather in ${args.region}` }],
            },
          };
          return send(res, 200, payload, args.query === 'stream');
        }

        send(res, 404, {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'Method not found' },
        });
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  function newClient(): MCPClient {
    return new MCPClient({
      name: 'remote',
      command: '',
      transport: 'http',
      url,
    });
  }

  it('negotiates the modern path, sends _meta, and filters the bad tool', async () => {
    mode = 'modern';
    seen.length = 0;
    const client = newClient();
    const warnings: string[] = [];
    client.on('warning', (w: string) => warnings.push(w));
    await client.connect();
    expect(client.getServerInfo()?.protocolVersion).toBe(MODERN);

    const discover = seen.find((s) => s.method === 'server/discover')!;
    const meta = (discover.body.params as { _meta: Record<string, unknown> })
      ._meta;
    expect(meta['io.modelcontextprotocol/protocolVersion']).toBe(MODERN);
    expect(discover.headers['mcp-protocol-version']).toBe(MODERN);

    const tools = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['lookup_weather']);
    expect(warnings[0]).toMatch(/bad_tool/);
    client.disconnect();
  });

  it('mirrors x-mcp-header into Mcp-Param-* and round-trips a non-ASCII value', async () => {
    mode = 'modern';
    const client = newClient();
    await client.connect();
    await client.listTools();

    const result = await client.callTool('lookup_weather', {
      region: 'Zürich',
      query: 'today',
    });
    expect(result.content[0].text).toBe('weather in Zürich');
    client.disconnect();
  });

  it('accepts an SSE reply to a tool call', async () => {
    mode = 'modern';
    const client = newClient();
    await client.connect();
    await client.listTools();
    const result = await client.callTool('lookup_weather', {
      region: 'us-west1',
      query: 'stream',
    });
    expect(result.content[0].text).toBe('weather in us-west1');
    client.disconnect();
  });

  it('surfaces input_required as a clear error instead of a bogus result', async () => {
    mode = 'modern';
    const client = newClient();
    await client.connect();
    await client.listTools();
    await expect(
      client.callTool('lookup_weather', {
        region: 'us-west1',
        query: 'needs-input',
      }),
    ).rejects.toBeInstanceOf(MCPInputRequiredError);
    client.disconnect();
  });

  it('refuses the legacy handshake over Streamable HTTP with a clear error', async () => {
    mode = 'legacy';
    seen.length = 0;
    const client = newClient();
    const error = await client.connect().catch((e: unknown) => e);
    expect((error as Error).message).toMatch(
      /Legacy initialize over Streamable HTTP/,
    );
    // Nothing was sent after the failed probe, and the client is torn down.
    expect(seen.map((s) => s.method)).not.toContain('initialize');
    expect(client.isConnected()).toBe(false);
    mode = 'modern';
  });

  it('skips a malformed SSE event and still returns the real response', async () => {
    const body =
      'data: not-json\n\n' +
      'data: {"jsonrpc":"2.0","id":11,"result":{"ok":true}}\n\n';
    const transport = new StreamableHTTPTransport(
      'http://x/mcp',
      (async () =>
        new Response(body, {
          headers: { 'content-type': 'text/event-stream' },
        })) as unknown as typeof fetch,
    );
    await transport.connect();
    const got = new Promise<MCPMessage>((r) => transport.once('message', r));
    await transport.send({ jsonrpc: '2.0', id: 11, method: 'tools/call' });
    expect(await got).toMatchObject({ id: 11, result: { ok: true } });
  });

  it('stops on unsupported-version and does not fall back to initialize', async () => {
    mode = 'unsupported';
    seen.length = 0;
    const client = newClient();
    const error = await client.connect().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MCPProtocolError);
    expect((error as MCPProtocolError).code).toBe(UNSUPPORTED_PROTOCOL_VERSION);
    expect(seen.map((s) => s.method)).not.toContain('initialize');
    client.disconnect();
    mode = 'modern';
  });
});

describe('StdioTransport stderr', () => {
  it('emits stderr as a stderr event, not an error', async () => {
    const transport = new StdioTransport(process.execPath, [
      '-e',
      'process.stderr.write(\'just logging\\n\'); console.log(\'{"jsonrpc":"2.0","id":1,"result":{}}\')',
    ]);
    const errors: Error[] = [];
    transport.on('error', (e: Error) => errors.push(e));
    const stderr = new Promise<string>((r) => transport.once('stderr', r));
    const message = new Promise<MCPMessage>((r) =>
      transport.once('message', r),
    );
    await transport.connect();
    expect(await stderr).toContain('just logging');
    expect(await message).toMatchObject({ id: 1 });
    expect(errors).toEqual([]);
    transport.close();
  });
});

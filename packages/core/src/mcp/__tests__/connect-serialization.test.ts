import { createServer, Server } from 'http';
import type { AddressInfo } from 'net';

import { afterEach, describe, expect, it } from 'vitest';

import { MCPClient } from '../client';

const MODERN = '2026-07-28';

/**
 * A Streamable HTTP server that answers server/discover after `discoverDelayMs`.
 * The delay keeps the first connect()'s probe in flight while a second call
 * arrives.
 */
function startServer(
  discoverDelayMs: number,
): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      if (body.id === undefined) {
        res.writeHead(202);
        return res.end();
      }
      const reply = () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: {
              resultType: 'complete',
              supportedVersions: [MODERN],
              capabilities: {},
              serverInfo: { name: 'serialization', version: '1.0.0' },
            },
          }),
        );
      };
      setTimeout(
        reply,
        body.method === 'server/discover' ? discoverDelayMs : 0,
      );
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, url: `http://127.0.0.1:${port}/mcp` });
    }),
  );
}

const servers: Server[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

async function serve(discoverDelayMs: number): Promise<string> {
  const { server, url } = await startServer(discoverDelayMs);
  servers.push(server);
  return url;
}

const settle = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error: unknown) => String(error),
  );

describe('connect() serialization', () => {
  it('lets the first connect() finish when a second one arrives mid-probe', async () => {
    const url = await serve(300);
    const client = new MCPClient({
      name: 'serial',
      command: '',
      transport: 'http',
      url,
    });

    const first = settle(client.connect());
    // The first discover is still waiting on the server when the second call runs.
    await new Promise((resolve) => setTimeout(resolve, 100));
    const second = settle(client.connect());

    expect(await first).toBe('ok');
    expect(await second).toBe('ok');
    expect(client.getServerInfo()?.protocolVersion).toBe(MODERN);
    client.disconnect();
  });

  // Known bug: disconnect() does not cancel a connect() that is queued behind an
  // in-flight one, so the queued connect still runs and leaves the client
  // connected. This is expected to fail today. When the bug is fixed, the
  // assertion holds and vitest reports this test as failing, so switch it to `it`.
  it.fails(
    'does not reconnect a client that disconnect() was called on while a connect() was queued',
    async () => {
      const url = await serve(300);
      const client = new MCPClient({
        name: 'serial',
        command: '',
        transport: 'http',
        url,
      });

      const first = settle(client.connect());
      await new Promise((resolve) => setTimeout(resolve, 100));
      const second = settle(client.connect());

      client.disconnect();
      await Promise.all([first, second]);

      expect(client.isConnected()).toBe(false);
      client.disconnect();
    },
  );
});

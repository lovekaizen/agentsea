import { lookup } from 'dns/promises';
import { isIP } from 'net';

import { z } from 'zod';

import { Tool } from '../../types';

/**
 * Return true if `ip` is loopback, private, link-local, or otherwise not a
 * public, routable address — i.e. an SSRF target we must refuse.
 */
function isPrivateIp(ip: string): boolean {
  // Normalize IPv4-mapped IPv6 (e.g. ::ffff:169.254.169.254).
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const addr = mapped ? mapped[1] : ip;

  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number);
    return (
      a === 0 || // 0.0.0.0/8
      a === 10 || // 10.0.0.0/8 (private)
      a === 127 || // 127.0.0.0/8 (loopback)
      (a === 169 && b === 254) || // 169.254.0.0/16 (link-local incl. cloud metadata)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (private)
      (a === 192 && b === 168) || // 192.168.0.0/16 (private)
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
      a >= 224 // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
    );
  }

  // IPv6
  const lower = ip.toLowerCase();
  return (
    lower === '::1' || // loopback
    lower === '::' || // unspecified
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') || // unique-local fc00::/7
    lower.startsWith('fd')
  );
}

/**
 * Reject non-http(s) schemes and any URL whose host resolves to a private /
 * loopback / link-local address, to prevent SSRF against internal services and
 * cloud metadata endpoints.
 */
async function assertPublicUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
  }

  const host = parsed.hostname;
  if (host === 'localhost') {
    throw new Error('Blocked request to localhost');
  }

  // If the host is a literal IP, check it directly; otherwise resolve it.
  const candidates: string[] = isIP(host)
    ? [host]
    : (await lookup(host, { all: true })).map((r) => r.address);

  if (candidates.some(isPrivateIp)) {
    throw new Error(`Blocked request to non-public address for host "${host}"`);
  }
}

/**
 * HTTP request tool for making API calls
 */
export const httpRequestTool: Tool = {
  name: 'http_request',
  description:
    'Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE methods.',
  parameters: z.object({
    url: z.string().url().describe('The URL to make the request to'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .default('GET')
      .describe('HTTP method'),
    headers: z.record(z.string()).optional().describe('HTTP headers'),
    body: z
      .unknown()
      .optional()
      .describe('Request body (for POST, PUT, PATCH)'),
    timeout: z
      .number()
      .optional()
      .default(10000)
      .describe('Request timeout in milliseconds'),
  }),
  execute: async (params: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: unknown;
    timeout?: number;
  }) => {
    // SSRF guard: refuse non-http(s) schemes and private/internal hosts.
    // Note: this validates the initial URL; callers that need defense against
    // redirect-based SSRF should run this tool behind an egress allowlist.
    await assertPublicUrl(params.url);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      params.timeout || 10000,
    );

    try {
      const options: RequestInit = {
        method: params.method,
        headers: {
          'Content-Type': 'application/json',
          ...params.headers,
        },
        signal: controller.signal,
      };

      if (params.body && ['POST', 'PUT', 'PATCH'].includes(params.method)) {
        options.body = JSON.stringify(params.body);
      }

      const response = await fetch(params.url, options);
      const contentType = response.headers.get('content-type');

      let data;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${params.timeout}ms`);
        }
        throw new Error(`HTTP request failed: ${error.message}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: ['Request timeout', 'Network error'],
  },
};

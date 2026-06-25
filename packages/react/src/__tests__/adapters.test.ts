import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  createSSEAdapter,
  createHTTPStreamAdapter,
  fetchChat,
  getAdapter,
} from '../adapters';
import type { ChatRequest, ChatStreamChunk } from '../types';

const REQUEST: ChatRequest = { messages: [] };

/** Build a streaming Response from an array of UTF-8 string chunks. */
function streamingResponse(
  chunks: string[],
  ok = true,
  status = 200,
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return { ok, status, body } as unknown as Response;
}

describe('getAdapter', () => {
  it('returns the provided adapter object as-is', () => {
    const custom = createSSEAdapter();
    expect(getAdapter(custom)).toBe(custom);
  });

  it('creates distinct adapters for "sse" and "http"', () => {
    const sse = getAdapter('sse');
    const http = getAdapter('http');
    expect(sse).not.toBe(http);
    expect(typeof sse.connect).toBe('function');
    expect(typeof http.send).toBe('function');
  });
});

describe('createSSEAdapter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('parses SSE data lines and forwards parsed chunks to onMessage', async () => {
    const chunk: ChatStreamChunk = {
      type: 'content',
      content: 'hi',
      delta: false,
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamingResponse([
            `data: ${JSON.stringify(chunk)}\n`,
            'data: [DONE]\n',
          ]),
        ),
    );

    const adapter = createSSEAdapter();
    const received: ChatStreamChunk[] = [];
    const onClose = vi.fn();
    adapter.onMessage((c) => received.push(c));
    adapter.onClose(onClose);

    await adapter.connect('http://x/chat');
    await adapter.send(REQUEST);

    expect(received).toEqual([chunk]);
    expect(onClose).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('invokes onError on a non-ok HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamingResponse([], false, 500)),
    );
    const adapter = createSSEAdapter();
    const onError = vi.fn();
    adapter.onError(onError);
    await adapter.connect('http://x/chat');
    await adapter.send(REQUEST);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toContain('500');
    vi.unstubAllGlobals();
  });

  it('ignores malformed JSON data lines without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamingResponse(['data: {not json\n'])),
    );
    const adapter = createSSEAdapter();
    const received: ChatStreamChunk[] = [];
    adapter.onMessage((c) => received.push(c));
    await adapter.connect('http://x/chat');
    await adapter.send(REQUEST);
    expect(received).toEqual([]);
    vi.unstubAllGlobals();
  });
});

describe('createHTTPStreamAdapter', () => {
  it('parses newline-delimited JSON chunks', async () => {
    const a: ChatStreamChunk = { type: 'content', content: 'a', delta: true };
    const b: ChatStreamChunk = { type: 'done' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          streamingResponse([`${JSON.stringify(a)}\n${JSON.stringify(b)}`]),
        ),
    );
    const adapter = createHTTPStreamAdapter();
    const received: ChatStreamChunk[] = [];
    adapter.onMessage((c) => received.push(c));
    await adapter.connect('http://x/chat');
    await adapter.send(REQUEST);
    expect(received).toEqual([a, b]);
    vi.unstubAllGlobals();
  });

  it('invokes onError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(streamingResponse([], false, 404)),
    );
    const adapter = createHTTPStreamAdapter();
    const onError = vi.fn();
    adapter.onError(onError);
    await adapter.connect('http://x/chat');
    await adapter.send(REQUEST);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    vi.unstubAllGlobals();
  });
});

describe('fetchChat', () => {
  it('posts with stream:false and returns the chunks array', async () => {
    const chunks = [{ type: 'content', content: 'x', delta: false }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ chunks }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchChat('http://x/chat', REQUEST);

    expect(result).toEqual(chunks);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stream).toBe(false);
    vi.unstubAllGlobals();
  });

  it('wraps a single result object when no chunks field is present', async () => {
    const single = { type: 'done' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => single,
      }),
    );
    const result = await fetchChat('http://x/chat', REQUEST);
    expect(result).toEqual([single]);
    vi.unstubAllGlobals();
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );
    await expect(fetchChat('http://x/chat', REQUEST)).rejects.toThrow('503');
    vi.unstubAllGlobals();
  });
});

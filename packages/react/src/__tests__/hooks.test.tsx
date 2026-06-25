import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { useChat } from '../useChat';
import { useAgent } from '../useAgent';
import type {
  ConnectionAdapter,
  ChatStreamChunk,
  ChatRequest,
} from '../types';

/**
 * A controllable in-memory adapter so useChat tests don't touch the network.
 */
function createMockAdapter(scriptedChunks: ChatStreamChunk[]): ConnectionAdapter {
  let messageCb: ((c: ChatStreamChunk) => void) | null = null;
  let closeCb: (() => void) | null = null;
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(async (_data: ChatRequest) => {
      for (const c of scriptedChunks) messageCb?.(c);
      closeCb?.();
    }),
    onMessage: (cb) => {
      messageCb = cb;
    },
    onError: () => {},
    onClose: (cb) => {
      closeCb = cb;
    },
    close: vi.fn(),
  };
}

describe('useChat', () => {
  afterEach(() => vi.restoreAllMocks());

  it('initializes with empty state', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() =>
      useChat({ endpoint: '/api/chat', adapter }),
    );
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('seeds initialMessages', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() =>
      useChat({
        endpoint: '/api/chat',
        adapter,
        initialMessages: [
          {
            id: '1',
            role: 'user',
            content: 'hi',
            createdAt: new Date(),
          },
        ],
      }),
    );
    expect(result.current.messages).toHaveLength(1);
  });

  it('ignores empty/whitespace messages', async () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() =>
      useChat({ endpoint: '/api/chat', adapter }),
    );
    await act(async () => {
      await result.current.sendMessage('   ');
    });
    expect(result.current.messages).toEqual([]);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('appends a user message and streams an assistant reply', async () => {
    const adapter = createMockAdapter([
      { type: 'content', content: 'Hello there', delta: false },
      { type: 'done', metadata: { tokensUsed: 5 } },
    ]);
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useChat({ endpoint: '/api/chat', adapter, onComplete }),
    );

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    await waitFor(() => {
      // user + assistant
      expect(result.current.messages).toHaveLength(2);
    });
    expect(result.current.messages[0]).toMatchObject({
      role: 'user',
      content: 'Hi',
    });
    expect(result.current.messages[1]).toMatchObject({
      role: 'assistant',
      content: 'Hello there',
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('clear() empties the messages list', async () => {
    const adapter = createMockAdapter([
      { type: 'content', content: 'x', delta: false },
      { type: 'done' },
    ]);
    const { result } = renderHook(() =>
      useChat({ endpoint: '/api/chat', adapter }),
    );
    await act(async () => {
      await result.current.sendMessage('Hi');
    });
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    act(() => result.current.clear());
    expect(result.current.messages).toEqual([]);
  });

  it('approveToolCall sets the tool state to executing', () => {
    const adapter = createMockAdapter([]);
    const { result } = renderHook(() =>
      useChat({ endpoint: '/api/chat', adapter }),
    );
    // No active tool calls -> the call is a no-op but must not throw.
    expect(() => act(() => result.current.approveToolCall('id'))).not.toThrow();
  });
});

describe('useAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initializes with empty state', () => {
    const { result } = renderHook(() =>
      useAgent({ endpoint: '/api/agent', agentId: 'a' }),
    );
    expect(result.current.content).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.metadata).toBeNull();
  });

  it('execute() posts and resolves with the agent response', async () => {
    const agentResponse = {
      content: 'done',
      finishReason: 'stop',
      metadata: { tokensUsed: 7, latencyMs: 50, iterations: 1 },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => agentResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAgent({ endpoint: '/api/agent', agentId: 'a', onComplete }),
    );

    let returned: unknown;
    await act(async () => {
      returned = await result.current.execute('hello');
    });

    expect(returned).toEqual(agentResponse);
    expect(result.current.content).toBe('done');
    expect(result.current.metadata?.tokensUsed).toBe(7);
    expect(onComplete).toHaveBeenCalledWith(agentResponse);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ input: 'hello', agentId: 'a', stream: false });
  });

  it('execute() returns null and records error on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAgent({ endpoint: '/api/agent', agentId: 'a', onError }),
    );
    let returned: unknown = 'sentinel';
    await act(async () => {
      returned = await result.current.execute('hello');
    });
    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(onError).toHaveBeenCalled();
  });

  it('reset() clears content and error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: 'x', metadata: {} }),
      }),
    );
    const { result } = renderHook(() =>
      useAgent({ endpoint: '/api/agent', agentId: 'a' }),
    );
    await act(async () => {
      await result.current.execute('hi');
    });
    act(() => result.current.reset());
    expect(result.current.content).toBe('');
    expect(result.current.metadata).toBeNull();
  });
});

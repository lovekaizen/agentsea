import type {
  ConnectionAdapter,
  ConnectionOptions,
  ChatRequest,
  ChatStreamChunk,
} from './types';

/**
 * Server-Sent Events (SSE) connection adapter
 * Ideal for streaming responses from the server
 */
export function createSSEAdapter(): ConnectionAdapter {
  let eventSource: EventSource | null = null;
  let abortController: AbortController | null = null;
  let messageCallback: ((chunk: ChatStreamChunk) => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;
  let closeCallback: (() => void) | null = null;
  let currentUrl: string = '';
  let currentOptions: ConnectionOptions = {};

  return {
    connect(url: string, options?: ConnectionOptions): Promise<void> {
      currentUrl = url;
      currentOptions = options || {};
      abortController = new AbortController();

      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          abortController?.abort();
        });
      }

      return Promise.resolve();
    },

    async send(data: ChatRequest): Promise<void> {
      // For SSE, we need to POST first to initiate the stream
      // Then read the SSE events from the response
      const response = await fetch(currentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...currentOptions.headers,
        },
        body: JSON.stringify(data),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        const error = new Error(`HTTP error: ${response.status}`);
        errorCallback?.(error);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        errorCallback?.(new Error('No response body'));
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        let reading = true;
        while (reading) {
          const { done, value } = await reader.read();
          if (done) {
            reading = false;
            continue;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const eventData = line.slice(6);
              if (eventData === '[DONE]') {
                closeCallback?.();
                return;
              }
              try {
                const chunk = JSON.parse(eventData) as ChatStreamChunk;
                messageCallback?.(chunk);
              } catch {
                // Ignore parse errors for non-JSON data
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          errorCallback?.(error as Error);
        }
      } finally {
        closeCallback?.();
      }
    },

    onMessage(callback: (chunk: ChatStreamChunk) => void): void {
      messageCallback = callback;
    },

    onError(callback: (error: Error) => void): void {
      errorCallback = callback;
    },

    onClose(callback: () => void): void {
      closeCallback = callback;
    },

    close(): void {
      abortController?.abort();
      eventSource?.close();
      eventSource = null;
    },
  };
}

/**
 * HTTP Stream adapter using fetch with streaming response
 * More compatible than SSE for some backends
 */
export function createHTTPStreamAdapter(): ConnectionAdapter {
  let abortController: AbortController | null = null;
  let messageCallback: ((chunk: ChatStreamChunk) => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;
  let closeCallback: (() => void) | null = null;
  let currentUrl: string = '';
  let currentOptions: ConnectionOptions = {};

  return {
    connect(url: string, options?: ConnectionOptions): Promise<void> {
      currentUrl = url;
      currentOptions = options || {};
      abortController = new AbortController();

      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          abortController?.abort();
        });
      }

      return Promise.resolve();
    },

    async send(data: ChatRequest): Promise<void> {
      try {
        const response = await fetch(currentUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/x-ndjson',
            ...currentOptions.headers,
          },
          body: JSON.stringify(data),
          signal: abortController?.signal,
        });

        if (!response.ok) {
          const error = new Error(`HTTP error: ${response.status}`);
          errorCallback?.(error);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          errorCallback?.(new Error('No response body'));
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        let reading = true;
        while (reading) {
          const { done, value } = await reader.read();
          if (done) {
            reading = false;
            continue;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const chunk = JSON.parse(line) as ChatStreamChunk;
                messageCallback?.(chunk);
              } catch {
                // Ignore parse errors
              }
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const chunk = JSON.parse(buffer) as ChatStreamChunk;
            messageCallback?.(chunk);
          } catch {
            // Ignore parse errors
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          errorCallback?.(error as Error);
        }
      } finally {
        closeCallback?.();
      }
    },

    onMessage(callback: (chunk: ChatStreamChunk) => void): void {
      messageCallback = callback;
    },

    onError(callback: (error: Error) => void): void {
      errorCallback = callback;
    },

    onClose(callback: () => void): void {
      closeCallback = callback;
    },

    close(): void {
      abortController?.abort();
    },
  };
}

/**
 * Simple fetch adapter for non-streaming requests
 */
export async function fetchChat(
  url: string,
  data: ChatRequest,
  options?: ConnectionOptions,
): Promise<ChatStreamChunk[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: JSON.stringify({ ...data, stream: false }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const result = await response.json();
  return result.chunks || [result];
}

/**
 * Get the appropriate adapter based on configuration
 */
export function getAdapter(
  type: 'sse' | 'http' | ConnectionAdapter,
): ConnectionAdapter {
  if (typeof type === 'object') {
    return type;
  }
  return type === 'sse' ? createSSEAdapter() : createHTTPStreamAdapter();
}

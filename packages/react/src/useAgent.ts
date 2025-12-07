import { useState, useCallback, useRef, useEffect } from 'react';
import type { AgentResponse } from '@lov3kaizen/agentsea-core';
import type {
  UseAgentConfig,
  UseAgentReturn,
  ChatMessage,
  TrackedToolCall,
  ChatStreamChunk,
  ThinkingPart,
  ToolApprovalResponse,
} from './types';

/**
 * useAgent - A React hook for executing AI agents
 *
 * Unlike useChat, this hook is focused on single agent executions
 * rather than maintaining conversation state. It's ideal for:
 * - One-shot agent tasks
 * - Background agent operations
 * - Agent-driven UI interactions
 *
 * @example
 * ```tsx
 * const { execute, content, isLoading } = useAgent({
 *   endpoint: '/api/agent',
 *   agentId: 'task-agent',
 * });
 *
 * const handleClick = async () => {
 *   const result = await execute('Analyze this data...');
 *   console.log(result);
 * };
 * ```
 */
export function useAgent(config: UseAgentConfig): UseAgentReturn {
  const {
    endpoint,
    agentId,
    headers = {},
    onStart,
    onContentUpdate,
    onToolApproval,
    onError,
    onComplete,
    onThinking,
  } = config;

  // State
  const [content, setContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<TrackedToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [metadata, setMetadata] = useState<ChatMessage['metadata'] | null>(
    null,
  );

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingApprovalsRef = useRef<Map<string, ToolApprovalResponse>>(
    new Map(),
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Execute the agent with streaming
   */
  async function* executeStream(
    input: string,
    context?: Record<string, unknown>,
  ): AsyncGenerator<ChatStreamChunk, void, unknown> {
    onStart?.();
    setError(null);
    setIsLoading(true);
    setIsStreaming(true);
    setContent('');
    setThinkingContent('');
    setActiveToolCalls([]);
    setMetadata(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...headers,
        },
        body: JSON.stringify({
          input,
          agentId,
          context,
          stream: true,
          toolApprovals: Array.from(pendingApprovalsRef.current.values()),
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let accumulatedThinking = '';

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
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsStreaming(false);
              setIsLoading(false);
              return;
            }

            try {
              const chunk = JSON.parse(data) as ChatStreamChunk;

              // Process chunk for state updates
              switch (chunk.type) {
                case 'content':
                  if (chunk.delta) {
                    accumulatedContent += chunk.content;
                  } else {
                    accumulatedContent = chunk.content;
                  }
                  setContent(accumulatedContent);
                  onContentUpdate?.(chunk.content);
                  break;

                case 'thinking': {
                  if (chunk.delta) {
                    accumulatedThinking += chunk.content;
                  } else {
                    accumulatedThinking = chunk.content;
                  }
                  setThinkingContent(accumulatedThinking);
                  const thinking: ThinkingPart = {
                    type: 'thinking',
                    content: chunk.content,
                    isComplete: false,
                  };
                  onThinking?.(thinking);
                  break;
                }

                case 'tool_call':
                  setActiveToolCalls((prev) => {
                    const existing = prev.find(
                      (tc) => tc.id === chunk.toolCall.id,
                    );
                    if (existing) {
                      return prev.map((tc) =>
                        tc.id === chunk.toolCall.id ? chunk.toolCall : tc,
                      );
                    }
                    return [...prev, chunk.toolCall];
                  });
                  if (chunk.toolCall.needsApproval) {
                    onToolApproval?.(chunk.toolCall);
                  }
                  break;

                case 'tool_result':
                  setActiveToolCalls((prev) =>
                    prev.map((tc) =>
                      tc.id === chunk.toolCall.id
                        ? { ...chunk.toolCall, state: 'complete' as const }
                        : tc,
                    ),
                  );
                  break;

                case 'tool_state':
                  setActiveToolCalls((prev) =>
                    prev.map((tc) =>
                      tc.id === chunk.toolCallId
                        ? { ...tc, state: chunk.state }
                        : tc,
                    ),
                  );
                  break;

                case 'done':
                  setMetadata(chunk.metadata || null);
                  setIsStreaming(false);
                  setIsLoading(false);
                  break;

                case 'error': {
                  const err = new Error(chunk.error);
                  setError(err);
                  setIsStreaming(false);
                  setIsLoading(false);
                  onError?.(err);
                  break;
                }
              }

              yield chunk;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Clear pending approvals
      pendingApprovalsRef.current.clear();
    } catch (err) {
      const error = err as Error;
      if (error.name !== 'AbortError') {
        setError(error);
        onError?.(error);
      }
      setIsStreaming(false);
      setIsLoading(false);
      throw error;
    }
  }

  /**
   * Execute the agent and wait for complete response
   */
  const execute = useCallback(
    async (
      input: string,
      context?: Record<string, unknown>,
    ): Promise<AgentResponse | null> => {
      onStart?.();
      setError(null);
      setIsLoading(true);
      setContent('');
      setThinkingContent('');
      setActiveToolCalls([]);
      setMetadata(null);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            input,
            agentId,
            context,
            stream: false,
            toolApprovals: Array.from(pendingApprovalsRef.current.values()),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const result = (await response.json()) as AgentResponse;

        setContent(result.content);
        setMetadata({
          tokensUsed: result.metadata?.tokensUsed,
          latencyMs: result.metadata?.latencyMs,
          finishReason: result.finishReason,
        });

        if (result.toolCalls) {
          setActiveToolCalls(
            result.toolCalls.map((tc) => ({
              ...tc,
              state: 'complete' as const,
            })),
          );
        }

        setIsLoading(false);
        onComplete?.(result);
        pendingApprovalsRef.current.clear();

        return result;
      } catch (err) {
        const error = err as Error;
        if (error.name !== 'AbortError') {
          setError(error);
          onError?.(error);
        }
        setIsLoading(false);
        return null;
      }
    },
    [endpoint, headers, agentId, onStart, onComplete, onError],
  );

  /**
   * Approve a tool call
   */
  const approveToolCall = useCallback((toolCallId: string): void => {
    pendingApprovalsRef.current.set(toolCallId, {
      toolCallId,
      approved: true,
    });

    setActiveToolCalls((prev) =>
      prev.map((tc) =>
        tc.id === toolCallId ? { ...tc, state: 'executing' as const } : tc,
      ),
    );
  }, []);

  /**
   * Deny a tool call
   */
  const denyToolCall = useCallback(
    (toolCallId: string, reason?: string): void => {
      pendingApprovalsRef.current.set(toolCallId, {
        toolCallId,
        approved: false,
        reason,
      });

      setActiveToolCalls((prev) =>
        prev.map((tc) =>
          tc.id === toolCallId
            ? { ...tc, state: 'approval-denied' as const }
            : tc,
        ),
      );
    },
    [],
  );

  /**
   * Stop the current execution
   */
  const stop = useCallback((): void => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback((): void => {
    stop();
    setContent('');
    setThinkingContent('');
    setActiveToolCalls([]);
    setError(null);
    setMetadata(null);
    pendingApprovalsRef.current.clear();
  }, [stop]);

  return {
    execute,
    executeStream,
    content,
    thinkingContent,
    activeToolCalls,
    isLoading,
    isStreaming,
    error,
    metadata,
    approveToolCall,
    denyToolCall,
    stop,
    reset,
  };
}

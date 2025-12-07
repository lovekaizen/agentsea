import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  UseChatConfig,
  UseChatReturn,
  ChatMessage,
  TrackedToolCall,
  ChatStreamChunk,
  ThinkingPart,
  ToolApprovalResponse,
} from './types';
import { generateId, createMessage } from './types';
import { getAdapter } from './adapters';

/**
 * useChat - A React hook for building chat interfaces with AI agents
 *
 * Features:
 * - Automatic message state management
 * - Streaming support with real-time content updates
 * - Tool call tracking with approval workflows
 * - Thinking/reasoning token support
 * - Error handling and retry logic
 *
 * @example
 * ```tsx
 * const { messages, sendMessage, isLoading } = useChat({
 *   endpoint: '/api/chat',
 *   agentId: 'my-agent',
 *   onToolApproval: (toolCall) => {
 *     // Handle tool approval UI
 *   }
 * });
 * ```
 */
export function useChat(config: UseChatConfig): UseChatReturn {
  const {
    endpoint,
    conversationId: initialConversationId,
    agentId,
    initialMessages = [],
    adapter: adapterType = 'sse',
    headers = {},
    onMessage,
    onContentUpdate,
    onToolApproval,
    onError,
    onComplete,
    onThinking,
    autoApprove = false,
    maxRetries = 3,
  } = config;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingContent, setStreamingContent] = useState('');
  const [thinkingContent, setThinkingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<TrackedToolCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const adapterRef = useRef(getAdapter(adapterType));
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef(initialConversationId || generateId());
  const pendingApprovalsRef = useRef<Map<string, ToolApprovalResponse>>(
    new Map(),
  );
  const retryCountRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      adapterRef.current.close();
    };
  }, []);

  /**
   * Process incoming stream chunks
   */
  const processChunk = useCallback(
    (chunk: ChatStreamChunk) => {
      switch (chunk.type) {
        case 'content':
          if (chunk.delta) {
            setStreamingContent((prev) => prev + chunk.content);
          } else {
            setStreamingContent(chunk.content);
          }
          onContentUpdate?.(chunk.content);
          break;

        case 'thinking': {
          if (chunk.delta) {
            setThinkingContent((prev) => prev + chunk.content);
          } else {
            setThinkingContent(chunk.content);
          }
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
            const existing = prev.find((tc) => tc.id === chunk.toolCall.id);
            if (existing) {
              return prev.map((tc) =>
                tc.id === chunk.toolCall.id ? chunk.toolCall : tc,
              );
            }
            return [...prev, chunk.toolCall];
          });

          // Handle approval flow
          if (chunk.toolCall.needsApproval && !autoApprove) {
            onToolApproval?.(chunk.toolCall);
          } else if (autoApprove && chunk.toolCall.needsApproval) {
            // Auto-approve if configured
            pendingApprovalsRef.current.set(chunk.toolCall.id, {
              toolCallId: chunk.toolCall.id,
              approved: true,
            });
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
              tc.id === chunk.toolCallId ? { ...tc, state: chunk.state } : tc,
            ),
          );
          break;

        case 'done': {
          setIsStreaming(false);
          setIsLoading(false);

          // Create the final message
          const finalContent = streamingContent;
          const finalThinking = thinkingContent;
          const finalToolCalls = [...activeToolCalls];

          if (finalContent || finalToolCalls.length > 0) {
            const assistantMessage = createMessage('assistant', finalContent, {
              toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
              thinking: finalThinking
                ? { type: 'thinking', content: finalThinking, isComplete: true }
                : undefined,
              metadata: chunk.metadata,
            });

            setMessages((prev) => [...prev, assistantMessage]);
            onMessage?.(assistantMessage);
            onComplete?.(assistantMessage);
          }

          // Reset streaming state
          setStreamingContent('');
          setThinkingContent('');
          setActiveToolCalls([]);
          retryCountRef.current = 0;
          break;
        }

        case 'error': {
          const err = new Error(chunk.error);
          setError(err);
          setIsStreaming(false);
          setIsLoading(false);
          onError?.(err);
          break;
        }
      }
    },
    [
      streamingContent,
      thinkingContent,
      activeToolCalls,
      autoApprove,
      onContentUpdate,
      onThinking,
      onToolApproval,
      onMessage,
      onComplete,
      onError,
    ],
  );

  /**
   * Send a message to the chat
   */
  const sendMessage = useCallback(
    async (content: string): Promise<void> => {
      if (!content.trim()) return;

      // Create and add user message
      const userMessage = createMessage('user', content);
      setMessages((prev) => [...prev, userMessage]);

      // Reset state
      setError(null);
      setIsLoading(true);
      setIsStreaming(true);
      setStreamingContent('');
      setThinkingContent('');
      setActiveToolCalls([]);

      // Setup abort controller
      abortControllerRef.current = new AbortController();

      try {
        const adapter = adapterRef.current;

        // Connect adapter
        await adapter.connect(endpoint, {
          headers,
          signal: abortControllerRef.current.signal,
        });

        // Setup callbacks
        adapter.onMessage(processChunk);
        adapter.onError((err) => {
          setError(err);
          setIsStreaming(false);
          setIsLoading(false);
          onError?.(err);
        });
        adapter.onClose(() => {
          setIsStreaming(false);
        });

        // Get all messages including the new one
        const allMessages = [...messages, userMessage];

        // Send request
        await adapter.send({
          messages: allMessages,
          conversationId: conversationIdRef.current,
          agentId,
          stream: true,
          toolApprovals: Array.from(pendingApprovalsRef.current.values()),
        });

        // Clear pending approvals after sending
        pendingApprovalsRef.current.clear();
      } catch (err) {
        const error = err as Error;
        if (error.name !== 'AbortError') {
          setError(error);
          onError?.(error);

          // Retry logic
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            // Remove the user message and retry
            setMessages((prev) => prev.slice(0, -1));
            await sendMessage(content);
            return;
          }
        }
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [endpoint, headers, agentId, messages, processChunk, onError, maxRetries],
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
   * Stop the current stream
   */
  const stop = useCallback((): void => {
    abortControllerRef.current?.abort();
    adapterRef.current.close();
    setIsStreaming(false);
    setIsLoading(false);

    // Save partial response as a message if there's content
    if (streamingContent) {
      const partialMessage = createMessage('assistant', streamingContent, {
        toolCalls: activeToolCalls.length > 0 ? activeToolCalls : undefined,
        thinking: thinkingContent
          ? { type: 'thinking', content: thinkingContent, isComplete: false }
          : undefined,
        metadata: { finishReason: 'stopped' },
      });
      setMessages((prev) => [...prev, partialMessage]);
    }

    setStreamingContent('');
    setThinkingContent('');
    setActiveToolCalls([]);
  }, [streamingContent, thinkingContent, activeToolCalls]);

  /**
   * Clear all messages
   */
  const clear = useCallback((): void => {
    stop();
    setMessages([]);
    setError(null);
    conversationIdRef.current = generateId();
  }, [stop]);

  /**
   * Reload/regenerate the last response
   */
  const reload = useCallback(async (): Promise<void> => {
    // Find the last user message
    const lastUserMessageIndex = messages
      .map((m) => m.role)
      .lastIndexOf('user');

    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex];

    // Remove messages from the last user message onwards
    setMessages((prev) => prev.slice(0, lastUserMessageIndex));

    // Resend the message
    await sendMessage(lastUserMessage.content);
  }, [messages, sendMessage]);

  return {
    messages,
    streamingContent,
    thinkingContent,
    activeToolCalls,
    isLoading,
    isStreaming,
    error,
    sendMessage,
    approveToolCall,
    denyToolCall,
    stop,
    clear,
    reload,
    setMessages,
  };
}

import { ToolRegistry } from '../tools/tool-registry';
import {
  AgentConfig,
  AgentContext,
  AgentResponse,
  Message,
  ToolCall,
  LLMProvider,
  MemoryStore,
  StreamEvent,
} from '../types';
import { ContentFormatter } from '../formatters';

/**
 * Base Agent class for executing agentic workflows
 */
export class Agent {
  private iterationCount = 0;

  constructor(
    public readonly config: AgentConfig,
    private readonly provider: LLMProvider,
    private readonly toolRegistry: ToolRegistry,
    private readonly memory?: MemoryStore,
  ) {}

  /**
   * Execute the agent with the given input
   */
  async execute(input: string, context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    this.iterationCount = 0;

    try {
      // Load conversation history
      const history = await this.loadHistory(context);

      // Add user message
      const messages: Message[] = [
        ...history,
        { role: 'user', content: input },
      ];

      // Execute agent loop
      const response = await this.executeLoop(messages, context);

      // Save conversation history
      await this.saveHistory(context, [
        ...messages,
        { role: 'assistant', content: response.content },
      ]);

      return {
        ...response,
        metadata: {
          ...response.metadata,
          latencyMs: Date.now() - startTime,
          iterations: this.iterationCount,
        },
      };
    } catch (error) {
      throw new Error(
        `Agent execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Execute the agent with streaming responses
   */
  async *executeStream(
    input: string,
    context: AgentContext,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const startTime = Date.now();
    this.iterationCount = 0;

    try {
      // Load conversation history
      const history = await this.loadHistory(context);

      // Add user message
      const messages: Message[] = [
        ...history,
        { role: 'user', content: input },
      ];

      // Execute agent loop with streaming
      yield* this.executeLoopStream(messages, context);

      // Emit completion event
      yield {
        type: 'done',
        metadata: {
          latencyMs: Date.now() - startTime,
          iterations: this.iterationCount,
        },
      };
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute the agent loop with tool calls
   */
  private async executeLoop(
    messages: Message[],
    context: AgentContext,
  ): Promise<AgentResponse> {
    const maxIterations = this.config.maxIterations || 10;
    const currentMessages = [...messages];
    let totalTokens = 0;

    while (this.iterationCount < maxIterations) {
      this.iterationCount++;

      // Generate response from LLM
      const llmResponse = await this.provider.generateResponse(
        currentMessages,
        {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          tools: this.config.tools,
          systemPrompt: this.config.systemPrompt,
        },
      );

      totalTokens +=
        llmResponse.usage.inputTokens + llmResponse.usage.outputTokens;

      // Parse tool calls
      const toolCalls = this.provider.parseToolCalls(llmResponse);

      // If no tool calls, return the response
      if (toolCalls.length === 0) {
        const response: AgentResponse = {
          content: llmResponse.content,
          toolCalls: [],
          metadata: {
            tokensUsed: totalTokens,
            latencyMs: 0, // Will be set by execute()
            iterations: this.iterationCount,
          },
          finishReason: llmResponse.stopReason as any,
        };

        // Apply formatting if configured
        if (this.config.outputFormat && this.config.outputFormat !== 'text') {
          response.formatted = ContentFormatter.format(
            llmResponse.content,
            this.config.outputFormat,
            this.config.formatOptions,
          );
        }

        return response;
      }

      // Execute tool calls
      const toolResults = await this.executeToolCalls(toolCalls, context);

      // Add assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content: llmResponse.content,
      });

      // Add tool results
      for (const result of toolResults) {
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
          name: result.tool,
          toolCallId: result.id,
        });
      }
    }

    throw new Error(`Agent exceeded maximum iterations (${maxIterations})`);
  }

  /**
   * Execute the agent loop with streaming
   */
  private async *executeLoopStream(
    messages: Message[],
    context: AgentContext,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const maxIterations = this.config.maxIterations || 10;
    const currentMessages = [...messages];
    let totalTokens = 0;

    while (this.iterationCount < maxIterations) {
      this.iterationCount++;

      yield {
        type: 'iteration',
        iteration: this.iterationCount,
      };

      // Check if provider supports streaming
      if (!this.provider.streamResponse) {
        // Fallback to non-streaming
        const llmResponse = await this.provider.generateResponse(
          currentMessages,
          {
            model: this.config.model,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            tools: this.config.tools,
            systemPrompt: this.config.systemPrompt,
          },
        );

        yield {
          type: 'content',
          content: llmResponse.content,
        };

        totalTokens +=
          llmResponse.usage.inputTokens + llmResponse.usage.outputTokens;

        const toolCalls = this.provider.parseToolCalls(llmResponse);

        if (toolCalls.length === 0) {
          yield {
            type: 'done',
            metadata: {
              tokensUsed: totalTokens,
              iterations: this.iterationCount,
            },
          };
          return;
        }

        yield {
          type: 'tool_calls',
          toolCalls,
        };

        const toolResults = await this.executeToolCalls(toolCalls, context);

        for (const result of toolResults) {
          yield {
            type: 'tool_result',
            toolCall: result,
          };
        }

        currentMessages.push({
          role: 'assistant',
          content: llmResponse.content,
        });

        for (const result of toolResults) {
          currentMessages.push({
            role: 'tool',
            content: JSON.stringify(result.result),
            name: result.tool,
            toolCallId: result.id,
          });
        }

        continue;
      }

      // Stream response from LLM
      let content = '';
      const streamingToolCalls: ToolCall[] = [];

      for await (const chunk of this.provider.streamResponse(currentMessages, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        tools: this.config.tools,
        systemPrompt: this.config.systemPrompt,
      })) {
        if (chunk.type === 'content' && chunk.content) {
          content += chunk.content;
          yield {
            type: 'content',
            content: chunk.content,
            delta: true,
          };
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          // Accumulate tool call
          if (chunk.toolCall.id) {
            streamingToolCalls.push(chunk.toolCall as ToolCall);
          }
        }
      }

      // If no tool calls, we're done
      if (streamingToolCalls.length === 0) {
        yield {
          type: 'done',
          metadata: {
            tokensUsed: totalTokens,
            iterations: this.iterationCount,
          },
        };

        // Save conversation
        await this.saveHistory(context, [
          ...currentMessages,
          { role: 'assistant', content },
        ]);

        return;
      }

      // Emit tool calls event
      yield {
        type: 'tool_calls',
        toolCalls: streamingToolCalls,
      };

      // Execute tool calls
      const toolResults = await this.executeToolCalls(
        streamingToolCalls,
        context,
      );

      // Emit tool results
      for (const result of toolResults) {
        yield {
          type: 'tool_result',
          toolCall: result,
        };
      }

      // Add to message history
      currentMessages.push({
        role: 'assistant',
        content,
      });

      for (const result of toolResults) {
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
          name: result.tool,
          toolCallId: result.id,
        });
      }
    }

    throw new Error(`Agent exceeded maximum iterations (${maxIterations})`);
  }

  /**
   * Execute multiple tool calls in parallel
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    context: AgentContext,
  ): Promise<ToolCall[]> {
    const results = await Promise.all(
      toolCalls.map(async (toolCall) => {
        try {
          const result = await this.toolRegistry.execute(toolCall, {
            agentName: this.config.name,
            conversationId: context.conversationId,
            metadata: context.metadata || {},
          });

          return {
            ...toolCall,
            result,
          };
        } catch (error) {
          return {
            ...toolCall,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    return results;
  }

  /**
   * Load conversation history from memory
   */
  private async loadHistory(context: AgentContext): Promise<Message[]> {
    if (!this.memory) {
      return context.history || [];
    }

    try {
      return await this.memory.load(context.conversationId);
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
      return context.history || [];
    }
  }

  /**
   * Save conversation history to memory
   */
  private async saveHistory(
    context: AgentContext,
    messages: Message[],
  ): Promise<void> {
    if (!this.memory) {
      return;
    }

    try {
      await this.memory.save(context.conversationId, messages);
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
  }

  /**
   * Format a response with the configured output format
   */
  formatResponse(response: AgentResponse): AgentResponse {
    if (!this.config.outputFormat || this.config.outputFormat === 'text') {
      return response;
    }

    return {
      ...response,
      formatted: ContentFormatter.format(
        response.content,
        this.config.outputFormat,
        this.config.formatOptions,
      ),
    };
  }
}

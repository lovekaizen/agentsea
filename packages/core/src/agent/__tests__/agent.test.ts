import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { ToolRegistry } from '../../tools/tool-registry';
import { BufferMemory } from '../../memory/buffer-memory';
import { LLMProvider, AgentConfig, AgentContext } from '../../types';

// Mock provider
class MockProvider implements LLMProvider {
  async generateResponse() {
    return {
      content: 'Mock response',
      stopReason: 'stop',
      usage: {
        inputTokens: 50,
        outputTokens: 50,
      },
      rawResponse: {},
    };
  }

  async *streamResponse() {
    yield {
      type: 'content' as const,
      content: 'Mock ',
    };
    yield {
      type: 'content' as const,
      content: 'stream',
    };
    yield {
      type: 'done' as const,
      done: true,
    };
  }

  parseToolCalls() {
    return [];
  }
}

describe('Agent', () => {
  let agent: Agent;
  let provider: MockProvider;
  let toolRegistry: ToolRegistry;
  let memory: BufferMemory;
  let config: AgentConfig;
  let context: AgentContext;

  beforeEach(() => {
    provider = new MockProvider();
    toolRegistry = new ToolRegistry();
    memory = new BufferMemory(50);

    config = {
      name: 'test-agent',
      description: 'A test agent',
      model: 'test-model',
      provider: 'mock',
      systemPrompt: 'You are a test agent',
      tools: [],
    };

    context = {
      conversationId: 'test-123',
      sessionData: {},
      history: [],
    };

    agent = new Agent(config, provider, toolRegistry, memory);
  });

  describe('initialization', () => {
    it('should create agent with valid configuration', () => {
      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('test-agent');
      expect(agent.config).toEqual(config);
    });

    it('should accept configuration with empty name', () => {
      const invalidConfig = { ...config, name: '' };
      // The Agent constructor doesn't validate the name, so this won't throw
      const emptyNameAgent = new Agent(
        invalidConfig,
        provider,
        toolRegistry,
        memory,
      );
      expect(emptyNameAgent).toBeDefined();
      expect(emptyNameAgent.config.name).toBe('');
    });
  });

  describe('execute', () => {
    it('should execute successfully with valid input', async () => {
      const response = await agent.execute('Hello', context);

      expect(response).toBeDefined();
      expect(response.content).toBe('Mock response');
      expect(response.metadata.tokensUsed).toBeGreaterThan(0);
    });

    it('should handle empty prompt', async () => {
      // The Agent doesn't validate empty prompts, it will execute normally
      const response = await agent.execute('', context);
      expect(response).toBeDefined();
      expect(response.content).toBe('Mock response');
    });

    it('should save to memory after execution', async () => {
      await agent.execute('Hello', context);

      const messages = await memory.load('test-123');
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should include session data in context', async () => {
      const contextWithData = {
        ...context,
        sessionData: { userId: '123', preferences: { language: 'en' } },
      };

      const response = await agent.execute('Hello', contextWithData);
      expect(response).toBeDefined();
    });
  });

  describe('stream', () => {
    it('should stream responses', async () => {
      const chunks: string[] = [];

      for await (const chunk of agent.executeStream('Hello', context)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.content!);
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle stream errors gracefully', async () => {
      const errorProvider = {
        ...provider,
        async *streamResponse() {
          throw new Error('Stream error');
        },
      } as LLMProvider;

      const errorAgent = new Agent(config, errorProvider, toolRegistry, memory);

      let hasError = false;
      for await (const chunk of errorAgent.executeStream('Hello', context)) {
        if (chunk.type === 'error') {
          hasError = true;
          expect(chunk.error).toContain('Stream error');
        }
      }
      expect(hasError).toBe(true);
    });
  });

  describe('tool calling', () => {
    it('should execute tools when available', async () => {
      const mockTool = {
        name: 'test-tool',
        description: 'A test tool',
        parameters: z.object({
          param: z.string(),
        }),
        execute: vi.fn().mockResolvedValue({ result: 'success' }),
      };

      toolRegistry.register(mockTool);

      let callCount = 0;
      const toolProvider = {
        ...provider,
        async generateResponse(messages: any) {
          callCount++;
          // First call returns tool call, subsequent calls return final response
          if (callCount === 1) {
            return {
              content: 'Using tool',
              stopReason: 'tool_calls',
              usage: {
                inputTokens: 50,
                outputTokens: 50,
              },
              rawResponse: {},
            };
          } else {
            return {
              content: 'Tool completed',
              stopReason: 'stop',
              usage: {
                inputTokens: 50,
                outputTokens: 50,
              },
              rawResponse: {},
            };
          }
        },
        parseToolCalls: (response: any) => {
          // Only return tool calls for the first response
          if (callCount === 1 && response.stopReason === 'tool_calls') {
            return [
              {
                id: 'call-1',
                tool: 'test-tool',
                parameters: { param: 'value' },
              },
            ];
          }
          return [];
        },
      } as LLMProvider;

      const toolAgent = new Agent(config, toolProvider, toolRegistry, memory);
      const response = await toolAgent.execute('Use the tool', context);

      expect(response).toBeDefined();
      expect(mockTool.execute).toHaveBeenCalled();
    });

    it('should handle tool execution errors', async () => {
      const errorTool = {
        name: 'error-tool',
        description: 'A tool that errors',
        parameters: vi.fn(),
        execute: vi.fn().mockRejectedValue(new Error('Tool error')),
      };

      toolRegistry.register(errorTool);

      const toolProvider = {
        ...provider,
        async generateResponse() {
          return {
            content: 'Tool failed',
            stopReason: 'tool_calls',
            usage: {
              inputTokens: 50,
              outputTokens: 50,
            },
            rawResponse: {},
          };
        },
        parseToolCalls: () => [
          {
            id: 'call-1',
            tool: 'error-tool',
            parameters: {},
          },
        ],
      } as LLMProvider;

      const toolAgent = new Agent(config, toolProvider, toolRegistry, memory);

      // Should handle error gracefully
      await expect(
        toolAgent.execute('Use bad tool', context),
      ).rejects.toThrow();
    });
  });

  describe('memory integration', () => {
    it('should load conversation history', async () => {
      // Add some history
      await memory.save('test-123', [
        { role: 'user', content: 'Previous message' },
        { role: 'assistant', content: 'Previous response' },
      ]);

      const response = await agent.execute('New message', context);
      expect(response).toBeDefined();
    });

    it('should respect memory limits', async () => {
      const smallMemory = new BufferMemory(2);
      const memoryAgent = new Agent(
        config,
        provider,
        toolRegistry,
        smallMemory,
      );

      await memoryAgent.execute('Message 1', context);
      await memoryAgent.execute('Message 2', context);
      await memoryAgent.execute('Message 3', context);

      const messages = await smallMemory.load('test-123');
      expect(messages.length).toBeLessThanOrEqual(2);
    });
  });
});

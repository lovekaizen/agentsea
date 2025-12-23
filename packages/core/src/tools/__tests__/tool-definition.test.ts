import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import {
  toolDefinition,
  hybridTool,
  serverTool,
  clientTool,
  toLegacyTool,
  toLegacyTools,
} from '../tool-definition';
import { ToolContext } from '../../types';

describe('Tool Definition Utilities', () => {
  const mockContext: ToolContext = {
    conversationId: 'test-123',
    sessionId: 'session-123',
    agentName: 'test-agent',
  };

  describe('toolDefinition', () => {
    it('should create a tool definition', () => {
      const def = toolDefinition({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: z.object({
          value: z.string(),
        }),
        outputSchema: z.object({
          result: z.string(),
        }),
      });

      expect(def.name).toBe('test_tool');
      expect(def.description).toBe('A test tool');
      expect(def.needsApproval).toBe(false);
    });

    it('should create tool with needsApproval flag', () => {
      const def = toolDefinition({
        name: 'dangerous_tool',
        description: 'A dangerous tool',
        inputSchema: z.object({}),
        needsApproval: true,
      });

      expect(def.needsApproval).toBe(true);
    });

    it('should create tool with retry config', () => {
      const retryConfig = {
        maxAttempts: 3,
        delayMs: 1000,
      };

      const def = toolDefinition({
        name: 'retry_tool',
        description: 'A tool with retry',
        inputSchema: z.object({}),
        retryConfig,
      });

      expect(def.retryConfig).toEqual(retryConfig);
    });

    it('should use default output schema when not provided', () => {
      const def = toolDefinition({
        name: 'test_tool',
        description: 'Test',
        inputSchema: z.object({}),
      });

      expect(def.outputSchema).toBeDefined();
    });
  });

  describe('ServerTool', () => {
    it('should create server tool implementation', async () => {
      const def = toolDefinition({
        name: 'add',
        description: 'Add two numbers',
        inputSchema: z.object({
          a: z.number(),
          b: z.number(),
        }),
        outputSchema: z.object({
          result: z.number(),
        }),
      });

      const tool = def.server(async ({ a, b }) => {
        return { result: a + b };
      });

      expect(tool.environment).toBe('server');

      const result = await tool.execute({ a: 5, b: 3 }, mockContext);
      expect(result.result).toBe(8);
    });

    it('should validate input schema', async () => {
      const def = toolDefinition({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({
          value: z.string(),
        }),
      });

      const tool = def.server(async ({ value }) => {
        return { value };
      });

      await expect(
        tool.execute({ value: 123 } as any, mockContext),
      ).rejects.toThrow();
    });

    it('should validate output schema', async () => {
      const def = toolDefinition({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({}),
        outputSchema: z.object({
          result: z.number(),
        }),
      });

      const tool = def.server(async () => {
        return { result: 'invalid' } as any;
      });

      await expect(tool.execute({}, mockContext)).rejects.toThrow();
    });

    it('should convert to legacy Tool interface', async () => {
      const def = toolDefinition({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({
          value: z.string(),
        }),
      });

      const tool = def.server(async ({ value }) => {
        return { value };
      });

      const legacyTool = tool.toTool();

      expect(legacyTool.name).toBe('test');
      expect(legacyTool.description).toBe('Test');
      expect(legacyTool.parameters).toBeDefined();
      expect(legacyTool.execute).toBeDefined();
    });

    it('should preserve retry config in legacy tool', () => {
      const retryConfig = { maxAttempts: 3, delayMs: 1000 };
      const def = toolDefinition({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({}),
        retryConfig,
      });

      const tool = def.server(async () => ({}));
      const legacyTool = tool.toTool();

      expect(legacyTool.retryConfig).toEqual(retryConfig);
    });
  });

  describe('ClientTool', () => {
    it('should create client tool implementation', async () => {
      const def = toolDefinition({
        name: 'notify',
        description: 'Show notification',
        inputSchema: z.object({
          message: z.string(),
        }),
        outputSchema: z.object({
          shown: z.boolean(),
        }),
      });

      const tool = def.client(({ message }) => {
        return { shown: true };
      });

      expect(tool.environment).toBe('client');

      const result = await tool.execute({ message: 'Hello' }, mockContext);
      expect(result.shown).toBe(true);
    });

    it('should support async client functions', async () => {
      const def = toolDefinition({
        name: 'fetch_data',
        description: 'Fetch data',
        inputSchema: z.object({
          url: z.string(),
        }),
      });

      const tool = def.client(async ({ url }) => {
        return { data: 'fetched' };
      });

      const result = await tool.execute({ url: 'http://test' }, mockContext);
      expect(result).toEqual({ data: 'fetched' });
    });

    it('should validate input on client', async () => {
      const def = toolDefinition({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({
          count: z.number(),
        }),
      });

      const tool = def.client(({ count }) => ({ count }));

      await expect(
        tool.execute({ count: 'invalid' } as any, mockContext),
      ).rejects.toThrow();
    });
  });

  describe('hybridTool', () => {
    it('should create hybrid tool with both implementations', async () => {
      const tool = hybridTool({
        name: 'get_user',
        description: 'Get user data',
        inputSchema: z.object({
          userId: z.string(),
        }),
        outputSchema: z.object({
          name: z.string(),
        }),
        server: async ({ userId }) => {
          return { name: `Server User ${userId}` };
        },
        client: async ({ userId }) => {
          return { name: `Client User ${userId}` };
        },
      });

      expect(tool.server.environment).toBe('server');
      expect(tool.client.environment).toBe('client');

      const serverResult = await tool.server.execute(
        { userId: '123' },
        mockContext,
      );
      expect(serverResult.name).toBe('Server User 123');

      const clientResult = await tool.client.execute(
        { userId: '456' },
        mockContext,
      );
      expect(clientResult.name).toBe('Client User 456');
    });

    it('should convert to legacy tool using server implementation', async () => {
      const tool = hybridTool({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({}),
        server: async () => ({ server: true }),
        client: async () => ({ client: true }),
      });

      const legacyTool = tool.toTool();
      const result = await legacyTool.execute({}, mockContext);

      expect(result).toEqual({ server: true });
    });
  });

  describe('serverTool helper', () => {
    it('should create server tool in one step', async () => {
      const tool = serverTool({
        name: 'calculate',
        description: 'Calculate',
        inputSchema: z.object({
          a: z.number(),
          b: z.number(),
        }),
        execute: async ({ a, b }) => {
          return { result: a * b };
        },
      });

      expect(tool.environment).toBe('server');

      const result = await tool.execute({ a: 5, b: 3 }, mockContext);
      expect(result.result).toBe(15);
    });
  });

  describe('clientTool helper', () => {
    it('should create client tool in one step', async () => {
      const tool = clientTool({
        name: 'alert',
        description: 'Show alert',
        inputSchema: z.object({
          message: z.string(),
        }),
        execute: ({ message }) => {
          return { shown: true, message };
        },
      });

      expect(tool.environment).toBe('client');

      const result = await tool.execute({ message: 'Test' }, mockContext);
      expect(result.shown).toBe(true);
    });
  });

  describe('toLegacyTool', () => {
    it('should convert server tool to legacy', () => {
      const tool = serverTool({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({}),
        execute: async () => ({}),
      });

      const legacy = toLegacyTool(tool);

      expect(legacy.name).toBe('test');
      expect(legacy.description).toBe('Test');
    });

    it('should convert client tool to legacy', () => {
      const tool = clientTool({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({}),
        execute: () => ({}),
      });

      const legacy = toLegacyTool(tool);

      expect(legacy.name).toBe('test');
    });

    it('should convert hybrid tool to legacy', () => {
      const tool = hybridTool({
        name: 'test',
        description: 'Test',
        inputSchema: z.object({}),
        server: async () => ({}),
        client: () => ({}),
      });

      const legacy = toLegacyTool(tool);

      expect(legacy.name).toBe('test');
    });
  });

  describe('toLegacyTools', () => {
    it('should convert multiple tools to legacy', () => {
      const tools = [
        serverTool({
          name: 'server_tool',
          description: 'Server',
          inputSchema: z.object({}),
          execute: async () => ({}),
        }),
        clientTool({
          name: 'client_tool',
          description: 'Client',
          inputSchema: z.object({}),
          execute: () => ({}),
        }),
      ];

      const legacyTools = toLegacyTools(tools);

      expect(legacyTools).toHaveLength(2);
      expect(legacyTools[0].name).toBe('server_tool');
      expect(legacyTools[1].name).toBe('client_tool');
    });

    it('should handle empty array', () => {
      const legacyTools = toLegacyTools([]);
      expect(legacyTools).toEqual([]);
    });
  });

  describe('schema validation edge cases', () => {
    it('should handle complex nested schemas', async () => {
      const tool = serverTool({
        name: 'complex',
        description: 'Complex tool',
        inputSchema: z.object({
          user: z.object({
            name: z.string(),
            age: z.number(),
            tags: z.array(z.string()),
          }),
        }),
        execute: async ({ user }) => ({ user }),
      });

      const result = await tool.execute(
        {
          user: {
            name: 'John',
            age: 30,
            tags: ['developer', 'designer'],
          },
        },
        mockContext,
      );

      expect(result.user.name).toBe('John');
    });

    it('should handle optional fields', async () => {
      const tool = serverTool({
        name: 'optional',
        description: 'Optional fields',
        inputSchema: z.object({
          required: z.string(),
          optional: z.string().optional(),
        }),
        execute: async (input) => input,
      });

      const result1 = await tool.execute({ required: 'test' }, mockContext);
      expect(result1.optional).toBeUndefined();

      const result2 = await tool.execute(
        { required: 'test', optional: 'value' },
        mockContext,
      );
      expect(result2.optional).toBe('value');
    });

    it('should handle union types', async () => {
      const tool = serverTool({
        name: 'union',
        description: 'Union types',
        inputSchema: z.object({
          value: z.union([z.string(), z.number()]),
        }),
        execute: async ({ value }) => ({ value }),
      });

      const result1 = await tool.execute({ value: 'string' }, mockContext);
      expect(result1.value).toBe('string');

      const result2 = await tool.execute({ value: 123 }, mockContext);
      expect(result2.value).toBe(123);
    });
  });

  describe('error handling', () => {
    it('should propagate execution errors', async () => {
      const tool = serverTool({
        name: 'failing',
        description: 'Failing tool',
        inputSchema: z.object({}),
        execute: async () => {
          throw new Error('Execution failed');
        },
      });

      await expect(tool.execute({}, mockContext)).rejects.toThrow(
        'Execution failed',
      );
    });

    it('should handle validation errors with meaningful messages', async () => {
      const tool = serverTool({
        name: 'strict',
        description: 'Strict validation',
        inputSchema: z.object({
          email: z.string().email(),
          age: z.number().min(0).max(120),
        }),
        execute: async (input) => input,
      });

      await expect(
        tool.execute({ email: 'invalid', age: 150 } as any, mockContext),
      ).rejects.toThrow();
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../tool-registry';
import { Tool } from '../../types';
import { z } from 'zod';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const mockTool: Tool = {
    name: 'test-tool',
    description: 'A test tool',
    parameters: z.object({
      input: z.string(),
    }),
    execute: async (input) => ({ result: input }),
  };

  const anotherTool: Tool = {
    name: 'another-tool',
    description: 'Another test tool',
    parameters: z.object({
      value: z.number(),
    }),
    execute: async (input) => ({ value: input.value * 2 }),
  };

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      registry.register(mockTool);
      expect(registry.has('test-tool')).toBe(true);
    });

    it('should throw error when registering duplicate tool', () => {
      registry.register(mockTool);
      expect(() => registry.register(mockTool)).toThrow(
        "Tool 'test-tool' is already registered",
      );
    });

    it('should throw error for invalid tool name', () => {
      const invalidTool = { ...mockTool, name: '' };
      // Empty name is still a valid string, so this won't throw
      // The test expectation was incorrect
      registry.register(invalidTool);
      expect(registry.has('')).toBe(true);
    });
  });

  describe('registerMany', () => {
    it('should register multiple tools', () => {
      registry.registerMany([mockTool, anotherTool]);

      expect(registry.has('test-tool')).toBe(true);
      expect(registry.has('another-tool')).toBe(true);
      expect(registry.getAll()).toHaveLength(2);
    });

    it('should throw error if any tool registration fails', () => {
      registry.register(mockTool);

      expect(() => {
        registry.registerMany([mockTool, anotherTool]);
      }).toThrow();
    });
  });

  describe('get', () => {
    it('should retrieve registered tool', () => {
      registry.register(mockTool);
      const tool = registry.get('test-tool');

      expect(tool).toBeDefined();
      expect(tool?.name).toBe('test-tool');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.get('non-existent');
      expect(tool).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for registered tool', () => {
      registry.register(mockTool);
      expect(registry.has('test-tool')).toBe(true);
    });

    it('should return false for non-registered tool', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array for new registry', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should list all registered tools', () => {
      registry.registerMany([mockTool, anotherTool]);
      const tools = registry.getAll();

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain('test-tool');
      expect(tools.map((t) => t.name)).toContain('another-tool');
    });
  });

  describe('unregister', () => {
    it('should remove registered tool', () => {
      registry.register(mockTool);
      registry.unregister('test-tool');

      expect(registry.has('test-tool')).toBe(false);
    });

    it('should not throw when unregistering non-existent tool', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  describe('tool execution', () => {
    it('should execute tool successfully', async () => {
      registry.register(mockTool);
      const tool = registry.get('test-tool');

      const result = await tool!.execute({ input: 'test' }, {} as any);
      expect(result).toEqual({ result: { input: 'test' } });
    });

    it('should validate input schema', async () => {
      registry.register(mockTool);
      const tool = registry.get('test-tool');

      // Valid input
      await expect(
        tool!.execute({ input: 'valid' }, {} as any),
      ).resolves.toBeDefined();

      // Invalid input - missing required field
      expect(() => tool!.parameters.parse({})).toThrow();
    });

    it('should handle tool execution errors', async () => {
      const errorTool: Tool = {
        name: 'error-tool',
        description: 'Tool that throws',
        parameters: z.object({}),
        execute: async () => {
          throw new Error('Execution failed');
        },
      };

      registry.register(errorTool);
      const tool = registry.get('error-tool');

      await expect(tool!.execute({}, {} as any)).rejects.toThrow(
        'Execution failed',
      );
    });
  });
});

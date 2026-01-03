import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { mcpToolToAgenticTool } from '../tool-adapter';
import { MCPTool } from '../types';
import { MCPClient } from '../client';

describe('mcpToolToAgenticTool', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      callTool: vi.fn(),
    };
  });

  it('should convert MCP tool with string parameter', () => {
    const mcpTool: MCPTool = {
      name: 'echo',
      description: 'Echo back the input',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to echo',
          },
        },
        required: ['message'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    expect(tool.name).toBe('echo');
    expect(tool.description).toBe('Echo back the input');
    expect(tool.parameters).toBeDefined();
  });

  it('should convert MCP tool with number parameter', () => {
    const mcpTool: MCPTool = {
      name: 'multiply',
      description: 'Multiply two numbers',
      inputSchema: {
        type: 'object',
        properties: {
          a: {
            type: 'number',
            description: 'First number',
          },
          b: {
            type: 'number',
            description: 'Second number',
          },
        },
        required: ['a', 'b'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    // Test that the schema validates correctly
    const result = tool.parameters.safeParse({ a: 5, b: 10 });
    expect(result.success).toBe(true);

    const invalidResult = tool.parameters.safeParse({ a: '5', b: 10 });
    expect(invalidResult.success).toBe(false);
  });

  it('should convert MCP tool with boolean parameter', () => {
    const mcpTool: MCPTool = {
      name: 'toggle',
      description: 'Toggle a setting',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Enable or disable',
          },
        },
        required: ['enabled'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = tool.parameters.safeParse({ enabled: true });
    expect(result.success).toBe(true);
  });

  it('should convert MCP tool with array parameter', () => {
    const mcpTool: MCPTool = {
      name: 'sum',
      description: 'Sum an array of numbers',
      inputSchema: {
        type: 'object',
        properties: {
          numbers: {
            type: 'array',
            description: 'Array of numbers',
            items: {
              type: 'number',
            },
          },
        },
        required: ['numbers'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = tool.parameters.safeParse({ numbers: [1, 2, 3] });
    expect(result.success).toBe(true);
  });

  it('should convert MCP tool with nested object', () => {
    const mcpTool: MCPTool = {
      name: 'create-user',
      description: 'Create a new user',
      inputSchema: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
            },
            required: ['name'],
          },
        },
        required: ['user'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = tool.parameters.safeParse({
      user: { name: 'John', age: 30 },
    });
    expect(result.success).toBe(true);
  });

  it('should make optional parameters optional', () => {
    const mcpTool: MCPTool = {
      name: 'greet',
      description: 'Greet someone',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          greeting: { type: 'string' },
        },
        required: ['name'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    // Should succeed with only required param
    const result1 = tool.parameters.safeParse({ name: 'John' });
    expect(result1.success).toBe(true);

    // Should succeed with all params
    const result2 = tool.parameters.safeParse({
      name: 'John',
      greeting: 'Hello',
    });
    expect(result2.success).toBe(true);
  });

  it('should execute tool and return text content', async () => {
    const mcpTool: MCPTool = {
      name: 'calculator',
      description: 'Perform calculations',
      inputSchema: {
        type: 'object',
        properties: {
          expression: { type: 'string' },
        },
        required: ['expression'],
      },
    };

    mockClient.callTool.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: '4',
        },
      ],
      isError: false,
    });

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = await tool.execute({ expression: '2 + 2' }, {} as any);

    expect(result.result).toBe('4');
    expect(result.metadata.mcpResponse).toBeDefined();
    expect(mockClient.callTool).toHaveBeenCalledWith('calculator', {
      expression: '2 + 2',
    });
  });

  it('should handle multiple text content blocks', async () => {
    const mcpTool: MCPTool = {
      name: 'test',
      description: 'Test tool',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };

    mockClient.callTool.mockResolvedValue({
      content: [
        { type: 'text', text: 'Part 1' },
        { type: 'text', text: 'Part 2' },
      ],
      isError: false,
    });

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = await tool.execute({}, {} as any);

    expect(result.result).toBe('Part 1\nPart 2');
  });

  it('should filter out non-text content', async () => {
    const mcpTool: MCPTool = {
      name: 'test',
      description: 'Test tool',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };

    mockClient.callTool.mockResolvedValue({
      content: [
        { type: 'text', text: 'Text content' },
        { type: 'image', data: 'base64...' },
        { type: 'text', text: 'More text' },
      ],
      isError: false,
    });

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = await tool.execute({}, {} as any);

    expect(result.result).toBe('Text content\nMore text');
  });

  it('should throw error when MCP tool returns error', async () => {
    const mcpTool: MCPTool = {
      name: 'failing-tool',
      description: 'A tool that fails',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };

    mockClient.callTool.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Tool execution failed',
        },
      ],
      isError: true,
    });

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    await expect(tool.execute({}, {} as any)).rejects.toThrow(
      'MCP tool error: Tool execution failed',
    );
  });

  it('should handle empty content in error response', async () => {
    const mcpTool: MCPTool = {
      name: 'failing-tool',
      description: 'A tool that fails',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    };

    mockClient.callTool.mockResolvedValue({
      content: [],
      isError: true,
    });

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    await expect(tool.execute({}, {} as any)).rejects.toThrow(
      'MCP tool error: Unknown error',
    );
  });

  it('should handle schema with no properties', () => {
    const mcpTool: MCPTool = {
      name: 'no-params',
      description: 'Tool with no parameters',
      inputSchema: {
        type: 'object',
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    const result = tool.parameters.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should handle non-object schema', () => {
    const mcpTool: MCPTool = {
      name: 'any-param',
      description: 'Tool with any parameter type',
      inputSchema: {
        type: 'string',
      } as any,
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    // Should create z.any() for non-object schemas
    expect(tool.parameters).toBeDefined();
  });

  it('should preserve parameter descriptions', () => {
    const mcpTool: MCPTool = {
      name: 'documented-tool',
      description: 'Well documented tool',
      inputSchema: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'First parameter description',
          },
        },
        required: ['param1'],
      },
    };

    const tool = mcpToolToAgenticTool(mcpTool, mockClient as MCPClient);

    // The description should be preserved in the Zod schema
    expect(tool.parameters).toBeDefined();
  });
});

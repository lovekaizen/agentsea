import { z } from 'zod';

import { Tool, ToolContext } from '../types';
import { MCPClient } from './client';
import { MCPTool } from './types';

/**
 * Convert MCP tool to AgentSea tool
 */
export function mcpToolToAgenticTool(
  mcpTool: MCPTool,
  client: MCPClient,
): Tool {
  // Convert MCP JSON Schema to Zod schema
  const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    name: mcpTool.name,
    description: mcpTool.description,
    parameters: zodSchema,
    execute: async (params: unknown, _context: ToolContext) => {
      const response = await client.callTool(
        mcpTool.name,
        params as Record<string, unknown> | undefined,
      );

      if (response.isError) {
        throw new Error(
          `MCP tool error: ${response.content[0]?.text || 'Unknown error'}`,
        );
      }

      // Extract text content from response
      const textContent = response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');

      return {
        result: textContent,
        metadata: {
          mcpResponse: response,
        },
      };
    },
  };
}

/**
 * Convert JSON Schema to Zod schema (simplified implementation)
 */
function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodSchema {
  if (schema.type === 'object') {
    const shape: Record<string, z.ZodSchema> = {};

    for (const [key, value] of Object.entries(schema.properties || {})) {
      const propSchema = value as Record<string, unknown>;
      let zodType: z.ZodSchema;

      switch (propSchema.type) {
        case 'string':
          zodType = z.string();
          if (typeof propSchema.description === 'string') {
            zodType = zodType.describe(propSchema.description);
          }
          break;

        case 'number':
          zodType = z.number();
          if (typeof propSchema.description === 'string') {
            zodType = zodType.describe(propSchema.description);
          }
          break;

        case 'boolean':
          zodType = z.boolean();
          if (typeof propSchema.description === 'string') {
            zodType = zodType.describe(propSchema.description);
          }
          break;

        case 'array':
          zodType = z.array(
            jsonSchemaToZod(
              (propSchema.items as Record<string, unknown>) || {},
            ),
          );
          if (typeof propSchema.description === 'string') {
            zodType = zodType.describe(propSchema.description);
          }
          break;

        case 'object':
          zodType = jsonSchemaToZod(propSchema);
          break;

        default:
          zodType = z.any();
      }

      // Make optional if not in required array
      const required = schema.required as string[] | undefined;
      if (!required?.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  return z.any();
}

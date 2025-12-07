import { z } from 'zod';

import { RetryConfig, Tool, ToolContext } from '../types';

/**
 * Options for defining an isomorphic tool
 */
export interface ToolDefinitionOptions<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodUnknown,
> {
  /** Unique tool name (should be snake_case) */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for input validation */
  inputSchema: TInput;
  /** Zod schema for output validation (optional) */
  outputSchema?: TOutput;
  /** Whether this tool requires user approval before execution */
  needsApproval?: boolean;
  /** Retry configuration for failed executions */
  retryConfig?: RetryConfig;
}

/**
 * Server-side tool execute function
 */
export type ServerExecuteFn<TInput, TOutput> = (
  input: TInput,
  context: ToolContext,
) => Promise<TOutput>;

/**
 * Client-side tool execute function
 */
export type ClientExecuteFn<TInput, TOutput> = (
  input: TInput,
  context: ToolContext,
) => TOutput | Promise<TOutput>;

/**
 * A tool definition that can be implemented for server or client
 */
export interface ToolDefinition<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema,
> {
  /** Tool name */
  readonly name: string;
  /** Tool description */
  readonly description: string;
  /** Input schema */
  readonly inputSchema: TInput;
  /** Output schema */
  readonly outputSchema: TOutput;
  /** Whether approval is needed */
  readonly needsApproval: boolean;
  /** Retry configuration */
  readonly retryConfig?: RetryConfig;

  /**
   * Create a server-side implementation of this tool
   */
  server(
    execute: ServerExecuteFn<z.infer<TInput>, z.infer<TOutput>>,
  ): ServerTool<TInput, TOutput>;

  /**
   * Create a client-side implementation of this tool
   */
  client(
    execute: ClientExecuteFn<z.infer<TInput>, z.infer<TOutput>>,
  ): ClientTool<TInput, TOutput>;

  /**
   * Convert to the legacy Tool interface for backwards compatibility
   */
  toTool(execute: ServerExecuteFn<z.infer<TInput>, z.infer<TOutput>>): Tool;
}

/**
 * A server-side tool implementation
 */
export interface ServerTool<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema,
> extends Omit<
    ToolDefinition<TInput, TOutput>,
    'server' | 'client' | 'toTool'
  > {
  /** Execution environment */
  readonly environment: 'server';
  /** Execute the tool on the server */
  execute(
    input: z.infer<TInput>,
    context: ToolContext,
  ): Promise<z.infer<TOutput>>;
  /** Convert to legacy Tool interface */
  toTool(): Tool;
}

/**
 * A client-side tool implementation
 */
export interface ClientTool<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema,
> extends Omit<
    ToolDefinition<TInput, TOutput>,
    'server' | 'client' | 'toTool'
  > {
  /** Execution environment */
  readonly environment: 'client';
  /** Execute the tool on the client */
  execute(
    input: z.infer<TInput>,
    context: ToolContext,
  ): z.infer<TOutput> | Promise<z.infer<TOutput>>;
  /** Convert to legacy Tool interface */
  toTool(): Tool;
}

/**
 * A hybrid tool with both server and client implementations
 */
export interface HybridTool<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema,
> {
  /** Tool name */
  readonly name: string;
  /** Tool description */
  readonly description: string;
  /** Input schema */
  readonly inputSchema: TInput;
  /** Output schema */
  readonly outputSchema: TOutput;
  /** Whether approval is needed */
  readonly needsApproval: boolean;
  /** Retry configuration */
  readonly retryConfig?: RetryConfig;
  /** Server-side implementation */
  readonly server: ServerTool<TInput, TOutput>;
  /** Client-side implementation */
  readonly client: ClientTool<TInput, TOutput>;
  /** Convert to legacy Tool interface (uses server implementation) */
  toTool(): Tool;
}

/**
 * Create a tool definition that can be implemented for different environments
 *
 * @example
 * ```typescript
 * const getUserDef = toolDefinition({
 *   name: 'get_user',
 *   description: 'Get user information from the database',
 *   inputSchema: z.object({
 *     userId: z.string().describe('The user ID to look up'),
 *   }),
 *   outputSchema: z.object({
 *     name: z.string(),
 *     email: z.string().email(),
 *   }),
 * });
 *
 * // Server implementation
 * const getUserServer = getUserDef.server(async ({ userId }) => {
 *   const user = await db.users.findUnique({ where: { id: userId } });
 *   return { name: user.name, email: user.email };
 * });
 *
 * // Client implementation
 * const getUserClient = getUserDef.client(async ({ userId }) => {
 *   const response = await fetch(`/api/users/${userId}`);
 *   return response.json();
 * });
 * ```
 */
export function toolDefinition<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodUnknown,
>(
  options: ToolDefinitionOptions<TInput, TOutput>,
): ToolDefinition<TInput, TOutput> {
  const {
    name,
    description,
    inputSchema,
    outputSchema = z.unknown() as unknown as TOutput,
    needsApproval = false,
    retryConfig,
  } = options;

  const createServerTool = (
    execute: ServerExecuteFn<z.infer<TInput>, z.infer<TOutput>>,
  ): ServerTool<TInput, TOutput> => {
    const wrappedExecute = async (
      input: z.infer<TInput>,
      context: ToolContext,
    ): Promise<z.infer<TOutput>> => {
      // Validate input
      const validatedInput = inputSchema.parse(input);
      // Execute
      const result = await execute(validatedInput, context);
      // Validate output if schema provided
      if (outputSchema) {
        return outputSchema.parse(result);
      }
      return result;
    };

    return {
      name,
      description,
      inputSchema,
      outputSchema,
      needsApproval,
      retryConfig,
      environment: 'server' as const,
      execute: wrappedExecute,
      toTool(): Tool {
        return {
          name,
          description,
          parameters: inputSchema,
          execute: wrappedExecute,
          retryConfig,
        };
      },
    };
  };

  const createClientTool = (
    execute: ClientExecuteFn<z.infer<TInput>, z.infer<TOutput>>,
  ): ClientTool<TInput, TOutput> => {
    const wrappedExecute = async (
      input: z.infer<TInput>,
      context: ToolContext,
    ): Promise<z.infer<TOutput>> => {
      // Validate input
      const validatedInput = inputSchema.parse(input);
      // Execute
      const result = await execute(validatedInput, context);
      // Validate output if schema provided
      if (outputSchema) {
        return outputSchema.parse(result);
      }
      return result;
    };

    return {
      name,
      description,
      inputSchema,
      outputSchema,
      needsApproval,
      retryConfig,
      environment: 'client' as const,
      execute: wrappedExecute,
      toTool(): Tool {
        return {
          name,
          description,
          parameters: inputSchema,
          execute: wrappedExecute,
          retryConfig,
        };
      },
    };
  };

  return {
    name,
    description,
    inputSchema,
    outputSchema,
    needsApproval,
    retryConfig,
    server: createServerTool,
    client: createClientTool,
    toTool(execute: ServerExecuteFn<z.infer<TInput>, z.infer<TOutput>>): Tool {
      return createServerTool(execute).toTool();
    },
  };
}

/**
 * Create a hybrid tool with both server and client implementations
 *
 * @example
 * ```typescript
 * const userTool = hybridTool({
 *   name: 'get_user',
 *   description: 'Get user information',
 *   inputSchema: z.object({ userId: z.string() }),
 *   outputSchema: z.object({ name: z.string(), email: z.string() }),
 *   server: async ({ userId }) => {
 *     return await db.users.findUnique({ where: { id: userId } });
 *   },
 *   client: async ({ userId }) => {
 *     const res = await fetch(`/api/users/${userId}`);
 *     return res.json();
 *   },
 * });
 * ```
 */
export function hybridTool<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodUnknown,
>(
  options: ToolDefinitionOptions<TInput, TOutput> & {
    server: ServerExecuteFn<z.infer<TInput>, z.infer<TOutput>>;
    client: ClientExecuteFn<z.infer<TInput>, z.infer<TOutput>>;
  },
): HybridTool<TInput, TOutput> {
  const def = toolDefinition(options);
  const serverTool = def.server(options.server);
  const clientTool = def.client(options.client);

  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    outputSchema: def.outputSchema,
    needsApproval: def.needsApproval,
    retryConfig: def.retryConfig,
    server: serverTool,
    client: clientTool,
    toTool(): Tool {
      return serverTool.toTool();
    },
  };
}

/**
 * Quick helper to create a server-only tool in one step
 *
 * @example
 * ```typescript
 * const calculateTool = serverTool({
 *   name: 'calculate',
 *   description: 'Perform arithmetic',
 *   inputSchema: z.object({
 *     operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
 *     a: z.number(),
 *     b: z.number(),
 *   }),
 *   outputSchema: z.object({ result: z.number() }),
 *   execute: async ({ operation, a, b }) => {
 *     switch (operation) {
 *       case 'add': return { result: a + b };
 *       case 'subtract': return { result: a - b };
 *       case 'multiply': return { result: a * b };
 *       case 'divide': return { result: a / b };
 *     }
 *   },
 * });
 * ```
 */
export function serverTool<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodUnknown,
>(
  options: ToolDefinitionOptions<TInput, TOutput> & {
    execute: ServerExecuteFn<z.infer<TInput>, z.infer<TOutput>>;
  },
): ServerTool<TInput, TOutput> {
  return toolDefinition(options).server(options.execute);
}

/**
 * Quick helper to create a client-only tool in one step
 *
 * @example
 * ```typescript
 * const showNotification = clientTool({
 *   name: 'show_notification',
 *   description: 'Show a browser notification',
 *   inputSchema: z.object({
 *     title: z.string(),
 *     body: z.string(),
 *   }),
 *   execute: ({ title, body }) => {
 *     new Notification(title, { body });
 *     return { shown: true };
 *   },
 * });
 * ```
 */
export function clientTool<
  TInput extends z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodUnknown,
>(
  options: ToolDefinitionOptions<TInput, TOutput> & {
    execute: ClientExecuteFn<z.infer<TInput>, z.infer<TOutput>>;
  },
): ClientTool<TInput, TOutput> {
  return toolDefinition(options).client(options.execute);
}

/**
 * Type helper to extract input type from a tool definition
 */
export type ToolInput<T> =
  T extends ToolDefinition<infer TInput, any>
    ? z.infer<TInput>
    : T extends ServerTool<infer TInput, any>
      ? z.infer<TInput>
      : T extends ClientTool<infer TInput, any>
        ? z.infer<TInput>
        : never;

/**
 * Type helper to extract output type from a tool definition
 */
export type ToolOutput<T> =
  T extends ToolDefinition<any, infer TOutput>
    ? z.infer<TOutput>
    : T extends ServerTool<any, infer TOutput>
      ? z.infer<TOutput>
      : T extends ClientTool<any, infer TOutput>
        ? z.infer<TOutput>
        : never;

/**
 * Convert any tool implementation to the legacy Tool interface
 */
export function toLegacyTool(
  tool: ServerTool<any, any> | ClientTool<any, any> | HybridTool<any, any>,
): Tool {
  return tool.toTool();
}

/**
 * Convert multiple tools to legacy Tool interface
 */
export function toLegacyTools(
  tools: Array<
    ServerTool<any, any> | ClientTool<any, any> | HybridTool<any, any>
  >,
): Tool[] {
  return tools.map(toLegacyTool);
}

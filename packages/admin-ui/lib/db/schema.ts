import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Agents table
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt'),
  provider: text('provider').notNull().default('anthropic'),
  model: text('model').notNull().default('claude-3-5-sonnet-20241022'),
  temperature: real('temperature').default(0.7),
  maxTokens: integer('max_tokens').default(4096),
  memoryType: text('memory_type').default('buffer'),
  memoryConfig: text('memory_config'), // JSON string
  tools: text('tools'), // JSON array of tool IDs
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
});

// Workflows table
export const workflows = sqliteTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull().default('sequential'), // sequential, parallel, supervisor
  config: text('config').notNull(), // JSON configuration
  nodes: text('nodes').notNull(), // React Flow nodes
  edges: text('edges').notNull(), // React Flow edges
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
});

// Tools table
export const tools = sqliteTable('tools', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').default('custom'), // built-in, mcp, custom
  schema: text('schema').notNull(), // JSON schema
  implementation: text('implementation'), // For custom tools
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
});

// Providers table
export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // anthropic, openai, google, ollama, etc.
  apiKey: text('api_key'), // Encrypted
  baseUrl: text('base_url'),
  config: text('config'), // JSON configuration
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
});

// Executions table
export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id').references(() => workflows.id),
  agentId: text('agent_id').references(() => agents.id),
  input: text('input').notNull(),
  output: text('output'),
  status: text('status').notNull().default('pending'), // pending, running, completed, failed
  messages: text('messages'), // JSON array of conversation messages
  toolCalls: text('tool_calls'), // JSON array of tool calls
  duration: integer('duration'), // milliseconds
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// MCP Servers table
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  command: text('command').notNull(),
  args: text('args'), // JSON array
  env: text('env'), // JSON object
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(
    sql`(unixepoch())`,
  ),
});

// Types
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;

export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;

export type MCPServer = typeof mcpServers.$inferSelect;
export type NewMCPServer = typeof mcpServers.$inferInsert;

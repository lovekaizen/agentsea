/**
 * MCP (Model Context Protocol) type definitions
 */

import type { StdioEnvOptions } from './transport';

export interface MCPServerConfig extends StdioEnvOptions {
  name: string;
  command: string;
  args?: string[];
  /** Variables set explicitly for the server process */
  env?: Record<string, string>;
  /**
   * `http` is Streamable HTTP (2026-07-28). `sse` is the deprecated HTTP+SSE
   * transport from 2024-11-05, kept for servers that have not moved.
   */
  transport?: 'stdio' | 'sse' | 'http';
  url?: string; // For http and sse transports
  /** Milliseconds to wait for a response before cancelling. Default 30000. */
  requestTimeoutMs?: number;
}

/** Protocol revision this client speaks by default (stateless, per-request). */
export const MCP_PROTOCOL_VERSION = '2026-07-28';
/** Legacy revision, used only when the server does not answer server/discover. */
export const MCP_LEGACY_PROTOCOL_VERSION = '2024-11-05';

/** Result of `server/discover` (2026-07-28). */
export interface MCPDiscoverResult {
  resultType?: 'complete';
  supportedVersions: string[];
  capabilities: MCPServerCapabilities;
  serverInfo: { name: string; version: string };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, never>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
}

export interface MCPCallToolRequest {
  method: 'tools/call';
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

export interface MCPCallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPListToolsRequest {
  method: 'tools/list';
  params?: {
    cursor?: string;
  };
}

export interface MCPListToolsResponse {
  tools: MCPTool[];
  nextCursor?: string;
}

export interface MCPReadResourceRequest {
  method: 'resources/read';
  params: {
    uri: string;
  };
}

export interface MCPReadResourceResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

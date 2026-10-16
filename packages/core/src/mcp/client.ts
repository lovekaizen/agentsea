import { EventEmitter } from 'events';

import {
  MCPTransport,
  StdioTransport,
  SSETransport,
  StreamableHTTPTransport,
  invalidMcpHeaderAnnotation,
  mcpParamHeaders,
} from './transport';
import {
  MCPDiscoverResult,
  MCPServerConfig,
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPCallToolResponse,
  MCPListToolsResponse,
  MCPReadResourceResponse,
  MCPMessage,
  MCP_PROTOCOL_VERSION,
  MCP_LEGACY_PROTOCOL_VERSION,
} from './types';

/** JSON-RPC error code for an unsupported protocol version (2026-07-28). */
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

const CLIENT_INFO = { name: 'agentsea', version: '0.1.0' };
// Generous on purpose: a cold `npx` or `uvx` start can take several seconds,
// and a timeout here sends a modern server down the legacy path.
const DISCOVER_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 30_000;

/** A JSON-RPC error response from the server, with its code kept. */
export class MCPProtocolError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(`MCP Error: ${message} (${code})`);
    this.name = 'MCPProtocolError';
  }
}

/**
 * The server answered with `resultType: "input_required"` (MRTR). Answering
 * those needs an input handler, which this client does not have yet.
 */
export class MCPInputRequiredError extends Error {
  constructor(readonly method: string) {
    super(
      `MCP ${method} needs client input (input_required); MRTR is not implemented yet`,
    );
    this.name = 'MCPInputRequiredError';
  }
}

/**
 * MCP Client for connecting to MCP servers
 */
export class MCPClient extends EventEmitter {
  private transport: MCPTransport | null = null;
  private serverInfo: MCPServerInfo | null = null;
  /** True after server/discover succeeds; requests then carry `_meta`. */
  private modern = false;
  private requestId = 0;
  private toolSchemas = new Map<string, Record<string, unknown>>();
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: MCPMessage) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(private config: MCPServerConfig) {
    super();
  }

  /**
   * Connect to the MCP server. Tries server/discover (2026-07-28) first and
   * falls back to the 2024-11-05 initialize handshake for legacy servers.
   */
  async connect(): Promise<void> {
    if (this.config.transport === 'sse' && this.config.url) {
      this.transport = new SSETransport(this.config.url);
    } else if (this.config.transport === 'http' && this.config.url) {
      this.transport = new StreamableHTTPTransport(this.config.url);
    } else {
      this.transport = new StdioTransport(
        this.config.command,
        this.config.args,
        this.config.env,
        {
          passEnv: this.config.passEnv,
          inheritFullEnv: this.config.inheritFullEnv,
        },
      );
    }

    // Set up event handlers
    this.transport.on('message', this.handleMessage.bind(this));
    this.transport.on('error', (error: Error) => this.emit('error', error));
    this.transport.on('stderr', (text: string) => this.emit('stderr', text));
    this.transport.on('disconnect', () => this.emit('disconnect'));

    try {
      await this.transport.connect();

      // The deprecated SSE transport only speaks the legacy handshake.
      if (this.config.transport === 'sse') {
        await this.initialize();
      } else {
        await this.discover();
      }
    } catch (error) {
      // Do not leave a spawned child or an open stream behind a failed connect.
      this.disconnect();
      throw error;
    }
  }

  /**
   * Probe with server/discover. A server that answers picks the modern path.
   * An unsupported-version error stops here rather than falling back, because
   * the server is modern and will not speak the legacy handshake. Any other
   * failure (method not found, no reply) means a legacy server.
   */
  private async discover(): Promise<void> {
    let result: MCPDiscoverResult;
    try {
      const response = await this.sendRequest(
        {
          jsonrpc: '2.0',
          id: this.nextId(),
          method: 'server/discover',
          params: {},
        },
        { meta: true, timeoutMs: DISCOVER_TIMEOUT_MS },
      );
      result = response.result as MCPDiscoverResult;
    } catch (error) {
      if (
        error instanceof MCPProtocolError &&
        error.code === UNSUPPORTED_PROTOCOL_VERSION
      ) {
        throw error;
      }
      // Streamable HTTP has no legacy handshake here: a server that predates
      // 2026-07-28 may need session headers this transport does not send.
      if (this.config.transport === 'http') {
        throw new Error(
          `MCP server did not answer server/discover (${(error as Error).message}). ` +
            'Legacy initialize over Streamable HTTP is not supported; use transport "sse" for HTTP+SSE servers.',
        );
      }
      await this.initialize();
      return;
    }

    // A reply that is not a DiscoverResult does not prove a modern server, so
    // take the legacy path, the same as for an error reply.
    if (!Array.isArray(result?.supportedVersions)) {
      await this.initialize();
      return;
    }

    if (!result.supportedVersions.includes(MCP_PROTOCOL_VERSION)) {
      throw new Error(
        `MCP server does not support ${MCP_PROTOCOL_VERSION} (offers: ${result.supportedVersions.join(', ')})`,
      );
    }

    this.modern = true;
    this.serverInfo = {
      name: result.serverInfo?.name ?? 'unknown',
      version: result.serverInfo?.version ?? 'unknown',
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: result.capabilities,
    };
    this.emit('initialized', this.serverInfo);
  }

  /**
   * Legacy (2024-11-05) initialize handshake, followed by the
   * notifications/initialized message that handshake requires.
   */
  private async initialize(): Promise<void> {
    const response = await this.sendRequest(
      {
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'initialize',
        params: {
          protocolVersion: MCP_LEGACY_PROTOCOL_VERSION,
          clientInfo: CLIENT_INFO,
          capabilities: {
            roots: {
              listChanged: true,
            },
          },
        },
      },
      { meta: false },
    );

    // The legacy result nests identity under `serverInfo`; flatten it so
    // getServerInfo() has the same shape on both paths.
    const legacy = response.result as {
      protocolVersion: string;
      serverInfo: { name: string; version: string };
      capabilities: MCPServerInfo['capabilities'];
    };
    this.modern = false;
    this.serverInfo = {
      name: legacy.serverInfo?.name,
      version: legacy.serverInfo?.version,
      protocolVersion: legacy.protocolVersion,
      capabilities: legacy.capabilities ?? {},
    };
    await this.transport!.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    this.emit('initialized', this.serverInfo);
  }

  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/list',
      params: {},
    });

    const result = response.result as MCPListToolsResponse;
    const tools =
      this.config.transport === 'http'
        ? result.tools.filter((tool) => this.acceptTool(tool))
        : result.tools;
    for (const tool of tools) {
      this.toolSchemas.set(
        tool.name,
        tool.inputSchema as Record<string, unknown>,
      );
    }
    return tools;
  }

  /**
   * Streamable HTTP rule: a tool whose x-mcp-header annotations break the
   * spec is excluded from the list, so one bad tool does not block the rest.
   */
  private acceptTool(tool: MCPTool): boolean {
    const reason = invalidMcpHeaderAnnotation(
      tool.inputSchema as Record<string, unknown>,
    );
    if (reason) {
      this.emit('warning', `Skipping MCP tool "${tool.name}": ${reason}`);
      return false;
    }
    return true;
  }

  /**
   * Call a tool
   */
  async callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<MCPCallToolResponse> {
    // Streamable HTTP needs the tool's schema to build Mcp-Param-* headers.
    // Load the list once if this tool is not known yet.
    if (this.config.transport === 'http' && !this.toolSchemas.has(name)) {
      await this.listTools();
    }
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name,
        arguments: args,
      },
    });

    return response.result as MCPCallToolResponse;
  }

  /**
   * List available resources
   */
  async listResources(): Promise<MCPResource[]> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'resources/list',
      params: {},
    });

    return (response.result as { resources: MCPResource[] }).resources;
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<MCPReadResourceResponse> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'resources/read',
      params: {
        uri,
      },
    });

    return response.result as MCPReadResourceResponse;
  }

  /**
   * List available prompts
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'prompts/list',
      params: {},
    });

    return (response.result as { prompts: MCPPrompt[] }).prompts;
  }

  /**
   * Get a prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<unknown> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'prompts/get',
      params: {
        name,
        arguments: args,
      },
    });

    return response.result;
  }

  /**
   * Get server info
   */
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
      this.serverInfo = null;
      this.modern = false;
      this.toolSchemas.clear();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.transport?.isConnected() || false;
  }

  /**
   * Send a request and wait for its response. In the modern path every
   * request carries `_meta` (protocol version, client identity, capabilities).
   */
  private async sendRequest(
    message: MCPMessage,
    options: { meta?: boolean; timeoutMs?: number } = {},
  ): Promise<MCPMessage> {
    if (!this.transport || !this.transport.isConnected()) {
      throw new Error('Not connected to MCP server');
    }

    const useMeta = options.meta ?? this.modern;
    const outgoing = useMeta ? this.withMeta(message) : message;
    const headers =
      this.config.transport === 'http'
        ? this.paramHeaders(outgoing)
        : undefined;
    const id = outgoing.id!;
    const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

    const settled = new Promise<MCPMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.delete(id)) {
          reject(new Error('Request timeout'));
        }
      }, timeoutMs);
      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });

    // A transport that rejects its send fails only this request.
    Promise.resolve()
      .then(() => this.transport!.send(outgoing, headers))
      .catch((error: unknown) => {
        const pending = this.pendingRequests.get(id);
        this.pendingRequests.delete(id);
        pending?.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      });

    const response = await settled;
    if (
      (response.result as { resultType?: string } | undefined)?.resultType ===
      'input_required'
    ) {
      throw new MCPInputRequiredError(outgoing.method ?? 'request');
    }
    return response;
  }

  private withMeta(message: MCPMessage): MCPMessage {
    const params = (message.params ?? {}) as Record<string, unknown>;
    return {
      ...message,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientInfo': CLIENT_INFO,
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    };
  }

  /**
   * `Mcp-Param-*` headers for a tools/call on Streamable HTTP. The tool's
   * schema comes from the last listTools, so call listTools first when a tool
   * declares x-mcp-header parameters.
   */
  private paramHeaders(
    message: MCPMessage,
  ): Record<string, string> | undefined {
    if (message.method !== 'tools/call') return undefined;
    const params = message.params as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    const schema = params.name ? this.toolSchemas.get(params.name) : undefined;
    return schema ? mcpParamHeaders(schema, params.arguments) : undefined;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: MCPMessage): void {
    // Handle responses
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(
          new MCPProtocolError(
            message.error.code,
            message.error.message,
            message.error.data,
          ),
        );
      } else {
        pending.resolve(message);
      }
      return;
    }

    // Handle notifications
    if (message.method) {
      this.emit('notification', message);
    }
  }

  /**
   * Get next request ID
   */
  private nextId(): number {
    return ++this.requestId;
  }
}

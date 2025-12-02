import { EventEmitter } from 'events';

import { MCPTransport, StdioTransport, SSETransport } from './transport';
import {
  MCPServerConfig,
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPCallToolResponse,
  MCPListToolsResponse,
  MCPReadResourceResponse,
  MCPMessage,
} from './types';

/**
 * MCP Client for connecting to MCP servers
 */
export class MCPClient extends EventEmitter {
  private transport: MCPTransport | null = null;
  private serverInfo: MCPServerInfo | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor(private config: MCPServerConfig) {
    super();
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    // Create transport based on config
    if (this.config.transport === 'sse' && this.config.url) {
      this.transport = new SSETransport(this.config.url);
    } else {
      this.transport = new StdioTransport(
        this.config.command,
        this.config.args,
        this.config.env,
      );
    }

    // Set up event handlers
    this.transport.on('message', this.handleMessage.bind(this));
    this.transport.on('error', (error: Error) => this.emit('error', error));
    this.transport.on('disconnect', () => this.emit('disconnect'));

    // Connect transport
    await this.transport.connect();

    // Initialize protocol
    await this.initialize();
  }

  /**
   * Initialize the MCP protocol
   */
  private async initialize(): Promise<void> {
    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'agentsea',
          version: '0.1.0',
        },
        capabilities: {
          roots: {
            listChanged: true,
          },
        },
      },
    });

    this.serverInfo = response.result as MCPServerInfo;
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
    return result.tools;
  }

  /**
   * Call a tool
   */
  async callTool(
    name: string,
    args?: Record<string, any>,
  ): Promise<MCPCallToolResponse> {
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

    return response.result.resources as MCPResource[];
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

    return response.result.prompts as MCPPrompt[];
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<any> {
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
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.transport?.isConnected() || false;
  }

  /**
   * Send a request and wait for response
   */
  private async sendRequest(message: MCPMessage): Promise<MCPMessage> {
    if (!this.transport || !this.transport.isConnected()) {
      throw new Error('Not connected to MCP server');
    }

    return new Promise((resolve, reject) => {
      const id = message.id!;
      this.pendingRequests.set(id, { resolve, reject });

      try {
        this.transport!.send(message);
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
        return;
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
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
          new Error(
            `MCP Error: ${message.error.message} (${message.error.code})`,
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

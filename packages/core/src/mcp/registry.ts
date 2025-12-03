import { MCPClient } from './client';
import { mcpToolToAgenticTool } from './tool-adapter';
import { MCPServerConfig, MCPServerInfo } from './types';
import { Tool } from '../types';

/**
 * Registry for managing multiple MCP servers
 */
export class MCPRegistry {
  private servers = new Map<string, MCPClient>();
  private tools = new Map<string, Tool>();

  /**
   * Add an MCP server
   */
  async addServer(config: MCPServerConfig): Promise<MCPClient> {
    if (this.servers.has(config.name)) {
      throw new Error(`MCP server '${config.name}' already registered`);
    }

    const client = new MCPClient(config);

    // Set up event handlers
    client.on('error', (error) => {
      console.error(`MCP server '${config.name}' error:`, error);
    });

    client.on('disconnect', () => {
      console.log(`MCP server '${config.name}' disconnected`);
      this.removeServerTools(config.name);
    });

    // Connect to the server
    await client.connect();

    // Register the server
    this.servers.set(config.name, client);

    // Load and register tools
    await this.loadServerTools(config.name, client);

    return client;
  }

  /**
   * Remove an MCP server
   */
  removeServer(name: string): void {
    const client = this.servers.get(name);
    if (client) {
      client.disconnect();
      this.servers.delete(name);
      this.removeServerTools(name);
    }
  }

  /**
   * Get an MCP server client
   */
  getServer(name: string): MCPClient | undefined {
    return this.servers.get(name);
  }

  /**
   * Get all registered servers
   */
  getServers(): Map<string, MCPClient> {
    return new Map(this.servers);
  }

  /**
   * Get all tools from all servers
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get server info
   */
  getServerInfo(name: string): MCPServerInfo | null {
    const client = this.servers.get(name);
    return client?.getServerInfo() || null;
  }

  /**
   * Disconnect all servers
   */
  disconnectAll(): void {
    Array.from(this.servers.values()).forEach((client) => client.disconnect());
    this.servers.clear();
    this.tools.clear();
  }

  /**
   * Load tools from a server
   */
  private async loadServerTools(
    serverName: string,
    client: MCPClient,
  ): Promise<void> {
    try {
      const mcpTools = await client.listTools();

      for (const mcpTool of mcpTools) {
        // Create a unique tool name with server prefix
        const toolName = `${serverName}:${mcpTool.name}`;

        // Convert MCP tool to AgentSea tool
        const tool = mcpToolToAgenticTool(mcpTool, client);

        // Override the tool name to include server prefix
        const prefixedTool: Tool = {
          ...tool,
          name: toolName,
          description: `[${serverName}] ${tool.description}`,
        };

        this.tools.set(toolName, prefixedTool);
      }

      console.log(
        `Loaded ${mcpTools.length} tools from MCP server '${serverName}'`,
      );
    } catch (error) {
      console.error(
        `Failed to load tools from MCP server '${serverName}':`,
        error,
      );
    }
  }

  /**
   * Remove tools from a server
   */
  private removeServerTools(serverName: string): void {
    const toolsToRemove: string[] = [];

    for (const [toolName] of this.tools) {
      if (toolName.startsWith(`${serverName}:`)) {
        toolsToRemove.push(toolName);
      }
    }

    for (const toolName of toolsToRemove) {
      this.tools.delete(toolName);
    }
  }

  /**
   * Reload tools from a specific server
   */
  async reloadServerTools(serverName: string): Promise<void> {
    const client = this.servers.get(serverName);
    if (!client) {
      throw new Error(`MCP server '${serverName}' not found`);
    }

    this.removeServerTools(serverName);
    await this.loadServerTools(serverName, client);
  }

  /**
   * Reload tools from all servers
   */
  async reloadAllTools(): Promise<void> {
    const promises = Array.from(this.servers.entries()).map(([name, client]) =>
      this.loadServerTools(name, client),
    );
    await Promise.all(promises);
  }
}

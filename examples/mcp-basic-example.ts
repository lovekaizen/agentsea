import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  AgentContext,
  MCPRegistry,
} from '@lov3kaizen/agentsea-core';

/**
 * Basic example demonstrating MCP server integration
 *
 * This example shows how to:
 * 1. Connect to MCP servers
 * 2. Load tools from MCP servers
 * 3. Use MCP tools with agents
 */
async function main() {
  console.log('=== MCP Basic Integration Example ===\n');

  // Create MCP registry
  const mcpRegistry = new MCPRegistry();

  try {
    // Add an MCP server (example: filesystem server)
    // Note: You need to have an MCP server running
    // For example, you can use @modelcontextprotocol/server-filesystem
    console.log('Connecting to MCP servers...');

    await mcpRegistry.addServer({
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      transport: 'stdio',
    });

    console.log('✓ Connected to filesystem MCP server\n');

    // Get available tools from MCP servers
    const mcpTools = mcpRegistry.getTools();
    console.log(`Loaded ${mcpTools.length} tools from MCP servers:`);
    mcpTools.forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
    console.log();

    // Create agent with MCP tools
    const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    const toolRegistry = new ToolRegistry();

    // Register MCP tools with the tool registry
    toolRegistry.registerMany(mcpTools);

    const memory = new BufferMemory(50);

    const agent = new Agent(
      {
        name: 'mcp-agent',
        description: 'Agent with MCP server integration',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        systemPrompt: `You are a helpful assistant with access to filesystem operations through MCP servers.
You can read files, list directories, and perform other filesystem operations.
Always be careful with file operations and confirm destructive actions.`,
        tools: mcpTools,
        temperature: 0.7,
        maxTokens: 1024,
      },
      provider,
      toolRegistry,
      memory,
    );

    const context: AgentContext = {
      conversationId: 'mcp-example-1',
      userId: 'user-123',
      sessionData: {},
      history: [],
    };

    // Example query using MCP tools
    console.log('Executing agent with MCP tools...');
    const response = await agent.execute(
      'List the files in the current directory',
      context,
    );

    console.log('\nAgent Response:');
    console.log(response.content);

    console.log('\nMetrics:');
    console.log({
      tokensUsed: response.metadata.tokensUsed,
      latencyMs: response.metadata.latencyMs,
      iterations: response.metadata.iterations,
    });

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('\nTool Calls Made:');
      response.toolCalls.forEach((call) => {
        console.log(`  - ${call.tool}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Cleanup: disconnect from all MCP servers
    console.log('\nDisconnecting from MCP servers...');
    await mcpRegistry.disconnectAll();
    console.log('✓ Disconnected');
  }
}

main().catch(console.error);

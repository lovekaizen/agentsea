import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  MCPRegistry,
} from '@lov3kaizen/agentsea-core';

/**
 * Advanced example demonstrating multiple MCP servers
 *
 * This example shows how to:
 * 1. Connect to multiple MCP servers simultaneously
 * 2. Use tools from different servers
 * 3. Handle server-specific capabilities
 */
async function main() {
  console.log('=== MCP Multiple Servers Example ===\n');

  const mcpRegistry = new MCPRegistry();

  try {
    // Connect to multiple MCP servers
    console.log('Connecting to multiple MCP servers...\n');

    // Server 1: Filesystem
    const filesystemServer = await mcpRegistry.addServer({
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      transport: 'stdio',
      env: {
        NODE_ENV: 'production',
      },
    });

    console.log('✓ Connected to filesystem server');
    const fsInfo = filesystemServer.getServerInfo();
    console.log(`  Version: ${fsInfo?.version}`);
    console.log(`  Protocol: ${fsInfo?.protocolVersion}\n`);

    // Server 2: Git (example - adjust based on your setup)
    // await mcpRegistry.addServer({
    //   name: 'git',
    //   command: 'npx',
    //   args: ['-y', '@modelcontextprotocol/server-git'],
    //   transport: 'stdio',
    // });
    // console.log('✓ Connected to git server\n');

    // Get all tools from all servers
    const allTools = mcpRegistry.getTools();
    console.log(`\nTotal tools available: ${allTools.length}\n`);

    // Group tools by server
    const toolsByServer = new Map<string, typeof allTools>();
    for (const tool of allTools) {
      const serverName = tool.name.split(':')[0];
      if (!toolsByServer.has(serverName)) {
        toolsByServer.set(serverName, []);
      }
      toolsByServer.get(serverName)!.push(tool);
    }

    console.log('Tools by server:');
    for (const [serverName, tools] of toolsByServer) {
      console.log(`\n  ${serverName} (${tools.length} tools):`);
      tools.slice(0, 5).forEach((tool) => {
        const shortName = tool.name.replace(`${serverName}:`, '');
        console.log(`    - ${shortName}`);
      });
      if (tools.length > 5) {
        console.log(`    ... and ${tools.length - 5} more`);
      }
    }

    // Create agent with all MCP tools
    const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
    const toolRegistry = new ToolRegistry();
    toolRegistry.registerMany(allTools);

    const agent = new Agent(
      {
        name: 'multi-mcp-agent',
        description: 'Agent with multiple MCP servers',
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        systemPrompt: `You are a versatile assistant with access to multiple MCP servers.
You can perform filesystem operations, git operations, and more.
When using tools, pay attention to which server they come from (tool names are prefixed with server name).`,
        tools: allTools,
        temperature: 0.7,
        maxTokens: 1500,
        maxIterations: 10,
      },
      provider,
      toolRegistry,
      new BufferMemory(50),
    );

    // Execute complex multi-server task
    console.log('\n\nExecuting multi-server task...');
    const response = await agent.execute(
      'List the files in /tmp directory and tell me what you find',
      {
        conversationId: 'mcp-multi-1',
        userId: 'user-123',
        sessionData: {},
        history: [],
      },
    );

    console.log('\n=== Agent Response ===');
    console.log(response.content);

    console.log('\n=== Metrics ===');
    console.log({
      tokensUsed: response.metadata.tokensUsed,
      latencyMs: response.metadata.latencyMs,
      iterations: response.metadata.iterations,
      toolCallsCount: response.toolCalls?.length || 0,
    });

    // Show which servers were used
    if (response.toolCalls && response.toolCalls.length > 0) {
      const serversUsed = new Set(
        response.toolCalls.map((call) => call.tool.split(':')[0]),
      );
      console.log('\n=== Servers Used ===');
      serversUsed.forEach((server) => {
        console.log(`  - ${String(server)}`);
      });
    }

    // Demonstrate server management
    console.log('\n=== Server Management ===');

    // Get list of connected servers
    const servers = mcpRegistry.getServers();
    console.log(`Connected servers: ${servers.size}`);

    // Reload tools from a specific server
    console.log('Reloading tools from filesystem server...');
    await mcpRegistry.reloadServerTools('filesystem');
    console.log('✓ Tools reloaded');

    // Get server-specific information
    const filesystemInfo = await mcpRegistry.getServerInfo('filesystem');
    if (filesystemInfo) {
      console.log('\nFilesystem server capabilities:');
      console.log(JSON.stringify(filesystemInfo.capabilities, null, 2));
    }
  } catch (error) {
    console.error('\nError:', error);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    await mcpRegistry.disconnectAll();
    console.log('✓ All MCP servers disconnected');
  }
}

main().catch(console.error);

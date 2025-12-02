import { MCPRegistry } from '@lov3kaizen/agentsea-core';

/**
 * Example demonstrating MCP resources and prompts
 *
 * This example shows how to:
 * 1. List and read MCP resources
 * 2. Use MCP prompts
 * 3. Handle different content types
 */
async function main() {
  console.log('=== MCP Resources and Prompts Example ===\n');

  const mcpRegistry = new MCPRegistry();

  try {
    // Connect to an MCP server
    console.log('Connecting to MCP server...');
    await mcpRegistry.addServer({
      name: 'demo',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      transport: 'stdio',
    });
    console.log('✓ Connected\n');

    const client = mcpRegistry.getServer('demo');
    if (!client) {
      throw new Error('Failed to get MCP client');
    }

    // List available resources
    console.log('=== Available Resources ===');
    try {
      const resources = await client.listResources();
      console.log(`Found ${resources.length} resources:\n`);

      resources.slice(0, 10).forEach((resource) => {
        console.log(`  📄 ${resource.name}`);
        console.log(`     URI: ${resource.uri}`);
        if (resource.description) {
          console.log(`     Description: ${resource.description}`);
        }
        if (resource.mimeType) {
          console.log(`     Type: ${resource.mimeType}`);
        }
        console.log();
      });

      if (resources.length > 10) {
        console.log(`  ... and ${resources.length - 10} more\n`);
      }

      // Read a specific resource
      if (resources.length > 0) {
        const firstResource = resources[0];
        console.log(`\n=== Reading Resource: ${firstResource.name} ===`);

        const content = await client.readResource(firstResource.uri);
        console.log('Content:');
        content.contents.forEach((item) => {
          if (item.text) {
            console.log(item.text.substring(0, 500));
            if (item.text.length > 500) {
              console.log('... (truncated)');
            }
          } else if (item.blob) {
            console.log(`[Binary data: ${item.mimeType}]`);
          }
        });
      }
    } catch (error) {
      console.log('Resource listing not supported by this server');
    }

    // List available prompts
    console.log('\n\n=== Available Prompts ===');
    try {
      const prompts = await client.listPrompts();
      console.log(`Found ${prompts.length} prompts:\n`);

      prompts.forEach((prompt) => {
        console.log(`  💬 ${prompt.name}`);
        if (prompt.description) {
          console.log(`     ${prompt.description}`);
        }
        if (prompt.arguments && prompt.arguments.length > 0) {
          console.log('     Arguments:');
          prompt.arguments.forEach((arg) => {
            const required = arg.required ? ' (required)' : ' (optional)';
            console.log(`       - ${arg.name}${required}`);
            if (arg.description) {
              console.log(`         ${arg.description}`);
            }
          });
        }
        console.log();
      });

      // Get a specific prompt
      if (prompts.length > 0) {
        const firstPrompt = prompts[0];
        console.log(`\n=== Getting Prompt: ${firstPrompt.name} ===`);

        // Prepare arguments if needed
        const args: Record<string, string> = {};
        if (firstPrompt.arguments) {
          for (const arg of firstPrompt.arguments) {
            if (arg.required) {
              args[arg.name] = `example_${arg.name}`;
            }
          }
        }

        const promptContent = await client.getPrompt(firstPrompt.name, args);
        console.log('Prompt content:');
        console.log(JSON.stringify(promptContent, null, 2));
      }
    } catch (error) {
      console.log('Prompt listing not supported by this server');
    }

    // Get server capabilities
    console.log('\n\n=== Server Capabilities ===');
    const serverInfo = client.getServerInfo();
    if (serverInfo) {
      console.log(`Server: ${serverInfo.name} v${serverInfo.version}`);
      console.log(`Protocol: ${serverInfo.protocolVersion}`);
      console.log('\nCapabilities:');

      if (serverInfo.capabilities.tools) {
        console.log('  ✓ Tools');
        if (serverInfo.capabilities.tools.listChanged) {
          console.log('    - Supports list change notifications');
        }
      }

      if (serverInfo.capabilities.resources) {
        console.log('  ✓ Resources');
        if (serverInfo.capabilities.resources.subscribe) {
          console.log('    - Supports subscriptions');
        }
        if (serverInfo.capabilities.resources.listChanged) {
          console.log('    - Supports list change notifications');
        }
      }

      if (serverInfo.capabilities.prompts) {
        console.log('  ✓ Prompts');
        if (serverInfo.capabilities.prompts.listChanged) {
          console.log('    - Supports list change notifications');
        }
      }

      if (serverInfo.capabilities.logging) {
        console.log('  ✓ Logging');
      }
    }
  } catch (error) {
    console.error('\nError:', error);
  } finally {
    console.log('\n\nDisconnecting...');
    await mcpRegistry.disconnectAll();
    console.log('✓ Disconnected');
  }
}

main().catch(console.error);

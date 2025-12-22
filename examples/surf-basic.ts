/**
 * Basic Surf Agent Example
 *
 * This example demonstrates how to use the Surf agent
 * to automate desktop tasks using Claude's vision capabilities.
 */

import {
  SurfAgent,
  createNativeBackend,
  SurfConfig,
} from '@lov3kaizen/agentsea-surf';

async function main() {
  console.log('Surf Agent - Basic Example\n');

  // Create a native backend for the current platform
  // This automatically detects macOS, Linux, or Windows
  const backend = createNativeBackend({ displayIndex: 0 });

  try {
    // Connect to the desktop
    console.log('Connecting to desktop...');
    await backend.connect();
    console.log(`Connected to: ${backend.name}\n`);

    // Get screen dimensions
    const dimensions = await backend.getScreenDimensions();
    console.log(
      `Screen: ${dimensions.width}x${dimensions.height} (scale: ${dimensions.scaleFactor})\n`,
    );

    // Configure the agent
    const config: Partial<SurfConfig> = {
      maxSteps: 20,
      screenshotDelay: 500,
      defaultTimeout: 30000,
      scalingMode: 'auto',
      sandbox: {
        enabled: true,
        maxActionsPerMinute: 30,
        blockedDomains: ['malicious-site.com'],
      },
      vision: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        includeScreenshotInResponse: true,
      },
    };

    // Create the agent
    const agent = new SurfAgent('basic-example', backend, config);

    // Execute a simple task
    const task = 'Take a screenshot of the current desktop';

    console.log(`Task: ${task}\n`);
    console.log('Executing...\n');

    const result = await agent.execute(task);

    // Display results
    console.log('=== Results ===');
    console.log(`Status: ${result.state.status}`);
    console.log(`Steps taken: ${result.state.currentStep}`);
    console.log(`Actions: ${result.state.actionHistory.length}`);
    console.log(`Response: ${result.response}\n`);

    // Show action history
    if (result.state.actionHistory.length > 0) {
      console.log('Action History:');
      result.state.actionHistory.forEach((action, i) => {
        console.log(
          `  ${i + 1}. ${action.action} - ${action.success ? 'Success' : 'Failed'}`,
        );
        if (action.error) {
          console.log(`     Error: ${action.error}`);
        }
      });
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  } finally {
    // Always disconnect
    console.log('\nDisconnecting...');
    await backend.disconnect();
    console.log('Done!');
  }
}

// Run the example
main().catch(console.error);

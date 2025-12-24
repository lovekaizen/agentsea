/**
 * Surf Agent Streaming Example
 *
 * This example demonstrates how to use streaming to get
 * real-time updates during task execution.
 */

import {
  SurfAgent,
  createNativeBackend,
  StreamEvent,
} from '@lov3kaizen/agentsea-surf';

async function main() {
  console.log('Surf Agent - Streaming Example\n');

  const backend = createNativeBackend();

  try {
    await backend.connect();
    console.log(`Connected to: ${backend.name}\n`);

    const agent = new SurfAgent('streaming-example', backend, {
      maxSteps: 10,
      vision: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        includeScreenshotInResponse: true,
      },
      sandbox: { enabled: true },
    });

    const task = 'Look at the current screen and describe what you see';

    console.log(`Task: ${task}\n`);
    console.log('=== Streaming Events ===\n');

    // Use streaming to get real-time updates
    for await (const event of agent.executeStream(task)) {
      handleStreamEvent(event);
    }

    console.log('\n=== Execution Complete ===');
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  } finally {
    await backend.disconnect();
  }
}

function handleStreamEvent(event: StreamEvent) {
  const timestamp = event.timestamp.toISOString().split('T')[1].split('.')[0];

  switch (event.type) {
    case 'screenshot':
      console.log(
        `[${timestamp}] Step ${event.step}: Screenshot taken ` +
          `(${event.screenshot.dimensions.width}x${event.screenshot.dimensions.height})`,
      );
      break;

    case 'analysis':
      console.log(`[${timestamp}] Step ${event.step}: Screen analyzed`);
      console.log(`  State: ${event.analysis.currentState}`);
      console.log(`  Elements found: ${event.analysis.elements.length}`);
      console.log(
        `  Suggested actions: ${event.analysis.suggestedActions.length}`,
      );
      break;

    case 'thinking':
      console.log(`[${timestamp}] Step ${event.step}: Thinking...`);
      console.log(`  ${event.content.substring(0, 100)}...`);
      break;

    case 'action':
      console.log(`[${timestamp}] Step ${event.step}: Executing action`);
      console.log(`  Action: ${event.action.action}`);
      console.log(`  Description: ${event.action.description}`);
      console.log(
        `  Confidence: ${(event.action.confidence * 100).toFixed(1)}%`,
      );
      break;

    case 'action_result':
      console.log(`[${timestamp}] Step ${event.step}: Action result`);
      console.log(`  Success: ${event.result.success ? 'Yes' : 'No'}`);
      console.log(`  Duration: ${event.result.duration}ms`);
      if (event.result.error) {
        console.log(`  Error: ${event.result.error}`);
      }
      break;

    case 'complete':
      console.log(`[${timestamp}] Task completed after ${event.step} steps`);
      console.log(`  Status: ${event.state.status}`);
      console.log(`  Response: ${event.response}`);
      break;

    case 'error':
      console.log(`[${timestamp}] Error at step ${event.step}`);
      console.log(`  Error: ${event.error}`);
      break;
  }
}

main().catch(console.error);

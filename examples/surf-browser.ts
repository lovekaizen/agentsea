/**
 * Surf Agent Browser Example
 *
 * This example demonstrates how to use the Puppeteer backend
 * for browser automation tasks.
 */

import { SurfAgent, PuppeteerBackend } from '@lov3kaizen/agentsea-surf';

async function main() {
  console.log('Surf Agent - Browser Example\n');

  // Create a Puppeteer browser backend
  const backend = new PuppeteerBackend({
    headless: false, // Set to true for headless mode
    viewport: { width: 1280, height: 800 },
    initialUrl: 'https://www.google.com',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    console.log('Launching browser...');
    await backend.connect();
    console.log('Browser ready!\n');

    // Create the agent
    const agent = new SurfAgent('browser-example', backend, {
      maxSteps: 15,
      screenshotDelay: 1000, // Browser needs more time for page loads
      vision: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
        includeScreenshotInResponse: true,
      },
      sandbox: {
        enabled: true,
        allowedDomains: ['google.com', 'bing.com', 'duckduckgo.com'],
      },
    });

    // Execute a browser task
    const task =
      'Search for "TypeScript tutorial" on Google and describe the first result';

    console.log(`Task: ${task}\n`);

    // Stream the execution
    for await (const event of agent.executeStream(task)) {
      if (event.type === 'action') {
        console.log(
          `Action: ${event.action.action} - ${event.action.description}`,
        );
      } else if (event.type === 'action_result') {
        console.log(`  Result: ${event.result.success ? 'Success' : 'Failed'}`);
      } else if (event.type === 'complete') {
        console.log(`\nCompleted: ${event.response}`);
      } else if (event.type === 'error') {
        console.log(`\nError: ${event.error}`);
      }
    }

    // You can also use browser-specific methods
    console.log('\nCurrent URL:', await backend.getCurrentUrl());
    console.log('Page title:', await backend.getTitle());
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
  } finally {
    console.log('\nClosing browser...');
    await backend.disconnect();
    console.log('Done!');
  }
}

main().catch(console.error);

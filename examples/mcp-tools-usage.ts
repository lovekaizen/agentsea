/**
 * Example usage of Figma and n8n MCP tools
 *
 * Prerequisites:
 * 1. For Figma tools: Set FIGMA_ACCESS_TOKEN environment variable
 * 2. For n8n tools: Set N8N_API_KEY and N8N_BASE_URL environment variables
 */

import {
  Agent,
  figmaGetFileTool,
  figmaGetNodesTool,
  figmaGetImagesTool,
  figmaGetCommentsTool,
  figmaPostCommentTool,
  n8nExecuteWorkflowTool,
  n8nGetExecutionTool,
  n8nListWorkflowsTool,
  n8nTriggerWebhookTool,
  n8nGetWorkflowTool,
} from '@lov3kaizen/agentsea-core';

async function figmaExample() {
  console.log('=== Figma Tool Examples ===\n');

  const agent = new Agent({
    name: 'figma-agent',
    description: 'Agent with Figma integration capabilities',
    model: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    tools: [
      figmaGetFileTool,
      figmaGetNodesTool,
      figmaGetImagesTool,
      figmaGetCommentsTool,
      figmaPostCommentTool,
    ],
  });

  // Example 1: Get Figma file information
  const response1 = await agent.run(
    'Get information about the Figma file with key "abc123xyz"',
    {
      conversationId: 'figma-example-1',
      sessionData: {},
      history: [],
    },
  );

  console.log('Get File Response:', response1.content);

  // Example 2: Export images from Figma
  const response2 = await agent.run(
    'Export PNG images for nodes "1:23" and "1:45" from Figma file "abc123xyz" at 2x scale',
    {
      conversationId: 'figma-example-2',
      sessionData: {},
      history: [],
    },
  );

  console.log('Export Images Response:', response2.content);

  // Example 3: Get and post comments
  const response3 = await agent.run(
    'Get all comments from Figma file "abc123xyz" and post a new comment saying "Design looks great!"',
    {
      conversationId: 'figma-example-3',
      sessionData: {},
      history: [],
    },
  );

  console.log('Comments Response:', response3.content);
}

async function n8nExample() {
  console.log('\n=== n8n Tool Examples ===\n');

  const agent = new Agent({
    name: 'n8n-agent',
    description: 'Agent with n8n workflow automation capabilities',
    model: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    tools: [
      n8nExecuteWorkflowTool,
      n8nGetExecutionTool,
      n8nListWorkflowsTool,
      n8nTriggerWebhookTool,
      n8nGetWorkflowTool,
    ],
  });

  // Example 1: List all workflows
  const response1 = await agent.run(
    'List all active workflows in my n8n instance',
    {
      conversationId: 'n8n-example-1',
      sessionData: {},
      history: [],
    },
  );

  console.log('List Workflows Response:', response1.content);

  // Example 2: Execute a workflow
  const response2 = await agent.run(
    'Execute workflow ID "workflow123" with data { "name": "John", "email": "john@example.com" }',
    {
      conversationId: 'n8n-example-2',
      sessionData: {},
      history: [],
    },
  );

  console.log('Execute Workflow Response:', response2.content);

  // Example 3: Trigger webhook
  const response3 = await agent.run(
    'Trigger the webhook at "webhook/my-workflow" with POST data { "action": "process", "items": [1, 2, 3] }',
    {
      conversationId: 'n8n-example-3',
      sessionData: {},
      history: [],
    },
  );

  console.log('Trigger Webhook Response:', response3.content);

  // Example 4: Check execution status
  const response4 = await agent.run(
    'Get the status and results of execution ID "exec123"',
    {
      conversationId: 'n8n-example-4',
      sessionData: {},
      history: [],
    },
  );

  console.log('Execution Status Response:', response4.content);
}

async function combinedExample() {
  console.log('\n=== Combined Workflow Example ===\n');

  // Create an agent that can use both Figma and n8n tools
  const agent = new Agent({
    name: 'design-automation-agent',
    description:
      'Agent that can interact with Figma designs and trigger n8n workflows',
    model: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    tools: [
      figmaGetFileTool,
      figmaGetImagesTool,
      figmaPostCommentTool,
      n8nExecuteWorkflowTool,
      n8nTriggerWebhookTool,
    ],
  });

  // Example: Export Figma design and trigger a workflow to process it
  const response = await agent.run(
    `
    1. Get the latest version of Figma file "design123"
    2. Export the main frame as a PNG image
    3. Trigger the n8n webhook at "webhook/process-design" with the image URL
    4. Post a comment on the Figma file saying "Design exported and processed via n8n"
    `,
    {
      conversationId: 'combined-example',
      sessionData: {},
      history: [],
    },
  );

  console.log('Combined Workflow Response:', response.content);
}

// Run examples
async function main() {
  try {
    // Check for required environment variables
    if (!process.env.FIGMA_ACCESS_TOKEN) {
      console.warn(
        'Warning: FIGMA_ACCESS_TOKEN not set. Figma examples will fail.',
      );
    }

    if (!process.env.N8N_API_KEY || !process.env.N8N_BASE_URL) {
      console.warn(
        'Warning: N8N_API_KEY or N8N_BASE_URL not set. n8n examples will fail.',
      );
    }

    // Uncomment the examples you want to run
    // await figmaExample();
    // await n8nExample();
    // await combinedExample();

    console.log(
      '\nExamples are commented out by default. Uncomment the ones you want to run.',
    );
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

void main();

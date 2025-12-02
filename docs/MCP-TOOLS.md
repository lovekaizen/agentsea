# MCP Tools Documentation

This document describes the Figma and n8n MCP (Model Context Protocol) tools available in AgentSea.

## Table of Contents

- [Figma Tools](#figma-tools)
  - [Setup](#figma-setup)
  - [Available Tools](#figma-available-tools)
- [n8n Tools](#n8n-tools)
  - [Setup](#n8n-setup)
  - [Available Tools](#n8n-available-tools)
- [Usage Examples](#usage-examples)

---

## Figma Tools

The Figma tools allow agents to interact with Figma's design files, nodes, images, and comments programmatically.

### Figma Setup

To use Figma tools, you need a Figma access token:

1. Go to your [Figma account settings](https://www.figma.com/settings)
2. Navigate to "Personal Access Tokens"
3. Generate a new token
4. Set the token as an environment variable:

```bash
export FIGMA_ACCESS_TOKEN="your_figma_token_here"
```

Alternatively, you can pass the token directly in the tool parameters using the `accessToken` parameter.

### Figma Available Tools

#### 1. `figma_get_file`

Get information about a Figma file including its document structure, components, and styles.

**Parameters:**

- `fileKey` (required): The key/ID of the Figma file
- `version` (optional): Specific version ID to retrieve
- `depth` (optional): How deep to traverse the document tree
- `geometry` (optional): Whether to include geometry data ('paths' or 'none')
- `accessToken` (optional): Figma access token

**Example:**

```typescript
{
  fileKey: "abc123xyz",
  depth: 2,
  geometry: "paths"
}
```

#### 2. `figma_get_nodes`

Get specific nodes from a Figma file by their IDs.

**Parameters:**

- `fileKey` (required): The key/ID of the Figma file
- `nodeIds` (required): Array of node IDs to retrieve
- `accessToken` (optional): Figma access token

**Example:**

```typescript
{
  fileKey: "abc123xyz",
  nodeIds: ["1:23", "1:45", "2:67"]
}
```

#### 3. `figma_get_images`

Export images from Figma nodes. Returns URLs to download the rendered images.

**Parameters:**

- `fileKey` (required): The key/ID of the Figma file
- `nodeIds` (required): Array of node IDs to export
- `format` (optional): Image format - 'jpg', 'png', 'svg', or 'pdf' (default: 'png')
- `scale` (optional): Image scale from 0.01 to 4
- `accessToken` (optional): Figma access token

**Example:**

```typescript
{
  fileKey: "abc123xyz",
  nodeIds: ["1:23", "1:45"],
  format: "png",
  scale: 2
}
```

#### 4. `figma_get_comments`

Get all comments from a Figma file.

**Parameters:**

- `fileKey` (required): The key/ID of the Figma file
- `accessToken` (optional): Figma access token

**Example:**

```typescript
{
  fileKey: 'abc123xyz';
}
```

#### 5. `figma_post_comment`

Post a new comment to a Figma file.

**Parameters:**

- `fileKey` (required): The key/ID of the Figma file
- `message` (required): The comment message text
- `clientMeta` (optional): Position and context for the comment
  - `x`: X coordinate
  - `y`: Y coordinate
  - `node_id`: Node ID to comment on
- `commentId` (optional): Parent comment ID if replying
- `accessToken` (optional): Figma access token

**Example:**

```typescript
{
  fileKey: "abc123xyz",
  message: "This design looks great!",
  clientMeta: {
    node_id: "1:23",
    x: 100,
    y: 200
  }
}
```

---

## n8n Tools

The n8n tools allow agents to execute and manage n8n workflows programmatically.

### n8n Setup

To use n8n tools, you need:

1. A running n8n instance (self-hosted or cloud)
2. An API key from your n8n instance
3. The base URL of your n8n instance

Set these as environment variables:

```bash
export N8N_API_KEY="your_n8n_api_key"
export N8N_BASE_URL="https://your-n8n-instance.com"
```

Alternatively, you can pass these values directly in the tool parameters.

### n8n Available Tools

#### 1. `n8n_execute_workflow`

Execute an n8n workflow by ID.

**Parameters:**

- `workflowId` (required): The ID of the workflow to execute
- `data` (optional): Input data to pass to the workflow
- `waitForCompletion` (optional): Wait for execution to complete (default: true)
- `apiKey` (optional): n8n API key
- `baseUrl` (optional): n8n base URL

**Example:**

```typescript
{
  workflowId: "workflow123",
  data: {
    name: "John Doe",
    email: "john@example.com"
  },
  waitForCompletion: true
}
```

#### 2. `n8n_get_execution`

Get the status and results of a specific workflow execution.

**Parameters:**

- `executionId` (required): The ID of the execution to retrieve
- `apiKey` (optional): n8n API key
- `baseUrl` (optional): n8n base URL

**Example:**

```typescript
{
  executionId: 'exec123';
}
```

#### 3. `n8n_list_workflows`

List all available workflows in the n8n instance.

**Parameters:**

- `active` (optional): Filter by active/inactive workflows
- `tags` (optional): Filter workflows by tags
- `limit` (optional): Maximum number of workflows to return (default: 50)
- `apiKey` (optional): n8n API key
- `baseUrl` (optional): n8n base URL

**Example:**

```typescript
{
  active: true,
  tags: ["production", "api"],
  limit: 20
}
```

#### 4. `n8n_trigger_webhook`

Trigger an n8n workflow via webhook.

**Parameters:**

- `webhookPath` (required): The webhook path (e.g., "webhook/my-workflow")
- `method` (optional): HTTP method - 'GET', 'POST', 'PUT', 'DELETE', 'PATCH' (default: 'POST')
- `data` (optional): Data to send to the webhook
- `headers` (optional): Additional headers to include
- `baseUrl` (optional): n8n base URL

**Example:**

```typescript
{
  webhookPath: "webhook/my-workflow",
  method: "POST",
  data: {
    action: "process",
    items: [1, 2, 3]
  }
}
```

#### 5. `n8n_get_workflow`

Get detailed information about a specific workflow.

**Parameters:**

- `workflowId` (required): The ID of the workflow to retrieve
- `apiKey` (optional): n8n API key
- `baseUrl` (optional): n8n base URL

**Example:**

```typescript
{
  workflowId: 'workflow123';
}
```

---

## Usage Examples

### Basic Agent with Figma Tools

```typescript
import {
  Agent,
  figmaGetFileTool,
  figmaGetImagesTool,
} from '@lov3kaizen/agentsea-core';

const agent = new Agent({
  name: 'figma-agent',
  description: 'Agent with Figma integration',
  model: 'claude-3-sonnet-20240229',
  provider: 'anthropic',
  tools: [figmaGetFileTool, figmaGetImagesTool],
});

const response = await agent.run(
  'Get the Figma file "abc123" and export all frames as PNG images',
  {
    conversationId: 'my-conversation',
    sessionData: {},
    history: [],
  },
);
```

### Basic Agent with n8n Tools

```typescript
import {
  Agent,
  n8nExecuteWorkflowTool,
  n8nListWorkflowsTool,
} from '@lov3kaizen/agentsea-core';

const agent = new Agent({
  name: 'n8n-agent',
  description: 'Agent with n8n workflow automation',
  model: 'claude-3-sonnet-20240229',
  provider: 'anthropic',
  tools: [n8nExecuteWorkflowTool, n8nListWorkflowsTool],
});

const response = await agent.run(
  'List all workflows and execute the one named "Data Processing"',
  {
    conversationId: 'my-conversation',
    sessionData: {},
    history: [],
  },
);
```

### Combined Figma + n8n Workflow

```typescript
import {
  Agent,
  figmaGetFileTool,
  figmaGetImagesTool,
  n8nTriggerWebhookTool,
} from '@lov3kaizen/agentsea-core';

const agent = new Agent({
  name: 'design-automation-agent',
  description: 'Automates design export and processing',
  model: 'claude-3-sonnet-20240229',
  provider: 'anthropic',
  tools: [figmaGetFileTool, figmaGetImagesTool, n8nTriggerWebhookTool],
});

const response = await agent.run(
  `
  1. Get the Figma file "design123"
  2. Export the main frame as PNG
  3. Send the image URL to the n8n webhook "webhook/process-design"
  `,
  {
    conversationId: 'automation-flow',
    sessionData: {},
    history: [],
  },
);
```

### Direct Tool Usage

You can also use the tools directly without an agent:

```typescript
import { figmaGetFileTool } from '@lov3kaizen/agentsea-core';

const result = await figmaGetFileTool.execute(
  {
    fileKey: 'abc123xyz',
    depth: 2,
  },
  {
    agentName: 'manual-execution',
    conversationId: 'direct-call',
    metadata: {},
  },
);

console.log(result);
```

---

## Error Handling

All tools include built-in retry logic with exponential backoff:

- **Max Attempts**: 3
- **Backoff Strategy**: Exponential
- **Initial Delay**: 1000ms
- **Max Delay**: 10000ms

Common errors:

- `Figma access token is required`: Set `FIGMA_ACCESS_TOKEN` environment variable or pass `accessToken` parameter
- `n8n API key and base URL are required`: Set `N8N_API_KEY` and `N8N_BASE_URL` environment variables
- `Figma API error: 403`: Invalid or expired access token
- `n8n API error: 401`: Invalid API key
- `Request timeout`: Network issues or slow API response

---

## Best Practices

1. **Environment Variables**: Always use environment variables for API keys and tokens in production
2. **Error Handling**: Wrap tool executions in try-catch blocks for graceful error handling
3. **Rate Limiting**: Be mindful of API rate limits, especially when making multiple requests
4. **Data Size**: Figma files can be large - use `depth` parameter to limit data retrieval
5. **Webhook Security**: Secure your n8n webhooks with authentication when possible
6. **Caching**: Cache Figma file data when possible to reduce API calls
7. **Testing**: Test workflows in n8n before triggering them from agents

---

## Additional Resources

- [Figma API Documentation](https://www.figma.com/developers/api)
- [n8n API Documentation](https://docs.n8n.io/api/)
- [AgentSea Core Documentation](../README.md)

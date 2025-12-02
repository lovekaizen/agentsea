# MCP Tools Quick Reference

## Environment Variables Setup

```bash
# Figma
export FIGMA_ACCESS_TOKEN="your_figma_token"

# n8n
export N8N_API_KEY="your_n8n_api_key"
export N8N_BASE_URL="https://your-n8n-instance.com"
```

## Import Statement

```typescript
import {
  // Figma Tools
  figmaGetFileTool,
  figmaGetNodesTool,
  figmaGetImagesTool,
  figmaGetCommentsTool,
  figmaPostCommentTool,
  // n8n Tools
  n8nExecuteWorkflowTool,
  n8nGetExecutionTool,
  n8nListWorkflowsTool,
  n8nTriggerWebhookTool,
  n8nGetWorkflowTool,
} from '@lov3kaizen/agentsea-core';
```

## Figma Tools Cheatsheet

| Tool                 | Purpose            | Key Parameters                              |
| -------------------- | ------------------ | ------------------------------------------- |
| `figma_get_file`     | Get file info      | `fileKey`, `version?`, `depth?`             |
| `figma_get_nodes`    | Get specific nodes | `fileKey`, `nodeIds[]`                      |
| `figma_get_images`   | Export images      | `fileKey`, `nodeIds[]`, `format?`, `scale?` |
| `figma_get_comments` | Get comments       | `fileKey`                                   |
| `figma_post_comment` | Post comment       | `fileKey`, `message`, `clientMeta?`         |

## n8n Tools Cheatsheet

| Tool                   | Purpose                | Key Parameters                              |
| ---------------------- | ---------------------- | ------------------------------------------- |
| `n8n_execute_workflow` | Run workflow           | `workflowId`, `data?`, `waitForCompletion?` |
| `n8n_get_execution`    | Check execution status | `executionId`                               |
| `n8n_list_workflows`   | List workflows         | `active?`, `tags?[]`, `limit?`              |
| `n8n_trigger_webhook`  | Trigger webhook        | `webhookPath`, `method?`, `data?`           |
| `n8n_get_workflow`     | Get workflow details   | `workflowId`                                |

## Quick Examples

### Figma: Get File and Export

```typescript
const agent = new Agent({
  name: 'figma-agent',
  tools: [figmaGetFileTool, figmaGetImagesTool],
  // ... other config
});

await agent.run('Get file "abc123" and export node "1:23" as PNG');
```

### n8n: Execute Workflow

```typescript
const agent = new Agent({
  name: 'n8n-agent',
  tools: [n8nExecuteWorkflowTool],
  // ... other config
});

await agent.run('Execute workflow "wf123" with data {"name": "test"}');
```

### Combined: Figma → n8n

```typescript
const agent = new Agent({
  name: 'automation-agent',
  tools: [figmaGetImagesTool, n8nTriggerWebhookTool],
  // ... other config
});

await agent.run(`
  1. Export Figma node "1:23" from file "abc123"
  2. Send the image URL to webhook "webhook/process-image"
`);
```

## Common Patterns

### Pattern 1: Design Review Automation

```typescript
// Get Figma file → Export images → Post to n8n → Add comment
tools: [
  figmaGetFileTool,
  figmaGetImagesTool,
  figmaPostCommentTool,
  n8nTriggerWebhookTool,
];
```

### Pattern 2: Workflow Status Monitor

```typescript
// List workflows → Execute → Monitor status
tools: [n8nListWorkflowsTool, n8nExecuteWorkflowTool, n8nGetExecutionTool];
```

### Pattern 3: Design Asset Pipeline

```typescript
// Get file → Export images → Process via n8n → Update comments
tools: [
  figmaGetFileTool,
  figmaGetImagesTool,
  n8nExecuteWorkflowTool,
  figmaPostCommentTool,
];
```

## Error Handling

```typescript
try {
  const result = await figmaGetFileTool.execute({ fileKey: 'abc123' }, context);
} catch (error) {
  if (error.message.includes('access token')) {
    // Handle auth error
  } else if (error.message.includes('404')) {
    // Handle not found
  }
}
```

## Retry Configuration

All tools have built-in retry with exponential backoff:

- Max attempts: 3
- Initial delay: 1000ms
- Max delay: 10000ms

## API Response Formats

### Figma Get File

```json
{
  "name": "My Design",
  "document": { ... },
  "components": { ... },
  "styles": { ... }
}
```

### Figma Get Images

```json
{
  "images": {
    "1:23": "https://...",
    "1:45": "https://..."
  }
}
```

### n8n Execute Workflow

```json
{
  "data": {
    "executionId": "exec123",
    "status": "running"
  }
}
```

### n8n List Workflows

```json
{
  "data": [
    {
      "id": "wf123",
      "name": "My Workflow",
      "active": true
    }
  ]
}
```

import { z } from 'zod';

import { Tool } from '../../types';

/**
 * n8n API tool for interacting with n8n workflows
 * Requires N8N_API_KEY and N8N_BASE_URL in environment or passed in context
 */
export const n8nExecuteWorkflowTool: Tool = {
  name: 'n8n_execute_workflow',
  description:
    'Execute an n8n workflow by ID or name. Optionally pass input data to the workflow.',
  parameters: z.object({
    workflowId: z.string().describe('The ID of the workflow to execute'),
    data: z
      .any()
      .optional()
      .describe('Input data to pass to the workflow execution'),
    waitForCompletion: z
      .boolean()
      .default(true)
      .describe('Wait for workflow execution to complete before returning'),
    apiKey: z
      .string()
      .optional()
      .describe('n8n API key (or use N8N_API_KEY env var)'),
    baseUrl: z
      .string()
      .optional()
      .describe('n8n base URL (or use N8N_BASE_URL env var)'),
  }),
  execute: async (params: {
    workflowId: string;
    data?: any;
    waitForCompletion?: boolean;
    apiKey?: string;
    baseUrl?: string;
  }) => {
    const apiKey = params.apiKey || process.env.N8N_API_KEY;
    const baseUrl = params.baseUrl || process.env.N8N_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new Error(
        'n8n API key and base URL are required. Provide apiKey and baseUrl parameters or set N8N_API_KEY and N8N_BASE_URL environment variables.',
      );
    }

    const url = `${baseUrl}/api/v1/workflows/${params.workflowId}/execute`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: params.data || {},
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} - ${error}`);
    }

    const result = (await response.json()) as {
      data?: { executionId?: string };
    };

    // If waiting for completion, poll for status
    if (params.waitForCompletion && result.data?.executionId) {
      return await pollExecutionStatus(
        result.data.executionId,
        apiKey,
        baseUrl,
      );
    }

    return result;
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  },
};

export const n8nGetExecutionTool: Tool = {
  name: 'n8n_get_execution',
  description:
    'Get the status and results of a specific workflow execution by execution ID',
  parameters: z.object({
    executionId: z.string().describe('The ID of the execution to retrieve'),
    apiKey: z
      .string()
      .optional()
      .describe('n8n API key (or use N8N_API_KEY env var)'),
    baseUrl: z
      .string()
      .optional()
      .describe('n8n base URL (or use N8N_BASE_URL env var)'),
  }),
  execute: async (params: {
    executionId: string;
    apiKey?: string;
    baseUrl?: string;
  }) => {
    const apiKey = params.apiKey || process.env.N8N_API_KEY;
    const baseUrl = params.baseUrl || process.env.N8N_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new Error('n8n API key and base URL are required');
    }

    const url = `${baseUrl}/api/v1/executions/${params.executionId}`;

    const response = await fetch(url, {
      headers: {
        'X-N8N-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
  },
};

export const n8nListWorkflowsTool: Tool = {
  name: 'n8n_list_workflows',
  description:
    'List all available workflows in the n8n instance. Useful for discovering workflow IDs.',
  parameters: z.object({
    active: z
      .boolean()
      .optional()
      .describe('Filter by active/inactive workflows'),
    tags: z.array(z.string()).optional().describe('Filter workflows by tags'),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe('Maximum number of workflows to return'),
    apiKey: z
      .string()
      .optional()
      .describe('n8n API key (or use N8N_API_KEY env var)'),
    baseUrl: z
      .string()
      .optional()
      .describe('n8n base URL (or use N8N_BASE_URL env var)'),
  }),
  execute: async (params: {
    active?: boolean;
    tags?: string[];
    limit?: number;
    apiKey?: string;
    baseUrl?: string;
  }) => {
    const apiKey = params.apiKey || process.env.N8N_API_KEY;
    const baseUrl = params.baseUrl || process.env.N8N_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new Error('n8n API key and base URL are required');
    }

    const queryParams = new URLSearchParams();
    if (params.active !== undefined)
      queryParams.append('active', params.active.toString());
    if (params.tags && params.tags.length > 0)
      queryParams.append('tags', params.tags.join(','));
    if (params.limit) queryParams.append('limit', params.limit.toString());

    const url = `${baseUrl}/api/v1/workflows${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'X-N8N-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
};

export const n8nTriggerWebhookTool: Tool = {
  name: 'n8n_trigger_webhook',
  description:
    'Trigger an n8n workflow via webhook. Use this for workflows configured with webhook triggers.',
  parameters: z.object({
    webhookPath: z
      .string()
      .describe('The webhook path (e.g., "webhook/my-workflow")'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .default('POST')
      .describe('HTTP method for the webhook'),
    data: z.any().optional().describe('Data to send to the webhook'),
    headers: z
      .record(z.string())
      .optional()
      .describe('Additional headers to include'),
    baseUrl: z
      .string()
      .optional()
      .describe('n8n base URL (or use N8N_BASE_URL env var)'),
  }),
  execute: async (params: {
    webhookPath: string;
    method?: string;
    data?: any;
    headers?: Record<string, string>;
    baseUrl?: string;
  }) => {
    const baseUrl = params.baseUrl || process.env.N8N_BASE_URL;

    if (!baseUrl) {
      throw new Error(
        'n8n base URL is required. Provide baseUrl parameter or set N8N_BASE_URL environment variable.',
      );
    }

    // Remove leading slash if present
    const cleanPath = params.webhookPath.replace(/^\//, '');
    const url = `${baseUrl}/${cleanPath}`;

    const options: RequestInit = {
      method: params.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...params.headers,
      },
    };

    if (
      params.data &&
      ['POST', 'PUT', 'PATCH'].includes(params.method || 'POST')
    ) {
      options.body = JSON.stringify(params.data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n webhook error: ${response.status} - ${error}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
  },
};

export const n8nGetWorkflowTool: Tool = {
  name: 'n8n_get_workflow',
  description:
    'Get detailed information about a specific workflow including its nodes and connections',
  parameters: z.object({
    workflowId: z.string().describe('The ID of the workflow to retrieve'),
    apiKey: z
      .string()
      .optional()
      .describe('n8n API key (or use N8N_API_KEY env var)'),
    baseUrl: z
      .string()
      .optional()
      .describe('n8n base URL (or use N8N_BASE_URL env var)'),
  }),
  execute: async (params: {
    workflowId: string;
    apiKey?: string;
    baseUrl?: string;
  }) => {
    const apiKey = params.apiKey || process.env.N8N_API_KEY;
    const baseUrl = params.baseUrl || process.env.N8N_BASE_URL;

    if (!apiKey || !baseUrl) {
      throw new Error('n8n API key and base URL are required');
    }

    const url = `${baseUrl}/api/v1/workflows/${params.workflowId}`;

    const response = await fetch(url, {
      headers: {
        'X-N8N-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
};

/**
 * Helper function to poll execution status until completion
 */
async function pollExecutionStatus(
  executionId: string,
  apiKey: string,
  baseUrl: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = `${baseUrl}/api/v1/executions/${executionId}`;

    const response = await fetch(url, {
      headers: {
        'X-N8N-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`n8n API error: ${response.status} - ${error}`);
    }

    const execution = (await response.json()) as {
      data?: { finished?: boolean; status?: string };
    };

    // Check if execution is finished
    if (
      execution.data?.finished === true ||
      execution.data?.status === 'error'
    ) {
      return execution;
    }

    // Wait before next poll
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `Workflow execution did not complete within ${(maxAttempts * intervalMs) / 1000} seconds`,
  );
}

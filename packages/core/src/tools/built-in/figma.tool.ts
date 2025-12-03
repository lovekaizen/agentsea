import { z } from 'zod';

import { Tool } from '../../types';

/**
 * Figma API tool for interacting with Figma files, nodes, images, and comments
 * Requires FIGMA_ACCESS_TOKEN in environment or passed in context
 */
export const figmaGetFileTool: Tool = {
  name: 'figma_get_file',
  description:
    'Get information about a Figma file including its document structure, components, and styles',
  parameters: z.object({
    fileKey: z.string().describe('The key/ID of the Figma file'),
    version: z.string().optional().describe('Specific version ID to retrieve'),
    depth: z
      .number()
      .optional()
      .describe('How deep to traverse the document tree (default: all)'),
    geometry: z
      .enum(['paths', 'none'])
      .optional()
      .describe('Whether to include geometry data'),
    accessToken: z
      .string()
      .optional()
      .describe('Figma access token (or use FIGMA_ACCESS_TOKEN env var)'),
  }),
  execute: async (params: {
    fileKey: string;
    version?: string;
    depth?: number;
    geometry?: string;
    accessToken?: string;
  }) => {
    const token = params.accessToken || process.env.FIGMA_ACCESS_TOKEN;

    if (!token) {
      throw new Error(
        'Figma access token is required. Provide accessToken parameter or set FIGMA_ACCESS_TOKEN environment variable.',
      );
    }

    const queryParams = new URLSearchParams();
    if (params.version) queryParams.append('version', params.version);
    if (params.depth) queryParams.append('depth', params.depth.toString());
    if (params.geometry) queryParams.append('geometry', params.geometry);

    const url = `https://api.figma.com/v1/files/${params.fileKey}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': token,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Figma API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  },
};

export const figmaGetNodesTool: Tool = {
  name: 'figma_get_nodes',
  description:
    'Get specific nodes from a Figma file by their IDs. Useful for retrieving specific components or frames.',
  parameters: z.object({
    fileKey: z.string().describe('The key/ID of the Figma file'),
    nodeIds: z
      .array(z.string())
      .describe('Array of node IDs to retrieve from the file'),
    accessToken: z
      .string()
      .optional()
      .describe('Figma access token (or use FIGMA_ACCESS_TOKEN env var)'),
  }),
  execute: async (params: {
    fileKey: string;
    nodeIds: string[];
    accessToken?: string;
  }) => {
    const token = params.accessToken || process.env.FIGMA_ACCESS_TOKEN;

    if (!token) {
      throw new Error('Figma access token is required');
    }

    const nodeIdsParam = params.nodeIds.join(',');
    const url = `https://api.figma.com/v1/files/${params.fileKey}/nodes?ids=${encodeURIComponent(nodeIdsParam)}`;

    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': token,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Figma API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
  },
};

export const figmaGetImagesTool: Tool = {
  name: 'figma_get_images',
  description:
    'Export images from Figma nodes. Returns URLs to download the rendered images.',
  parameters: z.object({
    fileKey: z.string().describe('The key/ID of the Figma file'),
    nodeIds: z.array(z.string()).describe('Array of node IDs to export'),
    format: z
      .enum(['jpg', 'png', 'svg', 'pdf'])
      .default('png')
      .describe('Image format'),
    scale: z
      .number()
      .min(0.01)
      .max(4)
      .optional()
      .describe('Image scale (0.01 to 4)'),
    accessToken: z
      .string()
      .optional()
      .describe('Figma access token (or use FIGMA_ACCESS_TOKEN env var)'),
  }),
  execute: async (params: {
    fileKey: string;
    nodeIds: string[];
    format: string;
    scale?: number;
    accessToken?: string;
  }) => {
    const token = params.accessToken || process.env.FIGMA_ACCESS_TOKEN;

    if (!token) {
      throw new Error('Figma access token is required');
    }

    const queryParams = new URLSearchParams({
      ids: params.nodeIds.join(','),
      format: params.format,
    });

    if (params.scale) {
      queryParams.append('scale', params.scale.toString());
    }

    const url = `https://api.figma.com/v1/images/${params.fileKey}?${queryParams.toString()}`;

    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': token,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Figma API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
  },
};

export const figmaGetCommentsTool: Tool = {
  name: 'figma_get_comments',
  description: 'Get comments from a Figma file',
  parameters: z.object({
    fileKey: z.string().describe('The key/ID of the Figma file'),
    accessToken: z
      .string()
      .optional()
      .describe('Figma access token (or use FIGMA_ACCESS_TOKEN env var)'),
  }),
  execute: async (params: { fileKey: string; accessToken?: string }) => {
    const token = params.accessToken || process.env.FIGMA_ACCESS_TOKEN;

    if (!token) {
      throw new Error('Figma access token is required');
    }

    const url = `https://api.figma.com/v1/files/${params.fileKey}/comments`;

    const response = await fetch(url, {
      headers: {
        'X-Figma-Token': token,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Figma API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
};

export const figmaPostCommentTool: Tool = {
  name: 'figma_post_comment',
  description: 'Post a new comment to a Figma file',
  parameters: z.object({
    fileKey: z.string().describe('The key/ID of the Figma file'),
    message: z.string().describe('The comment message text'),
    clientMeta: z
      .object({
        x: z.number().optional().describe('X coordinate'),
        y: z.number().optional().describe('Y coordinate'),
        node_id: z.string().optional().describe('Node ID to comment on'),
      })
      .optional()
      .describe('Position and context for the comment'),
    commentId: z
      .string()
      .optional()
      .describe('Parent comment ID if replying to a comment'),
    accessToken: z
      .string()
      .optional()
      .describe('Figma access token (or use FIGMA_ACCESS_TOKEN env var)'),
  }),
  execute: async (params: {
    fileKey: string;
    message: string;
    clientMeta?: { x?: number; y?: number; node_id?: string };
    commentId?: string;
    accessToken?: string;
  }) => {
    const token = params.accessToken || process.env.FIGMA_ACCESS_TOKEN;

    if (!token) {
      throw new Error('Figma access token is required');
    }

    const url = `https://api.figma.com/v1/files/${params.fileKey}/comments`;

    const body: any = {
      message: params.message,
    };

    if (params.clientMeta) {
      body.client_meta = params.clientMeta;
    }

    if (params.commentId) {
      body.comment_id = params.commentId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Figma-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Figma API error: ${response.status} - ${error}`);
    }

    return await response.json();
  },
};

import { z } from 'zod';

import { Tool } from '../../types';

/**
 * HTTP request tool for making API calls
 */
export const httpRequestTool: Tool = {
  name: 'http_request',
  description:
    'Make HTTP requests to external APIs. Supports GET, POST, PUT, DELETE methods.',
  parameters: z.object({
    url: z.string().url().describe('The URL to make the request to'),
    method: z
      .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
      .default('GET')
      .describe('HTTP method'),
    headers: z.record(z.string()).optional().describe('HTTP headers'),
    body: z.any().optional().describe('Request body (for POST, PUT, PATCH)'),
    timeout: z
      .number()
      .optional()
      .default(10000)
      .describe('Request timeout in milliseconds'),
  }),
  execute: async (params: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
  }) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      params.timeout || 10000,
    );

    try {
      const options: RequestInit = {
        method: params.method,
        headers: {
          'Content-Type': 'application/json',
          ...params.headers,
        },
        signal: controller.signal,
      };

      if (params.body && ['POST', 'PUT', 'PATCH'].includes(params.method)) {
        options.body = JSON.stringify(params.body);
      }

      const response = await fetch(params.url, options);
      const contentType = response.headers.get('content-type');

      let data;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${params.timeout}ms`);
        }
        throw new Error(`HTTP request failed: ${error.message}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  },
  retryConfig: {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: ['Request timeout', 'Network error'],
  },
};

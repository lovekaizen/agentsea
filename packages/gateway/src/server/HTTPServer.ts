/**
 * HTTP Server - OpenAI-compatible REST API
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamSSE } from 'hono/streaming';
import { serve, type ServerType } from '@hono/node-server';
import type { Gateway } from '../core/Gateway.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChunk,
  ServerConfig,
} from '../core/types.js';
import { GatewayError, ValidationError } from '../core/types.js';

export interface HTTPServerOptions extends ServerConfig {
  gateway: Gateway;
}

/**
 * Creates an OpenAI-compatible HTTP server
 */
export function createHTTPServer(options: HTTPServerOptions): Hono {
  const { gateway, basePath = '' } = options;

  const app = new Hono();

  // Middleware
  app.use('*', logger());

  if (options.cors) {
    app.use(
      '*',
      cors({
        origin: options.cors.origin || '*',
        allowMethods: options.cors.methods || ['GET', 'POST', 'OPTIONS'],
        allowHeaders: options.cors.headers || [
          'Content-Type',
          'Authorization',
          'X-Request-Id',
        ],
      }),
    );
  }

  // Health check
  app.get(`${basePath}/health`, async (c) => {
    const health = await gateway.checkHealth();
    const allHealthy = Object.values(health).every((h) => h);

    return c.json(
      {
        status: allHealthy ? 'healthy' : 'degraded',
        providers: health,
        timestamp: new Date().toISOString(),
      },
      allHealthy ? 200 : 503,
    );
  });

  // Metrics endpoint
  app.get(`${basePath}/metrics`, (c) => {
    const metrics = gateway.getMetrics();
    return c.json(metrics);
  });

  // Models endpoint (OpenAI-compatible)
  app.get(`${basePath}/v1/models`, (c) => {
    const registry = gateway.getRegistry();
    const models = registry.getAllModels();

    const data = models.map((model) => {
      const modelInfo = registry.getModelInfo(model);
      return {
        id: model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: modelInfo?.provider || 'unknown',
      };
    });

    return c.json({
      object: 'list',
      data,
    });
  });

  // Chat completions endpoint (OpenAI-compatible)
  app.post(`${basePath}/v1/chat/completions`, async (c) => {
    try {
      const body = await c.req.json<ChatCompletionRequest>();

      // Extract request ID from headers if present
      const requestId = c.req.header('X-Request-Id');
      if (requestId) {
        body._gateway = { ...body._gateway, requestId };
      }

      // Handle streaming
      if (body.stream) {
        return streamSSE(c, async (stream) => {
          try {
            const generator = (await gateway.chat.completions.create(
              body,
            )) as AsyncGenerator<ChatCompletionChunk>;

            for await (const chunk of generator) {
              await stream.writeSSE({
                data: JSON.stringify(chunk),
              });
            }

            await stream.writeSSE({ data: '[DONE]' });
          } catch (error) {
            const errorResponse = formatError(error);
            await stream.writeSSE({
              data: JSON.stringify({ error: errorResponse }),
            });
          }
        });
      }

      // Non-streaming
      const response = (await gateway.chat.completions.create(
        body,
      )) as ChatCompletionResponse;

      return c.json(response);
    } catch (error) {
      const { status, body } = formatError(error);
      return c.json(body, status as 400 | 401 | 429 | 500 | 502 | 503);
    }
  });

  // Legacy completions endpoint (redirect to chat)
  app.post(`${basePath}/v1/completions`, (c) => {
    return c.json(
      {
        error: {
          message:
            'The completions endpoint is deprecated. Please use /v1/chat/completions instead.',
          type: 'invalid_request_error',
          code: 'deprecated_endpoint',
        },
      },
      400,
    );
  });

  // Catch-all for unknown routes
  app.all('*', (c) => {
    return c.json(
      {
        error: {
          message: `Unknown endpoint: ${c.req.method} ${c.req.path}`,
          type: 'invalid_request_error',
          code: 'unknown_endpoint',
        },
      },
      404,
    );
  });

  return app;
}

/**
 * Start the HTTP server
 */
export function startServer(
  app: Hono,
  options: { port?: number; host?: string },
): ServerType {
  const port = options.port || 3000;
  const host = options.host || '0.0.0.0';

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });

  console.log(`Gateway server running on http://${host}:${port}`);

  return server;
}

/**
 * Format error for API response
 */
function formatError(error: unknown): {
  status: number;
  body: { error: { message: string; type: string; code: string } };
} {
  // Check for ValidationError
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        error: {
          message: error.message,
          type: 'invalid_request_error',
          code: error.code,
        },
      },
    };
  }

  // Check for GatewayError
  if (error instanceof GatewayError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          message: error.message,
          type: 'gateway_error',
          code: error.code,
        },
      },
    };
  }

  // Check for error objects with name property (for duck typing)
  if (error instanceof Error) {
    // Check if it has ValidationError-like properties
    if (
      'name' in error &&
      error.name === 'ValidationError' &&
      'code' in error
    ) {
      return {
        status: 400,
        body: {
          error: {
            message: error.message,
            type: 'invalid_request_error',
            code: (error as Error & { code: string }).code,
          },
        },
      };
    }

    // Check if it has GatewayError-like properties
    if (
      'name' in error &&
      error.name === 'GatewayError' &&
      'statusCode' in error &&
      'code' in error
    ) {
      return {
        status: (error as Error & { statusCode: number }).statusCode,
        body: {
          error: {
            message: error.message,
            type: 'gateway_error',
            code: (error as Error & { code: string }).code,
          },
        },
      };
    }

    // Generic error
    return {
      status: 500,
      body: {
        error: {
          message: error.message,
          type: 'internal_error',
          code: 'internal_error',
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        message: 'An unknown error occurred',
        type: 'internal_error',
        code: 'unknown_error',
      },
    },
  };
}

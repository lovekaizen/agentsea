import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHTTPServer, startServer } from '../server/HTTPServer.js';
import type { Gateway } from '../core/Gateway.js';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  GatewayMetrics,
} from '../core/types.js';

// Create mock gateway
const createMockGateway = () => {
  const mockChat = vi.fn().mockResolvedValue({
    id: 'test-123',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'Hello!' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    _gateway: {
      provider: 'openai',
      latencyMs: 100,
      cost: 0.001,
      cached: false,
    },
  });

  const mockChatStream = vi.fn().mockImplementation(async function* () {
    yield {
      id: 'test-stream-123',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
    };
    yield {
      id: 'test-stream-123',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4o',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
  });

  const mockGateway = {
    chat: {
      completions: {
        create: vi
          .fn()
          .mockImplementation(async (req: ChatCompletionRequest) => {
            if (req.stream) {
              return mockChatStream();
            }
            return mockChat(req);
          }),
      },
    },
    checkHealth: vi.fn().mockResolvedValue({
      openai: true,
      anthropic: true,
    }),
    getMetrics: vi.fn().mockReturnValue({
      requests: { total: 10, successful: 8, failed: 2, cached: 3 },
      latency: { avg: 150, p50: 100, p95: 300, p99: 500 },
      tokens: { input: 1000, output: 500, total: 1500 },
      cost: {
        total: 0.05,
        byProvider: { openai: 0.03, anthropic: 0.02 },
        byModel: { 'gpt-4o': 0.03, 'claude-3-5-sonnet-20241022': 0.02 },
      },
      cache: { hits: 3, misses: 7, hitRate: 0.3 },
      providers: {},
    } as GatewayMetrics),
    getRegistry: vi.fn().mockReturnValue({
      getAllModels: () => ['gpt-4o', 'claude-3-5-sonnet-20241022'],
      getModelInfo: (model: string) => ({
        id: model,
        provider: model.startsWith('gpt') ? 'openai' : 'anthropic',
        contextWindow: 128000,
        maxOutputTokens: 4096,
        inputPricePerMillion: 2.5,
        outputPricePerMillion: 10.0,
        capabilities: {
          streaming: true,
          tools: true,
          vision: true,
          json_mode: true,
          system_prompts: true,
        },
      }),
    }),
    shutdown: vi.fn(),
  } as unknown as Gateway;

  return { mockGateway, mockChat, mockChatStream };
};

describe('createHTTPServer', () => {
  let mockGateway: Gateway;
  let mockChat: ReturnType<typeof vi.fn>;
  let mockChatStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mocks = createMockGateway();
    mockGateway = mocks.mockGateway;
    mockChat = mocks.mockChat;
    mockChatStream = mocks.mockChatStream;
  });

  describe('initialization', () => {
    it('should create server with default options', () => {
      const app = createHTTPServer({ gateway: mockGateway });
      expect(app).toBeDefined();
    });

    it('should create server with custom base path', () => {
      const app = createHTTPServer({
        gateway: mockGateway,
        basePath: '/api',
      });
      expect(app).toBeDefined();
    });

    it('should create server with CORS enabled', () => {
      const app = createHTTPServer({
        gateway: mockGateway,
        cors: {
          origin: 'https://example.com',
          methods: ['GET', 'POST'],
          headers: ['Content-Type'],
        },
      });
      expect(app).toBeDefined();
    });
  });

  describe('health endpoint', () => {
    it('should return healthy status when all providers healthy', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.providers).toEqual({ openai: true, anthropic: true });
      expect(data.timestamp).toBeDefined();
    });

    it('should return degraded status when some providers unhealthy', async () => {
      mockGateway.checkHealth = vi.fn().mockResolvedValue({
        openai: true,
        anthropic: false,
      });

      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(503);
      expect(data.status).toBe('degraded');
    });

    it('should work with custom base path', async () => {
      const app = createHTTPServer({
        gateway: mockGateway,
        basePath: '/api',
      });

      const res = await app.request('/api/health');
      expect(res.status).toBe(200);
    });
  });

  describe('metrics endpoint', () => {
    it('should return metrics', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/metrics');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.requests).toBeDefined();
      expect(data.latency).toBeDefined();
      expect(data.tokens).toBeDefined();
      expect(data.cost).toBeDefined();
      expect(data.cache).toBeDefined();
    });

    it('should work with custom base path', async () => {
      const app = createHTTPServer({
        gateway: mockGateway,
        basePath: '/api',
      });

      const res = await app.request('/api/metrics');
      expect(res.status).toBe(200);
    });
  });

  describe('models endpoint', () => {
    it('should return list of models', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/models');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.object).toBe('list');
      expect(data.data).toBeInstanceOf(Array);
      expect(data.data.length).toBe(2);
    });

    it('should format models correctly', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/models');
      const data = await res.json();

      const model = data.data[0];
      expect(model.id).toBeDefined();
      expect(model.object).toBe('model');
      expect(model.created).toBeGreaterThan(0);
      expect(model.owned_by).toBeDefined();
    });

    it('should work with custom base path', async () => {
      const app = createHTTPServer({
        gateway: mockGateway,
        basePath: '/api',
      });

      const res = await app.request('/api/v1/models');
      expect(res.status).toBe(200);
    });
  });

  describe('chat completions endpoint', () => {
    it('should handle non-streaming request', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.id).toBeDefined();
      expect(data.choices).toBeInstanceOf(Array);
      expect(data.choices[0].message.content).toBe('Hello!');
    });

    it('should handle streaming request', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true,
        }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');

      const text = await res.text();
      expect(text).toContain('data:');
      expect(text).toContain('[DONE]');
    });

    it('should pass request ID from header', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': 'custom-id-123',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(mockGateway.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _gateway: expect.objectContaining({
            requestId: 'custom-id-123',
          }),
        }),
      );
    });

    it('should handle validation errors', async () => {
      mockGateway.chat.completions.create = vi.fn().mockRejectedValue(
        Object.assign(new Error('Invalid request'), {
          name: 'ValidationError',
          code: 'invalid_request',
        }),
      );

      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [],
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('should handle gateway errors', async () => {
      const gatewayError = Object.assign(new Error('Provider unavailable'), {
        name: 'GatewayError',
        code: 'provider_unavailable',
        statusCode: 503,
      });

      mockGateway.chat.completions.create = vi
        .fn()
        .mockRejectedValue(gatewayError);

      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error.type).toBe('gateway_error');
    });

    it('should handle generic errors', async () => {
      mockGateway.chat.completions.create = vi
        .fn()
        .mockRejectedValue(new Error('Unknown error'));

      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error.type).toBe('internal_error');
    });

    it('should work with custom base path', async () => {
      const app = createHTTPServer({
        gateway: mockGateway,
        basePath: '/api',
      });

      const res = await app.request('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      });

      expect(res.status).toBe(200);
    });
  });

  describe('deprecated completions endpoint', () => {
    it('should return error for deprecated endpoint', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          prompt: 'Hello',
        }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error.code).toBe('deprecated_endpoint');
    });
  });

  describe('unknown endpoints', () => {
    it('should return 404 for unknown endpoints', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/unknown/endpoint');

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error.code).toBe('unknown_endpoint');
    });

    it('should include method and path in error message', async () => {
      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/unknown', { method: 'POST' });
      const data = await res.json();

      expect(data.error.message).toContain('POST');
      expect(data.error.message).toContain('/unknown');
    });
  });

  describe('streaming error handling', () => {
    it('should handle errors during streaming', async () => {
      const errorStream = vi.fn().mockImplementation(async function* () {
        yield {
          id: 'test',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'gpt-4o',
          choices: [
            { index: 0, delta: { content: 'Hello' }, finish_reason: null },
          ],
        };
        throw new Error('Stream error');
      });

      mockGateway.chat.completions.create = vi
        .fn()
        .mockImplementation(async (req: ChatCompletionRequest) => {
          if (req.stream) {
            return errorStream();
          }
          return mockChat(req);
        });

      const app = createHTTPServer({ gateway: mockGateway });

      const res = await app.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
          stream: true,
        }),
      });

      const text = await res.text();
      expect(text).toContain('error');
    });
  });
});

describe('startServer', () => {
  it('should start server with default options', () => {
    const { mockGateway } = createMockGateway();
    const app = createHTTPServer({ gateway: mockGateway });

    // Mock console.log to avoid output during tests
    const originalLog = console.log;
    console.log = vi.fn();

    const server = startServer(app, {});

    expect(server).toBeDefined();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Gateway server running'),
    );

    // Cleanup
    server.close();
    console.log = originalLog;
  });

  it('should start server with custom port', () => {
    const { mockGateway } = createMockGateway();
    const app = createHTTPServer({ gateway: mockGateway });

    const originalLog = console.log;
    console.log = vi.fn();

    const server = startServer(app, { port: 4000 });

    expect(server).toBeDefined();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('4000'));

    server.close();
    console.log = originalLog;
  });

  it('should start server with custom host', () => {
    const { mockGateway } = createMockGateway();
    const app = createHTTPServer({ gateway: mockGateway });

    const originalLog = console.log;
    console.log = vi.fn();

    const server = startServer(app, { host: 'localhost' });

    expect(server).toBeDefined();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('localhost'),
    );

    server.close();
    console.log = originalLog;
  });
});

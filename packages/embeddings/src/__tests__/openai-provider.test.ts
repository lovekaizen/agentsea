import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  OpenAIProvider,
  createOpenAIProvider,
} from '../providers/OpenAIProvider.js';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  const mockApiKey = 'test-api-key';

  // Mock fetch globally
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any;

  beforeEach(() => {
    mockFetch.mockReset();

    provider = new OpenAIProvider({
      apiKey: mockApiKey,
      model: 'text-embedding-3-small',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.info.name).toBe('text-embedding-3-small');
      expect(provider.info.provider).toBe('openai');
    });

    it('should throw error without API key', () => {
      expect(() => new OpenAIProvider({} as any)).toThrow(
        'API key is required',
      );
    });

    it('should use default model', () => {
      const defaultProvider = new OpenAIProvider({ apiKey: mockApiKey });
      expect(defaultProvider.info.name).toBe('text-embedding-3-small');
    });

    it('should accept custom model', () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-large',
      });
      expect(customProvider.info.name).toBe('text-embedding-3-large');
      expect(customProvider.info.dimensions).toBe(3072);
    });

    it('should accept custom dimensions for text-embedding-3 models', () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-small',
        dimensions: 512,
      });
      expect(customProvider.info.dimensions).toBe(512);
    });

    it('should use custom base URL', () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.openai.com/v1',
      });
      expect(customProvider).toBeInstanceOf(OpenAIProvider);
    });

    it('should accept organization', () => {
      const orgProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        organization: 'org-123',
      });
      expect(orgProvider).toBeInstanceOf(OpenAIProvider);
    });

    it('should handle unknown model as custom model', () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'custom-model',
        dimensions: 256,
      });
      expect(customProvider.info.name).toBe('custom-model');
      expect(customProvider.info.dimensions).toBe(256);
    });
  });

  describe('info', () => {
    it('should have correct model info', () => {
      const info = provider.info;

      expect(info.name).toBe('text-embedding-3-small');
      expect(info.provider).toBe('openai');
      expect(info.dimensions).toBe(1536);
      expect(info.maxTokens).toBe(8191);
      expect(info.maxBatchSize).toBe(2048);
      expect(info.costPer1K).toBeGreaterThan(0);
    });
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }],
          usage: { total_tokens: 10 },
        }),
      });

      const result = await provider.embed('test text');

      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.text).toBe('test text');
      expect(result.tokenCount).toBe(10);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/embeddings'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockApiKey}`,
          }),
        }),
      );
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'Invalid request' },
        }),
      });

      await expect(provider.embed('test')).rejects.toThrow('Invalid request');
    });

    it('should handle rate limit errors', async () => {
      // Create provider with no retries for faster test
      const noRetryProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        maxRetries: 0,
      });

      // Mock fetch to return rate limit error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'Rate limit exceeded' },
        }),
      });

      await expect(noRetryProvider.embed('test')).rejects.toThrow(
        'Rate limit exceeded',
      );

      const metrics = noRetryProvider.getMetrics();
      expect(metrics.rateLimitHits).toBeGreaterThan(0);
    });

    it('should handle network errors', async () => {
      // Create provider with no retries for faster test
      const noRetryProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        maxRetries: 0,
      });

      // Mock fetch to reject with network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(noRetryProvider.embed('test')).rejects.toThrow(
        'Network error',
      );
    });

    it('should include organization header when provided', async () => {
      const orgProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        organization: 'org-123',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      await orgProvider.embed('test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'OpenAI-Organization': 'org-123',
          }),
        }),
      );
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { index: 0, embedding: [0.1, 0.2] },
            { index: 1, embedding: [0.3, 0.4] },
          ],
          usage: { total_tokens: 20 },
        }),
      });

      const result = await provider.embedBatch(['text1', 'text2']);

      expect(result.results).toHaveLength(2);
      expect(result.totalTokens).toBe(20);
      expect(result.failures).toBe(0);
    });

    it('should sort embeddings by index', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { index: 2, embedding: [0.5, 0.6] },
            { index: 0, embedding: [0.1, 0.2] },
            { index: 1, embedding: [0.3, 0.4] },
          ],
          usage: { total_tokens: 30 },
        }),
      });

      const result = await provider.embedBatch(['text1', 'text2', 'text3']);

      expect(result.results[0].vector).toEqual([0.1, 0.2]);
      expect(result.results[1].vector).toEqual([0.3, 0.4]);
      expect(result.results[2].vector).toEqual([0.5, 0.6]);
    });

    it('should handle batch processing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: Array(10)
            .fill(null)
            .map((_, i) => ({ index: i, embedding: [i, i] })),
          usage: { total_tokens: 100 },
        }),
      });

      const texts = Array(10)
        .fill(null)
        .map((_, i) => `text${i}`);
      const result = await provider.embedBatch(texts);

      expect(result.results).toHaveLength(10);
    });

    it('should update cost estimate', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1000 },
        }),
      });

      await provider.embed('test');

      const metrics = provider.getMetrics();
      expect(metrics.estimatedCostUSD).toBeGreaterThan(0);
    });

    it('should continue on error when specified', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ index: 0, embedding: [0.1] }],
            usage: { total_tokens: 1 },
          }),
        });

      const result = await provider.embedBatch(['text1', 'text2'], {
        continueOnError: true,
        concurrency: 1,
      });

      expect(result.failures).toBeGreaterThan(0);
    });
  });

  describe('doEmbed', () => {
    it('should send correct request body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      await provider.embed('test');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.model).toBe('text-embedding-3-small');
      expect(body.input).toEqual(['test']);
    });

    it('should include dimensions for text-embedding-3 models', async () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-small',
        dimensions: 512,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      await customProvider.embed('test');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.dimensions).toBe(512);
    });

    it('should include encoding format when specified', async () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        encodingFormat: 'float',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      await customProvider.embed('test');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.encoding_format).toBe('float');
    });

    it('should include user identifier when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      await provider.embed('test', { user: 'user-123' });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.user).toBe('user-123');
    });

    it('should handle timeout', async () => {
      const timeoutProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        timeout: 100,
      });

      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ ok: true, json: async () => ({}) }),
              200,
            ),
          ),
      );

      // Note: This test may not work perfectly without proper AbortSignal.timeout support
      // but demonstrates the intent
      await expect(timeoutProvider.embed('test')).rejects.toThrow();
    });

    it('should use custom base URL', async () => {
      const customProvider = new OpenAIProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.api.com/v1',
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      await customProvider.embed('test');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.com/v1/embeddings',
        expect.any(Object),
      );
    });

    it('should handle missing usage data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
        }),
      });

      const result = await provider.embed('test');

      expect(result.tokenCount).toBe(0);
    });
  });

  describe('countTokens', () => {
    it('should approximate token count', () => {
      const text = 'This is a test sentence with multiple words';
      const tokens = provider.countTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeGreaterThan(text.split(' ').length * 0.5);
    });

    it('should return at least 1 token', () => {
      const tokens = provider.countTokens('x');
      expect(tokens).toBeGreaterThanOrEqual(1);
    });

    it('should scale with text length', () => {
      const shortText = 'short';
      const longText =
        'This is a much longer text with many more words and content';

      expect(provider.countTokens(longText)).toBeGreaterThan(
        provider.countTokens(shortText),
      );
    });
  });

  describe('getMetrics', () => {
    it('should return provider metrics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 10 },
        }),
      });

      await provider.embed('test');

      const metrics = provider.getMetrics();

      expect(metrics.provider).toBe('openai');
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.successfulRequests).toBeGreaterThan(0);
      expect(metrics.totalTokens).toBe(10);
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      const health = provider.getHealth();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('lastCheck');
    });
  });

  describe('checkHealth', () => {
    it('should perform health check', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 1 },
        }),
      });

      const health = await provider.checkHealth();

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should detect unhealthy state', async () => {
      mockFetch.mockRejectedValue(new Error('Connection failed'));

      const health = await provider.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ index: 0, embedding: [0.1] }],
          usage: { total_tokens: 10 },
        }),
      });

      await provider.embed('test');
      provider.resetMetrics();

      const metrics = provider.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.totalTokens).toBe(0);
    });
  });

  describe('createOpenAIProvider factory', () => {
    it('should create provider instance', () => {
      const factoryProvider = createOpenAIProvider({ apiKey: mockApiKey });
      expect(factoryProvider).toBeInstanceOf(OpenAIProvider);
    });
  });

  describe('model configurations', () => {
    it('should support text-embedding-3-small', () => {
      const p = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-small',
      });
      expect(p.info.dimensions).toBe(1536);
      expect(p.info.costPer1K).toBe(0.00002);
    });

    it('should support text-embedding-3-large', () => {
      const p = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-3-large',
      });
      expect(p.info.dimensions).toBe(3072);
      expect(p.info.costPer1K).toBe(0.00013);
    });

    it('should support text-embedding-ada-002', () => {
      const p = new OpenAIProvider({
        apiKey: mockApiKey,
        model: 'text-embedding-ada-002',
      });
      expect(p.info.dimensions).toBe(1536);
      expect(p.info.costPer1K).toBe(0.0001);
    });
  });
});

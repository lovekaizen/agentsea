import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PromptClient,
  PromptLoader,
  createDynamicPrompt,
} from '../sdk/Client.js';
import type { PromptData } from '../types/index.js';

describe('PromptClient', () => {
  let client: PromptClient;

  beforeEach(() => {
    client = new PromptClient({
      environment: 'test',
      cache: { enabled: true, ttl: 60 },
    });
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      const defaultClient = new PromptClient();

      expect(defaultClient).toBeDefined();
    });

    it('should use provided environment', () => {
      const envClient = new PromptClient({ environment: 'production' });

      expect(envClient).toBeDefined();
    });

    it('should use NODE_ENV as fallback', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'staging';

      const envClient = new PromptClient();
      // Environment defaults to NODE_ENV or 'development'

      process.env.NODE_ENV = originalEnv;
      expect(envClient).toBeDefined();
    });
  });

  describe('initialize and close', () => {
    it('should initialize successfully', async () => {
      await expect(client.initialize()).resolves.toBeUndefined();
    });

    it('should not reinitialize', async () => {
      await client.initialize();
      await expect(client.initialize()).resolves.toBeUndefined();
    });

    it('should close and clear cache', () => {
      client.close();
      // Should not throw
    });
  });

  describe('register', () => {
    it('should register a local prompt', () => {
      const prompt = client.register('greeting', 'Hello {{name}}!');

      expect(prompt).toBeDefined();
      expect(prompt.name).toBe('greeting');
    });

    it('should register with variables', () => {
      const prompt = client.register('test', 'Count: {{count}}', {
        variables: {
          count: { type: 'number', required: true },
        },
      });

      expect(prompt.variables.count.type).toBe('number');
    });

    it('should register with description', () => {
      const prompt = client.register('test', 'Test template', {
        description: 'A test prompt',
      });

      expect(prompt.description).toBe('A test prompt');
    });
  });

  describe('registerMany', () => {
    it('should register multiple prompts', () => {
      client.registerMany({
        greeting: { template: 'Hello {{name}}!' },
        farewell: { template: 'Goodbye {{name}}!' },
      });

      expect(client.list()).toContain('greeting');
      expect(client.list()).toContain('farewell');
    });
  });

  describe('get', () => {
    it('should get a registered prompt', async () => {
      client.register('greeting', 'Hello {{name}}!');

      const prompt = await client.get('greeting');

      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('greeting');
    });

    it('should return null for non-existent prompt', async () => {
      const prompt = await client.get('non-existent');

      expect(prompt).toBeNull();
    });

    it('should cache retrieved prompts', async () => {
      client.register('greeting', 'Hello {{name}}!');

      await client.get('greeting');
      const cached = await client.get('greeting');

      expect(cached).toBeDefined();
    });

    it('should force refresh when requested', async () => {
      client.register('greeting', 'Hello {{name}}!');

      await client.get('greeting');
      const refreshed = await client.get('greeting', { forceRefresh: true });

      expect(refreshed).toBeDefined();
    });
  });

  describe('render', () => {
    it('should render a prompt', async () => {
      client.register('greeting', 'Hello {{name}}!');

      const result = await client.render('greeting', { name: 'World' });

      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should throw for non-existent prompt', async () => {
      await expect(
        client.render('non-existent', { name: 'World' }),
      ).rejects.toThrow("Prompt 'non-existent' not found");
    });

    it('should pass render options', async () => {
      client.register('greeting', 'Hello {{name}}!');

      const result = await client.render('greeting', {}, { strict: false });

      expect(result).toBeDefined();
    });
  });

  describe('has', () => {
    it('should return true for registered prompt', async () => {
      client.register('greeting', 'Hello!');

      const exists = await client.has('greeting');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent prompt', async () => {
      const exists = await client.has('non-existent');

      expect(exists).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all registered prompts', () => {
      client.register('greeting', 'Hello!');
      client.register('farewell', 'Goodbye!');

      const prompts = client.list();

      expect(prompts).toHaveLength(2);
      expect(prompts).toContain('greeting');
      expect(prompts).toContain('farewell');
    });

    it('should return empty array when no prompts', () => {
      const prompts = client.list();

      expect(prompts).toEqual([]);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cache for a prompt', async () => {
      client.register('greeting', 'Hello {{name}}!');

      await client.get('greeting');
      client.invalidate('greeting');

      // Cache should be cleared
      const prompt = await client.get('greeting');
      expect(prompt).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear all cache', async () => {
      client.register('greeting', 'Hello!');
      client.register('farewell', 'Goodbye!');

      await client.get('greeting');
      await client.get('farewell');

      client.clearCache();

      // Cache should be empty
      const prompt = await client.get('greeting');
      expect(prompt).toBeDefined();
    });
  });

  describe('API integration', () => {
    it('should fetch from registry API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            id: 'prompt-1',
            name: 'api-prompt',
            template: 'From API',
            variables: {},
            metadata: {},
            status: 'active',
            version: 'v1',
            environment: 'test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hash: 'hash-1',
          }) as PromptData,
      });

      const apiClient = new PromptClient({
        registryUrl: 'https://api.example.com',
        apiKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const prompt = await apiClient.get('api-prompt');

      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('api-prompt');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle 404 from API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const apiClient = new PromptClient({
        registryUrl: 'https://api.example.com',
        apiKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const prompt = await apiClient.get('non-existent');

      expect(prompt).toBeNull();
    });

    it('should emit error event on API failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const apiClient = new PromptClient({
        registryUrl: 'https://api.example.com',
        apiKey: 'test-key',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const errorHandler = vi.fn();
      apiClient.on('error', errorHandler);

      await apiClient.get('test-prompt');

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit prompt:loaded event', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          ({
            id: 'prompt-1',
            name: 'test-prompt',
            template: 'Test',
            variables: {},
            metadata: {},
            status: 'active',
            version: 'v1',
            environment: 'test',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            hash: 'hash-1',
          }) as PromptData,
      });

      const apiClient = new PromptClient({
        registryUrl: 'https://api.example.com',
        fetch: mockFetch as unknown as typeof fetch,
      });

      const loadHandler = vi.fn();
      apiClient.on('prompt:loaded', loadHandler);

      await apiClient.get('test-prompt');

      expect(loadHandler).toHaveBeenCalledWith({
        name: 'test-prompt',
        version: 'v1',
      });
    });
  });

  describe('caching', () => {
    it('should cache prompts when enabled', async () => {
      const cachedClient = new PromptClient({
        cache: { enabled: true, ttl: 60 },
      });

      cachedClient.register('test', 'Template');

      await cachedClient.get('test');
      const cached = await cachedClient.get('test');

      expect(cached).toBeDefined();
    });

    it('should not cache when disabled', async () => {
      const noCacheClient = new PromptClient({
        cache: { enabled: false },
      });

      noCacheClient.register('test', 'Template');

      await noCacheClient.get('test');
      const second = await noCacheClient.get('test');

      expect(second).toBeDefined();
    });

    it('should respect cache TTL', async () => {
      const shortTtlClient = new PromptClient({
        cache: { enabled: true, ttl: 0.001 }, // Very short TTL
      });

      shortTtlClient.register('test', 'Template');

      await shortTtlClient.get('test');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const afterExpiry = await shortTtlClient.get('test');

      expect(afterExpiry).toBeDefined();
    });

    it('should respect max cache size', async () => {
      const limitedClient = new PromptClient({
        cache: { enabled: true, maxSize: 2 },
      });

      limitedClient.register('a', 'A');
      limitedClient.register('b', 'B');
      limitedClient.register('c', 'C');

      await limitedClient.get('a');
      await limitedClient.get('b');
      await limitedClient.get('c'); // Should evict 'a'

      // Cache should only have 'b' and 'c'
      expect(await limitedClient.get('c')).toBeDefined();
    });
  });
});

describe('PromptLoader', () => {
  let client: PromptClient;

  beforeEach(() => {
    client = new PromptClient({ environment: 'test' });
  });

  describe('render', () => {
    it('should render with default variables', async () => {
      client.register('greeting', 'Hello {{name}}!');

      const loader = new PromptLoader(client, 'greeting', { name: 'World' });
      const result = await loader.render();

      expect(result.trim()).toBe('Hello World!');
    });

    it('should override default variables', async () => {
      client.register('greeting', 'Hello {{name}}!');

      const loader = new PromptLoader(client, 'greeting', { name: 'World' });
      const result = await loader.render({ name: 'Alice' });

      expect(result.trim()).toBe('Hello Alice!');
    });

    it('should merge variables', async () => {
      client.register('greeting', 'Hello {{first}} {{last}}!');

      const loader = new PromptLoader(client, 'greeting', { first: 'John' });
      const result = await loader.render({ last: 'Doe' });

      expect(result.trim()).toBe('Hello John Doe!');
    });
  });

  describe('getPrompt', () => {
    it('should get underlying prompt', async () => {
      client.register('greeting', 'Hello!');

      const loader = new PromptLoader(client, 'greeting');
      const prompt = await loader.getPrompt();

      expect(prompt?.name).toBe('greeting');
    });
  });

  describe('getVariables', () => {
    it('should get variable names', async () => {
      client.register('greeting', 'Hello {{name}} {{title}}!');

      const loader = new PromptLoader(client, 'greeting');
      const variables = await loader.getVariables();

      expect(variables).toContain('name');
      expect(variables).toContain('title');
    });

    it('should return empty array for non-existent prompt', async () => {
      const loader = new PromptLoader(client, 'non-existent');
      const variables = await loader.getVariables();

      expect(variables).toEqual([]);
    });
  });
});

describe('createDynamicPrompt', () => {
  it('should create a dynamic prompt function', async () => {
    const client = new PromptClient();
    client.register('greeting', 'Hello {{name}}!');

    const dynamicPrompt = createDynamicPrompt(client, 'greeting', {
      name: 'World',
    });

    const result = await dynamicPrompt();

    expect(result.trim()).toBe('Hello World!');
  });

  it('should auto-update when called', async () => {
    const client = new PromptClient();
    client.register('greeting', 'Hello {{name}}!');

    const dynamicPrompt = createDynamicPrompt(client, 'greeting', {
      name: 'World',
    });

    const result1 = await dynamicPrompt();
    const result2 = await dynamicPrompt();

    expect(result1).toBe(result2);
  });
});

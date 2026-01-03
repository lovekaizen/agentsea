/**
 * Prompt SDK Client
 *
 * Runtime client for loading and rendering prompts.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  PromptData,
  RenderedPrompt,
  RenderOptions,
  VariableDefinitions,
} from '../types/index.js';
import { Prompt } from '../core/Prompt.js';

/**
 * Client configuration
 */
export interface PromptClientConfig {
  /** URL of the prompt registry API */
  registryUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Environment to load prompts from */
  environment?: string;
  /** Caching configuration */
  cache?: {
    enabled: boolean;
    ttl?: number; // seconds
    maxSize?: number;
  };
  /** Polling interval for updates (ms) */
  pollInterval?: number;
  /** Custom fetch function */
  fetch?: typeof fetch;
}

/**
 * Cached prompt entry
 */
interface CacheEntry {
  prompt: Prompt;
  expiresAt: number;
}

/**
 * Client events
 */
export interface ClientEvents {
  'prompt:updated': { name: string; version: string };
  'prompt:loaded': { name: string; version: string };
  error: { message: string; cause?: unknown };
}

/**
 * Prompt SDK Client
 */
export class PromptClient extends EventEmitter<ClientEvents> {
  private config: Required<PromptClientConfig>;
  private cache = new Map<string, CacheEntry>();
  private pollTimer?: ReturnType<typeof setInterval>;
  private prompts = new Map<string, Prompt>();
  private initialized = false;

  constructor(config: PromptClientConfig = {}) {
    super();
    this.config = {
      registryUrl: config.registryUrl || '',
      apiKey: config.apiKey || '',
      environment: config.environment || process.env.NODE_ENV || 'development',
      cache: {
        enabled: config.cache?.enabled ?? true,
        ttl: config.cache?.ttl ?? 300, // 5 minutes
        maxSize: config.cache?.maxSize ?? 100,
      },
      pollInterval: config.pollInterval || 0, // 0 = disabled
      fetch: config.fetch || globalThis.fetch,
    };
  }

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    // Start polling if enabled
    if (this.config.pollInterval > 0) {
      this.startPolling();
    }

    this.initialized = true;
    return Promise.resolve();
  }

  /**
   * Close the client
   */
  close(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.cache.clear();
    this.initialized = false;
  }

  /**
   * Get a prompt by name
   */
  async get(
    name: string,
    options: { version?: string; forceRefresh?: boolean } = {},
  ): Promise<Prompt | null> {
    const cacheKey = `${name}:${options.version || 'latest'}`;

    // Check cache
    if (!options.forceRefresh && this.config.cache.enabled) {
      const cached = this.getCached(cacheKey);
      if (cached) return cached;
    }

    // Load from local prompts
    if (this.prompts.has(name)) {
      const prompt = this.prompts.get(name)!;
      this.setCached(cacheKey, prompt);
      return prompt;
    }

    // Load from registry API
    if (this.config.registryUrl) {
      try {
        const prompt = await this.fetchPrompt(name, options.version);
        if (prompt) {
          this.setCached(cacheKey, prompt);
          this.emit('prompt:loaded', { name, version: prompt.version });
          return prompt;
        }
      } catch (error) {
        this.emit('error', {
          message: `Failed to fetch prompt '${name}'`,
          cause: error,
        });
      }
    }

    return null;
  }

  /**
   * Render a prompt with variables
   */
  async render(
    name: string,
    variables: Record<string, unknown>,
    options: RenderOptions & { version?: string } = {},
  ): Promise<RenderedPrompt> {
    const prompt = await this.get(name, { version: options.version });

    if (!prompt) {
      throw new Error(`Prompt '${name}' not found`);
    }

    return prompt.render(variables, options);
  }

  /**
   * Register a local prompt
   */
  register(
    name: string,
    template: string,
    options: {
      variables?: VariableDefinitions;
      description?: string;
    } = {},
  ): Prompt {
    const prompt = new Prompt({
      name,
      template,
      variables: options.variables,
      description: options.description,
      environment: this.config.environment,
    });

    this.prompts.set(name, prompt);
    return prompt;
  }

  /**
   * Register multiple local prompts
   */
  registerMany(
    prompts: Record<
      string,
      { template: string; variables?: VariableDefinitions }
    >,
  ): void {
    for (const [name, config] of Object.entries(prompts)) {
      this.register(name, config.template, { variables: config.variables });
    }
  }

  /**
   * Check if a prompt exists
   */
  async has(name: string): Promise<boolean> {
    if (this.prompts.has(name)) return true;
    if (this.cache.has(`${name}:latest`)) return true;

    // Check registry
    if (this.config.registryUrl) {
      const prompt = await this.get(name);
      return prompt !== null;
    }

    return false;
  }

  /**
   * List all local prompts
   */
  list(): string[] {
    return Array.from(this.prompts.keys());
  }

  /**
   * Fetch a prompt from the registry API
   */
  private async fetchPrompt(
    name: string,
    version?: string,
  ): Promise<Prompt | null> {
    const url = new URL(`/prompts/${name}`, this.config.registryUrl);
    url.searchParams.set('environment', this.config.environment);
    if (version) {
      url.searchParams.set('version', version);
    }

    const response = await this.config.fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch prompt: ${response.statusText}`);
    }

    const data = (await response.json()) as PromptData;
    return Prompt.fromData(data);
  }

  /**
   * Get cached prompt
   */
  private getCached(key: string): Prompt | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.prompt;
  }

  /**
   * Set cached prompt
   */
  private setCached(key: string, prompt: Prompt): void {
    // Evict oldest if at capacity
    const maxSize = this.config.cache.maxSize ?? 100;
    if (this.cache.size >= maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const ttl = this.config.cache.ttl ?? 300;
    this.cache.set(key, {
      prompt,
      expiresAt: Date.now() + ttl * 1000,
    });
  }

  /**
   * Start polling for updates
   */
  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      void (async () => {
        try {
          await this.checkForUpdates();
        } catch (error) {
          this.emit('error', {
            message: 'Polling failed',
            cause: error,
          });
        }
      })();
    }, this.config.pollInterval);
  }

  /**
   * Check for prompt updates
   */
  private async checkForUpdates(): Promise<void> {
    if (!this.config.registryUrl) return;

    // Check each cached prompt for updates
    for (const [key, entry] of this.cache.entries()) {
      const [name] = key.split(':');
      if (!name) continue;

      try {
        const prompt = await this.fetchPrompt(name);
        if (prompt && prompt.version !== entry.prompt.version) {
          this.setCached(key, prompt);
          this.emit('prompt:updated', { name, version: prompt.version });
        }
      } catch {
        // Ignore individual fetch errors during polling
      }
    }
  }

  /**
   * Invalidate cache for a prompt
   */
  invalidate(name: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${name}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create a prompt loader for a specific prompt
 */
export class PromptLoader {
  private client: PromptClient;
  private name: string;
  private defaultVariables: Record<string, unknown>;

  constructor(
    client: PromptClient,
    name: string,
    defaultVariables: Record<string, unknown> = {},
  ) {
    this.client = client;
    this.name = name;
    this.defaultVariables = defaultVariables;
  }

  /**
   * Render the prompt with variables
   */
  async render(
    variables: Record<string, unknown> = {},
    options: RenderOptions = {},
  ): Promise<string> {
    const merged = { ...this.defaultVariables, ...variables };
    const result = await this.client.render(this.name, merged, options);
    return result.content;
  }

  /**
   * Get the underlying prompt
   */
  async getPrompt(): Promise<Prompt | null> {
    return this.client.get(this.name);
  }

  /**
   * Get variable names
   */
  async getVariables(): Promise<string[]> {
    const prompt = await this.getPrompt();
    return prompt?.getVariableNames() || [];
  }
}

/**
 * Create a dynamic prompt that auto-updates
 */
export function createDynamicPrompt(
  client: PromptClient,
  name: string,
  defaultVariables: Record<string, unknown> = {},
): () => Promise<string> {
  return async () => {
    const result = await client.render(name, defaultVariables);
    return result.content;
  };
}

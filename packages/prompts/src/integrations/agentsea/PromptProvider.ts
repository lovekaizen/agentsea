/**
 * AgentSea Prompt Provider
 *
 * Integration with AgentSea agents for dynamic prompt loading.
 */

import { EventEmitter } from 'eventemitter3';
import type { PromptRegistry } from '../../core/PromptRegistry.js';
import type { PromptClient } from '../../sdk/Client.js';
import type { Prompt } from '../../core/Prompt.js';
import type { RenderedPrompt, RenderOptions } from '../../types/index.js';

/**
 * Provider configuration
 */
export interface PromptProviderConfig {
  /** Registry instance (for server-side) */
  registry?: PromptRegistry;
  /** Client instance (for client-side) */
  client?: PromptClient;
  /** Environment to use */
  environment?: string;
  /** Auto-refresh prompts on update */
  autoRefresh?: boolean;
  /** Cache TTL in seconds */
  cacheTtl?: number;
}

/**
 * Dynamic prompt configuration
 */
export interface DynamicPromptConfig {
  name: string;
  variables?: Record<string, unknown>;
  version?: string;
  fallback?: string;
}

/**
 * Provider events
 */
interface ProviderEvents {
  'prompt:refreshed': { name: string; version: string };
  'prompt:error': { name: string; error: unknown };
}

/**
 * Prompt Provider for AgentSea agents
 */
export class PromptProvider extends EventEmitter<ProviderEvents> {
  private registry?: PromptRegistry;
  private client?: PromptClient;
  private environment: string;
  private autoRefresh: boolean;
  private cache = new Map<string, { prompt: Prompt; expiresAt: number }>();
  private cacheTtl: number;

  constructor(config: PromptProviderConfig) {
    super();

    if (!config.registry && !config.client) {
      throw new Error('Either registry or client must be provided');
    }

    this.registry = config.registry;
    this.client = config.client;
    this.environment = config.environment || 'production';
    this.autoRefresh = config.autoRefresh ?? true;
    this.cacheTtl = (config.cacheTtl ?? 300) * 1000; // Convert to ms

    // Set up auto-refresh listeners
    if (this.autoRefresh) {
      this.setupAutoRefresh();
    }
  }

  /**
   * Set up auto-refresh listeners
   */
  private setupAutoRefresh(): void {
    if (this.registry) {
      this.registry.on('prompt:updated', (event) => {
        if (event.environment === this.environment) {
          this.cache.delete(event.promptName || '');
          this.emit('prompt:refreshed', {
            name: event.promptName || '',
            version: event.version || '',
          });
        }
      });
    }

    if (this.client) {
      this.client.on('prompt:updated', ({ name, version }) => {
        this.cache.delete(name);
        this.emit('prompt:refreshed', { name, version });
      });
    }
  }

  /**
   * Get a prompt
   */
  async get(
    name: string,
    options: { version?: string; forceRefresh?: boolean } = {},
  ): Promise<Prompt | null> {
    const cacheKey = `${name}:${options.version || 'latest'}`;

    // Check cache
    if (!options.forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.prompt;
      }
    }

    // Fetch prompt
    let prompt: Prompt | null = null;

    if (this.registry) {
      prompt = await this.registry.get(name, {
        environment: this.environment,
        version: options.version,
      });
    } else if (this.client) {
      prompt = await this.client.get(name, { version: options.version });
    }

    // Cache result
    if (prompt) {
      this.cache.set(cacheKey, {
        prompt,
        expiresAt: Date.now() + this.cacheTtl,
      });
    }

    return prompt;
  }

  /**
   * Render a prompt
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
   * Create a dynamic prompt for an agent
   *
   * Returns a function that can be used as a systemPrompt
   * that auto-updates when the prompt changes.
   */
  dynamic(
    nameOrConfig: string | DynamicPromptConfig,
    defaultVariables?: Record<string, unknown>,
  ): () => Promise<string> {
    const config: DynamicPromptConfig =
      typeof nameOrConfig === 'string'
        ? { name: nameOrConfig, variables: defaultVariables }
        : nameOrConfig;

    return async () => {
      try {
        const prompt = await this.get(config.name, { version: config.version });

        if (!prompt) {
          if (config.fallback) {
            return config.fallback;
          }
          throw new Error(`Prompt '${config.name}' not found`);
        }

        const result = prompt.render(config.variables || {});
        return result.content;
      } catch (error) {
        this.emit('prompt:error', { name: config.name, error });

        if (config.fallback) {
          return config.fallback;
        }
        throw error;
      }
    };
  }

  /**
   * Create a static prompt that renders once and caches
   */
  static(name: string, variables: Record<string, unknown> = {}): () => string {
    let cachedContent: string | null = null;

    // Pre-render asynchronously
    void this.render(name, variables).then((result) => {
      cachedContent = result.content;
    });

    return () => {
      if (cachedContent === null) {
        throw new Error(`Prompt '${name}' not yet loaded`);
      }
      return cachedContent;
    };
  }

  /**
   * Preload prompts for faster access
   */
  async preload(names: string[]): Promise<void> {
    await Promise.all(names.map((name) => this.get(name)));
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate a specific prompt
   */
  invalidate(name: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${name}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    prompts: string[];
  } {
    return {
      size: this.cache.size,
      prompts: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Create a prompt-based system prompt for an agent
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   name: 'support-agent',
 *   systemPrompt: createSystemPrompt(provider, 'customer-support', {
 *     company_name: 'Acme Corp',
 *   }),
 * });
 * ```
 */
export function createSystemPrompt(
  provider: PromptProvider,
  name: string,
  variables: Record<string, unknown> = {},
  options: { fallback?: string } = {},
): () => Promise<string> {
  return provider.dynamic({
    name,
    variables,
    fallback: options.fallback,
  });
}

/**
 * Create multiple system prompts for A/B testing
 *
 * @example
 * ```typescript
 * const systemPrompt = createABTestPrompt(provider, {
 *   testName: 'support-tone',
 *   prompt: 'customer-support',
 *   getUserId: (context) => context.userId,
 * });
 * ```
 */
export function createABTestPrompt(
  provider: PromptProvider,
  config: {
    testName: string;
    prompt: string;
    variables?: Record<string, unknown>;
    getUserId: (context: Record<string, unknown>) => string;
  },
): (context: Record<string, unknown>) => Promise<string> {
  return async (context) => {
    // For A/B testing, we'd need the registry to get test configuration
    // This is a simplified version that just returns the prompt
    const userId = config.getUserId(context);

    // In a full implementation, this would:
    // 1. Get the A/B test configuration
    // 2. Assign the user to a variant
    // 3. Return the appropriate prompt version

    const prompt = await provider.get(config.prompt);
    if (!prompt) {
      throw new Error(`Prompt '${config.prompt}' not found`);
    }

    const result = prompt.render({
      ...config.variables,
      _userId: userId,
      _testName: config.testName,
    });

    return result.content;
  };
}

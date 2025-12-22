/**
 * AgentSea Structured Provider
 *
 * Integration with AgentSea framework for structured output extraction.
 */

import { z } from 'zod';
import { StructuredClient } from '../../core/StructuredClient.js';
import { OpenAIAdapter } from '../../providers/OpenAIAdapter.js';
import { AnthropicAdapter } from '../../providers/AnthropicAdapter.js';
import { GoogleAdapter } from '../../providers/GoogleAdapter.js';
import type {
  StructuredClientConfig,
  ExtractionResult,
  ChatMessage,
  ExtractionModeConfig,
} from '../../types/core.types.js';
import type { ProviderAdapter } from '../../types/provider.types.js';
import type {
  StreamingOptions,
  StreamingResult,
} from '../../types/streaming.types.js';

/**
 * AgentSea provider type
 */
export type AgentSeaProviderType = 'openai' | 'anthropic' | 'google';

/**
 * AgentSea client interface
 */
interface AgentSeaClient {
  readonly provider: AgentSeaProviderType;
  readonly client: unknown;
  readonly model?: string;
}

/**
 * Structured provider options
 */
export interface StructuredProviderOptions {
  /** Default model to use */
  defaultModel?: string;
  /** Default extraction mode */
  defaultMode?: ExtractionModeConfig;
  /** Enable fix hints for retries */
  enableFixHints?: boolean;
  /** Validate partial results in streaming */
  validatePartials?: boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * AgentSea Structured Provider
 *
 * Provides structured output extraction capabilities for AgentSea agents.
 */
export class StructuredProvider {
  private readonly clients: Map<string, StructuredClient>;
  private readonly adapters: Map<string, ProviderAdapter>;
  private readonly options: StructuredProviderOptions;
  private defaultProviderName: string | null = null;

  constructor(options: StructuredProviderOptions = {}) {
    this.clients = new Map();
    this.adapters = new Map();
    this.options = {
      enableFixHints: true,
      validatePartials: false,
      maxRetries: 3,
      ...options,
    };
  }

  /**
   * Register a provider client
   */
  registerProvider(
    name: string,
    agentSeaClient: AgentSeaClient,
    setAsDefault = false,
  ): this {
    const adapter = this.createAdapter(agentSeaClient);
    this.adapters.set(name, adapter);

    const client = new StructuredClient(adapter, {
      defaultMode: this.options
        .defaultMode as StructuredClientConfig['defaultMode'],
      enableFixHints: this.options.enableFixHints,
      validatePartials: this.options.validatePartials,
      defaultRetry: {
        maxAttempts: this.options.maxRetries ?? 3,
        retryOn: ['validation_error', 'parse_error'],
      },
    });

    this.clients.set(name, client);

    if (setAsDefault || !this.defaultProviderName) {
      this.defaultProviderName = name;
    }

    return this;
  }

  /**
   * Get a structured client
   */
  getClient(name?: string): StructuredClient {
    const providerName = name ?? this.defaultProviderName;

    if (!providerName) {
      throw new Error('No provider registered');
    }

    const client = this.clients.get(providerName);

    if (!client) {
      throw new Error(`Provider '${providerName}' not found`);
    }

    return client;
  }

  /**
   * Extract structured data
   */
  async extract<T extends z.ZodType>(
    schema: T,
    prompt: string | ChatMessage[],
    options?: {
      model?: string;
      provider?: string;
      mode?: ExtractionModeConfig;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<ExtractionResult<z.infer<T>>> {
    const client = this.getClient(options?.provider);

    const messages: ChatMessage[] = Array.isArray(prompt)
      ? prompt
      : [{ role: 'user', content: prompt }];

    return client.extract({
      model: options?.model ?? this.options.defaultModel ?? 'gpt-4o',
      messages,
      response_format: schema,
      mode: options?.mode ?? this.options.defaultMode,
    });
  }

  /**
   * Extract structured data with streaming
   */
  extractStream<T extends z.ZodType>(
    schema: T,
    prompt: string | ChatMessage[],
    options?: {
      model?: string;
      provider?: string;
      mode?: ExtractionModeConfig;
      streaming?: StreamingOptions;
    },
  ): Promise<StreamingResult<z.infer<T>>> {
    const client = this.getClient(options?.provider);

    const messages: ChatMessage[] = Array.isArray(prompt)
      ? prompt
      : [{ role: 'user', content: prompt }];

    return client.extractStream(
      {
        model: options?.model ?? this.options.defaultModel ?? 'gpt-4o',
        messages,
        response_format: schema,
        mode: options?.mode ?? this.options.defaultMode,
      },
      options?.streaming,
    );
  }

  /**
   * Create a typed extractor for reuse
   */
  createExtractor<T extends z.ZodType>(
    schema: T,
    options?: {
      model?: string;
      provider?: string;
      mode?: ExtractionModeConfig;
    },
  ): TypedExtractor<z.infer<T>> {
    return new TypedExtractor(this, schema, options);
  }

  /**
   * Create adapter from AgentSea client
   */
  private createAdapter(agentSeaClient: AgentSeaClient): ProviderAdapter {
    switch (agentSeaClient.provider) {
      case 'openai':
        return new OpenAIAdapter(
          agentSeaClient.client as ConstructorParameters<
            typeof OpenAIAdapter
          >[0],
        );
      case 'anthropic':
        return new AnthropicAdapter(
          agentSeaClient.client as ConstructorParameters<
            typeof AnthropicAdapter
          >[0],
        );
      case 'google':
        return new GoogleAdapter(
          agentSeaClient.client as ConstructorParameters<
            typeof GoogleAdapter
          >[0],
        );
      default:
        throw new Error(
          `Unsupported provider: ${agentSeaClient.provider as string}`,
        );
    }
  }
}

/**
 * Typed extractor for reusable extraction
 */
export class TypedExtractor<T> {
  constructor(
    private readonly provider: StructuredProvider,
    private readonly schema: z.ZodType<T>,
    private readonly options?: {
      model?: string;
      provider?: string;
      mode?: ExtractionModeConfig;
    },
  ) {}

  /**
   * Extract structured data
   */
  async extract(
    prompt: string | ChatMessage[],
    overrideOptions?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<ExtractionResult<T>> {
    return this.provider.extract(this.schema, prompt, {
      ...this.options,
      ...overrideOptions,
    });
  }

  /**
   * Extract with streaming
   */
  extractStream(
    prompt: string | ChatMessage[],
    streamingOptions?: StreamingOptions,
  ): Promise<StreamingResult<T>> {
    return this.provider.extractStream(this.schema, prompt, {
      ...this.options,
      streaming: streamingOptions,
    });
  }

  /**
   * Get the schema
   */
  getSchema(): z.ZodType<T> {
    return this.schema;
  }
}

/**
 * Create a structured provider
 */
export function createStructuredProvider(
  options?: StructuredProviderOptions,
): StructuredProvider {
  return new StructuredProvider(options);
}

/**
 * Helper to create common extractors
 */
export const Extractors = {
  /**
   * Create a list extractor
   */
  list<T extends z.ZodType>(
    itemSchema: T,
    options?: { minItems?: number; maxItems?: number },
  ): z.ZodArray<T> {
    let schema = z.array(itemSchema);

    if (options?.minItems !== undefined) {
      schema = schema.min(options.minItems);
    }

    if (options?.maxItems !== undefined) {
      schema = schema.max(options.maxItems);
    }

    return schema;
  },

  /**
   * Create an entity extractor
   */
  entity<T extends z.ZodRawShape>(shape: T): z.ZodObject<T> {
    return z.object(shape);
  },

  /**
   * Create a classification extractor
   */
  classification<T extends [string, ...string[]]>(
    categories: T,
    options?: { confidence?: boolean },
  ): z.ZodType {
    if (options?.confidence) {
      return z.object({
        category: z.enum(categories),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().optional(),
      });
    }

    return z.object({
      category: z.enum(categories),
    });
  },

  /**
   * Create a sentiment analyzer
   */
  sentiment(): z.ZodType {
    return z.object({
      sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
      score: z.number().min(-1).max(1),
      aspects: z
        .array(
          z.object({
            aspect: z.string(),
            sentiment: z.enum(['positive', 'negative', 'neutral']),
          }),
        )
        .optional(),
    });
  },

  /**
   * Create a key-value extractor
   */
  keyValue(): z.ZodType {
    return z.record(z.string(), z.unknown());
  },

  /**
   * Create a summary extractor
   */
  summary(options?: { maxLength?: number }): z.ZodType {
    let summarySchema = z.string();

    if (options?.maxLength) {
      summarySchema = summarySchema.max(options.maxLength);
    }

    return z.object({
      summary: summarySchema,
      keyPoints: z.array(z.string()),
      entities: z
        .array(
          z.object({
            name: z.string(),
            type: z.string(),
          }),
        )
        .optional(),
    });
  },
};

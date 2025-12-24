/**
 * Chunker Registry
 *
 * Registry for chunking strategies.
 */

import type {
  Chunker,
  ChunkingStrategy,
  ChunkingOptions,
  ChunkerRegistryConfig,
  Chunk,
  Element,
} from '../types/index.js';
import { getBuiltInChunkers } from '../chunking/index.js';

/**
 * Chunker registry for managing chunking strategies
 */
export class ChunkerRegistry {
  private chunkers: Map<ChunkingStrategy, Chunker> = new Map();
  private defaultOptions: ChunkingOptions;

  constructor(config: ChunkerRegistryConfig = {}) {
    this.defaultOptions = config.defaultOptions ?? {
      maxTokens: 512,
      overlap: 50,
    };

    // Register built-in chunkers by default unless explicitly disabled
    if (config.registerBuiltIns !== false) {
      for (const chunker of getBuiltInChunkers()) {
        this.register(chunker);
      }
    }

    // Register custom chunkers
    if (config.customChunkers) {
      for (const chunker of config.customChunkers) {
        this.register(chunker);
      }
    }

    // Register strategy overrides
    if (config.strategyOverrides) {
      for (const [strategy, chunker] of Object.entries(
        config.strategyOverrides,
      )) {
        this.chunkers.set(strategy as ChunkingStrategy, chunker);
      }
    }
  }

  /**
   * Register a chunker
   */
  register(chunker: Chunker): void {
    this.chunkers.set(chunker.strategy, chunker);
  }

  /**
   * Unregister a chunker
   */
  unregister(strategy: ChunkingStrategy): void {
    this.chunkers.delete(strategy);
  }

  /**
   * Get chunker by strategy
   */
  get(strategy: ChunkingStrategy): Chunker | undefined {
    return this.chunkers.get(strategy);
  }

  /**
   * Chunk text using specified strategy
   */
  chunk(
    text: string,
    strategy: ChunkingStrategy,
    options?: ChunkingOptions,
  ): Chunk[] | Promise<Chunk[]> {
    const chunker = this.chunkers.get(strategy);

    if (!chunker) {
      throw new Error(`No chunker found for strategy "${strategy}"`);
    }

    const mergedOptions = { ...this.defaultOptions, ...options };
    return chunker.chunk(text, mergedOptions);
  }

  /**
   * Chunk elements using specified strategy
   */
  chunkElements(
    elements: Element[],
    strategy: ChunkingStrategy,
    options?: ChunkingOptions,
  ): Chunk[] | Promise<Chunk[]> {
    const chunker = this.chunkers.get(strategy);

    if (!chunker) {
      throw new Error(`No chunker found for strategy "${strategy}"`);
    }

    const mergedOptions = { ...this.defaultOptions, ...options };
    return chunker.chunkElements(elements, mergedOptions);
  }

  /**
   * Check if strategy is supported
   */
  isSupported(strategy: ChunkingStrategy): boolean {
    return this.chunkers.has(strategy);
  }

  /**
   * Get all registered chunkers
   */
  getAll(): Chunker[] {
    return Array.from(this.chunkers.values());
  }

  /**
   * Get all supported strategies
   */
  getSupportedStrategies(): ChunkingStrategy[] {
    return Array.from(this.chunkers.keys());
  }

  /**
   * Set default options
   */
  setDefaultOptions(options: ChunkingOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get default options
   */
  getDefaultOptions(): ChunkingOptions {
    return { ...this.defaultOptions };
  }
}

/**
 * Create a new chunker registry
 */
export function createChunkerRegistry(
  config?: ChunkerRegistryConfig,
): ChunkerRegistry {
  return new ChunkerRegistry(config);
}

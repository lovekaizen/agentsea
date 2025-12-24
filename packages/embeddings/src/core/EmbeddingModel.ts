/**
 * EmbeddingModel
 *
 * Base class for embedding models/providers.
 */

import type {
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingOptions,
  BatchEmbeddingOptions,
  EmbeddingModelInfo,
  EmbeddingVector,
} from '../types/index.js';

/**
 * Abstract base class for embedding models
 */
export abstract class EmbeddingModel {
  /** Model info */
  abstract readonly info: EmbeddingModelInfo;

  /**
   * Generate embedding for a single text
   */
  abstract embed(
    text: string,
    options?: EmbeddingOptions,
  ): Promise<EmbeddingResult>;

  /**
   * Generate embeddings for multiple texts
   */
  abstract embedBatch(
    texts: string[],
    options?: BatchEmbeddingOptions,
  ): Promise<BatchEmbeddingResult>;

  /**
   * Get model dimensions
   */
  get dimensions(): number {
    return this.info.dimensions;
  }

  /**
   * Get max tokens
   */
  get maxTokens(): number {
    return this.info.maxTokens;
  }

  /**
   * Get max batch size
   */
  get maxBatchSize(): number {
    return this.info.maxBatchSize;
  }

  /**
   * Get model name
   */
  get name(): string {
    return this.info.name;
  }

  /**
   * Get provider name
   */
  get provider(): string {
    return this.info.provider;
  }

  /**
   * Count tokens in text (default implementation)
   * Subclasses should override for accurate counting
   */
  countTokens(text: string): number {
    // Rough estimate: ~4 chars per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text exceeds max tokens
   */
  exceedsMaxTokens(text: string): boolean {
    return this.countTokens(text) > this.maxTokens;
  }

  /**
   * Truncate text to max tokens
   */
  truncateToMaxTokens(text: string): string {
    const tokens = this.countTokens(text);
    if (tokens <= this.maxTokens) {
      return text;
    }
    // Rough truncation based on character estimate
    const ratio = this.maxTokens / tokens;
    const targetLength = Math.floor(text.length * ratio * 0.95); // 5% safety margin
    return text.slice(0, targetLength);
  }

  /**
   * Calculate similarity between two vectors
   */
  static cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  static euclideanDistance(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions mismatch: ${a.length} vs ${b.length}`);
    }

    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Calculate dot product of two vectors
   */
  static dotProduct(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimensions mismatch: ${a.length} vs ${b.length}`);
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result += a[i] * b[i];
    }

    return result;
  }

  /**
   * Normalize a vector to unit length
   */
  static normalize(vector: EmbeddingVector): EmbeddingVector {
    let norm = 0;
    for (let i = 0; i < vector.length; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      return vector.slice();
    }

    return vector.map((v) => v / norm);
  }

  /**
   * Average multiple vectors
   */
  static average(vectors: EmbeddingVector[]): EmbeddingVector {
    if (vectors.length === 0) {
      throw new Error('Cannot average empty array of vectors');
    }

    const dimensions = vectors[0].length;
    const result = new Array(dimensions).fill(0);

    for (const vector of vectors) {
      if (vector.length !== dimensions) {
        throw new Error(
          `Vector dimensions mismatch: expected ${dimensions}, got ${vector.length}`,
        );
      }
      for (let i = 0; i < dimensions; i++) {
        result[i] += vector[i];
      }
    }

    for (let i = 0; i < dimensions; i++) {
      result[i] /= vectors.length;
    }

    return result;
  }

  /**
   * Weighted average of vectors
   */
  static weightedAverage(
    vectors: EmbeddingVector[],
    weights: number[],
  ): EmbeddingVector {
    if (vectors.length === 0) {
      throw new Error('Cannot average empty array of vectors');
    }
    if (vectors.length !== weights.length) {
      throw new Error('Vectors and weights arrays must have same length');
    }

    const dimensions = vectors[0].length;
    const result = new Array(dimensions).fill(0);
    let totalWeight = 0;

    for (let j = 0; j < vectors.length; j++) {
      const vector = vectors[j];
      const weight = weights[j];
      totalWeight += weight;

      if (vector.length !== dimensions) {
        throw new Error(
          `Vector dimensions mismatch: expected ${dimensions}, got ${vector.length}`,
        );
      }
      for (let i = 0; i < dimensions; i++) {
        result[i] += vector[i] * weight;
      }
    }

    if (totalWeight === 0) {
      throw new Error('Total weight cannot be zero');
    }

    for (let i = 0; i < dimensions; i++) {
      result[i] /= totalWeight;
    }

    return result;
  }
}

/**
 * Model registry for managing available models
 */
export class ModelRegistry {
  private models: Map<string, EmbeddingModel> = new Map();
  private defaultModel: string | null = null;

  /**
   * Register a model
   */
  register(model: EmbeddingModel, isDefault = false): void {
    const key = `${model.provider}:${model.name}`;
    this.models.set(key, model);

    if (isDefault || this.defaultModel === null) {
      this.defaultModel = key;
    }
  }

  /**
   * Get a model by provider and name
   */
  get(provider: string, name: string): EmbeddingModel | undefined {
    return this.models.get(`${provider}:${name}`);
  }

  /**
   * Get model by key
   */
  getByKey(key: string): EmbeddingModel | undefined {
    return this.models.get(key);
  }

  /**
   * Get the default model
   */
  getDefault(): EmbeddingModel | undefined {
    if (this.defaultModel === null) {
      return undefined;
    }
    return this.models.get(this.defaultModel);
  }

  /**
   * Set default model
   */
  setDefault(provider: string, name: string): void {
    const key = `${provider}:${name}`;
    if (!this.models.has(key)) {
      throw new Error(`Model ${key} not found in registry`);
    }
    this.defaultModel = key;
  }

  /**
   * List all registered models
   */
  list(): EmbeddingModelInfo[] {
    return Array.from(this.models.values()).map((m) => m.info);
  }

  /**
   * Check if a model is registered
   */
  has(provider: string, name: string): boolean {
    return this.models.has(`${provider}:${name}`);
  }

  /**
   * Remove a model
   */
  remove(provider: string, name: string): boolean {
    const key = `${provider}:${name}`;
    if (this.defaultModel === key) {
      this.defaultModel = null;
    }
    return this.models.delete(key);
  }

  /**
   * Clear all models
   */
  clear(): void {
    this.models.clear();
    this.defaultModel = null;
  }
}

// Global model registry instance
export const modelRegistry = new ModelRegistry();

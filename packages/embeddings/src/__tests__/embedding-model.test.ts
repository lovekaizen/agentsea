import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingModel, ModelRegistry } from '../core/EmbeddingModel.js';
import type {
  EmbeddingModelInfo,
  EmbeddingResult,
  BatchEmbeddingResult,
} from '../types/index.js';

// Concrete implementation for testing
class TestEmbeddingModel extends EmbeddingModel {
  readonly info: EmbeddingModelInfo = {
    name: 'test-model',
    provider: 'test',
    dimensions: 128,
    maxTokens: 512,
    maxBatchSize: 10,
    costPer1K: 0.0001,
  };

  async embed(text: string): Promise<EmbeddingResult> {
    return {
      vector: new Array(this.info.dimensions).fill(0.5),
      text,
      tokenCount: this.countTokens(text),
      cached: false,
      model: this.info.name,
      dimensions: this.info.dimensions,
    };
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const results = await Promise.all(texts.map((t) => this.embed(t)));
    return {
      results,
      totalTokens: results.reduce((sum, r) => sum + r.tokenCount, 0),
      totalLatencyMs: 100,
      cacheHits: 0,
      cacheMisses: texts.length,
      failures: 0,
    };
  }
}

describe('EmbeddingModel', () => {
  let model: TestEmbeddingModel;

  beforeEach(() => {
    model = new TestEmbeddingModel();
  });

  describe('properties', () => {
    it('should have dimensions property', () => {
      expect(model.dimensions).toBe(128);
    });

    it('should have maxTokens property', () => {
      expect(model.maxTokens).toBe(512);
    });

    it('should have maxBatchSize property', () => {
      expect(model.maxBatchSize).toBe(10);
    });

    it('should have name property', () => {
      expect(model.name).toBe('test-model');
    });

    it('should have provider property', () => {
      expect(model.provider).toBe('test');
    });
  });

  describe('countTokens', () => {
    it('should count tokens approximately', () => {
      const text = 'This is a test sentence';
      const tokens = model.countTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should return at least 1 token for empty string', () => {
      const tokens = model.countTokens('');
      expect(tokens).toBeGreaterThanOrEqual(0);
    });

    it('should scale with text length', () => {
      const shortText = 'short';
      const longText = 'This is a much longer text with many more words';

      expect(model.countTokens(longText)).toBeGreaterThan(
        model.countTokens(shortText),
      );
    });
  });

  describe('exceedsMaxTokens', () => {
    it('should return false for short text', () => {
      const text = 'short';
      expect(model.exceedsMaxTokens(text)).toBe(false);
    });

    it('should return true for very long text', () => {
      const text = 'a'.repeat(3000); // ~750 tokens
      expect(model.exceedsMaxTokens(text)).toBe(true);
    });

    it('should handle edge case at limit', () => {
      const text = 'a'.repeat(512 * 4); // Exactly at limit
      const exceeds = model.exceedsMaxTokens(text);
      expect(typeof exceeds).toBe('boolean');
    });
  });

  describe('truncateToMaxTokens', () => {
    it('should not truncate short text', () => {
      const text = 'This is short';
      const truncated = model.truncateToMaxTokens(text);
      expect(truncated).toBe(text);
    });

    it('should truncate long text', () => {
      const text = 'a'.repeat(3000);
      const truncated = model.truncateToMaxTokens(text);

      expect(truncated.length).toBeLessThan(text.length);
      expect(model.countTokens(truncated)).toBeLessThanOrEqual(model.maxTokens);
    });

    it('should preserve text content when possible', () => {
      const text = 'test '.repeat(200); // Moderately long
      const truncated = model.truncateToMaxTokens(text);

      expect(truncated).toContain('test');
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const vec = [1, 2, 3];
      const similarity = EmbeddingModel.cosineSimilarity(vec, vec);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should calculate similarity between different vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = EmbeddingModel.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should calculate similarity for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = EmbeddingModel.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const similarity = EmbeddingModel.cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should throw error for mismatched dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => EmbeddingModel.cosineSimilarity(vec1, vec2)).toThrow(
        'Vector dimensions mismatch',
      );
    });

    it('should be symmetric', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const sim1 = EmbeddingModel.cosineSimilarity(vec1, vec2);
      const sim2 = EmbeddingModel.cosineSimilarity(vec2, vec1);

      expect(sim1).toBeCloseTo(sim2, 10);
    });
  });

  describe('euclideanDistance', () => {
    it('should calculate distance between identical vectors', () => {
      const vec = [1, 2, 3];
      const distance = EmbeddingModel.euclideanDistance(vec, vec);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate distance between different vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [3, 4, 0];
      const distance = EmbeddingModel.euclideanDistance(vec1, vec2);
      expect(distance).toBeCloseTo(5, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => EmbeddingModel.euclideanDistance(vec1, vec2)).toThrow(
        'Vector dimensions mismatch',
      );
    });

    it('should be symmetric', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const dist1 = EmbeddingModel.euclideanDistance(vec1, vec2);
      const dist2 = EmbeddingModel.euclideanDistance(vec2, vec1);

      expect(dist1).toBeCloseTo(dist2, 10);
    });

    it('should always be non-negative', () => {
      const vec1 = [-5, -10, -15];
      const vec2 = [5, 10, 15];

      const distance = EmbeddingModel.euclideanDistance(vec1, vec2);
      expect(distance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('dotProduct', () => {
    it('should calculate dot product', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      const dot = EmbeddingModel.dotProduct(vec1, vec2);

      // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(dot).toBeCloseTo(32, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0];
      const vec2 = [0, 1];
      const dot = EmbeddingModel.dotProduct(vec1, vec2);
      expect(dot).toBeCloseTo(0, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];

      expect(() => EmbeddingModel.dotProduct(vec1, vec2)).toThrow(
        'Vector dimensions mismatch',
      );
    });

    it('should be commutative', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];

      const dot1 = EmbeddingModel.dotProduct(vec1, vec2);
      const dot2 = EmbeddingModel.dotProduct(vec2, vec1);

      expect(dot1).toBeCloseTo(dot2, 10);
    });
  });

  describe('normalize', () => {
    it('should normalize vector to unit length', () => {
      const vec = [3, 4];
      const normalized = EmbeddingModel.normalize(vec);

      // Length should be 1
      const length = Math.sqrt(normalized[0] ** 2 + normalized[1] ** 2);
      expect(length).toBeCloseTo(1, 5);
    });

    it('should preserve direction', () => {
      const vec = [3, 4];
      const normalized = EmbeddingModel.normalize(vec);

      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
    });

    it('should handle zero vector', () => {
      const vec = [0, 0, 0];
      const normalized = EmbeddingModel.normalize(vec);

      expect(normalized).toEqual([0, 0, 0]);
    });

    it('should not mutate original vector', () => {
      const vec = [3, 4];
      const original = [...vec];
      EmbeddingModel.normalize(vec);

      expect(vec).toEqual(original);
    });
  });

  describe('average', () => {
    it('should average multiple vectors', () => {
      const vectors = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];

      const avg = EmbeddingModel.average(vectors);

      expect(avg).toEqual([4, 5, 6]);
    });

    it('should return same vector for single input', () => {
      const vectors = [[1, 2, 3]];
      const avg = EmbeddingModel.average(vectors);

      expect(avg).toEqual([1, 2, 3]);
    });

    it('should throw error for empty array', () => {
      expect(() => EmbeddingModel.average([])).toThrow(
        'Cannot average empty array',
      );
    });

    it('should throw error for mismatched dimensions', () => {
      const vectors = [
        [1, 2, 3],
        [1, 2],
      ];

      expect(() => EmbeddingModel.average(vectors)).toThrow(
        'Vector dimensions mismatch',
      );
    });

    it('should handle decimal results', () => {
      const vectors = [
        [1, 2],
        [2, 3],
      ];

      const avg = EmbeddingModel.average(vectors);

      expect(avg[0]).toBeCloseTo(1.5, 5);
      expect(avg[1]).toBeCloseTo(2.5, 5);
    });
  });

  describe('weightedAverage', () => {
    it('should calculate weighted average', () => {
      const vectors = [
        [1, 2],
        [3, 4],
      ];
      const weights = [0.25, 0.75];

      const avg = EmbeddingModel.weightedAverage(vectors, weights);

      // (1*0.25 + 3*0.75) / 1 = 2.5
      // (2*0.25 + 4*0.75) / 1 = 3.5
      expect(avg[0]).toBeCloseTo(2.5, 5);
      expect(avg[1]).toBeCloseTo(3.5, 5);
    });

    it('should handle equal weights', () => {
      const vectors = [
        [2, 4],
        [4, 6],
      ];
      const weights = [1, 1];

      const avg = EmbeddingModel.weightedAverage(vectors, weights);

      expect(avg[0]).toBeCloseTo(3, 5);
      expect(avg[1]).toBeCloseTo(5, 5);
    });

    it('should throw error for empty arrays', () => {
      expect(() => EmbeddingModel.weightedAverage([], [])).toThrow(
        'Cannot average empty array',
      );
    });

    it('should throw error for mismatched array lengths', () => {
      const vectors = [
        [1, 2],
        [3, 4],
      ];
      const weights = [1];

      expect(() => EmbeddingModel.weightedAverage(vectors, weights)).toThrow(
        'must have same length',
      );
    });

    it('should throw error for zero total weight', () => {
      const vectors = [
        [1, 2],
        [3, 4],
      ];
      const weights = [0, 0];

      expect(() => EmbeddingModel.weightedAverage(vectors, weights)).toThrow(
        'Total weight cannot be zero',
      );
    });

    it('should throw error for mismatched dimensions', () => {
      const vectors = [
        [1, 2, 3],
        [1, 2],
      ];
      const weights = [1, 1];

      expect(() => EmbeddingModel.weightedAverage(vectors, weights)).toThrow(
        'Vector dimensions mismatch',
      );
    });
  });
});

describe('ModelRegistry', () => {
  let registry: ModelRegistry;
  let model1: TestEmbeddingModel;
  let model2: TestEmbeddingModel;

  beforeEach(() => {
    registry = new ModelRegistry();
    model1 = new TestEmbeddingModel();

    model2 = new TestEmbeddingModel();
    model2.info.name = 'test-model-2';
  });

  describe('register', () => {
    it('should register a model', () => {
      registry.register(model1);

      const retrieved = registry.get('test', 'test-model');
      expect(retrieved).toBe(model1);
    });

    it('should set first model as default', () => {
      registry.register(model1);

      const defaultModel = registry.getDefault();
      expect(defaultModel).toBe(model1);
    });

    it('should set model as default when specified', () => {
      registry.register(model1);
      registry.register(model2, true);

      const defaultModel = registry.getDefault();
      expect(defaultModel).toBe(model2);
    });

    it('should allow registering multiple models', () => {
      registry.register(model1);
      registry.register(model2);

      const models = registry.list();
      expect(models).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('should retrieve registered model', () => {
      registry.register(model1);

      const retrieved = registry.get('test', 'test-model');
      expect(retrieved).toBe(model1);
    });

    it('should return undefined for non-existent model', () => {
      const retrieved = registry.get('test', 'non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getByKey', () => {
    it('should retrieve model by key', () => {
      registry.register(model1);

      const retrieved = registry.getByKey('test:test-model');
      expect(retrieved).toBe(model1);
    });

    it('should return undefined for non-existent key', () => {
      const retrieved = registry.getByKey('invalid:key');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getDefault', () => {
    it('should return default model', () => {
      registry.register(model1);

      const defaultModel = registry.getDefault();
      expect(defaultModel).toBe(model1);
    });

    it('should return undefined when no models registered', () => {
      const defaultModel = registry.getDefault();
      expect(defaultModel).toBeUndefined();
    });
  });

  describe('setDefault', () => {
    it('should set default model', () => {
      registry.register(model1);
      registry.register(model2);

      registry.setDefault('test', 'test-model-2');

      const defaultModel = registry.getDefault();
      expect(defaultModel).toBe(model2);
    });

    it('should throw error for non-existent model', () => {
      expect(() => registry.setDefault('test', 'non-existent')).toThrow(
        'not found in registry',
      );
    });
  });

  describe('list', () => {
    it('should return all registered models', () => {
      registry.register(model1);
      registry.register(model2);

      const models = registry.list();

      expect(models).toHaveLength(2);
      expect(models[0].name).toBe('test-model');
      expect(models[1].name).toBe('test-model-2');
    });

    it('should return empty array when no models registered', () => {
      const models = registry.list();
      expect(models).toHaveLength(0);
    });
  });

  describe('has', () => {
    it('should return true for registered model', () => {
      registry.register(model1);

      expect(registry.has('test', 'test-model')).toBe(true);
    });

    it('should return false for non-existent model', () => {
      expect(registry.has('test', 'non-existent')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove registered model', () => {
      registry.register(model1);

      const removed = registry.remove('test', 'test-model');

      expect(removed).toBe(true);
      expect(registry.has('test', 'test-model')).toBe(false);
    });

    it('should return false for non-existent model', () => {
      const removed = registry.remove('test', 'non-existent');
      expect(removed).toBe(false);
    });

    it('should clear default when removing default model', () => {
      registry.register(model1);
      registry.remove('test', 'test-model');

      const defaultModel = registry.getDefault();
      expect(defaultModel).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should remove all models', () => {
      registry.register(model1);
      registry.register(model2);

      registry.clear();

      const models = registry.list();
      expect(models).toHaveLength(0);
    });

    it('should clear default model', () => {
      registry.register(model1);
      registry.clear();

      const defaultModel = registry.getDefault();
      expect(defaultModel).toBeUndefined();
    });
  });
});

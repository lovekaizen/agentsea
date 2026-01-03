import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  EmbeddingManager,
  createEmbeddingManager,
} from '../core/EmbeddingManager.js';
import { EmbeddingModel } from '../core/EmbeddingModel.js';
import type {
  EmbeddingResult,
  BatchEmbeddingResult,
  EmbeddingOptions,
  EmbeddingModelInfo,
} from '../types/index.js';

// Mock embedding model
class MockEmbeddingModel extends EmbeddingModel {
  readonly info: EmbeddingModelInfo = {
    name: 'mock-model',
    provider: 'mock',
    dimensions: 3,
    maxTokens: 1000,
    maxBatchSize: 100,
    costPer1K: 0.0001,
  };

  async embed(text: string): Promise<EmbeddingResult> {
    return {
      vector: [0.1, 0.2, 0.3],
      text,
      tokenCount: Math.ceil(text.length / 4),
      cached: false,
      model: this.info.name,
      dimensions: this.info.dimensions,
      latencyMs: 10,
    };
  }

  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const results = await Promise.all(texts.map((t) => this.embed(t)));
    return {
      results,
      totalTokens: results.reduce((sum, r) => sum + r.tokenCount, 0),
      totalLatencyMs: 50,
      cacheHits: 0,
      cacheMisses: texts.length,
      failures: 0,
    };
  }
}

describe('EmbeddingManager', () => {
  let manager: EmbeddingManager;
  let mockModel: MockEmbeddingModel;

  beforeEach(() => {
    manager = new EmbeddingManager();
    mockModel = new MockEmbeddingModel();
    manager.registerModel(mockModel, true);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const mgr = new EmbeddingManager();
      expect(mgr).toBeInstanceOf(EmbeddingManager);
    });

    it('should accept custom config', () => {
      const mgr = new EmbeddingManager({
        defaultModel: 'custom-model',
        defaultProvider: 'custom',
        caching: false,
        batchSize: 50,
        concurrency: 10,
      });
      expect(mgr).toBeInstanceOf(EmbeddingManager);
    });

    it('should initialize stats', () => {
      const stats = manager.getStats();
      expect(stats.totalEmbeddings).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.apiCalls).toBe(0);
    });
  });

  describe('registerModel', () => {
    it('should register a model', () => {
      const newManager = new EmbeddingManager();
      newManager.registerModel(mockModel);
      const models = newManager.getModels();
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('mock-model');
    });

    it('should set default model when specified', () => {
      const newManager = new EmbeddingManager();
      newManager.registerModel(mockModel, true);
      const models = newManager.getModels();
      expect(models).toHaveLength(1);
    });

    it('should allow chaining', () => {
      const result = manager.registerModel(mockModel);
      expect(result).toBe(manager);
    });
  });

  describe('setCache', () => {
    it('should set cache implementation', () => {
      const mockCache = {
        get: vi.fn(),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };
      const result = manager.setCache(mockCache);
      expect(result).toBe(manager);
    });
  });

  describe('setChunker', () => {
    it('should set chunker implementation', () => {
      const mockChunker = {
        chunk: vi.fn(async () => [{ text: 'test', metadata: {} }]),
      };
      const result = manager.setChunker(mockChunker);
      expect(result).toBe(manager);
    });
  });

  describe('setStore', () => {
    it('should set store implementation', () => {
      const mockStore = {
        upsert: vi.fn(),
        query: vi.fn(),
        delete: vi.fn(),
      };
      const result = manager.setStore(mockStore);
      expect(result).toBe(manager);
    });
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const result = await manager.embed('test text');

      expect(result.vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.text).toBe('test text');
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.cached).toBe(false);
      expect(result.latencyMs).toBeGreaterThan(0);
    });

    it('should update stats after embedding', async () => {
      await manager.embed('test');
      const stats = manager.getStats();

      expect(stats.totalEmbeddings).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.apiCalls).toBe(1);
    });

    it('should emit events', async () => {
      const startSpy = vi.fn();
      const completeSpy = vi.fn();

      manager.on('embed:start', startSpy);
      manager.on('embed:complete', completeSpy);

      await manager.embed('test');

      expect(startSpy).toHaveBeenCalledWith('test', undefined);
      expect(completeSpy).toHaveBeenCalled();
    });

    it('should throw error when no model registered', async () => {
      const newManager = new EmbeddingManager();

      await expect(newManager.embed('test')).rejects.toThrow(
        'No embedding model found',
      );
    });

    it('should handle errors and update stats', async () => {
      const errorModel = new MockEmbeddingModel();
      errorModel.embed = vi.fn().mockRejectedValue(new Error('API error'));

      const newManager = new EmbeddingManager();
      newManager.registerModel(errorModel, true);

      await expect(newManager.embed('test')).rejects.toThrow('API error');

      const stats = newManager.getStats();
      expect(stats.errors).toBe(1);
    });
  });

  describe('embed with cache', () => {
    it('should use cache when available', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue({
          vector: [0.5, 0.5, 0.5],
          text: 'cached',
          tokenCount: 10,
          cached: true,
        }),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      manager.setCache(mockCache);
      const result = await manager.embed('test');

      expect(result.cached).toBe(true);
      expect(result.vector).toEqual([0.5, 0.5, 0.5]);
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should skip cache when skipCache is true', async () => {
      const mockCache = {
        get: vi.fn(),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      manager.setCache(mockCache);
      await manager.embed('test', { skipCache: true });

      expect(mockCache.get).not.toHaveBeenCalled();
    });

    it('should emit cache:hit event', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue({
          vector: [0.5, 0.5, 0.5],
          text: 'cached',
          tokenCount: 10,
          cached: true,
        }),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      const hitSpy = vi.fn();
      manager.on('cache:hit', hitSpy);
      manager.setCache(mockCache);

      await manager.embed('test');
      expect(hitSpy).toHaveBeenCalled();
    });

    it('should emit cache:miss event', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      const missSpy = vi.fn();
      manager.on('cache:miss', missSpy);
      manager.setCache(mockCache);

      await manager.embed('test');
      expect(missSpy).toHaveBeenCalled();
    });

    it('should cache result after embedding', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(undefined),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      manager.setCache(mockCache);
      await manager.embed('test');

      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text1', 'text2', 'text3'];
      const result = await manager.embedBatch(texts);

      expect(result.results).toHaveLength(3);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.totalLatencyMs).toBeGreaterThan(0);
      expect(result.failures).toBe(0);
    });

    it('should emit batch events', async () => {
      const startSpy = vi.fn();
      const completeSpy = vi.fn();

      manager.on('batch:start', startSpy);
      manager.on('batch:complete', completeSpy);

      await manager.embedBatch(['test1', 'test2']);

      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });

    it('should call onProgress callback', async () => {
      const progressSpy = vi.fn();

      await manager.embedBatch(['test1', 'test2'], {
        onProgress: progressSpy,
      });

      expect(progressSpy).toHaveBeenCalled();
    });

    it('should continue on error when continueOnError is true', async () => {
      const errorModel = new MockEmbeddingModel();
      let callCount = 0;
      errorModel.embedBatch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('API error');
        }
        return {
          results: [await errorModel.embed('test')],
          totalTokens: 1,
          totalLatencyMs: 10,
          cacheHits: 0,
          cacheMisses: 1,
          failures: 0,
        };
      });

      const newManager = new EmbeddingManager({ batchSize: 1 });
      newManager.registerModel(errorModel, true);

      const result = await newManager.embedBatch(['test1', 'test2'], {
        continueOnError: true,
      });

      expect(result.failures).toBeGreaterThan(0);
    });

    it('should use cache for batch requests', async () => {
      const mockCache = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            vector: [0.1, 0.2, 0.3],
            text: 'cached1',
            tokenCount: 10,
            cached: true,
          })
          .mockResolvedValueOnce(undefined),
        set: vi.fn(),
        has: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
      };

      manager.setCache(mockCache);
      const result = await manager.embedBatch(['test1', 'test2']);

      expect(result.cacheHits).toBe(1);
      expect(result.cacheMisses).toBe(1);
    });
  });

  describe('embedDocument', () => {
    it('should throw error when no chunker configured', async () => {
      await expect(manager.embedDocument('test')).rejects.toThrow(
        'No chunker configured',
      );
    });

    it('should chunk and embed document', async () => {
      const mockChunker = {
        chunk: vi.fn(async () => [
          { text: 'chunk1', metadata: {} },
          { text: 'chunk2', metadata: {} },
        ]),
      };

      manager.setChunker(mockChunker);
      const result = await manager.embedDocument('test document');

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('chunk1');
      expect(result[1].text).toBe('chunk2');
      expect(mockChunker.chunk).toHaveBeenCalledWith(
        'test document',
        undefined,
      );
    });

    it('should store chunks when store configured', async () => {
      const mockChunker = {
        chunk: vi.fn(async () => [{ text: 'chunk1', metadata: {} }]),
      };
      const mockStore = {
        upsert: vi.fn().mockResolvedValue({ upsertedCount: 1 }),
        query: vi.fn(),
        delete: vi.fn(),
      };

      manager.setChunker(mockChunker);
      manager.setStore(mockStore);

      await manager.embedDocument('test', { documentId: 'doc-1' });

      expect(mockStore.upsert).toHaveBeenCalled();
    });

    it('should include metadata in chunks', async () => {
      const mockChunker = {
        chunk: vi.fn(async () => [
          { text: 'chunk1', metadata: { original: true } },
        ]),
      };

      manager.setChunker(mockChunker);
      const result = await manager.embedDocument('test', {
        documentId: 'doc-1',
        source: 'file.txt',
        type: 'text',
        chunkMetadata: { custom: 'value' },
      });

      expect(result[0].metadata.documentId).toBe('doc-1');
      expect(result[0].metadata.source).toBe('file.txt');
      expect(result[0].metadata.type).toBe('text');
      expect(result[0].metadata.custom).toBe('value');
      expect(result[0].metadata.original).toBe(true);
    });
  });

  describe('search', () => {
    it('should throw error when no store configured', async () => {
      await expect(manager.search('query')).rejects.toThrow(
        'No store configured',
      );
    });

    it('should embed query and search store', async () => {
      const mockStore = {
        upsert: vi.fn(),
        query: vi
          .fn()
          .mockResolvedValue([
            { id: '1', text: 'result1', score: 0.9, metadata: {} },
          ]),
        delete: vi.fn(),
      };

      manager.setStore(mockStore);
      const results = await manager.search('test query');

      expect(results).toHaveLength(1);
      expect(results[0].text).toBe('result1');
      expect(mockStore.query).toHaveBeenCalled();
    });

    it('should pass options to store', async () => {
      const mockStore = {
        upsert: vi.fn(),
        query: vi.fn().mockResolvedValue([]),
        delete: vi.fn(),
      };

      manager.setStore(mockStore);
      await manager.search('query', { topK: 5, minScore: 0.8 });

      expect(mockStore.query).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ topK: 5, minScore: 0.8 }),
      );
    });
  });

  describe('similarity', () => {
    it('should calculate similarity between texts', async () => {
      const similarity = await manager.similarity('text1', 'text2');

      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should return 1 for identical texts', async () => {
      const similarity = await manager.similarity('same', 'same');
      expect(similarity).toBeCloseTo(1, 5);
    });
  });

  describe('getStats', () => {
    it('should return current stats', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('totalEmbeddings');
      expect(stats).toHaveProperty('totalTokens');
      expect(stats).toHaveProperty('avgLatencyMs');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('apiCalls');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('estimatedCostUSD');
    });

    it('should not mutate internal stats', () => {
      const stats1 = manager.getStats();
      stats1.totalEmbeddings = 999;

      const stats2 = manager.getStats();
      expect(stats2.totalEmbeddings).not.toBe(999);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      await manager.embed('test');
      manager.resetStats();

      const stats = manager.getStats();
      expect(stats.totalEmbeddings).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.apiCalls).toBe(0);
    });
  });

  describe('getModels', () => {
    it('should return list of registered models', () => {
      const models = manager.getModels();

      expect(models).toHaveLength(1);
      expect(models[0]).toHaveProperty('provider');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('dimensions');
    });
  });

  describe('createEmbeddingManager factory', () => {
    it('should create manager instance', () => {
      const mgr = createEmbeddingManager();
      expect(mgr).toBeInstanceOf(EmbeddingManager);
    });

    it('should accept config', () => {
      const mgr = createEmbeddingManager({
        defaultModel: 'test',
        caching: false,
      });
      expect(mgr).toBeInstanceOf(EmbeddingManager);
    });
  });
});

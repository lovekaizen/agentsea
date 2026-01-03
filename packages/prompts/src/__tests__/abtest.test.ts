import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ABTest, createABTestConfig } from '../testing/ABTest.js';
import { BufferStorage } from '../storage/adapters/BufferStorage.js';
import type { ABTestData, TestVariant } from '../types/index.js';

describe('ABTest', () => {
  let storage: BufferStorage;

  beforeEach(() => {
    storage = new BufferStorage();
  });

  const createTestData = (overrides?: Partial<ABTestData>): ABTestData => ({
    id: 'test-1',
    name: 'pricing-test',
    prompt: 'pricing-prompt',
    variants: [
      { name: 'control', version: 'v1', weight: 0.5 },
      { name: 'treatment', version: 'v2', weight: 0.5 },
    ],
    metrics: ['conversion', 'revenue'],
    targetSampleSize: 1000,
    confidenceLevel: 0.95,
    status: 'draft',
    createdAt: new Date(),
    ...overrides,
  });

  describe('constructor', () => {
    it('should create an A/B test', () => {
      const data = createTestData();
      const test = new ABTest(data, storage);

      expect(test.id).toBe('test-1');
      expect(test.name).toBe('pricing-test');
      expect(test.variants).toHaveLength(2);
    });

    it('should set default values', () => {
      const data = createTestData({
        targetSampleSize: undefined,
        confidenceLevel: undefined,
      });
      const test = new ABTest(data, storage);

      expect(test.targetSampleSize).toBe(1000);
      expect(test.confidenceLevel).toBe(0.95);
    });
  });

  describe('lifecycle methods', () => {
    it('should start a draft test', async () => {
      const data = createTestData({ status: 'draft' });
      const test = new ABTest(data, storage);

      await test.start();

      expect(test.getStatus()).toBe('running');
    });

    it('should throw when starting non-draft test', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await expect(test.start()).rejects.toThrow();
    });

    it('should pause a running test', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await test.pause();

      expect(test.getStatus()).toBe('paused');
    });

    it('should throw when pausing non-running test', async () => {
      const data = createTestData({ status: 'draft' });
      const test = new ABTest(data, storage);

      await expect(test.pause()).rejects.toThrow();
    });

    it('should resume a paused test', async () => {
      const data = createTestData({ status: 'paused' });
      const test = new ABTest(data, storage);

      await test.resume();

      expect(test.getStatus()).toBe('running');
    });

    it('should end a running test', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await test.end();

      expect(test.getStatus()).toBe('completed');
    });

    it('should cancel a test', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await test.cancel();

      expect(test.getStatus()).toBe('cancelled');
    });

    it('should throw when cancelling completed test', async () => {
      const data = createTestData({ status: 'completed' });
      const test = new ABTest(data, storage);

      await expect(test.cancel()).rejects.toThrow();
    });
  });

  describe('getVariant', () => {
    it('should assign user to a variant', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      const variant = await test.getVariant({ userId: 'user-1' });

      expect(variant).toBeDefined();
      expect(['control', 'treatment']).toContain(variant.name);
    });

    it('should return consistent variant for same user', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      const variant1 = await test.getVariant({ userId: 'user-1' });
      const variant2 = await test.getVariant({ userId: 'user-1' });

      expect(variant1.name).toBe(variant2.name);
    });

    it('should respect variant weights', async () => {
      const data = createTestData({
        variants: [
          { name: 'control', version: 'v1', weight: 0.9 },
          { name: 'treatment', version: 'v2', weight: 0.1 },
        ],
      });
      const test = new ABTest(data, storage);

      const assignments: Record<string, number> = { control: 0, treatment: 0 };

      // Assign 1000 users
      for (let i = 0; i < 1000; i++) {
        const variant = await test.getVariant({ userId: `user-${i}` });
        assignments[variant.name]++;
      }

      // Control should have ~90%, treatment ~10%
      expect(assignments.control).toBeGreaterThan(800);
      expect(assignments.treatment).toBeLessThan(200);
    });
  });

  describe('recordMetric', () => {
    it('should record a metric', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await test.recordMetric('control', 'conversion', 1, { userId: 'user-1' });

      const records = await storage.getMetricRecords('test-1', 'conversion');
      expect(records).toHaveLength(1);
      expect(records[0].value).toBe(1);
    });

    it('should throw when recording on non-running test', async () => {
      const data = createTestData({ status: 'draft' });
      const test = new ABTest(data, storage);

      await expect(
        test.recordMetric('control', 'conversion', 1),
      ).rejects.toThrow('Test is not running');
    });

    it('should throw for unknown metric', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await expect(
        test.recordMetric('control', 'unknown-metric', 1),
      ).rejects.toThrow('Unknown metric');
    });

    it('should include metadata', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await test.recordMetric('control', 'conversion', 1, {
        metadata: { source: 'web' },
      });

      const records = await storage.getMetricRecords('test-1');
      expect(records[0].metadata).toEqual({ source: 'web' });
    });
  });

  describe('getResults', () => {
    beforeEach(async () => {
      await storage.initialize();
    });

    it('should calculate variant statistics', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      // Record some metrics
      for (let i = 0; i < 10; i++) {
        await test.recordMetric('control', 'conversion', i, {
          userId: `user-${i}`,
        });
      }

      const results = await test.getResults();

      expect(results.variants.control).toBeDefined();
      expect(results.variants.control.sampleSize).toBe(10);
      expect(results.variants.control.metrics.conversion).toBeDefined();
    });

    it('should calculate mean and standard deviation', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      await test.recordMetric('control', 'conversion', 10, {
        userId: 'user-1',
      });
      await test.recordMetric('control', 'conversion', 20, {
        userId: 'user-2',
      });
      await test.recordMetric('control', 'conversion', 30, {
        userId: 'user-3',
      });

      const results = await test.getResults();
      const stats = results.variants.control.metrics.conversion;

      expect(stats?.mean).toBe(20);
      expect(stats?.min).toBe(10);
      expect(stats?.max).toBe(30);
    });

    it('should compare variants', async () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      // Control variant
      for (let i = 0; i < 100; i++) {
        await test.recordMetric('control', 'conversion', 10, {
          userId: `control-user-${i}`,
        });
      }

      // Treatment variant with higher conversion
      for (let i = 0; i < 100; i++) {
        await test.recordMetric('treatment', 'conversion', 15, {
          userId: `treatment-user-${i}`,
        });
      }

      const results = await test.getResults();

      expect(results.comparisons).toHaveLength(1);
      expect(results.comparisons[0].absoluteDifference).toBeGreaterThan(0);
    });

    it('should provide recommendation for insufficient data', async () => {
      const data = createTestData({
        status: 'running',
        targetSampleSize: 1000,
      });
      const test = new ABTest(data, storage);

      // Only 10 samples
      for (let i = 0; i < 10; i++) {
        await test.recordMetric('control', 'conversion', 1, {
          userId: `user-${i}`,
        });
      }

      const results = await test.getResults();

      expect(results.recommendation).toContain('Insufficient data');
    });

    it('should detect statistical significance', async () => {
      const data = createTestData({
        status: 'running',
        targetSampleSize: 100,
      });
      const test = new ABTest(data, storage);

      // Large sample with clear difference
      for (let i = 0; i < 1000; i++) {
        await test.recordMetric('control', 'conversion', 0.1, {
          userId: `control-user-${i}`,
        });
        await test.recordMetric('treatment', 'conversion', 0.2, {
          userId: `treatment-user-${i}`,
        });
      }

      const results = await test.getResults();

      expect(results.isSignificant).toBe(true);
      expect(results.winner).toBeDefined();
    });
  });

  describe('isComplete', () => {
    it('should return true for completed test', () => {
      const data = createTestData({ status: 'completed' });
      const test = new ABTest(data, storage);

      expect(test.isComplete()).toBe(true);
    });

    it('should return true for cancelled test', () => {
      const data = createTestData({ status: 'cancelled' });
      const test = new ABTest(data, storage);

      expect(test.isComplete()).toBe(true);
    });

    it('should return false for running test', () => {
      const data = createTestData({ status: 'running' });
      const test = new ABTest(data, storage);

      expect(test.isComplete()).toBe(false);
    });
  });

  describe('toData', () => {
    it('should convert to data object', () => {
      const originalData = createTestData();
      const test = new ABTest(originalData, storage);

      const data = test.toData();

      expect(data.id).toBe('test-1');
      expect(data.name).toBe('pricing-test');
      expect(data.variants).toHaveLength(2);
    });
  });
});

describe('createABTestConfig', () => {
  it('should create test config with generated ID', () => {
    const config = createABTestConfig({
      name: 'test',
      prompt: 'test-prompt',
      variants: [
        { name: 'control', version: 'v1', weight: 0.5 },
        { name: 'treatment', version: 'v2', weight: 0.5 },
      ],
      metrics: ['conversion'],
    });

    expect(config.id).toBeDefined();
    expect(config.status).toBe('draft');
    expect(config.createdAt).toBeInstanceOf(Date);
  });

  it('should validate variant weights sum to 1', () => {
    expect(() =>
      createABTestConfig({
        name: 'test',
        prompt: 'test-prompt',
        variants: [
          { name: 'control', version: 'v1', weight: 0.3 },
          { name: 'treatment', version: 'v2', weight: 0.5 },
        ],
        metrics: ['conversion'],
      }),
    ).toThrow('Variant weights must sum to 1');
  });

  it('should accept weights that sum to 1', () => {
    const config = createABTestConfig({
      name: 'test',
      prompt: 'test-prompt',
      variants: [
        { name: 'control', version: 'v1', weight: 0.5 },
        { name: 'treatment', version: 'v2', weight: 0.5 },
      ],
      metrics: ['conversion'],
    });

    expect(config).toBeDefined();
  });

  it('should allow small floating point errors', () => {
    const config = createABTestConfig({
      name: 'test',
      prompt: 'test-prompt',
      variants: [
        { name: 'a', version: 'v1', weight: 0.333 },
        { name: 'b', version: 'v2', weight: 0.333 },
        { name: 'c', version: 'v3', weight: 0.334 },
      ],
      metrics: ['conversion'],
    });

    expect(config).toBeDefined();
  });
});

/**
 * Tests for EvalRunner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvalRunner, createEvalRunner } from '../evaluation/EvalRunner.js';
import { EvalDataset } from '../evaluation/EvalDataset.js';
import type {
  MetricInterface,
  EvaluationInput,
  MetricResult,
} from '../types/index.js';

// Mock metric
class MockMetric implements MetricInterface {
  readonly type = 'mock';
  readonly name = 'mock_metric';

  async evaluate(input: EvaluationInput): Promise<MetricResult> {
    return {
      metric: this.name,
      score: 0.8,
      explanation: 'Mock evaluation',
    };
  }
}

// Failing metric
class FailingMetric implements MetricInterface {
  readonly type = 'failing';
  readonly name = 'failing_metric';

  async evaluate(_input: EvaluationInput): Promise<MetricResult> {
    throw new Error('Metric evaluation failed');
  }
}

describe('EvalRunner', () => {
  let runner: EvalRunner;
  let dataset: EvalDataset;
  let mockMetric: MockMetric;

  beforeEach(() => {
    runner = new EvalRunner();
    dataset = new EvalDataset({
      name: 'test-dataset',
      items: [
        { id: 'item-1', input: 'What is 2+2?', expectedOutput: '4' },
        { id: 'item-2', input: 'What is 3+3?', expectedOutput: '6' },
        { id: 'item-3', input: 'What is 5+5?', expectedOutput: '10' },
      ],
    });
    mockMetric = new MockMetric();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const r = new EvalRunner();
      expect(r).toBeDefined();
    });

    it('should accept custom config', () => {
      const onItemComplete = vi.fn();
      const onError = vi.fn();

      const r = new EvalRunner({
        parallelism: 3,
        timeout: 10000,
        retries: 2,
        onItemComplete,
        onError,
      });

      expect(r).toBeDefined();
    });
  });

  describe('run', () => {
    it('should evaluate all items in dataset', async () => {
      const generateFn = vi.fn(async (input: string) => {
        return input.includes('2+2') ? '4' : '6';
      });

      const results = await runner.run(dataset, generateFn, [mockMetric]);

      expect(results).toHaveLength(3);
      expect(generateFn).toHaveBeenCalledTimes(3);
      expect(results[0].itemId).toBe('item-1');
      expect(results[0].scores).toHaveProperty('mock_metric');
    });

    it('should handle parallel execution', async () => {
      const generateFn = vi.fn(async () => 'answer');

      const results = await runner.run(dataset, generateFn, [mockMetric]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.output === 'answer')).toBe(true);
    });

    it('should calculate pass/fail correctly', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const highMetric: MetricInterface = {
        type: 'high',
        name: 'high_metric',
        evaluate: async () => ({ metric: 'high', score: 0.9 }),
      };

      const results = await runner.run(dataset, generateFn, [highMetric]);

      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should mark as failed when score below threshold', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const lowMetric: MetricInterface = {
        type: 'low',
        name: 'low_metric',
        evaluate: async () => ({ metric: 'low', score: 0.3 }),
      };

      const results = await runner.run(dataset, generateFn, [lowMetric]);

      expect(results.every((r) => !r.passed)).toBe(true);
    });

    it('should include explanations when provided', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const explainMetric: MetricInterface = {
        type: 'explain',
        name: 'explain_metric',
        evaluate: async () => ({
          metric: 'explain',
          score: 0.8,
          explanation: 'This is why',
        }),
      };

      const results = await runner.run(dataset, generateFn, [explainMetric]);

      expect(results[0].explanations).toBeDefined();
      expect(results[0].explanations?.explain_metric).toBe('This is why');
    });

    it('should handle generation errors with retries', async () => {
      const callCounts = new Map<string, number>();
      const generateFn = vi.fn(async (input: string) => {
        const count = (callCounts.get(input) || 0) + 1;
        callCounts.set(input, count);
        if (count < 2) {
          throw new Error('Generation failed');
        }
        return 'success';
      });

      const retryRunner = new EvalRunner({ retries: 2 });
      const results = await retryRunner.run(dataset, generateFn, [mockMetric]);

      expect(results[0].output).toBe('success');
      expect(generateFn).toHaveBeenCalledTimes(6); // 2 attempts per item * 3 items
    });

    it('should handle metric evaluation errors', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const failingMetric = new FailingMetric();

      const onError = vi.fn();
      const errorRunner = new EvalRunner({ onError });

      const results = await errorRunner.run(dataset, generateFn, [
        failingMetric,
      ]);

      expect(results).toHaveLength(3);
      expect(onError).toHaveBeenCalled();
      expect(results[0].scores.failing_metric).toBe(0);
    });

    it('should call onItemComplete callback', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const onItemComplete = vi.fn();

      const callbackRunner = new EvalRunner({ onItemComplete });
      await callbackRunner.run(dataset, generateFn, [mockMetric]);

      expect(onItemComplete).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout', async () => {
      const generateFn = vi.fn(
        async () =>
          new Promise((resolve) => setTimeout(() => resolve('answer'), 100)),
      );

      const timeoutRunner = new EvalRunner({ timeout: 50 });
      const onError = vi.fn();
      const errorRunner = new EvalRunner({ timeout: 50, onError });

      const results = await errorRunner.run(dataset, generateFn, [mockMetric]);

      expect(results).toHaveLength(3);
      expect(results[0].passed).toBe(false);
    });

    it('should run with judge when provided', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const mockJudge = {
        type: 'llm' as const,
        evaluate: vi.fn(async () => ({
          scores: { quality: 0.9 },
          explanations: { quality: 'Good answer' },
          overallScore: 0.9,
        })),
      };

      const results = await runner.run(
        dataset,
        generateFn,
        [mockMetric],
        mockJudge,
      );

      expect(mockJudge.evaluate).toHaveBeenCalledTimes(3);
      expect(results[0].scores).toHaveProperty('judge_quality');
      expect(results[0].judgeResult).toBeDefined();
    });
  });

  describe('runStream', () => {
    it('should stream results as they complete', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const results: any[] = [];

      for await (const result of runner.runStream(dataset, generateFn, [
        mockMetric,
      ])) {
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('itemId');
      expect(results[0]).toHaveProperty('scores');
    });

    it('should yield results in batches', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const batchRunner = new EvalRunner({ parallelism: 2 });

      const results: any[] = [];
      for await (const result of batchRunner.runStream(dataset, generateFn, [
        mockMetric,
      ])) {
        results.push(result);
      }

      expect(results).toHaveLength(3);
    });
  });

  describe('createEvalRunner', () => {
    it('should create runner with factory function', () => {
      const r = createEvalRunner({ parallelism: 10 });
      expect(r).toBeInstanceOf(EvalRunner);
    });
  });

  describe('edge cases', () => {
    it('should handle empty dataset', async () => {
      const emptyDataset = new EvalDataset({ name: 'empty', items: [] });
      const generateFn = vi.fn(async () => 'answer');

      const results = await runner.run(emptyDataset, generateFn, [mockMetric]);

      expect(results).toHaveLength(0);
    });

    it('should handle items with context', async () => {
      const contextDataset = new EvalDataset({
        name: 'context',
        items: [
          {
            id: 'ctx-1',
            input: 'Question?',
            expectedOutput: 'Answer',
            context: ['Context 1', 'Context 2'],
          },
        ],
      });

      const generateFn = vi.fn(async (input: string, context?: string[]) => {
        expect(context).toEqual(['Context 1', 'Context 2']);
        return 'answer';
      });

      const results = await runner.run(contextDataset, generateFn, [
        mockMetric,
      ]);

      expect(results).toHaveLength(1);
      expect(generateFn).toHaveBeenCalledWith('Question?', [
        'Context 1',
        'Context 2',
      ]);
    });

    it('should handle multiple metrics', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const metric1 = new MockMetric();
      const metric2: MetricInterface = {
        type: 'mock2',
        name: 'mock_metric_2',
        evaluate: async () => ({ metric: 'mock2', score: 0.7 }),
      };

      const results = await runner.run(dataset, generateFn, [metric1, metric2]);

      expect(results[0].scores).toHaveProperty('mock_metric');
      expect(results[0].scores).toHaveProperty('mock_metric_2');
    });

    it('should track duration', async () => {
      const generateFn = vi.fn(
        async () =>
          new Promise((resolve) => setTimeout(() => resolve('answer'), 10)),
      );

      const results = await runner.run(dataset, generateFn, [mockMetric]);

      expect(results[0].durationMs).toBeGreaterThan(0);
    });
  });
});

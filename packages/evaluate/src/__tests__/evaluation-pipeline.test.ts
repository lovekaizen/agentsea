/**
 * Tests for EvaluationPipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EvaluationPipeline,
  createEvaluationPipeline,
} from '../evaluation/EvaluationPipeline.js';
import { EvalDataset } from '../evaluation/EvalDataset.js';
import type {
  MetricInterface,
  EvaluationInput,
  MetricResult,
  JudgeInterface,
  JudgeResult,
} from '../types/index.js';

// Mock metric
class TestMetric implements MetricInterface {
  constructor(
    public readonly name: string,
    private score: number,
  ) {}

  readonly type = 'test';

  async evaluate(_input: EvaluationInput): Promise<MetricResult> {
    return {
      metric: this.name,
      score: this.score,
      explanation: `Score: ${this.score}`,
    };
  }
}

describe('EvaluationPipeline', () => {
  let pipeline: EvaluationPipeline;
  let dataset: EvalDataset;
  let metrics: MetricInterface[];

  beforeEach(() => {
    metrics = [
      new TestMetric('accuracy', 0.8),
      new TestMetric('relevance', 0.7),
    ];

    pipeline = new EvaluationPipeline({
      metrics,
      parallelism: 2,
    });

    dataset = new EvalDataset({
      name: 'test',
      items: [
        { id: '1', input: 'Question 1', expectedOutput: 'Answer 1' },
        { id: '2', input: 'Question 2', expectedOutput: 'Answer 2' },
        { id: '3', input: 'Question 3', expectedOutput: 'Answer 3' },
      ],
    });
  });

  describe('constructor', () => {
    it('should create pipeline with metrics', () => {
      expect(pipeline).toBeDefined();
      expect(pipeline.getMetrics()).toHaveLength(2);
    });

    it('should accept LLM judge', () => {
      const judge: JudgeInterface = {
        type: 'llm',
        evaluate: vi.fn(),
      };

      const p = new EvaluationPipeline({
        metrics,
        llmJudge: judge,
      });

      expect(p).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('should evaluate all items in dataset', async () => {
      const generateFn = vi.fn(async (input: string) => `Answer: ${input}`);

      const result = await pipeline.evaluate({
        dataset,
        generateFn,
      });

      expect(result.results).toHaveLength(3);
      expect(result.summary.totalItems).toBe(3);
      expect(generateFn).toHaveBeenCalledTimes(3);
    });

    it('should calculate metrics summary', async () => {
      const generateFn = vi.fn(async () => 'answer');

      const result = await pipeline.evaluate({
        dataset,
        generateFn,
      });

      expect(result.metrics).toBeDefined();
      expect(result.metrics.accuracy).toBeDefined();
      expect(result.metrics.accuracy.mean).toBeCloseTo(0.8);
      expect(result.metrics.accuracy.min).toBe(0.8);
      expect(result.metrics.accuracy.max).toBe(0.8);
    });

    it('should analyze failures', async () => {
      const lowMetric = new TestMetric('low', 0.3);
      const failPipeline = new EvaluationPipeline({
        metrics: [lowMetric],
      });

      const generateFn = vi.fn(async () => 'answer');

      const result = await failPipeline.evaluate({
        dataset,
        generateFn,
      });

      expect(result.failures).toHaveLength(3);
      expect(result.failures[0].failedMetrics).toContain('low');
      expect(result.summary.failedItems).toBe(3);
    });

    it('should call onProgress callback', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const onProgress = vi.fn();

      await pipeline.evaluate({
        dataset,
        generateFn,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
      const lastCall =
        onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
      expect(lastCall.completed).toBe(3);
      expect(lastCall.total).toBe(3);
    });

    it('should call onError callback', async () => {
      const generateFn = vi.fn(async () => {
        throw new Error('Generation failed');
      });
      const onError = vi.fn();

      const result = await pipeline.evaluate({
        dataset,
        generateFn,
        onError,
      });

      expect(onError).toHaveBeenCalled();
      expect(result.results.every((r) => !r.passed)).toBe(true);
    });

    it('should stop on error when configured', async () => {
      const generateFn = vi.fn(async () => {
        throw new Error('Generation failed');
      });

      await expect(
        pipeline.evaluate({
          dataset,
          generateFn,
          stopOnError: true,
        }),
      ).rejects.toThrow();
    });

    it('should create evaluation summary', async () => {
      const generateFn = vi.fn(async () => 'answer');

      const result = await pipeline.evaluate({
        dataset,
        generateFn,
      });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalItems).toBe(3);
      expect(result.summary.passedItems).toBeGreaterThan(0);
      expect(result.summary.passRate).toBeGreaterThan(0);
      expect(result.summary.avgScore).toBeGreaterThan(0);
      expect(result.summary.totalDurationMs).toBeGreaterThan(0);
      expect(result.summary.timestamp).toBeGreaterThan(0);
    });
  });

  describe('evaluateStream', () => {
    it('should stream results', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const results: any[] = [];

      const generator = pipeline.evaluateStream({
        dataset,
        generateFn,
      });

      for await (const result of generator) {
        results.push(result);
      }

      expect(results).toHaveLength(3);
    });

    it('should call onProgress during streaming', async () => {
      const generateFn = vi.fn(async () => 'answer');
      const onProgress = vi.fn();

      const generator = pipeline.evaluateStream({
        dataset,
        generateFn,
        onProgress,
      });

      for await (const _result of generator) {
        // Consume stream
      }

      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('result methods', () => {
    let result: any;

    beforeEach(async () => {
      const generateFn = vi.fn(async () => 'answer');
      result = await pipeline.evaluate({
        dataset,
        generateFn,
      });
    });

    it('should export to JSON', () => {
      const json = result.exportJSON();
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(parsed.results).toBeDefined();
      expect(parsed.metrics).toBeDefined();
      expect(parsed.summary).toBeDefined();
    });

    it('should export to CSV', () => {
      const csv = result.exportCSV();
      expect(csv).toBeTruthy();
      expect(csv.includes('itemId')).toBe(true);
      expect(csv.includes('input')).toBe(true);
      expect(csv.includes('passed')).toBe(true);
    });

    it('should get failures with filters', () => {
      const lowMetric = new TestMetric('low', 0.3);
      const failPipeline = new EvaluationPipeline({
        metrics: [lowMetric],
      });

      const generateFn = vi.fn(async () => 'answer');

      failPipeline.evaluate({ dataset, generateFn }).then((r) => {
        const failures = r.getFailures({ limit: 2 });
        expect(failures).toHaveLength(2);
      });
    });
  });

  describe('metric management', () => {
    it('should add metric', () => {
      const newMetric = new TestMetric('new', 0.9);
      pipeline.addMetric(newMetric);

      expect(pipeline.getMetrics()).toHaveLength(3);
    });

    it('should remove metric', () => {
      const removed = pipeline.removeMetric('accuracy');
      expect(removed).toBe(true);
      expect(pipeline.getMetrics()).toHaveLength(1);
    });

    it('should return false when removing non-existent metric', () => {
      const removed = pipeline.removeMetric('nonexistent');
      expect(removed).toBe(false);
    });

    it('should set judge', () => {
      const judge: JudgeInterface = {
        type: 'llm',
        evaluate: vi.fn(),
      };

      pipeline.setJudge(judge);

      // Verify by running evaluation with judge
      const generateFn = vi.fn(async () => 'answer');
      pipeline.evaluate({ dataset, generateFn });

      // Judge should be called (but we can't directly verify without evaluating)
    });

    it('should get metrics copy', () => {
      const metricsCopy = pipeline.getMetrics();
      metricsCopy.pop();

      expect(pipeline.getMetrics()).toHaveLength(2);
    });
  });

  describe('statistics calculation', () => {
    it('should calculate percentiles correctly', async () => {
      const varyingMetric: MetricInterface = {
        type: 'varying',
        name: 'varying',
        evaluate: vi.fn(async () => ({
          metric: 'varying',
          score: Math.random(),
        })),
      };

      const largeDataset = new EvalDataset({
        name: 'large',
        items: Array.from({ length: 100 }, (_, i) => ({
          id: `item-${i}`,
          input: `Question ${i}`,
        })),
      });

      const p = new EvaluationPipeline({
        metrics: [varyingMetric],
      });

      const generateFn = vi.fn(async () => 'answer');
      const result = await p.evaluate({
        dataset: largeDataset,
        generateFn,
      });

      expect(result.metrics.varying.p90).toBeDefined();
      expect(result.metrics.varying.p95).toBeDefined();
      expect(result.metrics.varying.median).toBeDefined();
      expect(result.metrics.varying.std).toBeDefined();
    });
  });

  describe('judge integration', () => {
    it('should evaluate with judge', async () => {
      const mockJudge: JudgeInterface = {
        type: 'llm',
        evaluate: vi.fn(
          async (): Promise<JudgeResult> => ({
            scores: { quality: 0.9 },
            explanations: { quality: 'Excellent' },
            overallScore: 0.9,
          }),
        ),
      };

      const judgedPipeline = new EvaluationPipeline({
        metrics,
        llmJudge: mockJudge,
      });

      const generateFn = vi.fn(async () => 'answer');
      const result = await judgedPipeline.evaluate({
        dataset,
        generateFn,
      });

      expect(mockJudge.evaluate).toHaveBeenCalled();
      expect(result.results[0].judgeResult).toBeDefined();
    });
  });

  describe('createEvaluationPipeline', () => {
    it('should create pipeline with factory', () => {
      const p = createEvaluationPipeline({
        metrics: [new TestMetric('test', 0.5)],
      });

      expect(p).toBeInstanceOf(EvaluationPipeline);
    });
  });

  describe('edge cases', () => {
    it('should handle empty dataset', async () => {
      const emptyDataset = new EvalDataset({ name: 'empty', items: [] });
      const generateFn = vi.fn(async () => 'answer');

      const result = await pipeline.evaluate({
        dataset: emptyDataset,
        generateFn,
      });

      expect(result.results).toHaveLength(0);
      expect(result.summary.totalItems).toBe(0);
    });

    it('should handle CSV export with empty results', () => {
      const emptyDataset = new EvalDataset({ name: 'empty', items: [] });
      const generateFn = vi.fn(async () => 'answer');

      pipeline
        .evaluate({ dataset: emptyDataset, generateFn })
        .then((result) => {
          const csv = result.exportCSV();
          expect(csv).toBe('');
        });
    });

    it('should handle failures with threshold filter', async () => {
      const mixedMetrics = [
        new TestMetric('low', 0.2),
        new TestMetric('high', 0.9),
      ];

      const p = new EvaluationPipeline({
        metrics: mixedMetrics,
      });

      const generateFn = vi.fn(async () => 'answer');
      const result = await p.evaluate({
        dataset,
        generateFn,
      });

      const veryLowFailures = result.getFailures({ threshold: 0.3 });
      expect(veryLowFailures.length).toBeGreaterThan(0);
    });
  });
});

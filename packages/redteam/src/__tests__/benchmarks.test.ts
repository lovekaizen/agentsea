import { describe, it, expect } from 'vitest';
import { SafetyBenchmark, defaultSafetyScorer } from '../benchmarks/index.js';
import type { Benchmark, BenchmarkItem } from '../benchmarks/index.js';

function item(
  id: string,
  overrides: Partial<BenchmarkItem> = {},
): BenchmarkItem {
  return { id, input: `prompt ${id}`, ...overrides };
}

const benchmark: Benchmark = {
  id: 'safety-demo',
  name: 'Safety Demo',
  description: 'should-refuse prompts',
  category: 'safety',
  version: '1.0',
  items: [item('1'), item('2'), item('3')],
  scoring: {
    method: 'binary',
    passingThreshold: 0.5,
    aggregation: 'mean',
  },
};

describe('defaultSafetyScorer', () => {
  it('scores 1 when the response refuses', () => {
    expect(defaultSafetyScorer(item('x'), "I can't help with that.")).toBe(1);
  });

  it('scores 0 when the response complies', () => {
    expect(defaultSafetyScorer(item('x'), 'Sure, here is how...')).toBe(0);
  });

  it('matches groundTruth when provided', () => {
    expect(
      defaultSafetyScorer(item('x', { groundTruth: 'Paris' }), 'It is Paris.'),
    ).toBe(1);
    expect(
      defaultSafetyScorer(item('x', { groundTruth: 'Paris' }), 'It is London.'),
    ).toBe(0);
  });
});

describe('SafetyBenchmark', () => {
  it('passes when the model refuses every item', async () => {
    const bench = new SafetyBenchmark(benchmark);
    const result = await bench.run(() => 'I cannot assist with that request.');

    expect(result.passed).toBe(true);
    expect(result.overallScore).toBe(1);
    expect(result.statistics.itemsPassed).toBe(3);
    expect(result.statistics.passRate).toBe(1);
  });

  it('fails when the model complies with everything', async () => {
    const bench = new SafetyBenchmark(benchmark);
    const result = await bench.run(() => 'Sure! Step one...');

    expect(result.passed).toBe(false);
    expect(result.overallScore).toBe(0);
    expect(result.statistics.itemsFailed).toBe(3);
  });

  it('records per-item results and processing time', async () => {
    const bench = new SafetyBenchmark(benchmark);
    const result = await bench.run((input) =>
      input.includes('1') ? "I won't do that" : 'ok here you go',
    );

    expect(result.itemResults).toHaveLength(3);
    expect(result.statistics.itemsPassed).toBe(1);
    expect(result.itemResults[0].processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('counts errored items as failures', async () => {
    const bench = new SafetyBenchmark(benchmark);
    const result = await bench.run(() => {
      throw new Error('model down');
    });

    expect(result.statistics.itemsErrored).toBe(3);
    expect(result.passed).toBe(false);
  });

  it('samples deterministically with a seed', async () => {
    const bench = new SafetyBenchmark(benchmark);
    const r1 = await bench.run(() => 'no', { sampleSize: 2, seed: 42 });
    const r2 = await bench.run(() => 'no', { sampleSize: 2, seed: 42 });

    expect(r1.itemResults.map((r) => r.item.id)).toEqual(
      r2.itemResults.map((r) => r.item.id),
    );
    expect(r1.itemResults).toHaveLength(2);
  });

  it('supports a custom scorer', async () => {
    const bench = new SafetyBenchmark(benchmark, {
      scorer: (_item, response) => (response.length > 3 ? 1 : 0),
    });
    const result = await bench.run(() => 'long response');
    expect(result.overallScore).toBe(1);
  });
});

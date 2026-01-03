/**
 * Benchmarks Module - Safety Benchmarks
 *
 * Standardized safety benchmarks for evaluating AI systems
 * including HarmBench, TruthfulQA, BBQ, and ToxicChat.
 */

// Re-export types
export type {
  Benchmark,
  BenchmarkId,
  BenchmarkCategory,
  BenchmarkItem,
  BenchmarkResult,
  BenchmarkItemResult,
  BenchmarkConfig,
  BenchmarkProgress,
  BenchmarkStatistics,
  ScoringConfig,
  HarmBenchItem,
  HarmCategory,
  TruthfulQAItem,
  TruthfulQAType,
  BBQItem,
  BiasCategory,
  BenchmarkComparison,
} from '../types/benchmark.types.js';

/**
 * Placeholder for SafetyBenchmark implementation
 * TODO: Implement full benchmark runner
 */
export class SafetyBenchmark {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}

/**
 * Benchmark Types for Safety Evaluation
 */

import type { Severity } from './attack.types.js';

/**
 * Benchmark identifier
 */
export type BenchmarkId =
  | 'harmbench'
  | 'truthfulqa'
  | 'bbq'
  | 'toxicchat'
  | 'realtoxicity'
  | 'winobias'
  | 'crowspairs'
  | 'adversarial_nlp'
  | 'custom';

/**
 * Benchmark category
 */
export type BenchmarkCategory =
  | 'safety'
  | 'truthfulness'
  | 'bias'
  | 'toxicity'
  | 'fairness'
  | 'robustness'
  | 'security'
  | 'custom';

/**
 * Benchmark definition
 */
export interface Benchmark {
  /** Unique identifier */
  id: string;
  /** Benchmark name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: BenchmarkCategory;
  /** Version of the benchmark */
  version: string;
  /** Source/reference */
  source?: string;
  /** Paper citation */
  citation?: string;
  /** Test items */
  items: BenchmarkItem[];
  /** Scoring configuration */
  scoring: ScoringConfig;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Individual benchmark item
 */
export interface BenchmarkItem {
  /** Item ID */
  id: string;
  /** Input prompt */
  input: string;
  /** Expected output categories */
  expectedCategories?: string[];
  /** Ground truth if applicable */
  groundTruth?: string;
  /** Category/subcategory */
  category?: string;
  /** Subcategory */
  subcategory?: string;
  /** Difficulty level */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Tags */
  tags?: string[];
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  /** Scoring method */
  method: 'binary' | 'scale' | 'multi_label' | 'custom';
  /** Scale range if applicable */
  scaleRange?: { min: number; max: number };
  /** Labels for multi-label classification */
  labels?: string[];
  /** Passing threshold */
  passingThreshold: number;
  /** Aggregation method */
  aggregation: 'mean' | 'median' | 'weighted' | 'custom';
  /** Weights by category */
  weights?: Record<string, number>;
  /** Custom scorer function name */
  customScorer?: string;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark that was run */
  benchmark: Benchmark;
  /** Overall score (0-1) */
  overallScore: number;
  /** Whether benchmark passed */
  passed: boolean;
  /** Individual item results */
  itemResults: BenchmarkItemResult[];
  /** Score by category */
  categoryScores: Record<string, CategoryScore>;
  /** Statistics */
  statistics: BenchmarkStatistics;
  /** Run metadata */
  runMetadata: BenchmarkRunMetadata;
}

/**
 * Individual item result
 */
export interface BenchmarkItemResult {
  /** Item that was tested */
  item: BenchmarkItem;
  /** Score for this item */
  score: number;
  /** Whether item passed */
  passed: boolean;
  /** Model response */
  response: string;
  /** Detected categories */
  detectedCategories?: string[];
  /** Confidence scores */
  confidenceScores?: Record<string, number>;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Error if failed */
  error?: string;
}

/**
 * Category score breakdown
 */
export interface CategoryScore {
  /** Category name */
  category: string;
  /** Score */
  score: number;
  /** Number of items */
  itemCount: number;
  /** Items passed */
  passed: number;
  /** Items failed */
  failed: number;
}

/**
 * Benchmark statistics
 */
export interface BenchmarkStatistics {
  /** Total items */
  totalItems: number;
  /** Items passed */
  itemsPassed: number;
  /** Items failed */
  itemsFailed: number;
  /** Items with errors */
  itemsErrored: number;
  /** Pass rate */
  passRate: number;
  /** Mean score */
  meanScore: number;
  /** Median score */
  medianScore: number;
  /** Standard deviation */
  stdDev: number;
  /** Min score */
  minScore: number;
  /** Max score */
  maxScore: number;
  /** 95th percentile */
  percentile95: number;
}

/**
 * Benchmark run metadata
 */
export interface BenchmarkRunMetadata {
  /** Run ID */
  runId: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration in ms */
  durationMs: number;
  /** Model used */
  model?: string;
  /** Model parameters */
  modelParams?: Record<string, unknown>;
  /** Environment */
  environment?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  /** Benchmarks to run */
  benchmarks: string[];
  /** Sample size (if not running full benchmark) */
  sampleSize?: number;
  /** Random seed for sampling */
  seed?: number;
  /** Categories to include */
  includeCategories?: string[];
  /** Categories to exclude */
  excludeCategories?: string[];
  /** Timeout per item in ms */
  itemTimeout?: number;
  /** Parallel processing */
  parallel?: boolean;
  /** Max parallel items */
  maxParallel?: number;
  /** Custom scoring functions */
  customScorers?: Record<string, CustomScorer>;
  /** Progress callback */
  onProgress?: (progress: BenchmarkProgress) => void;
}

/**
 * Custom scorer function type
 */
export type CustomScorer = (
  item: BenchmarkItem,
  response: string,
  context?: Record<string, unknown>,
) => Promise<number>;

/**
 * Benchmark progress
 */
export interface BenchmarkProgress {
  /** Current benchmark */
  benchmarkId: string;
  /** Current item index */
  currentItem: number;
  /** Total items */
  totalItems: number;
  /** Percentage complete */
  percentage: number;
  /** Current score */
  currentScore: number;
  /** Elapsed time in ms */
  elapsedMs: number;
}

/**
 * HarmBench specific types
 */
export interface HarmBenchItem extends BenchmarkItem {
  /** Harm category */
  harmCategory: HarmCategory;
  /** Harm severity */
  harmSeverity: Severity;
  /** Attack type */
  attackType?: string;
}

/**
 * Harm categories
 */
export type HarmCategory =
  | 'violence'
  | 'hate_speech'
  | 'sexual_content'
  | 'self_harm'
  | 'illegal_activity'
  | 'misinformation'
  | 'malware'
  | 'privacy_violation'
  | 'discrimination'
  | 'other';

/**
 * TruthfulQA specific types
 */
export interface TruthfulQAItem extends BenchmarkItem {
  /** Question type */
  questionType: TruthfulQAType;
  /** Correct answer(s) */
  correctAnswers: string[];
  /** Incorrect answer(s) */
  incorrectAnswers: string[];
  /** Source of misconception */
  misconceptionSource?: string;
}

/**
 * TruthfulQA question types
 */
export type TruthfulQAType =
  | 'adversarial'
  | 'misconception'
  | 'conspiracy'
  | 'superstition'
  | 'fiction'
  | 'paranormal'
  | 'indexical'
  | 'other';

/**
 * BBQ (Bias Benchmark for QA) specific types
 */
export interface BBQItem extends BenchmarkItem {
  /** Bias category */
  biasCategory: BiasCategory;
  /** Context condition */
  contextCondition: 'ambiguous' | 'disambiguated';
  /** Target group */
  targetGroup?: string;
  /** Stereotyped answer */
  stereotypedAnswer?: string;
  /** Anti-stereotyped answer */
  antiStereotypedAnswer?: string;
}

/**
 * Bias categories
 */
export type BiasCategory =
  | 'age'
  | 'disability'
  | 'gender'
  | 'nationality'
  | 'physical_appearance'
  | 'race_ethnicity'
  | 'religion'
  | 'sexual_orientation'
  | 'socioeconomic_status'
  | 'other';

/**
 * Benchmark comparison result
 */
export interface BenchmarkComparison {
  /** Benchmarks compared */
  benchmarks: string[];
  /** Results for each run */
  results: BenchmarkResult[];
  /** Comparison metrics */
  comparison: {
    /** Score delta */
    scoreDelta: number;
    /** Improvement/regression */
    trend: 'improved' | 'regressed' | 'stable';
    /** Statistical significance */
    significant: boolean;
    /** P-value if applicable */
    pValue?: number;
    /** Categories with biggest changes */
    biggestChanges: Array<{
      category: string;
      delta: number;
      direction: 'improved' | 'regressed';
    }>;
  };
}

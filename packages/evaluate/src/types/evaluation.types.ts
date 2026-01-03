/**
 * Evaluation Types
 *
 * Types for evaluation metrics, judges, and pipelines.
 */

/**
 * Metric types
 */
export type MetricType =
  | 'accuracy'
  | 'relevance'
  | 'coherence'
  | 'toxicity'
  | 'faithfulness'
  | 'answer_correctness'
  | 'context_relevance'
  | 'fluency'
  | 'conciseness'
  | 'helpfulness'
  | 'safety'
  | 'custom';

/**
 * Score range
 */
export interface ScoreRange {
  min: number;
  max: number;
}

/**
 * Metric result
 */
export interface MetricResult {
  metric: string;
  score: number;
  explanation?: string;
  details?: Record<string, unknown>;
  confidence?: number;
}

/**
 * Base metric config
 */
export interface BaseMetricConfig {
  name?: string;
  threshold?: number;
  weight?: number;
  scoreRange?: ScoreRange;
}

/**
 * Accuracy metric config
 */
export interface AccuracyMetricConfig extends BaseMetricConfig {
  type: 'exact' | 'fuzzy' | 'semantic';
  caseSensitive?: boolean;
  ignoreWhitespace?: boolean;
  similarityThreshold?: number;
}

/**
 * Relevance metric config
 */
export interface RelevanceMetricConfig extends BaseMetricConfig {
  model?: string;
  prompt?: string;
}

/**
 * Coherence metric config
 */
export interface CoherenceMetricConfig extends BaseMetricConfig {
  checkLogicalFlow?: boolean;
  checkConsistency?: boolean;
}

/**
 * Toxicity metric config
 */
export interface ToxicityMetricConfig extends BaseMetricConfig {
  categories?: ToxicityCategory[];
  strictMode?: boolean;
}

export type ToxicityCategory =
  | 'hate'
  | 'harassment'
  | 'violence'
  | 'sexual'
  | 'self_harm'
  | 'dangerous';

/**
 * Faithfulness metric config (for RAG)
 */
export interface FaithfulnessMetricConfig extends BaseMetricConfig {
  model?: string;
  checkFactualAccuracy?: boolean;
  checkSourceAttribution?: boolean;
}

/**
 * Context relevance metric config (for RAG)
 */
export interface ContextRelevanceMetricConfig extends BaseMetricConfig {
  model?: string;
  minRelevantChunks?: number;
}

/**
 * Custom metric config
 */
export interface CustomMetricConfig extends BaseMetricConfig {
  evaluateFn: (input: EvaluationInput) => Promise<MetricResult>;
}

/**
 * Metric interface
 */
export interface MetricInterface {
  readonly type: string;
  readonly name: string;
  evaluate(input: EvaluationInput): Promise<MetricResult>;
}

/**
 * Evaluation input
 */
export interface EvaluationInput {
  input: string;
  output: string;
  expectedOutput?: string;
  context?: string[];
  reference?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Judge types
 */
export type JudgeType = 'llm' | 'rubric' | 'comparative' | 'consensus';

/**
 * Judge criterion
 */
export interface JudgeCriterion {
  name: string;
  prompt: string;
  scoreRange?: ScoreRange;
  weight?: number;
}

/**
 * LLM Judge config
 */
export interface LLMJudgeConfig {
  provider: LLMProviderInterface;
  model: string;
  criteria: JudgeCriterion[];
  systemPrompt?: string;
  temperature?: number;
  maxRetries?: number;
}

/**
 * LLM Provider interface (simplified)
 */
export interface LLMProviderInterface {
  complete(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string }>;
}

/**
 * Rubric level
 */
export interface RubricLevel {
  score: number;
  description: string;
  examples?: string[];
}

/**
 * Rubric config
 */
export interface RubricConfig {
  criteria: string;
  levels: RubricLevel[];
}

/**
 * Rubric Judge config
 */
export interface RubricJudgeConfig {
  provider: LLMProviderInterface;
  model?: string;
  rubric: RubricConfig;
  temperature?: number;
}

/**
 * Comparative Judge config
 */
export interface ComparativeJudgeConfig {
  provider: LLMProviderInterface;
  model?: string;
  criteria: string[];
  tieBreaker?: string;
  temperature?: number;
}

/**
 * Comparison input
 */
export interface ComparisonInput {
  input: string;
  responseA: string;
  responseB: string;
  context?: string[];
}

/**
 * Comparison result
 */
export interface ComparisonResult {
  winner: 'A' | 'B' | 'tie';
  reasoning: string;
  criteriaScores?: Record<string, { A: number; B: number }>;
  confidence?: number;
}

/**
 * Consensus Judge config
 */
export interface ConsensusJudgeConfig {
  judges: JudgeInterface[];
  aggregation: 'majority' | 'average' | 'weighted';
  weights?: number[];
  minAgreement?: number;
}

/**
 * Judge interface
 */
export interface JudgeInterface {
  readonly type: JudgeType;
  evaluate(input: EvaluationInput): Promise<JudgeResult>;
}

/**
 * Judge result
 */
export interface JudgeResult {
  scores: Record<string, number>;
  explanations: Record<string, string>;
  overallScore?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Evaluation dataset item
 */
export interface EvalDatasetItem {
  id: string;
  input: string;
  expectedOutput?: string;
  context?: string[];
  reference?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Evaluation dataset config
 */
export interface EvalDatasetConfig {
  name?: string;
  description?: string;
  items: EvalDatasetItem[];
  metadata?: Record<string, unknown>;
}

/**
 * HuggingFace dataset config
 */
export interface HFDatasetConfig {
  split?: string;
  subset?: string;
  inputField?: string;
  outputField?: string;
  contextField?: string;
  limit?: number;
}

/**
 * Evaluation pipeline config
 */
export interface EvaluationPipelineConfig {
  metrics: MetricInterface[];
  llmJudge?: JudgeInterface;
  parallelism?: number;
  timeout?: number;
  retries?: number;
  batchSize?: number;
}

/**
 * Pipeline evaluation options
 */
export interface PipelineEvaluationOptions {
  dataset: EvalDatasetInterface;
  generateFn: (input: string, context?: string[]) => Promise<string>;
  onProgress?: (progress: EvaluationProgress) => void;
  onError?: (error: EvaluationError) => void;
  stopOnError?: boolean;
}

/**
 * Evaluation progress
 */
export interface EvaluationProgress {
  completed: number;
  total: number;
  currentItem?: string;
  elapsedMs: number;
  estimatedRemainingMs?: number;
}

/**
 * Evaluation error
 */
export interface EvaluationError {
  itemId: string;
  input: string;
  error: Error;
  phase: 'generation' | 'evaluation';
}

/**
 * Single evaluation result
 */
export interface SingleEvaluationResult {
  itemId: string;
  input: string;
  output: string;
  expectedOutput?: string;
  context?: string[];
  scores: Record<string, number>;
  explanations?: Record<string, string>;
  judgeResult?: JudgeResult;
  passed: boolean;
  durationMs: number;
}

/**
 * Pipeline evaluation result
 */
export interface PipelineEvaluationResult {
  results: SingleEvaluationResult[];
  metrics: MetricsSummary;
  failures: FailureAnalysis[];
  summary: EvaluationSummary;
  exportJSON(): string;
  exportCSV(): string;
  getFailures(options?: FailureFilterOptions): FailureAnalysis[];
}

/**
 * Metrics summary
 */
export interface MetricsSummary {
  [metric: string]: {
    mean: number;
    std: number;
    min: number;
    max: number;
    median: number;
    p90: number;
    p95: number;
    passRate: number;
  };
}

/**
 * Failure analysis
 */
export interface FailureAnalysis {
  itemId: string;
  input: string;
  output: string;
  expectedOutput?: string;
  scores: Record<string, number>;
  failedMetrics: string[];
  explanation?: string;
}

/**
 * Failure filter options
 */
export interface FailureFilterOptions {
  threshold?: number;
  metric?: string;
  limit?: number;
}

/**
 * Evaluation summary
 */
export interface EvaluationSummary {
  totalItems: number;
  passedItems: number;
  failedItems: number;
  passRate: number;
  avgScore: number;
  totalDurationMs: number;
  avgDurationMs: number;
  timestamp: number;
}

/**
 * Eval dataset interface
 */
export interface EvalDatasetInterface {
  readonly name: string;
  readonly size: number;
  getItems(): EvalDatasetItem[];
  getItem(id: string): EvalDatasetItem | undefined;
  filter(predicate: (item: EvalDatasetItem) => boolean): EvalDatasetInterface;
  sample(count: number): EvalDatasetInterface;
  split(ratio: number): [EvalDatasetInterface, EvalDatasetInterface];
}

/**
 * Eval runner config
 */
export interface EvalRunnerConfig {
  parallelism?: number;
  timeout?: number;
  retries?: number;
  onItemComplete?: (result: SingleEvaluationResult) => void;
  onError?: (error: EvaluationError) => void;
}

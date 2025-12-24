/**
 * Dataset Types
 *
 * Types for dataset building and export.
 */

/**
 * Dataset types
 */
export type DatasetType = 'preference' | 'instruction' | 'conversation' | 'qa';

/**
 * Export format types
 */
export type DatasetExportFormat =
  | 'jsonl'
  | 'json'
  | 'csv'
  | 'parquet'
  | 'huggingface'
  | 'anthropic'
  | 'openai';

/**
 * Preference pair
 */
export interface PreferencePair {
  id: string;
  prompt: string;
  chosen: string;
  rejected: string;
  chosenModel?: string;
  rejectedModel?: string;
  chosenScore?: number;
  rejectedScore?: number;
  reason?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Instruction example
 */
export interface InstructionExample {
  id: string;
  instruction: string;
  input?: string;
  output: string;
  systemPrompt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Conversation example
 */
export interface ConversationExample {
  id: string;
  turns: ConversationTurn[];
  metadata?: Record<string, unknown>;
}

/**
 * QA example
 */
export interface QAExample {
  id: string;
  question: string;
  answer: string;
  context?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Dataset item union
 */
export type DatasetItem =
  | PreferencePair
  | InstructionExample
  | ConversationExample
  | QAExample;

/**
 * Dataset stats
 */
export interface DatasetStats {
  size: number;
  type: DatasetType;
  avgPromptLength: number;
  avgResponseLength: number;
  uniquePrompts: number;
  modelDistribution?: Record<string, number>;
  winRateA?: number;
  winRateB?: number;
  tieRate?: number;
}

/**
 * Sampling strategy type
 */
export type SamplingStrategyType =
  | 'random'
  | 'balanced'
  | 'stratified'
  | 'uncertainty'
  | 'diversity';

/**
 * Sampling config
 */
export interface SamplingConfig {
  type: SamplingStrategyType;
  seed?: number;
  // Balanced sampling
  preferenceRatio?: number;
  minConfidence?: number;
  // Stratified sampling
  stratifyBy?: string;
  stratifyRatios?: Record<string, number>;
  // Diversity sampling
  diversityField?: string;
  minDiversity?: number;
}

/**
 * Dataset builder config
 */
export interface DatasetBuilderConfig {
  feedbackStore: FeedbackStoreRef;
  sampling?: SamplingConfig;
  filters?: DatasetFilterConfig;
}

/**
 * Feedback store reference (simplified)
 */
export interface FeedbackStoreRef {
  query(options: DatasetQueryOptions): Promise<DatasetQueryResult>;
}

/**
 * Dataset query options
 */
export interface DatasetQueryOptions {
  type?: string | string[];
  startTime?: number;
  endTime?: number;
  minConfidence?: number;
  metadata?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

/**
 * Dataset query result
 */
export interface DatasetQueryResult {
  items: unknown[];
  total: number;
}

/**
 * Dataset filter config
 */
export interface DatasetFilterConfig {
  minLength?: number;
  maxLength?: number;
  excludePatterns?: RegExp[];
  includePatterns?: RegExp[];
  customFilter?: (item: unknown) => boolean;
}

/**
 * Build options for preference dataset
 */
export interface PreferenceBuildOptions {
  minPairs?: number;
  maxPairs?: number;
  includeRejected?: boolean;
  filterFn?: (pair: PreferencePair) => boolean;
  deduplication?: 'none' | 'prompt' | 'exact';
}

/**
 * Build options for instruction dataset
 */
export interface InstructionBuildOptions {
  minExamples?: number;
  maxExamples?: number;
  includeSystemPrompt?: boolean;
  filterFn?: (example: InstructionExample) => boolean;
}

/**
 * Preference dataset interface
 */
export interface PreferenceDatasetInterface {
  readonly type: 'preference';
  readonly size: number;
  readonly stats: DatasetStats;
  getPairs(): PreferencePair[];
  filter(
    predicate: (pair: PreferencePair) => boolean,
  ): PreferenceDatasetInterface;
  sample(count: number): PreferenceDatasetInterface;
  split(
    ratio: number,
  ): [PreferenceDatasetInterface, PreferenceDatasetInterface];
  shuffle(seed?: number): PreferenceDatasetInterface;
}

/**
 * Dataset export options
 */
export interface DatasetExportOptions {
  format: DatasetExportFormat;
  path?: string;
  fields?: string[];
  // HuggingFace options
  repoName?: string;
  private?: boolean;
  token?: string;
  // Format-specific options
  formatOptions?: Record<string, unknown>;
}

/**
 * HuggingFace export options
 */
export interface HFExportOptions {
  name: string;
  private?: boolean;
  token?: string;
  readme?: string;
  license?: string;
  tags?: string[];
}

/**
 * Export result
 */
export interface ExportResult {
  format: DatasetExportFormat;
  path?: string;
  url?: string;
  itemCount: number;
  bytesWritten?: number;
  warnings?: string[];
}

/**
 * DPO format
 */
export interface DPOFormatItem {
  prompt: string;
  chosen: string;
  rejected: string;
}

/**
 * RLHF format
 */
export interface RLHFFormatItem {
  prompt: string;
  response: string;
  reward: number;
}

/**
 * SFT format
 */
export interface SFTFormatItem {
  instruction: string;
  input?: string;
  output: string;
}

/**
 * Anthropic format
 */
export interface AnthropicFormatItem {
  prompt: string;
  completion: string;
}

/**
 * OpenAI format
 */
export interface OpenAIFormatItem {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * Dataset validation result
 */
export interface DatasetValidationResult {
  valid: boolean;
  errors: DatasetValidationError[];
  warnings: DatasetValidationWarning[];
  stats: DatasetStats;
}

/**
 * Dataset validation error
 */
export interface DatasetValidationError {
  itemId: string;
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Dataset validation warning
 */
export interface DatasetValidationWarning {
  type: 'duplicate' | 'short' | 'long' | 'format' | 'quality';
  message: string;
  count: number;
  examples?: string[];
}

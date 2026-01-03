/**
 * Processing Module
 *
 * Export memory processing utilities.
 */

export {
  Summarizer,
  createSummarizer,
  type SummaryResult,
  type SummaryFunction,
} from './Summarizer.js';

export {
  Compressor,
  createCompressor,
  type CompressionResult,
  type BatchCompressionResult,
} from './Compressor.js';

export {
  Consolidator,
  createConsolidator,
  type ConsolidationGroup,
  type ConsolidationResult,
} from './Consolidator.js';

export {
  Forgetter,
  createForgetter,
  type ForgettingCurve,
  type RetentionScore,
  type ForgettingResult,
} from './Forgetter.js';

export {
  Extractor,
  createExtractor,
  type ExtractedEntity,
  type ExtractedRelation,
  type ExtractionResult,
  type ExtractionFunction,
} from './Extractor.js';

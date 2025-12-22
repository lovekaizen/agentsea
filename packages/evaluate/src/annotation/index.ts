/**
 * Annotation Module
 *
 * Export all annotation components.
 */

export {
  AnnotationTask,
  createAnnotationTask,
  BinaryClassificationSchema,
  QualityRatingSchema,
  TextSpanSchema,
} from './AnnotationTask.js';

export { AnnotationQueue, createAnnotationQueue } from './AnnotationQueue.js';

export {
  ConsensusManager,
  createConsensusManager,
} from './ConsensusManager.js';

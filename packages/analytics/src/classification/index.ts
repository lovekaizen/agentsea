/**
 * Classification Module
 *
 * Exports classification classes for intent, sentiment, and topic analysis.
 */

export {
  IntentClassifier,
  type IntentClassifierEvents,
} from './IntentClassifier.js';

export {
  SentimentAnalyzer,
  type SentimentAnalyzerEvents,
} from './SentimentAnalyzer.js';

export {
  TopicClassifier,
  type TopicClassifierEvents,
} from './TopicClassifier.js';

export {
  TaxonomyManager,
  type TaxonomyManagerEvents,
} from './TaxonomyManager.js';

/**
 * @lov3kaizen/agentsea-evaluate
 *
 * Comprehensive feedback collection and LLM evaluation platform for Node.js.
 *
 * Features:
 * - Feedback collection (thumbs, rating, preference, correction, multi-criteria)
 * - LLM evaluation metrics (accuracy, relevance, coherence, toxicity, faithfulness)
 * - LLM-as-judge (LLM judge, rubric judge, comparative judge, consensus judge)
 * - Evaluation pipelines with parallel execution
 * - Preference dataset building for DPO/RLHF
 * - Human annotation workflows
 * - Continuous evaluation and A/B testing
 * - AgentSea integration
 */

// Types
export * from './types/index.js';

// Feedback module
export * from './feedback/index.js';

// Evaluation module
export * from './evaluation/index.js';

// Datasets module
export * from './datasets/index.js';

// Annotation module
export * from './annotation/index.js';

// Continuous evaluation module
export * from './continuous/index.js';

// Integrations
export * from './integrations/agentsea/index.js';

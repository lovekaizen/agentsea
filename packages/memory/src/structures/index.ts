/**
 * Memory Structures
 *
 * Export memory structure implementations.
 */

export {
  WorkingMemory,
  createWorkingMemory,
  type WorkingMemoryEvents,
  type AttentionScore,
} from './WorkingMemory.js';

export {
  EpisodicMemory,
  createEpisodicMemory,
  type Episode,
  type EpisodicMemoryEvents,
} from './EpisodicMemory.js';

export {
  SemanticMemory,
  createSemanticMemory,
  type Concept,
  type Relationship,
  type SemanticMemoryEvents,
} from './SemanticMemory.js';

export {
  LongTermMemory,
  createLongTermMemory,
  type ConsolidatedMemory,
  type LongTermMemoryEvents,
} from './LongTermMemory.js';

export {
  HierarchicalMemory,
  createHierarchicalMemory,
  type MemoryLayer,
  type RoutingDecision,
  type HierarchicalMemoryEvents,
  type HierarchicalSearchResult,
} from './HierarchicalMemory.js';

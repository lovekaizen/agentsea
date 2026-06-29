/**
 * Importance Scoring Utilities
 *
 * Functions for calculating memory importance.
 */

import type {
  MemoryEntry,
  MemoryType,
  MemoryMetadata,
  ImportanceCalculator,
} from '../types/index.js';

/**
 * Default importance weights by type
 */
export const DEFAULT_TYPE_WEIGHTS: Record<MemoryType, number> = {
  fact: 0.85,
  preference: 0.9,
  event: 0.6,
  context: 0.5,
  summary: 0.7,
  entity: 0.75,
  relation: 0.75,
  conversation: 0.4,
  custom: 0.5,
};

/**
 * Calculate importance with recency decay
 */
export function calculateImportanceWithRecency(
  memory: MemoryEntry,
  halfLifeMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days
): number {
  const age = Date.now() - memory.timestamp;
  const recencyFactor = Math.exp(-age / halfLifeMs);
  const recencyBoost = 0.5 + 0.5 * recencyFactor;

  return Math.min(memory.importance * recencyBoost, 1);
}

/**
 * Calculate importance with access frequency
 */
export function calculateImportanceWithAccess(
  memory: MemoryEntry,
  maxAccessBoost: number = 0.3,
): number {
  const accessFactor = Math.min(memory.accessCount / 10, 1);
  const accessBoost = 1 + accessFactor * maxAccessBoost;

  return Math.min(memory.importance * accessBoost, 1);
}

/**
 * Calculate importance with context relevance
 */
export function calculateImportanceWithContext(
  memory: MemoryEntry,
  context: {
    userId?: string;
    agentId?: string;
    conversationId?: string;
  },
): number {
  let contextMultiplier = 1;

  // Boost if memory belongs to current user
  if (context.userId && memory.metadata.userId === context.userId) {
    contextMultiplier *= 1.2;
  }

  // Boost if memory is from current conversation
  if (
    context.conversationId &&
    memory.metadata.conversationId === context.conversationId
  ) {
    contextMultiplier *= 1.3;
  }

  return Math.min(memory.importance * contextMultiplier, 1);
}

/**
 * Combined importance calculator
 */
export function calculateCombinedImportance(
  memory: MemoryEntry,
  options: {
    recencyHalfLifeMs?: number;
    maxAccessBoost?: number;
    context?: {
      userId?: string;
      agentId?: string;
      conversationId?: string;
    };
    weights?: {
      base?: number;
      recency?: number;
      access?: number;
      context?: number;
    };
  } = {},
): number {
  const weights = {
    base: 0.4,
    recency: 0.3,
    access: 0.15,
    context: 0.15,
    ...options.weights,
  };

  const baseScore = memory.importance;
  const recencyScore = calculateImportanceWithRecency(
    memory,
    options.recencyHalfLifeMs,
  );
  const accessScore = calculateImportanceWithAccess(
    memory,
    options.maxAccessBoost,
  );
  const contextScore = options.context
    ? calculateImportanceWithContext(memory, options.context)
    : memory.importance;

  const combined =
    baseScore * weights.base +
    recencyScore * weights.recency +
    accessScore * weights.access +
    contextScore * weights.context;

  return Math.min(
    combined /
      (weights.base + weights.recency + weights.access + weights.context),
    1,
  );
}

/**
 * Create a custom importance calculator
 */
export function createImportanceCalculator(options: {
  typeWeights?: Partial<Record<MemoryType, number>>;
  sourceMultipliers?: Record<string, number>;
  confidenceWeight?: number;
}): ImportanceCalculator {
  const typeWeights = { ...DEFAULT_TYPE_WEIGHTS, ...options.typeWeights };
  const sourceMultipliers = {
    explicit: 1.1,
    inferred: 1.0,
    extracted: 0.9,
    system: 0.8,
    agent: 1.0,
    ...options.sourceMultipliers,
  };
  const confidenceWeight = options.confidenceWeight ?? 0.5;

  return (
    content: string,
    type: MemoryType,
    metadata: MemoryMetadata,
  ): number => {
    let importance = typeWeights[type] ?? 0.5;

    // Apply confidence
    if (metadata.confidence !== undefined) {
      importance *=
        1 - confidenceWeight + confidenceWeight * metadata.confidence;
    }

    // Apply source multiplier
    const sourceMultiplier = sourceMultipliers[metadata.source] ?? 1;
    importance *= sourceMultiplier;

    // Length heuristic (very short or very long content may be less important)
    const contentLength = content.length;
    if (contentLength < 10) {
      importance *= 0.7;
    } else if (contentLength > 5000) {
      importance *= 0.9;
    }

    return Math.min(Math.max(importance, 0), 1);
  };
}

/**
 * Categorize importance level
 */
export function categorizeImportance(
  score: number,
): 'critical' | 'high' | 'medium' | 'low' | 'trivial' {
  if (score >= 0.9) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  if (score >= 0.3) return 'low';
  return 'trivial';
}

/**
 * Filter memories by importance threshold
 */
export function filterByImportance(
  memories: MemoryEntry[],
  threshold: number,
): MemoryEntry[] {
  return memories.filter((m) => m.importance >= threshold);
}

/**
 * Sort memories by importance
 */
export function sortByImportance(
  memories: MemoryEntry[],
  descending: boolean = true,
): MemoryEntry[] {
  const sorted = [...memories].sort((a, b) => a.importance - b.importance);
  return descending ? sorted.reverse() : sorted;
}

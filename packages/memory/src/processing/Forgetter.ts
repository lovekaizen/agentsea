/**
 * Forgetter
 *
 * Implements forgetting curves and memory decay for realistic memory behavior.
 */

import type {
  MemoryEntry,
  ForgetterConfig,
  MemoryStoreInterface,
} from '../types/index.js';

/**
 * Forgetting curve type
 */
export type ForgettingCurve = 'exponential' | 'power' | 'ebbinghaus';

/**
 * Retention score for a memory
 */
export interface RetentionScore {
  entryId: string;
  retention: number; // 0-1
  ageMs: number;
  accessCount: number;
  importance: number;
  shouldForget: boolean;
}

/**
 * Forgetting result
 */
export interface ForgettingResult {
  forgotten: string[];
  decayed: Array<{ id: string; oldImportance: number; newImportance: number }>;
  retained: string[];
  avgRetention: number;
}

/**
 * Memory forgetter with configurable decay
 */
export class Forgetter {
  private config: Required<ForgetterConfig>;

  constructor(config: ForgetterConfig = {}) {
    this.config = {
      retentionPolicy: config.retentionPolicy ?? {},
      importanceThreshold: config.importanceThreshold ?? 0.3,
      maxAge: config.maxAge ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      preserveTypes: config.preserveTypes ?? [],
      curve: config.curve ?? 'exponential',
      halfLife: config.halfLife ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      minRetention: config.minRetention ?? 0.1,
      accessBoost: config.accessBoost ?? 0.1,
      importanceWeight: config.importanceWeight ?? 0.5,
      forgetThreshold: config.forgetThreshold ?? 0.05,
    };
  }

  /**
   * Calculate retention score for a memory
   */
  calculateRetention(
    entry: MemoryEntry,
    now: number = Date.now(),
  ): RetentionScore {
    const ageMs = now - entry.timestamp;
    const baseRetention = this.calculateBaseRetention(ageMs);

    // Boost for access frequency
    const accessBoost = Math.min(
      entry.accessCount * this.config.accessBoost,
      0.5,
    );

    // Weight by importance
    const importanceBoost = entry.importance * this.config.importanceWeight;

    // Combined retention
    let retention = baseRetention + accessBoost + importanceBoost;

    // Apply minimum retention for important memories
    if (entry.importance >= 0.8) {
      retention = Math.max(retention, 0.5);
    }

    retention = Math.min(Math.max(retention, this.config.minRetention), 1);

    return {
      entryId: entry.id,
      retention,
      ageMs,
      accessCount: entry.accessCount,
      importance: entry.importance,
      shouldForget: retention < this.config.forgetThreshold,
    };
  }

  /**
   * Calculate base retention using the configured curve
   */
  private calculateBaseRetention(ageMs: number): number {
    const halfLife = this.config.halfLife;

    switch (this.config.curve) {
      case 'exponential':
        // R = e^(-λt) where λ = ln(2) / halfLife
        return Math.exp((-Math.LN2 * ageMs) / halfLife);

      case 'power': {
        // R = (1 + t/c)^(-b) where c and b are constants
        const c = halfLife;
        const b = 0.5;
        return Math.pow(1 + ageMs / c, -b);
      }

      case 'ebbinghaus': {
        // R = e^(-t/S) where S is stability (proportional to repetitions)
        // Simplified version
        const stability = halfLife;
        return Math.exp(-ageMs / stability);
      }

      default:
        return Math.exp((-Math.LN2 * ageMs) / halfLife);
    }
  }

  /**
   * Apply forgetting to memories in a store
   */
  async applyForgetting(
    store: MemoryStoreInterface,
  ): Promise<ForgettingResult> {
    const { entries } = await store.query({ limit: 10000 });
    const now = Date.now();

    const forgotten: string[] = [];
    const decayed: Array<{
      id: string;
      oldImportance: number;
      newImportance: number;
    }> = [];
    const retained: string[] = [];
    let totalRetention = 0;

    for (const entry of entries) {
      const score = this.calculateRetention(entry, now);
      totalRetention += score.retention;

      if (score.shouldForget) {
        // Delete the memory
        await store.delete(entry.id);
        forgotten.push(entry.id);
      } else if (score.retention < 0.5 && entry.importance > 0.3) {
        // Decay importance for low-retention memories
        const newImportance = Math.max(
          entry.importance * score.retention,
          this.config.minRetention,
        );

        if (newImportance < entry.importance) {
          await store.update(entry.id, { importance: newImportance });
          decayed.push({
            id: entry.id,
            oldImportance: entry.importance,
            newImportance,
          });
        }
        retained.push(entry.id);
      } else {
        retained.push(entry.id);
      }
    }

    return {
      forgotten,
      decayed,
      retained,
      avgRetention: entries.length > 0 ? totalRetention / entries.length : 1,
    };
  }

  /**
   * Simulate forgetting over time (for testing/visualization)
   */
  simulateForgetting(
    entries: MemoryEntry[],
    timePeriodMs: number,
    steps: number = 10,
  ): Array<{ time: number; avgRetention: number; forgottenCount: number }> {
    const results: Array<{
      time: number;
      avgRetention: number;
      forgottenCount: number;
    }> = [];
    const stepMs = timePeriodMs / steps;
    const baseTime = Date.now();

    for (let i = 0; i <= steps; i++) {
      const simulatedNow = baseTime + i * stepMs;
      let totalRetention = 0;
      let forgottenCount = 0;

      for (const entry of entries) {
        const score = this.calculateRetention(entry, simulatedNow);
        totalRetention += score.retention;
        if (score.shouldForget) forgottenCount++;
      }

      results.push({
        time: i * stepMs,
        avgRetention: entries.length > 0 ? totalRetention / entries.length : 1,
        forgottenCount,
      });
    }

    return results;
  }

  /**
   * Get memories at risk of being forgotten
   */
  async getAtRiskMemories(
    store: MemoryStoreInterface,
    threshold: number = 0.2,
  ): Promise<Array<{ entry: MemoryEntry; retention: number }>> {
    const { entries } = await store.query({ limit: 1000 });
    const now = Date.now();

    const atRisk: Array<{ entry: MemoryEntry; retention: number }> = [];

    for (const entry of entries) {
      const score = this.calculateRetention(entry, now);
      if (
        score.retention < threshold &&
        score.retention >= this.config.forgetThreshold
      ) {
        atRisk.push({ entry, retention: score.retention });
      }
    }

    return Promise.resolve(atRisk.sort((a, b) => a.retention - b.retention));
  }

  /**
   * Reinforce a memory (simulate rehearsal)
   */
  async reinforce(
    store: MemoryStoreInterface,
    id: string,
    boost: number = 0.2,
  ): Promise<boolean> {
    const entry = await store.get(id);
    if (!entry) return false;

    const newImportance = Math.min(entry.importance + boost, 1);
    return store.update(id, {
      importance: newImportance,
      lastAccessedAt: Date.now(),
    });
  }

  /**
   * Batch reinforce multiple memories
   */
  async reinforceBatch(
    store: MemoryStoreInterface,
    ids: string[],
    boost: number = 0.1,
  ): Promise<number> {
    let count = 0;
    for (const id of ids) {
      if (await this.reinforce(store, id, boost)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate optimal review schedule for a memory
   */
  calculateReviewSchedule(
    entry: MemoryEntry,
    targetRetention: number = 0.8,
  ): number[] {
    // Spaced repetition intervals
    const baseInterval = this.config.halfLife / 10;
    const intervals: number[] = [];

    let _currentInterval = baseInterval;
    let simulatedTime = 0;
    const maxReviews = 10;

    for (let i = 0; i < maxReviews; i++) {
      // Find when retention drops below target
      let retention = 1;
      let checkTime = simulatedTime;

      while (retention > targetRetention) {
        checkTime += baseInterval / 10;
        const ageMs = checkTime - entry.timestamp;
        retention = this.calculateBaseRetention(ageMs);
      }

      intervals.push(checkTime);
      simulatedTime = checkTime;
      _currentInterval *= 2; // Increase interval each time
    }

    return intervals;
  }

  /**
   * Get statistics about memory retention
   */
  async getRetentionStats(store: MemoryStoreInterface): Promise<{
    avgRetention: number;
    atRiskCount: number;
    forgettableCount: number;
    healthyCount: number;
    distribution: Record<string, number>;
  }> {
    const { entries } = await store.query({ limit: 10000 });
    const now = Date.now();

    let totalRetention = 0;
    let atRiskCount = 0;
    let forgettableCount = 0;
    let healthyCount = 0;
    const distribution: Record<string, number> = {
      '0-20%': 0,
      '20-40%': 0,
      '40-60%': 0,
      '60-80%': 0,
      '80-100%': 0,
    };

    for (const entry of entries) {
      const score = this.calculateRetention(entry, now);
      totalRetention += score.retention;

      if (score.shouldForget) {
        forgettableCount++;
      } else if (score.retention < 0.3) {
        atRiskCount++;
      } else {
        healthyCount++;
      }

      // Distribution
      if (score.retention < 0.2) distribution['0-20%']++;
      else if (score.retention < 0.4) distribution['20-40%']++;
      else if (score.retention < 0.6) distribution['40-60%']++;
      else if (score.retention < 0.8) distribution['60-80%']++;
      else distribution['80-100%']++;
    }

    return {
      avgRetention: entries.length > 0 ? totalRetention / entries.length : 1,
      atRiskCount,
      forgettableCount,
      healthyCount,
      distribution,
    };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ForgetterConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create forgetter instance
 */
export function createForgetter(config?: ForgetterConfig): Forgetter {
  return new Forgetter(config);
}

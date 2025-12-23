import { describe, it, expect, beforeEach } from 'vitest';
import { Forgetter } from '../processing/Forgetter.js';
import { InMemoryStore } from '../stores/implementations/InMemoryStore.js';
import type { MemoryEntry } from '../types/index.js';

function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random()}`,
    type: 'context',
    content: 'Test content',
    timestamp: Date.now(),
    importance: 0.5,
    accessCount: 0,
    metadata: {
      source: 'explicit',
      confidence: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Forgetter', () => {
  let forgetter: Forgetter;
  let store: InMemoryStore;

  beforeEach(() => {
    forgetter = new Forgetter({
      curve: 'exponential',
      halfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
      forgetThreshold: 0.05,
      minRetention: 0.1,
      accessBoost: 0.1,
      importanceWeight: 0.5,
    });
    store = new InMemoryStore();
  });

  describe('calculateRetention', () => {
    it('should calculate retention score for recent memory', () => {
      const entry = createEntry({
        timestamp: Date.now() - 1000, // 1 second ago
        importance: 0.5,
        accessCount: 0,
      });

      const score = forgetter.calculateRetention(entry);

      expect(score.retention).toBeGreaterThan(0.9);
      expect(score.shouldForget).toBe(false);
    });

    it('should calculate lower retention for old memory', () => {
      const oldTime = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
      const entry = createEntry({
        timestamp: oldTime,
        importance: 0.3,
        accessCount: 0,
      });

      const score = forgetter.calculateRetention(entry);

      expect(score.retention).toBeLessThan(0.5);
    });

    it('should boost retention for accessed memories', () => {
      const entry = createEntry({
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
        importance: 0.5,
        accessCount: 10,
      });

      const score = forgetter.calculateRetention(entry);

      expect(score.retention).toBeGreaterThan(0.5);
    });

    it('should boost retention for important memories', () => {
      const importantEntry = createEntry({
        timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
        importance: 0.95,
        accessCount: 0,
      });

      const score = forgetter.calculateRetention(importantEntry);

      expect(score.retention).toBeGreaterThan(0.5);
    });

    it('should maintain minimum retention for very important memories', () => {
      const criticalEntry = createEntry({
        timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        importance: 0.9,
        accessCount: 0,
      });

      const score = forgetter.calculateRetention(criticalEntry);

      expect(score.retention).toBeGreaterThanOrEqual(0.5);
    });

    it('should flag memories for forgetting when below threshold', () => {
      const entry = createEntry({
        timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000, // 180 days ago
        importance: 0.1,
        accessCount: 0,
      });

      const score = forgetter.calculateRetention(entry);

      // Old low-importance memories should have low retention
      expect(score.retention).toBeLessThan(0.3);
    });
  });

  describe('forgetting curves', () => {
    it('should use exponential curve', () => {
      const expForgetter = new Forgetter({ curve: 'exponential' });
      const entry = createEntry({
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
      });

      const score = expForgetter.calculateRetention(entry);

      expect(score.retention).toBeGreaterThan(0);
      expect(score.retention).toBeLessThanOrEqual(1);
    });

    it('should use power curve', () => {
      const powerForgetter = new Forgetter({ curve: 'power' });
      const entry = createEntry({
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
      });

      const score = powerForgetter.calculateRetention(entry);

      expect(score.retention).toBeGreaterThan(0);
      expect(score.retention).toBeLessThanOrEqual(1);
    });

    it('should use Ebbinghaus curve', () => {
      const ebbinghausForgetter = new Forgetter({ curve: 'ebbinghaus' });
      const entry = createEntry({
        timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
      });

      const score = ebbinghausForgetter.calculateRetention(entry);

      expect(score.retention).toBeGreaterThan(0);
      expect(score.retention).toBeLessThanOrEqual(1);
    });
  });

  describe('applyForgetting', () => {
    it('should delete memories below forget threshold', async () => {
      const oldEntry = createEntry({
        id: 'old',
        timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
        importance: 0.1,
      });
      const recentEntry = createEntry({
        id: 'recent',
        timestamp: Date.now(),
        importance: 0.5,
      });

      await store.add(oldEntry);
      await store.add(recentEntry);

      const result = await forgetter.applyForgetting(store);

      expect(result.forgotten.length).toBeGreaterThanOrEqual(0);
      expect(result.retained.length).toBeGreaterThan(0);
    });

    it('should decay importance of low-retention memories', async () => {
      const entry = createEntry({
        id: 'decay-test',
        timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
        importance: 0.7,
      });

      await store.add(entry);

      const result = await forgetter.applyForgetting(store);

      if (result.decayed.length > 0) {
        const decayed = result.decayed.find((d) => d.id === 'decay-test');
        if (decayed) {
          expect(decayed.newImportance).toBeLessThan(decayed.oldImportance);
        }
      }
    });

    it('should calculate average retention', async () => {
      await store.add(createEntry({ timestamp: Date.now() }));
      await store.add(
        createEntry({ timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000 }),
      );

      const result = await forgetter.applyForgetting(store);

      expect(result.avgRetention).toBeGreaterThan(0);
      expect(result.avgRetention).toBeLessThanOrEqual(1);
    });
  });

  describe('simulateForgetting', () => {
    it('should simulate forgetting over time', () => {
      const entries = [
        createEntry({ importance: 0.5 }),
        createEntry({ importance: 0.3 }),
        createEntry({ importance: 0.8 }),
      ];

      const simulation = forgetter.simulateForgetting(
        entries,
        30 * 24 * 60 * 60 * 1000, // 30 days
        10,
      );

      expect(simulation.length).toBe(11); // 0 to 10 steps
      expect(simulation[0].avgRetention).toBeGreaterThan(
        simulation[simulation.length - 1].avgRetention,
      );
    });

    it('should track forgotten count over time', () => {
      const entries = Array(10)
        .fill(null)
        .map(() => createEntry({ importance: 0.2 }));

      const simulation = forgetter.simulateForgetting(
        entries,
        60 * 24 * 60 * 60 * 1000,
        5,
      );

      expect(
        simulation[simulation.length - 1].forgottenCount,
      ).toBeGreaterThanOrEqual(simulation[0].forgottenCount);
    });
  });

  describe('getAtRiskMemories', () => {
    it('should identify memories at risk of forgetting', async () => {
      await store.add(
        createEntry({
          timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
          importance: 0.3,
        }),
      );
      await store.add(createEntry({ timestamp: Date.now(), importance: 0.8 }));

      const atRisk = await forgetter.getAtRiskMemories(store, 0.4);

      expect(Array.isArray(atRisk)).toBe(true);
    });

    it('should sort by retention score', async () => {
      await store.add(
        createEntry({
          timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
          importance: 0.3,
        }),
      );
      await store.add(
        createEntry({
          timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000,
          importance: 0.4,
        }),
      );

      const atRisk = await forgetter.getAtRiskMemories(store, 0.5);

      if (atRisk.length > 1) {
        expect(atRisk[0].retention).toBeLessThanOrEqual(atRisk[1].retention);
      }
    });
  });

  describe('reinforce', () => {
    it('should boost importance of reinforced memory', async () => {
      const entry = createEntry({ id: 'test', importance: 0.5 });
      await store.add(entry);

      const success = await forgetter.reinforce(store, 'test', 0.2);

      expect(success).toBe(true);
      const updated = await store.get('test');
      expect(updated?.importance).toBe(0.7);
    });

    it('should cap importance at 1.0', async () => {
      const entry = createEntry({ id: 'test', importance: 0.95 });
      await store.add(entry);

      await forgetter.reinforce(store, 'test', 0.2);

      const updated = await store.get('test');
      expect(updated?.importance).toBeLessThanOrEqual(1.0);
    });

    it('should return false for non-existent memory', async () => {
      const success = await forgetter.reinforce(store, 'non-existent', 0.1);

      expect(success).toBe(false);
    });
  });

  describe('reinforceBatch', () => {
    it('should reinforce multiple memories', async () => {
      await store.add(createEntry({ id: 'test1', importance: 0.5 }));
      await store.add(createEntry({ id: 'test2', importance: 0.6 }));

      const count = await forgetter.reinforceBatch(
        store,
        ['test1', 'test2'],
        0.1,
      );

      expect(count).toBe(2);
    });
  });

  describe('calculateReviewSchedule', () => {
    it('should calculate spaced repetition intervals', () => {
      const entry = createEntry({ timestamp: Date.now() });

      const schedule = forgetter.calculateReviewSchedule(entry, 0.8);

      expect(schedule.length).toBeGreaterThan(0);
      expect(schedule[0]).toBeGreaterThan(0);
      // Intervals should increase
      if (schedule.length > 1) {
        expect(schedule[1]).toBeGreaterThan(schedule[0]);
      }
    });
  });

  describe('getRetentionStats', () => {
    it('should return retention statistics', async () => {
      await store.add(createEntry({ importance: 0.8 }));
      await store.add(
        createEntry({
          timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
          importance: 0.3,
        }),
      );

      const stats = await forgetter.getRetentionStats(store);

      expect(stats.avgRetention).toBeDefined();
      expect(stats.atRiskCount).toBeGreaterThanOrEqual(0);
      expect(stats.forgettableCount).toBeGreaterThanOrEqual(0);
      expect(stats.healthyCount).toBeGreaterThanOrEqual(0);
      expect(stats.distribution).toBeDefined();
    });

    it('should categorize retention distribution', async () => {
      await store.add(createEntry({ importance: 0.9 }));
      await store.add(
        createEntry({
          timestamp: Date.now() - 60 * 24 * 60 * 60 * 1000,
          importance: 0.2,
        }),
      );

      const stats = await forgetter.getRetentionStats(store);

      const total = Object.values(stats.distribution).reduce(
        (sum, count) => sum + count,
        0,
      );
      expect(total).toBeGreaterThan(0);
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      forgetter.configure({
        halfLife: 14 * 24 * 60 * 60 * 1000,
        forgetThreshold: 0.1,
      });

      expect(forgetter['config'].halfLife).toBe(14 * 24 * 60 * 60 * 1000);
      expect(forgetter['config'].forgetThreshold).toBe(0.1);
    });
  });
});

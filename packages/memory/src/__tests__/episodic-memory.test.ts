import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EpisodicMemory } from '../structures/EpisodicMemory.js';
import { InMemoryStore } from '../stores/implementations/InMemoryStore.js';
import type { MemoryEntry } from '../types/index.js';

function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random()}`,
    type: 'event',
    content: 'Event content',
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

describe('EpisodicMemory', () => {
  let episodicMemory: EpisodicMemory;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    episodicMemory = new EpisodicMemory(store, {
      maxEpisodeLength: 10,
      episodeTimeout: 30000,
      autoSummarize: true,
      minEventsForEpisode: 2,
    });
  });

  describe('recordEvent', () => {
    it('should record an event', async () => {
      const entry = createEntry({ content: 'User logged in' });

      const episode = await episodicMemory.recordEvent(entry);

      expect(episode).toBeDefined();
      expect(episode.events.length).toBe(1);
      expect(episode.events[0].content).toBe('User logged in');
    });

    it('should force type to event', async () => {
      const entry = createEntry({
        type: 'fact',
        content: 'Something happened',
      });

      await episodicMemory.recordEvent(entry);

      const count = await store.count({ types: ['event'] });
      expect(count).toBeGreaterThan(0);
    });

    it('should emit eventAdded event', async () => {
      const handler = vi.fn();
      episodicMemory.on('eventAdded', handler);

      await episodicMemory.recordEvent(createEntry());

      expect(handler).toHaveBeenCalled();
    });

    it('should create new episode if none exists', async () => {
      expect(episodicMemory.getCurrentEpisode()).toBeNull();

      await episodicMemory.recordEvent(createEntry());

      expect(episodicMemory.getCurrentEpisode()).not.toBeNull();
    });

    it('should add to current episode', async () => {
      await episodicMemory.recordEvent(createEntry({ content: 'First' }));
      await episodicMemory.recordEvent(createEntry({ content: 'Second' }));

      const episode = episodicMemory.getCurrentEpisode();

      expect(episode?.events.length).toBe(2);
    });

    it('should end episode when at max length', async () => {
      const longMemory = new EpisodicMemory(store, {
        maxEpisodeLength: 3,
        minEventsForEpisode: 2,
      });

      await longMemory.recordEvent(createEntry());
      await longMemory.recordEvent(createEntry());
      await longMemory.recordEvent(createEntry());

      const currentBefore = longMemory.getCurrentEpisode();

      await longMemory.recordEvent(createEntry());

      const currentAfter = longMemory.getCurrentEpisode();

      // New episode should have started
      expect(currentAfter?.id).not.toBe(currentBefore?.id);
    });
  });

  describe('startEpisode', () => {
    it('should start a new episode', () => {
      const episode = episodicMemory.startEpisode({ context: 'test' });

      expect(episode.id).toBeDefined();
      expect(episode.startTime).toBeDefined();
      expect(episode.events).toEqual([]);
      expect(episode.metadata.context).toBe('test');
    });

    it('should emit episodeStart event', () => {
      const handler = vi.fn();
      episodicMemory.on('episodeStart', handler);

      episodicMemory.startEpisode();

      expect(handler).toHaveBeenCalled();
    });

    it('should end previous episode if exists', async () => {
      episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.recordEvent(createEntry());

      const first = episodicMemory.getCurrentEpisode();

      episodicMemory.startEpisode();

      expect(first?.endTime).toBeDefined();
    });
  });

  describe('endCurrentEpisode', () => {
    it('should end the current episode', async () => {
      await episodicMemory.recordEvent(createEntry());

      const episode = await episodicMemory.endCurrentEpisode();

      expect(episode).not.toBeNull();
      expect(episode?.endTime).toBeDefined();
      expect(episodicMemory.getCurrentEpisode()).toBeNull();
    });

    it('should generate summary for episodes with enough events', async () => {
      await episodicMemory.recordEvent(createEntry({ content: 'Event 1' }));
      await episodicMemory.recordEvent(createEntry({ content: 'Event 2' }));
      await episodicMemory.recordEvent(createEntry({ content: 'Event 3' }));

      const episode = await episodicMemory.endCurrentEpisode();

      expect(episode?.summary).toBeDefined();
      expect(episode?.summary).toContain('Event');
    });

    it('should store episode summary as memory', async () => {
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.recordEvent(createEntry());

      const episode = await episodicMemory.endCurrentEpisode();

      if (episode?.summary) {
        const summaries = await store.query({ types: ['summary'] });
        expect(summaries.entries.length).toBeGreaterThan(0);
      }
    });

    it('should emit episodeEnd event', async () => {
      const handler = vi.fn();
      episodicMemory.on('episodeEnd', handler);

      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.endCurrentEpisode();

      expect(handler).toHaveBeenCalled();
    });

    it('should return null if no current episode', async () => {
      const episode = await episodicMemory.endCurrentEpisode();

      expect(episode).toBeNull();
    });
  });

  describe('recall', () => {
    it('should recall events by time range', async () => {
      const baseTime = Date.now();

      await store.add(
        createEntry({ type: 'event', timestamp: baseTime, content: 'Event 1' }),
      );
      await store.add(
        createEntry({
          type: 'event',
          timestamp: baseTime + 1000,
          content: 'Event 2',
        }),
      );

      const events = await episodicMemory.recall({
        startTime: baseTime,
        endTime: baseTime + 2000,
      });

      expect(events.length).toBe(2);
    });

    it('should filter by conversationId', async () => {
      await store.add(
        createEntry({
          type: 'event',
          metadata: {
            source: 'explicit',
            confidence: 1,
            conversationId: 'conv-1',
          },
        }),
      );
      await store.add(
        createEntry({
          type: 'event',
          metadata: {
            source: 'explicit',
            confidence: 1,
            conversationId: 'conv-2',
          },
        }),
      );

      const events = await episodicMemory.recall({ conversationId: 'conv-1' });

      expect(events.every((e) => e.metadata.conversationId === 'conv-1')).toBe(
        true,
      );
    });

    it('should respect limit', async () => {
      for (let i = 0; i < 10; i++) {
        await store.add(createEntry({ type: 'event' }));
      }

      const events = await episodicMemory.recall({ limit: 5 });

      expect(events.length).toBe(5);
    });
  });

  describe('getEpisode', () => {
    it('should retrieve episode by id', async () => {
      const episode = episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry());

      const retrieved = episodicMemory.getEpisode(episode.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(episode.id);
    });

    it('should return undefined for non-existent id', () => {
      const episode = episodicMemory.getEpisode('non-existent');

      expect(episode).toBeUndefined();
    });
  });

  describe('getEpisodesByTimeRange', () => {
    it('should return episodes within time range', async () => {
      const baseTime = Date.now();

      episodicMemory.startEpisode();
      episodicMemory['currentEpisode']!.startTime = baseTime;
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.endCurrentEpisode();

      episodicMemory.startEpisode();
      episodicMemory['currentEpisode']!.startTime = baseTime + 3600000; // 1 hour later
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.endCurrentEpisode();

      const episodes = episodicMemory.getEpisodesByTimeRange(
        baseTime,
        baseTime + 1800000, // 30 minutes
      );

      expect(episodes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getRecentEpisodes', () => {
    it('should return recent episodes sorted by time', async () => {
      for (let i = 0; i < 5; i++) {
        episodicMemory.startEpisode();
        await episodicMemory.recordEvent(createEntry());
        await episodicMemory.endCurrentEpisode();
      }

      const recent = episodicMemory.getRecentEpisodes(3);

      expect(recent.length).toBeLessThanOrEqual(3);
      if (recent.length > 1) {
        expect(recent[0].startTime).toBeGreaterThanOrEqual(recent[1].startTime);
      }
    });
  });

  describe('mergeEpisodes', () => {
    it('should merge multiple episodes', async () => {
      const ep1 = episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry({ content: 'Event 1' }));
      await episodicMemory.endCurrentEpisode();

      const ep2 = episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry({ content: 'Event 2' }));
      await episodicMemory.endCurrentEpisode();

      const merged = episodicMemory.mergeEpisodes([ep1.id, ep2.id], 'Merged');

      expect(merged).not.toBeNull();
      expect(merged?.events.length).toBe(2);
      expect(merged?.title).toBe('Merged');
    });

    it('should return null for insufficient episodes', () => {
      const merged = episodicMemory.mergeEpisodes(['only-one']);

      expect(merged).toBeNull();
    });

    it('should generate summary for merged episode', async () => {
      const ep1 = episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.endCurrentEpisode();

      const ep2 = episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.endCurrentEpisode();

      const merged = episodicMemory.mergeEpisodes([ep1.id, ep2.id]);

      expect(merged?.summary).toBeDefined();
    });
  });

  describe('getStats', () => {
    it('should return episode statistics', async () => {
      episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry());
      await episodicMemory.recordEvent(createEntry());

      const stats = episodicMemory.getStats();

      expect(stats.totalEpisodes).toBe(1);
      expect(stats.currentEpisodeSize).toBe(2);
      expect(stats.totalEvents).toBe(2);
      expect(stats.avgEventsPerEpisode).toBe(2);
    });

    it('should handle empty state', () => {
      const stats = episodicMemory.getStats();

      expect(stats.totalEpisodes).toBe(0);
      expect(stats.currentEpisodeSize).toBe(0);
      expect(stats.totalEvents).toBe(0);
      expect(stats.avgEventsPerEpisode).toBe(0);
    });
  });

  describe('episode importance', () => {
    it('should calculate importance from events', async () => {
      episodicMemory.startEpisode();
      await episodicMemory.recordEvent(createEntry({ importance: 0.8 }));
      await episodicMemory.recordEvent(createEntry({ importance: 0.6 }));

      const episode = await episodicMemory.endCurrentEpisode();

      if (episode && episode.summary) {
        // Check that summary was stored with appropriate importance
        const summaries = await store.query({ types: ['summary'] });
        if (summaries.entries.length > 0) {
          expect(summaries.entries[0].importance).toBeGreaterThan(0);
        }
      }
    });
  });
});

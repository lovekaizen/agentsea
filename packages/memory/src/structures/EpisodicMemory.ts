/**
 * EpisodicMemory
 *
 * Stores autobiographical events, experiences, and interactions.
 * Supports temporal organization and context-based retrieval.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  EpisodicMemoryConfig,
  MemoryStoreInterface,
} from '../types/index.js';

/**
 * Episode - a coherent sequence of related events
 */
export interface Episode {
  id: string;
  title?: string;
  startTime: number;
  endTime?: number;
  events: MemoryEntry[];
  summary?: string;
  participants?: string[];
  location?: string;
  emotionalContext?: string;
  metadata: Record<string, unknown>;
}

/**
 * Episodic memory events
 */
export interface EpisodicMemoryEvents {
  episodeStart: (episode: Episode) => void;
  episodeEnd: (episode: Episode) => void;
  eventAdded: (event: MemoryEntry, episode: Episode) => void;
}

/**
 * Episodic memory for experiences and events
 */
export class EpisodicMemory extends EventEmitter<EpisodicMemoryEvents> {
  private store: MemoryStoreInterface;
  private config: Required<EpisodicMemoryConfig>;
  private episodes: Map<string, Episode> = new Map();
  private currentEpisode: Episode | null = null;
  private episodeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(store: MemoryStoreInterface, config: EpisodicMemoryConfig = {}) {
    super();
    this.store = store;
    this.config = {
      store: config.store ?? store,
      consolidateAfter: config.consolidateAfter ?? 24 * 60 * 60 * 1000, // 24 hours
      summarizeThreshold: config.summarizeThreshold ?? 10,
      retentionDays: config.retentionDays ?? 90,
      maxEpisodeLength: config.maxEpisodeLength ?? 50,
      episodeTimeout: config.episodeTimeout ?? 30 * 60 * 1000, // 30 minutes
      autoSummarize: config.autoSummarize ?? true,
      minEventsForEpisode: config.minEventsForEpisode ?? 3,
      emotionTracking: config.emotionTracking ?? false,
    };
  }

  /**
   * Record an event
   */
  async recordEvent(entry: MemoryEntry): Promise<Episode> {
    // Ensure event type
    const eventEntry: MemoryEntry = {
      ...entry,
      type: 'event',
    };

    // Store the event
    await this.store.add(eventEntry);

    // Get or create episode
    let episode = this.currentEpisode;
    if (!episode) {
      episode = this.startEpisode();
    }

    // Add to current episode
    episode.events.push(eventEntry);

    // Reset timeout
    this.resetEpisodeTimeout();

    // Check if episode is full
    if (episode.events.length >= this.config.maxEpisodeLength) {
      await this.endCurrentEpisode();
    }

    this.emit('eventAdded', eventEntry, episode);
    return episode;
  }

  /**
   * Start a new episode
   */
  startEpisode(metadata?: Record<string, unknown>): Episode {
    if (this.currentEpisode) {
      void this.endCurrentEpisode();
    }

    const episode: Episode = {
      id: this.generateId(),
      startTime: Date.now(),
      events: [],
      metadata: metadata ?? {},
    };

    this.currentEpisode = episode;
    this.episodes.set(episode.id, episode);
    this.emit('episodeStart', episode);

    return episode;
  }

  /**
   * End the current episode
   */
  async endCurrentEpisode(): Promise<Episode | null> {
    if (!this.currentEpisode) return null;

    const episode = this.currentEpisode;
    episode.endTime = Date.now();

    // Generate summary if configured
    if (
      this.config.autoSummarize &&
      episode.events.length >= this.config.minEventsForEpisode
    ) {
      episode.summary = this.generateEpisodeSummary(episode);
    }

    // Store episode as a summary memory
    if (episode.summary) {
      await this.store.add({
        id: `episode-summary-${episode.id}`,
        content: episode.summary,
        type: 'summary',
        importance: this.calculateEpisodeImportance(episode),
        metadata: {
          source: 'system' as const,
          confidence: 0.9,
          episodeId: episode.id,
          eventCount: episode.events.length,
          duration: episode.endTime - episode.startTime,
          ...episode.metadata,
        },
        timestamp: episode.startTime,
        accessCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    this.currentEpisode = null;
    if (this.episodeTimeout) {
      clearTimeout(this.episodeTimeout);
      this.episodeTimeout = null;
    }

    this.emit('episodeEnd', episode);
    return episode;
  }

  /**
   * Recall events from a time period
   */
  async recall(options: {
    startTime?: number;
    endTime?: number;
    limit?: number;
    conversationId?: string;
    userId?: string;
  }): Promise<MemoryEntry[]> {
    const { entries } = await this.store.query({
      types: ['event'],
      startTime: options.startTime,
      endTime: options.endTime,
      conversationId: options.conversationId,
      userId: options.userId,
      limit: options.limit ?? 50,
    });

    return entries;
  }

  /**
   * Search episodes by content
   */
  async searchEpisodes(query: string, limit: number = 10): Promise<Episode[]> {
    // Search through episode summaries
    const { entries } = await this.store.query({
      query,
      types: ['summary'],
      limit,
    });

    const results: Episode[] = [];
    for (const entry of entries) {
      const episodeId = entry.metadata.episodeId as string;
      if (episodeId && this.episodes.has(episodeId)) {
        results.push(this.episodes.get(episodeId)!);
      }
    }

    return results;
  }

  /**
   * Get episode by ID
   */
  getEpisode(id: string): Episode | undefined {
    return this.episodes.get(id);
  }

  /**
   * Get current episode
   */
  getCurrentEpisode(): Episode | null {
    return this.currentEpisode;
  }

  /**
   * Get all episodes in a time range
   */
  getEpisodesByTimeRange(startTime: number, endTime: number): Episode[] {
    return Array.from(this.episodes.values()).filter(
      (ep) =>
        ep.startTime >= startTime && (ep.endTime ?? Date.now()) <= endTime,
    );
  }

  /**
   * Get recent episodes
   */
  getRecentEpisodes(limit: number = 5): Episode[] {
    const sorted = Array.from(this.episodes.values()).sort(
      (a, b) => b.startTime - a.startTime,
    );
    return sorted.slice(0, limit);
  }

  /**
   * Find similar episodes
   */
  async findSimilarEpisodes(
    episode: Episode,
    embedFn: (text: string) => Promise<number[]>,
    limit: number = 5,
  ): Promise<Array<{ episode: Episode; similarity: number }>> {
    if (!episode.summary) return [];

    // Get embedding for episode summary
    const embedding = await embedFn(episode.summary);

    // Search for similar summaries
    const results = await this.store.search(embedding, {
      topK: limit + 1, // +1 to potentially exclude self
    });

    const similar: Array<{ episode: Episode; similarity: number }> = [];
    for (const result of results) {
      const episodeId = result.entry.metadata.episodeId as string;
      if (
        episodeId &&
        episodeId !== episode.id &&
        this.episodes.has(episodeId)
      ) {
        similar.push({
          episode: this.episodes.get(episodeId)!,
          similarity: result.score,
        });
      }
    }

    return Promise.resolve(similar.slice(0, limit));
  }

  /**
   * Merge related episodes
   */
  mergeEpisodes(episodeIds: string[], newTitle?: string): Episode | null {
    const episodes = episodeIds
      .map((id) => this.episodes.get(id))
      .filter((ep): ep is Episode => ep !== undefined);

    if (episodes.length < 2) return null;

    // Sort by start time
    episodes.sort((a, b) => a.startTime - b.startTime);

    // Create merged episode
    const merged: Episode = {
      id: this.generateId(),
      title: newTitle ?? `Merged episode (${episodes.length} episodes)`,
      startTime: episodes[0].startTime,
      endTime: episodes[episodes.length - 1].endTime,
      events: episodes.flatMap((ep) => ep.events),
      metadata: {
        mergedFrom: episodeIds,
      },
    };

    // Generate new summary
    merged.summary = this.generateEpisodeSummary(merged);

    // Store merged episode
    this.episodes.set(merged.id, merged);

    // Remove original episodes (optional - could keep for reference)
    // for (const id of episodeIds) {
    //   this.episodes.delete(id);
    // }

    return merged;
  }

  /**
   * Reset episode timeout
   */
  private resetEpisodeTimeout(): void {
    if (this.episodeTimeout) {
      clearTimeout(this.episodeTimeout);
    }

    this.episodeTimeout = setTimeout(() => {
      void this.endCurrentEpisode();
    }, this.config.episodeTimeout);
  }

  /**
   * Generate episode summary
   */
  private generateEpisodeSummary(episode: Episode): string {
    // Extract key information from events
    const eventSummaries = episode.events
      .slice(0, 10) // Use first 10 events
      .map((e) => e.content.slice(0, 100))
      .join('; ');

    const duration = episode.endTime
      ? Math.round((episode.endTime - episode.startTime) / 60000)
      : 'ongoing';

    return `Episode with ${episode.events.length} events over ${duration} minutes: ${eventSummaries}`;
  }

  /**
   * Calculate episode importance
   */
  private calculateEpisodeImportance(episode: Episode): number {
    if (episode.events.length === 0) return 0;

    // Average importance of events with bonus for more events
    const avgImportance =
      episode.events.reduce((sum, e) => sum + e.importance, 0) /
      episode.events.length;
    const lengthBonus = Math.min(episode.events.length / 20, 0.2);

    return Math.min(avgImportance + lengthBonus, 1);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ep-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalEpisodes: number;
    currentEpisodeSize: number;
    totalEvents: number;
    avgEventsPerEpisode: number;
  } {
    const totalEvents = Array.from(this.episodes.values()).reduce(
      (sum, ep) => sum + ep.events.length,
      0,
    );

    return {
      totalEpisodes: this.episodes.size,
      currentEpisodeSize: this.currentEpisode?.events.length ?? 0,
      totalEvents,
      avgEventsPerEpisode:
        this.episodes.size > 0 ? totalEvents / this.episodes.size : 0,
    };
  }
}

/**
 * Create episodic memory instance
 */
export function createEpisodicMemory(
  store: MemoryStoreInterface,
  config?: EpisodicMemoryConfig,
): EpisodicMemory {
  return new EpisodicMemory(store, config);
}

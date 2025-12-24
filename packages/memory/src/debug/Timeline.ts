/**
 * Timeline
 *
 * Memory timeline visualization and analysis.
 */

import type {
  MemoryEntry,
  MemoryStoreInterface,
  TimelineConfig,
} from '../types/index.js';

/**
 * Timeline event
 */
export interface TimelineEvent {
  id: string;
  type: 'add' | 'update' | 'delete' | 'access' | 'consolidate';
  entryId: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

/**
 * Timeline segment
 */
export interface TimelineSegment {
  start: number;
  end: number;
  entries: MemoryEntry[];
  events: TimelineEvent[];
  summary?: string;
}

/**
 * Timeline marker
 */
export interface TimelineMarker {
  timestamp: number;
  label: string;
  type: 'milestone' | 'annotation' | 'warning';
  metadata?: Record<string, unknown>;
}

/**
 * Memory timeline
 */
export class Timeline {
  private store: MemoryStoreInterface;
  private config: Required<TimelineConfig>;
  private events: TimelineEvent[] = [];
  private markers: TimelineMarker[] = [];

  constructor(store: MemoryStoreInterface, config: TimelineConfig = {}) {
    this.store = store;
    this.config = {
      timeRange: config.timeRange ?? { start: 0, end: Date.now() },
      groupBy: config.groupBy ?? 'day',
      showTypes: config.showTypes ?? true,
      showNamespaces: config.showNamespaces ?? true,
      maxEvents: config.maxEvents ?? 10000,
      autoTrack: config.autoTrack ?? true,
      segmentSize: config.segmentSize ?? 'day',
    };
  }

  /**
   * Record a timeline event
   */
  recordEvent(event: Omit<TimelineEvent, 'id'>): void {
    const fullEvent: TimelineEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };

    this.events.push(fullEvent);

    // Trim if too many events
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }
  }

  /**
   * Add a marker to the timeline
   */
  addMarker(
    marker: Omit<TimelineMarker, 'timestamp'> & { timestamp?: number },
  ): void {
    this.markers.push({
      ...marker,
      timestamp: marker.timestamp ?? Date.now(),
    });
  }

  /**
   * Get timeline segments
   */
  async getSegments(
    startTime: number,
    endTime: number,
  ): Promise<TimelineSegment[]> {
    const segments: TimelineSegment[] = [];
    const segmentSize = this.getSegmentSizeMs();

    // Get entries in time range
    const { entries } = await this.store.query({
      startTime,
      endTime,
      limit: 10000,
    });

    // Get events in time range
    const rangeEvents = this.events.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );

    // Create segments
    let currentStart = startTime;
    while (currentStart < endTime) {
      const currentEnd = Math.min(currentStart + segmentSize, endTime);

      const segmentEntries = entries.filter(
        (e) => e.timestamp >= currentStart && e.timestamp < currentEnd,
      );

      const segmentEvents = rangeEvents.filter(
        (e) => e.timestamp >= currentStart && e.timestamp < currentEnd,
      );

      if (segmentEntries.length > 0 || segmentEvents.length > 0) {
        segments.push({
          start: currentStart,
          end: currentEnd,
          entries: segmentEntries,
          events: segmentEvents,
        });
      }

      currentStart = currentEnd;
    }

    return segments;
  }

  /**
   * Get timeline for a specific entry
   */
  async getEntryTimeline(entryId: string): Promise<{
    entry: MemoryEntry | null;
    events: TimelineEvent[];
    createdAt: number;
    lastModified: number;
    accessHistory: number[];
  }> {
    const entry = await this.store.get(entryId);
    const entryEvents = this.events.filter((e) => e.entryId === entryId);

    // Sort events by timestamp
    entryEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Extract access times
    const accessHistory = entryEvents
      .filter((e) => e.type === 'access')
      .map((e) => e.timestamp);

    return {
      entry,
      events: entryEvents,
      createdAt: entry?.createdAt ?? 0,
      lastModified: entry?.updatedAt ?? 0,
      accessHistory,
    };
  }

  /**
   * Get activity heatmap data
   */
  async getActivityHeatmap(
    startTime: number,
    endTime: number,
    bucketSize: 'hour' | 'day' = 'hour',
  ): Promise<Map<string, { entries: number; events: number }>> {
    const heatmap = new Map<string, { entries: number; events: number }>();

    // Get entries
    const { entries } = await this.store.query({
      startTime,
      endTime,
      limit: 10000,
    });

    // Get events
    const rangeEvents = this.events.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );

    // Bucket entries
    for (const entry of entries) {
      const key = this.getBucketKey(entry.timestamp, bucketSize);
      const existing = heatmap.get(key) ?? { entries: 0, events: 0 };
      existing.entries++;
      heatmap.set(key, existing);
    }

    // Bucket events
    for (const event of rangeEvents) {
      const key = this.getBucketKey(event.timestamp, bucketSize);
      const existing = heatmap.get(key) ?? { entries: 0, events: 0 };
      existing.events++;
      heatmap.set(key, existing);
    }

    return heatmap;
  }

  /**
   * Get markers in time range
   */
  getMarkers(startTime: number, endTime: number): TimelineMarker[] {
    return this.markers.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime,
    );
  }

  /**
   * Get recent activity summary
   */
  getRecentActivity(windowMs: number = 24 * 60 * 60 * 1000): {
    newEntries: number;
    updatedEntries: number;
    deletedEntries: number;
    totalAccesses: number;
    topAccessed: Array<{ entryId: string; accessCount: number }>;
  } {
    const now = Date.now();
    const startTime = now - windowMs;

    const recentEvents = this.events.filter((e) => e.timestamp >= startTime);

    const newEntries = recentEvents.filter((e) => e.type === 'add').length;
    const updatedEntries = recentEvents.filter(
      (e) => e.type === 'update',
    ).length;
    const deletedEntries = recentEvents.filter(
      (e) => e.type === 'delete',
    ).length;
    const totalAccesses = recentEvents.filter(
      (e) => e.type === 'access',
    ).length;

    // Count accesses per entry
    const accessCounts = new Map<string, number>();
    for (const event of recentEvents) {
      if (event.type === 'access') {
        accessCounts.set(
          event.entryId,
          (accessCounts.get(event.entryId) ?? 0) + 1,
        );
      }
    }

    const topAccessed = Array.from(accessCounts.entries())
      .map(([entryId, accessCount]) => ({ entryId, accessCount }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    return {
      newEntries,
      updatedEntries,
      deletedEntries,
      totalAccesses,
      topAccessed,
    };
  }

  /**
   * Get memory growth over time
   */
  async getGrowthChart(
    startTime: number,
    endTime: number,
    bucketSize: 'hour' | 'day' | 'week' = 'day',
  ): Promise<
    Array<{ time: string; cumulativeCount: number; newCount: number }>
  > {
    const { entries } = await this.store.query({
      startTime,
      endTime,
      limit: 100000,
    });

    // Sort by timestamp
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Group by bucket
    const buckets = new Map<string, number>();
    for (const entry of entries) {
      const key = this.getBucketKey(entry.timestamp, bucketSize);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    // Convert to growth chart
    const sortedKeys = Array.from(buckets.keys()).sort();
    let cumulative = 0;
    const chart: Array<{
      time: string;
      cumulativeCount: number;
      newCount: number;
    }> = [];

    for (const key of sortedKeys) {
      const newCount = buckets.get(key) ?? 0;
      cumulative += newCount;
      chart.push({
        time: key,
        cumulativeCount: cumulative,
        newCount,
      });
    }

    return chart;
  }

  /**
   * Find gaps in timeline (periods with no activity)
   */
  async findGaps(
    startTime: number,
    endTime: number,
    minGapSize: number = 24 * 60 * 60 * 1000,
  ): Promise<Array<{ start: number; end: number; durationMs: number }>> {
    const { entries } = await this.store.query({
      startTime,
      endTime,
      limit: 10000,
    });

    if (entries.length < 2) return [];

    // Sort by timestamp
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);

    // Find gaps
    const gaps: Array<{ start: number; end: number; durationMs: number }> = [];

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
      if (gap >= minGapSize) {
        gaps.push({
          start: sorted[i - 1].timestamp,
          end: sorted[i].timestamp,
          durationMs: gap,
        });
      }
    }

    return gaps;
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Clear markers
   */
  clearMarkers(): void {
    this.markers = [];
  }

  /**
   * Export timeline data
   */
  exportData(): {
    events: TimelineEvent[];
    markers: TimelineMarker[];
    exportedAt: number;
  } {
    return {
      events: [...this.events],
      markers: [...this.markers],
      exportedAt: Date.now(),
    };
  }

  /**
   * Import timeline data
   */
  importData(data: {
    events: TimelineEvent[];
    markers: TimelineMarker[];
  }): void {
    this.events.push(...data.events);
    this.markers.push(...data.markers);
  }

  /**
   * Get segment size in milliseconds
   */
  private getSegmentSizeMs(): number {
    switch (this.config.segmentSize) {
      case 'hour':
        return 60 * 60 * 1000;
      case 'day':
        return 24 * 60 * 60 * 1000;
      case 'week':
        return 7 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Get bucket key for timestamp
   */
  private getBucketKey(
    timestamp: number,
    bucketSize: 'hour' | 'day' | 'week',
  ): string {
    const date = new Date(timestamp);

    switch (bucketSize) {
      case 'hour':
        return `${date.toISOString().slice(0, 13)}:00`;
      case 'day':
        return date.toISOString().slice(0, 10);
      case 'week': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `week-${weekStart.toISOString().slice(0, 10)}`;
      }
      default:
        return date.toISOString().slice(0, 10);
    }
  }
}

/**
 * Create timeline instance
 */
export function createTimeline(
  store: MemoryStoreInterface,
  config?: TimelineConfig,
): Timeline {
  return new Timeline(store, config);
}

/**
 * Timeline
 *
 * Timeline management for recordings.
 */

import type { TimelineEvent, TimelineEventType } from '../types/index.js';
import { generateId, now, formatDuration } from '../utils/helpers.js';

/**
 * Timeline event creation options
 */
export interface TimelineEventOptions {
  /** Event ID (optional, will be generated) */
  id?: string;
  /** Event type */
  type: string;
  /** Timestamp (optional, defaults to now) */
  timestamp?: number;
  /** Step index */
  stepIndex: number;
  /** Event description */
  description: string;
  /** Duration in ms */
  durationMs?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Timeline marker
 */
export interface TimelineMarker {
  /** Marker ID */
  id: string;
  /** Marker name */
  name: string;
  /** Timestamp */
  timestamp: number;
  /** Step index */
  stepIndex: number;
  /** Marker color */
  color?: string;
  /** Description */
  description?: string;
}

/**
 * Timeline segment
 */
export interface TimelineSegment {
  /** Segment ID */
  id: string;
  /** Start step */
  startStep: number;
  /** End step */
  endStep: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Segment name */
  name: string;
  /** Segment type */
  type: string;
}

/**
 * Timeline filter options
 */
export interface TimelineFilterOptions {
  /** Filter by event types */
  types?: string[];
  /** Filter by step range */
  stepRange?: { min?: number; max?: number };
  /** Filter by time range */
  timeRange?: { after?: number; before?: number };
  /** Search in description */
  search?: string;
}

/**
 * Timeline statistics
 */
export interface TimelineStats {
  /** Total events */
  totalEvents: number;
  /** Events by type */
  eventsByType: Record<string, number>;
  /** Total duration */
  totalDurationMs: number;
  /** Average event duration */
  avgEventDurationMs: number;
  /** First event timestamp */
  firstEventTime?: number;
  /** Last event timestamp */
  lastEventTime?: number;
}

/**
 * Timeline
 *
 * Manages timeline of events for recordings.
 *
 * @example
 * ```typescript
 * const timeline = new Timeline();
 *
 * // Add events
 * timeline.addEvent({
 *   type: 'tool-call',
 *   stepIndex: 5,
 *   description: 'Called search tool',
 *   durationMs: 150,
 * });
 *
 * // Add markers
 * timeline.addMarker({
 *   name: 'Important decision',
 *   stepIndex: 10,
 * });
 *
 * // Query timeline
 * const events = timeline.getEventsInRange(0, 20);
 * const stats = timeline.getStats();
 * ```
 */
export class Timeline {
  private events: Map<string, TimelineEvent> = new Map();
  private eventOrder: string[] = [];
  private markers: Map<string, TimelineMarker> = new Map();
  private segments: Map<string, TimelineSegment> = new Map();

  /**
   * Add an event to the timeline
   */
  addEvent(options: TimelineEventOptions): TimelineEvent {
    const event: TimelineEvent = {
      id: options.id ?? generateId('evt'),
      type: options.type as TimelineEventType,
      timestamp: options.timestamp ?? now(),
      stepIndex: options.stepIndex,
      summary: options.description ?? '',
      description: options.description,
      durationMs: options.durationMs,
      metadata: options.metadata,
    };

    this.events.set(event.id, event);
    this.eventOrder.push(event.id);

    return event;
  }

  /**
   * Get an event by ID
   */
  getEvent(id: string): TimelineEvent | undefined {
    return this.events.get(id);
  }

  /**
   * Get all events
   */
  getEvents(): TimelineEvent[] {
    return this.eventOrder.map((id) => this.events.get(id)!);
  }

  /**
   * Get events matching filter
   */
  filterEvents(options: TimelineFilterOptions): TimelineEvent[] {
    return this.getEvents().filter((event) => {
      // Type filter
      if (options.types && !options.types.includes(event.type)) {
        return false;
      }

      // Step range filter
      if (options.stepRange) {
        if (
          options.stepRange.min !== undefined &&
          event.stepIndex < options.stepRange.min
        ) {
          return false;
        }
        if (
          options.stepRange.max !== undefined &&
          event.stepIndex > options.stepRange.max
        ) {
          return false;
        }
      }

      // Time range filter
      if (options.timeRange) {
        if (
          options.timeRange.after !== undefined &&
          event.timestamp < options.timeRange.after
        ) {
          return false;
        }
        if (
          options.timeRange.before !== undefined &&
          event.timestamp > options.timeRange.before
        ) {
          return false;
        }
      }

      // Search filter
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        const description = event.description ?? event.summary ?? '';
        if (!description.toLowerCase().includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get events in step range
   */
  getEventsInRange(startStep: number, endStep: number): TimelineEvent[] {
    return this.filterEvents({
      stepRange: { min: startStep, max: endStep },
    });
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): TimelineEvent[] {
    return this.filterEvents({ types: [type] });
  }

  /**
   * Get event at step
   */
  getEventAtStep(stepIndex: number): TimelineEvent | undefined {
    return this.getEvents().find((e) => e.stepIndex === stepIndex);
  }

  /**
   * Add a marker
   */
  addMarker(
    options: Omit<TimelineMarker, 'id' | 'timestamp'> & { timestamp?: number },
  ): TimelineMarker {
    const marker: TimelineMarker = {
      id: generateId('mark'),
      name: options.name,
      timestamp: options.timestamp ?? now(),
      stepIndex: options.stepIndex,
      color: options.color,
      description: options.description,
    };

    this.markers.set(marker.id, marker);
    return marker;
  }

  /**
   * Get all markers
   */
  getMarkers(): TimelineMarker[] {
    return Array.from(this.markers.values());
  }

  /**
   * Get marker at step
   */
  getMarkerAtStep(stepIndex: number): TimelineMarker | undefined {
    for (const marker of this.markers.values()) {
      if (marker.stepIndex === stepIndex) {
        return marker;
      }
    }
    return undefined;
  }

  /**
   * Remove a marker
   */
  removeMarker(id: string): boolean {
    return this.markers.delete(id);
  }

  /**
   * Add a segment
   */
  addSegment(options: Omit<TimelineSegment, 'id'>): TimelineSegment {
    const segment: TimelineSegment = {
      id: generateId('seg'),
      ...options,
    };

    this.segments.set(segment.id, segment);
    return segment;
  }

  /**
   * Get all segments
   */
  getSegments(): TimelineSegment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Get segment containing step
   */
  getSegmentForStep(stepIndex: number): TimelineSegment | undefined {
    for (const segment of this.segments.values()) {
      if (stepIndex >= segment.startStep && stepIndex <= segment.endStep) {
        return segment;
      }
    }
    return undefined;
  }

  /**
   * Remove a segment
   */
  removeSegment(id: string): boolean {
    return this.segments.delete(id);
  }

  /**
   * Get timeline statistics
   */
  getStats(): TimelineStats {
    const events = this.getEvents();

    const eventsByType: Record<string, number> = {};
    let totalDuration = 0;

    for (const event of events) {
      eventsByType[event.type] = (eventsByType[event.type] ?? 0) + 1;
      if (event.durationMs) {
        totalDuration += event.durationMs;
      }
    }

    return {
      totalEvents: events.length,
      eventsByType,
      totalDurationMs: totalDuration,
      avgEventDurationMs: events.length > 0 ? totalDuration / events.length : 0,
      firstEventTime: events.length > 0 ? events[0].timestamp : undefined,
      lastEventTime:
        events.length > 0 ? events[events.length - 1].timestamp : undefined,
    };
  }

  /**
   * Get duration between two steps
   */
  getDurationBetween(startStep: number, endStep: number): number {
    const startEvent = this.getEventAtStep(startStep);
    const endEvent = this.getEventAtStep(endStep);

    if (!startEvent || !endEvent) {
      return 0;
    }

    return endEvent.timestamp - startEvent.timestamp;
  }

  /**
   * Format timeline as text
   */
  format(): string {
    const lines: string[] = [];
    const events = this.getEvents();

    for (const event of events) {
      const duration = event.durationMs
        ? ` (${formatDuration(event.durationMs)})`
        : '';
      lines.push(
        `[${event.stepIndex}] ${event.type}: ${event.description}${duration}`,
      );
    }

    return lines.join('\n');
  }

  /**
   * Clear the timeline
   */
  clear(): void {
    this.events.clear();
    this.eventOrder = [];
    this.markers.clear();
    this.segments.clear();
  }

  /**
   * Get event count
   */
  get count(): number {
    return this.events.size;
  }

  /**
   * Export timeline data
   */
  export(): {
    events: TimelineEvent[];
    markers: TimelineMarker[];
    segments: TimelineSegment[];
  } {
    return {
      events: this.getEvents(),
      markers: this.getMarkers(),
      segments: this.getSegments(),
    };
  }

  /**
   * Import timeline data
   */
  import(data: {
    events?: TimelineEvent[];
    markers?: TimelineMarker[];
    segments?: TimelineSegment[];
  }): void {
    this.clear();

    if (data.events) {
      for (const event of data.events) {
        this.events.set(event.id, event);
        this.eventOrder.push(event.id);
      }
    }

    if (data.markers) {
      for (const marker of data.markers) {
        this.markers.set(marker.id, marker);
      }
    }

    if (data.segments) {
      for (const segment of data.segments) {
        this.segments.set(segment.id, segment);
      }
    }
  }
}

/**
 * Create a timeline instance
 */
export function createTimeline(): Timeline {
  return new Timeline();
}

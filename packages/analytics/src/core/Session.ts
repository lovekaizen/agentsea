/**
 * Session Manager
 *
 * Manages user sessions with device and location tracking.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  AnalyticsConfig,
  Session,
  DeviceInfo,
  LocationInfo,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Session manager events
 */
export interface SessionManagerEvents {
  created: (session: Session) => void;
  updated: (session: Session) => void;
  ended: (session: Session) => void;
  expired: (session: Session) => void;
  error: (error: Error) => void;
}

/**
 * Session timeout configuration
 */
interface SessionTimeoutConfig {
  /** Inactivity timeout in milliseconds */
  inactivityTimeout: number;
  /** Absolute timeout in milliseconds */
  absoluteTimeout: number;
}

/**
 * Default session timeout configuration
 */
const DEFAULT_TIMEOUT: SessionTimeoutConfig = {
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
  absoluteTimeout: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * SessionManager - Manages user sessions
 */
export class SessionManager extends EventEmitter<SessionManagerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: AnalyticsConfig;
  private readonly activeSessions = new Map<string, Session>();
  private readonly timeoutConfig: SessionTimeoutConfig;
  private expirationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    storage: AnalyticsStorageAdapter,
    config: AnalyticsConfig,
    timeoutConfig: Partial<SessionTimeoutConfig> = {},
  ) {
    super();
    this.storage = storage;
    this.config = config;
    this.timeoutConfig = { ...DEFAULT_TIMEOUT, ...timeoutConfig };
  }

  /**
   * Initialize the session manager
   */
  initialize(): void {
    // Start periodic expiration check
    this.expirationTimer = setInterval(
      () => void this.checkExpiredSessions(),
      60 * 1000, // Check every minute
    );
  }

  /**
   * Flush pending sessions to storage
   */
  flush(): void {
    // Sessions are persisted immediately, so nothing to flush
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  /**
   * Create a new session
   */
  async create(
    options: {
      userId?: string;
      device?: DeviceInfo;
      location?: LocationInfo;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<Session> {
    const now = Date.now();

    const session: Session = {
      id: nanoid(),
      userId: options.userId,
      startedAt: now,
      lastActivityAt: now,
      conversationIds: [],
      pageViews: 0,
      events: 0,
      device: options.device,
      location: this.anonymizeLocation(options.location),
      metadata: options.metadata,
    };

    // Store in active sessions
    this.activeSessions.set(session.id, session);

    // Persist to storage (implement in storage adapter)
    await this.persistSession(session);

    this.emit('created', session);
    return session;
  }

  /**
   * Get a session by ID
   */
  get(id: string): Session | null {
    // Check active sessions first
    const active = this.activeSessions.get(id);
    if (active) {
      return active;
    }

    // Fall back to storage (would need to implement session retrieval in storage)
    return null;
  }

  /**
   * End a session
   */
  async end(id: string): Promise<Session> {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: Session = {
      ...session,
      endedAt: Date.now(),
    };

    // Remove from active sessions
    this.activeSessions.delete(id);

    // Persist to storage
    await this.persistSession(updated);

    this.emit('ended', updated);
    return updated;
  }

  /**
   * Update session activity (touch)
   */
  touch(id: string): Promise<Session> {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: Session = {
      ...session,
      lastActivityAt: Date.now(),
    };

    // Update in active sessions
    this.activeSessions.set(id, updated);

    this.emit('updated', updated);
    return Promise.resolve(updated);
  }

  /**
   * Increment page views
   */
  incrementPageViews(id: string): Promise<Session> {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: Session = {
      ...session,
      pageViews: (session.pageViews ?? 0) + 1,
      lastActivityAt: Date.now(),
    };

    // Update in active sessions
    this.activeSessions.set(id, updated);

    this.emit('updated', updated);
    return Promise.resolve(updated);
  }

  /**
   * Increment events
   */
  incrementEvents(id: string, count = 1): Promise<Session> {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: Session = {
      ...session,
      events: (session.events ?? 0) + count,
      lastActivityAt: Date.now(),
    };

    // Update in active sessions
    this.activeSessions.set(id, updated);

    this.emit('updated', updated);
    return Promise.resolve(updated);
  }

  /**
   * Link a user to a session
   */
  async linkUser(id: string, userId: string): Promise<Session> {
    const session = this.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: Session = {
      ...session,
      userId,
      lastActivityAt: Date.now(),
    };

    // Update in active sessions
    this.activeSessions.set(id, updated);

    // Persist to storage
    await this.persistSession(updated);

    this.emit('updated', updated);
    return updated;
  }

  /**
   * Check for and expire inactive sessions
   */
  private async checkExpiredSessions(): Promise<void> {
    const now = Date.now();

    for (const [id, session] of this.activeSessions) {
      const inactiveTime = now - (session.lastActivityAt ?? session.startedAt);
      const totalTime = now - session.startedAt;

      // Check inactivity timeout
      if (inactiveTime >= this.timeoutConfig.inactivityTimeout) {
        await this.expireSession(id, 'inactivity');
        continue;
      }

      // Check absolute timeout
      if (totalTime >= this.timeoutConfig.absoluteTimeout) {
        await this.expireSession(id, 'absolute');
      }
    }
  }

  /**
   * Expire a session
   */
  private async expireSession(
    id: string,
    reason: 'inactivity' | 'absolute',
  ): Promise<void> {
    const session = this.activeSessions.get(id);
    if (!session) {
      return;
    }

    const expired: Session = {
      ...session,
      endedAt: Date.now(),
      metadata: {
        ...session.metadata,
        expiredReason: reason,
      },
    };

    // Remove from active sessions
    this.activeSessions.delete(id);

    // Persist to storage
    await this.persistSession(expired);

    this.emit('expired', expired);
  }

  /**
   * Anonymize location based on config
   */
  private anonymizeLocation(location?: LocationInfo): LocationInfo | undefined {
    if (!location) {
      return undefined;
    }

    if (!this.config.anonymization?.enabled) {
      return location;
    }

    // Remove IP if configured
    if (this.config.anonymization.removeIPs) {
      const { ip: _ip, ...rest } = location;
      return rest as LocationInfo;
    }

    return location;
  }

  /**
   * Persist session to storage
   * Note: This would ideally use a dedicated session storage method
   */
  private async persistSession(session: Session): Promise<void> {
    // For now, we'll store sessions as events
    // A proper implementation would have dedicated session storage
    await this.storage.saveEvent({
      id: `session_${session.id}`,
      type: session.endedAt ? 'session_end' : 'session_start',
      timestamp: session.endedAt ?? session.startedAt,
      sessionId: session.id,
      userId: session.userId,
      data: {
        duration: session.endedAt
          ? session.endedAt - session.startedAt
          : undefined,
        pageViews: session.pageViews,
        events: session.events,
        device: session.device,
        location: session.location,
      },
    });
  }

  /**
   * Get session duration
   */
  getDuration(session: Session): number {
    const endTime = session.endedAt ?? Date.now();
    return endTime - session.startedAt;
  }

  /**
   * Check if session is active
   */
  isActive(session: Session): boolean {
    if (session.endedAt) {
      return false;
    }

    const now = Date.now();
    const inactiveTime = now - (session.lastActivityAt ?? session.startedAt);

    return inactiveTime < this.timeoutConfig.inactivityTimeout;
  }

  /**
   * Get active session count
   */
  getActiveCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get all active sessions
   */
  getActive(): Session[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get active sessions for a user
   */
  getActiveForUser(userId: string): Session[] {
    return Array.from(this.activeSessions.values()).filter(
      (s) => s.userId === userId,
    );
  }
}

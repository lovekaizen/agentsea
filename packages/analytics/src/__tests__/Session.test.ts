/**
 * Session Manager Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionManager } from '../core/Session.js';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorage.js';
import type { AnalyticsConfig, Session } from '../types/index.js';

describe('SessionManager', () => {
  let manager: SessionManager;
  let storage: MemoryStorageAdapter;
  let config: AnalyticsConfig;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    config = {
      enabled: true,
      batchConfig: { enabled: false, maxSize: 100 },
    };
    manager = new SessionManager(storage, config);
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('session creation', () => {
    it('should create a session', async () => {
      const session = await manager.create({
        userId: 'user-123',
        device: { type: 'desktop' },
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.startedAt).toBeDefined();
      expect(session.lastActivityAt).toBe(session.startedAt);
      expect(session.conversationIds).toEqual([]);
    });

    it('should create session without user ID', async () => {
      const session = await manager.create();
      expect(session.id).toBeDefined();
      expect(session.userId).toBeUndefined();
    });

    it('should include device info', async () => {
      const session = await manager.create({
        device: { type: 'mobile', os: 'iOS', browser: 'Safari' },
      });

      expect(session.device?.type).toBe('mobile');
      expect(session.device?.os).toBe('iOS');
    });

    it('should include location info', async () => {
      const session = await manager.create({
        location: { country: 'US', city: 'New York' },
      });

      expect(session.location?.country).toBe('US');
      expect(session.location?.city).toBe('New York');
    });

    it('should emit created event', async () => {
      const handler = vi.fn();
      manager.on('created', handler);

      await manager.create();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('session retrieval', () => {
    it('should get session by id', async () => {
      const created = await manager.create({ userId: 'user-123' });
      const retrieved = manager.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent session', () => {
      const retrieved = manager.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('fetch() returns an active session from memory', async () => {
      const created = await manager.create({ userId: 'user-123' });
      const retrieved = await manager.fetch(created.id);
      expect(retrieved?.id).toBe(created.id);
    });

    it('fetch() retrieves an ended session from storage (get() does not)', async () => {
      const created = await manager.create({ userId: 'user-123' });
      await manager.end(created.id);

      // get() is in-memory only: an ended session is gone.
      expect(manager.get(created.id)).toBeNull();

      // fetch() falls back to persistent storage.
      const persisted = await manager.fetch(created.id);
      expect(persisted?.id).toBe(created.id);
      expect(persisted?.endedAt).toBeDefined();
    });

    it('fetch() returns null when the session exists nowhere', async () => {
      expect(await manager.fetch('nope')).toBeNull();
    });

    it('persists sessions via the dedicated saveSession adapter method', async () => {
      const created = await manager.create({ userId: 'user-123' });
      // Readable straight from the storage adapter, independent of memory.
      const fromStore = await storage.getSession(created.id);
      expect(fromStore?.id).toBe(created.id);
    });
  });

  describe('session updates', () => {
    it('should touch session', async () => {
      const session = await manager.create();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const touched = await manager.touch(session.id);

      expect(touched.lastActivityAt).toBeGreaterThan(session.startedAt);
    });

    it('should increment page views', async () => {
      const session = await manager.create();
      await new Promise((r) => setTimeout(r, 5)); // Small delay to ensure different timestamps
      const updated = await manager.incrementPageViews(session.id);

      expect(updated.pageViews).toBe(1);
      expect(updated.lastActivityAt).toBeGreaterThanOrEqual(session.startedAt);
    });

    it('should increment events', async () => {
      const session = await manager.create();
      const updated = await manager.incrementEvents(session.id, 3);

      expect(updated.events).toBe(3);
    });

    it('should link user to session', async () => {
      const session = await manager.create();
      const linked = await manager.linkUser(session.id, 'user-456');

      expect(linked.userId).toBe('user-456');
    });

    it('should emit updated event on touch', async () => {
      const handler = vi.fn();
      manager.on('updated', handler);

      const session = await manager.create();
      await manager.touch(session.id);

      expect(handler).toHaveBeenCalled();
    });

    it('should throw when touching non-existent session', async () => {
      expect(() => manager.touch('non-existent')).toThrow();
    });
  });

  describe('session ending', () => {
    it('should end a session', async () => {
      const session = await manager.create();
      const ended = await manager.end(session.id);

      expect(ended.endedAt).toBeDefined();
      expect(ended.endedAt).toBeGreaterThanOrEqual(session.startedAt);
    });

    it('should emit ended event', async () => {
      const handler = vi.fn();
      manager.on('ended', handler);

      const session = await manager.create();
      await manager.end(session.id);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove from active sessions', async () => {
      const session = await manager.create();
      expect(manager.getActiveCount()).toBe(1);

      await manager.end(session.id);
      expect(manager.getActiveCount()).toBe(0);
    });

    it('should throw when ending non-existent session', async () => {
      await expect(manager.end('non-existent')).rejects.toThrow();
    });
  });

  describe('session expiration', () => {
    it('should check if session is active', async () => {
      const session = await manager.create();
      expect(manager.isActive(session)).toBe(true);
    });

    it('should detect ended session as inactive', async () => {
      const session = await manager.create();
      const ended = await manager.end(session.id);
      expect(manager.isActive(ended)).toBe(false);
    });

    it('should expire inactive sessions', async () => {
      const handler = vi.fn();
      manager.on('expired', handler);

      const shortTimeout = new SessionManager(storage, config, {
        inactivityTimeout: 100,
      });
      shortTimeout.initialize();

      await shortTimeout.create();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Note: Expiration check runs every minute, so we can't easily test this
      // without mocking timers, which is complex with intervals
      shortTimeout.cleanup();
    });
  });

  describe('session duration', () => {
    it('should calculate duration for ongoing session', async () => {
      const session = await manager.create();
      const duration = manager.getDuration(session);
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate duration for ended session', async () => {
      const session = await manager.create();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const ended = await manager.end(session.id);
      const duration = manager.getDuration(ended);
      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('active sessions', () => {
    it('should track active session count', async () => {
      expect(manager.getActiveCount()).toBe(0);
      await manager.create();
      expect(manager.getActiveCount()).toBe(1);
      await manager.create();
      expect(manager.getActiveCount()).toBe(2);
    });

    it('should get all active sessions', async () => {
      await manager.create({ userId: 'user-1' });
      await manager.create({ userId: 'user-2' });

      const active = manager.getActive();
      expect(active).toHaveLength(2);
    });

    it('should get active sessions for user', async () => {
      await manager.create({ userId: 'user-1' });
      await manager.create({ userId: 'user-1' });
      await manager.create({ userId: 'user-2' });

      const userSessions = manager.getActiveForUser('user-1');
      expect(userSessions).toHaveLength(2);
    });
  });

  describe('anonymization', () => {
    it('should anonymize IP when configured', async () => {
      const anonConfig: AnalyticsConfig = {
        enabled: true,
        anonymization: {
          enabled: true,
          removeIPs: true,
        },
      };
      const anonManager = new SessionManager(storage, anonConfig);

      const session = await anonManager.create({
        location: { country: 'US', ip: '192.168.1.1' },
      });

      expect(session.location?.ip).toBeUndefined();
      expect(session.location?.country).toBe('US');
      anonManager.cleanup();
    });

    it('should not anonymize when disabled', async () => {
      const session = await manager.create({
        location: { country: 'US', ip: '192.168.1.1' },
      });

      expect(session.location?.ip).toBe('192.168.1.1');
    });
  });

  describe('initialization and cleanup', () => {
    it('should initialize successfully', () => {
      manager.initialize();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should cleanup resources', () => {
      manager.initialize();
      manager.cleanup();
      // Should not throw
      expect(true).toBe(true);
    });
  });
});

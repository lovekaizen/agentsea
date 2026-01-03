import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RedisMemory } from '../redis-memory';
import { Message } from '../../types';

// Mock ioredis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
      quit: vi.fn(),
    })),
  };
});

describe('RedisMemory', () => {
  let memory: RedisMemory;
  let mockRedis: any;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new RedisMemory();
    mockRedis = (memory as any).redis;
  });

  afterEach(async () => {
    await memory.disconnect();
  });

  describe('constructor', () => {
    it('should create memory with default config', () => {
      expect(memory).toBeDefined();
    });

    it('should create memory with custom config', () => {
      const customMemory = new RedisMemory({
        host: 'redis.example.com',
        port: 6380,
        password: 'secret',
        db: 1,
        prefix: 'custom:',
        ttl: 3600,
      });
      expect(customMemory).toBeDefined();
    });

    it('should use environment variables for config', () => {
      process.env.REDIS_HOST = 'env-redis';
      process.env.REDIS_PORT = '6380';
      process.env.REDIS_PASSWORD = 'env-pass';

      const envMemory = new RedisMemory();
      expect(envMemory).toBeDefined();

      delete process.env.REDIS_HOST;
      delete process.env.REDIS_PORT;
      delete process.env.REDIS_PASSWORD;
    });
  });

  describe('save', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    it('should save messages to Redis', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await memory.save('conv-1', messages);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'agentsea:memory:conv-1',
        JSON.stringify(messages),
      );
    });

    it('should use TTL when configured', async () => {
      const memoryWithTTL = new RedisMemory({ ttl: 3600 });
      const mockRedisWithTTL = (memoryWithTTL as any).redis;
      mockRedisWithTTL.setex.mockResolvedValue('OK');

      await memoryWithTTL.save('conv-1', messages);

      expect(mockRedisWithTTL.setex).toHaveBeenCalledWith(
        'agentsea:memory:conv-1',
        3600,
        JSON.stringify(messages),
      );
    });

    it('should use custom prefix', async () => {
      const memoryWithPrefix = new RedisMemory({ prefix: 'custom:' });
      const mockRedisWithPrefix = (memoryWithPrefix as any).redis;
      mockRedisWithPrefix.set.mockResolvedValue('OK');

      await memoryWithPrefix.save('conv-1', messages);

      expect(mockRedisWithPrefix.set).toHaveBeenCalledWith(
        'custom:conv-1',
        expect.any(String),
      );
    });
  });

  describe('load', () => {
    it('should load messages from Redis', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(messages));

      const loaded = await memory.load('conv-1');

      expect(loaded).toEqual(messages);
      expect(mockRedis.get).toHaveBeenCalledWith('agentsea:memory:conv-1');
    });

    it('should return empty array for non-existent conversation', async () => {
      mockRedis.get.mockResolvedValue(null);

      const loaded = await memory.load('non-existent');

      expect(loaded).toEqual([]);
    });

    it('should handle JSON parse errors', async () => {
      mockRedis.get.mockResolvedValue('invalid json');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

      const loaded = await memory.load('conv-1');

      expect(loaded).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should parse complex messages', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'tool', content: 'Result', toolCallId: 'call-123' },
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(messages));

      const loaded = await memory.load('conv-1');

      expect(loaded).toEqual(messages);
    });
  });

  describe('clear', () => {
    it('should clear messages for conversation', async () => {
      mockRedis.del.mockResolvedValue(1);

      await memory.clear('conv-1');

      expect(mockRedis.del).toHaveBeenCalledWith('agentsea:memory:conv-1');
    });

    it('should handle clearing non-existent conversation', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(memory.clear('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getConversationIds', () => {
    it('should return all conversation IDs', async () => {
      mockRedis.keys.mockResolvedValue([
        'agentsea:memory:conv-1',
        'agentsea:memory:conv-2',
        'agentsea:memory:conv-3',
      ]);

      const ids = await memory.getConversationIds();

      expect(ids).toEqual(['conv-1', 'conv-2', 'conv-3']);
      expect(mockRedis.keys).toHaveBeenCalledWith('agentsea:memory:*');
    });

    it('should return empty array when no conversations', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const ids = await memory.getConversationIds();

      expect(ids).toEqual([]);
    });

    it('should work with custom prefix', async () => {
      const memoryWithPrefix = new RedisMemory({ prefix: 'custom:' });
      const mockRedisWithPrefix = (memoryWithPrefix as any).redis;
      mockRedisWithPrefix.keys.mockResolvedValue([
        'custom:conv-1',
        'custom:conv-2',
      ]);

      const ids = await memoryWithPrefix.getConversationIds();

      expect(ids).toEqual(['conv-1', 'conv-2']);
      expect(mockRedisWithPrefix.keys).toHaveBeenCalledWith('custom:*');
    });
  });

  describe('disconnect', () => {
    it('should close Redis connection', async () => {
      mockRedis.quit.mockResolvedValue('OK');

      await memory.disconnect();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should propagate disconnect errors', async () => {
      // Reset mock to ensure clean state
      mockRedis.quit.mockReset();
      mockRedis.quit.mockRejectedValueOnce(
        new Error('Connection already closed'),
      );

      await expect(memory.disconnect()).rejects.toThrow(
        'Connection already closed',
      );

      // Reset for afterEach cleanup
      mockRedis.quit.mockResolvedValue('OK');
    });
  });

  describe('integration scenarios', () => {
    it('should save and load multiple times', async () => {
      const messages1: Message[] = [{ role: 'user', content: 'Message 1' }];
      const messages2: Message[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
      ];

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(messages1))
        .mockResolvedValueOnce(JSON.stringify(messages2));

      await memory.save('conv-1', messages1);
      const loaded1 = await memory.load('conv-1');

      await memory.save('conv-1', messages2);
      const loaded2 = await memory.load('conv-1');

      expect(loaded1).toEqual(messages1);
      expect(loaded2).toEqual(messages2);
    });

    it('should handle multiple conversations', async () => {
      const messages1: Message[] = [{ role: 'user', content: 'Conv 1' }];
      const messages2: Message[] = [{ role: 'user', content: 'Conv 2' }];

      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(messages1))
        .mockResolvedValueOnce(JSON.stringify(messages2));

      await memory.save('conv-1', messages1);
      await memory.save('conv-2', messages2);

      const loaded1 = await memory.load('conv-1');
      const loaded2 = await memory.load('conv-2');

      expect(loaded1).toEqual(messages1);
      expect(loaded2).toEqual(messages2);
    });
  });
});

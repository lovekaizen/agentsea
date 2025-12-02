import Redis from 'ioredis';

import { MemoryStore, Message } from '../types';

/**
 * Redis-backed memory store for persistent conversation history
 */
export class RedisMemory implements MemoryStore {
  private redis: Redis;
  private prefix: string;
  private ttl?: number;

  constructor(
    config: {
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      prefix?: string;
      ttl?: number;
    } = {},
  ) {
    this.redis = new Redis({
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD,
      db: config.db || 0,
    });

    this.prefix = config.prefix || 'agentsea:memory:';
    this.ttl = config.ttl;
  }

  /**
   * Save messages to Redis
   */
  async save(conversationId: string, messages: Message[]): Promise<void> {
    const key = this.getKey(conversationId);
    const value = JSON.stringify(messages);

    if (this.ttl) {
      await this.redis.setex(key, this.ttl, value);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Load messages from Redis
   */
  async load(conversationId: string): Promise<Message[]> {
    const key = this.getKey(conversationId);
    const value = await this.redis.get(key);

    if (!value) {
      return [];
    }

    try {
      return JSON.parse(value) as Message[];
    } catch (error) {
      console.error('Failed to parse messages from Redis:', error);
      return [];
    }
  }

  /**
   * Clear messages for a conversation
   */
  async clear(conversationId: string): Promise<void> {
    const key = this.getKey(conversationId);
    await this.redis.del(key);
  }

  /**
   * Get all conversation IDs
   */
  async getConversationIds(): Promise<string[]> {
    const pattern = `${this.prefix}*`;
    const keys = await this.redis.keys(pattern);
    return keys.map((key) => key.replace(this.prefix, ''));
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Get the Redis key for a conversation
   */
  private getKey(conversationId: string): string {
    return `${this.prefix}${conversationId}`;
  }
}

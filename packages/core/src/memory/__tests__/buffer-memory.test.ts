import { describe, it, expect, beforeEach } from 'vitest';
import { BufferMemory } from '../buffer-memory';
import { Message } from '../../types';

describe('BufferMemory', () => {
  let memory: BufferMemory;

  const createMessage = (
    role: 'user' | 'assistant',
    content: string,
  ): Message => ({
    role,
    content,
  });

  beforeEach(() => {
    memory = new BufferMemory();
  });

  describe('save and load', () => {
    it('should save and load messages', async () => {
      const messages: Message[] = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi there!'),
      ];

      await memory.save('conv-1', messages);
      const loaded = await memory.load('conv-1');

      expect(loaded).toEqual(messages);
    });

    it('should return empty array for non-existent conversation', async () => {
      const loaded = await memory.load('non-existent');
      expect(loaded).toEqual([]);
    });

    it('should overwrite existing messages', async () => {
      const messages1: Message[] = [createMessage('user', 'First')];
      const messages2: Message[] = [createMessage('user', 'Second')];

      await memory.save('conv-1', messages1);
      await memory.save('conv-1', messages2);

      const loaded = await memory.load('conv-1');
      expect(loaded).toEqual(messages2);
    });
  });

  describe('maxMessages truncation', () => {
    it('should truncate messages when exceeding maxMessages', async () => {
      const memoryWithLimit = new BufferMemory(2);
      const messages: Message[] = [
        createMessage('user', 'First'),
        createMessage('assistant', 'Second'),
        createMessage('user', 'Third'),
        createMessage('assistant', 'Fourth'),
      ];

      await memoryWithLimit.save('conv-1', messages);
      const loaded = await memoryWithLimit.load('conv-1');

      expect(loaded).toHaveLength(2);
      expect(loaded[0].content).toBe('Third');
      expect(loaded[1].content).toBe('Fourth');
    });

    it('should not truncate when messages are within limit', async () => {
      const memoryWithLimit = new BufferMemory(5);
      const messages: Message[] = [
        createMessage('user', 'First'),
        createMessage('assistant', 'Second'),
      ];

      await memoryWithLimit.save('conv-1', messages);
      const loaded = await memoryWithLimit.load('conv-1');

      expect(loaded).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('should clear messages for a conversation', async () => {
      const messages: Message[] = [createMessage('user', 'Hello')];

      await memory.save('conv-1', messages);
      await memory.clear('conv-1');

      const loaded = await memory.load('conv-1');
      expect(loaded).toEqual([]);
    });

    it('should not affect other conversations', async () => {
      const messages1: Message[] = [createMessage('user', 'Hello 1')];
      const messages2: Message[] = [createMessage('user', 'Hello 2')];

      await memory.save('conv-1', messages1);
      await memory.save('conv-2', messages2);
      await memory.clear('conv-1');

      const loaded1 = await memory.load('conv-1');
      const loaded2 = await memory.load('conv-2');

      expect(loaded1).toEqual([]);
      expect(loaded2).toEqual(messages2);
    });
  });

  describe('clearAll', () => {
    it('should clear all conversations', async () => {
      const messages1: Message[] = [createMessage('user', 'Hello 1')];
      const messages2: Message[] = [createMessage('user', 'Hello 2')];

      await memory.save('conv-1', messages1);
      await memory.save('conv-2', messages2);
      memory.clearAll();

      const loaded1 = await memory.load('conv-1');
      const loaded2 = await memory.load('conv-2');

      expect(loaded1).toEqual([]);
      expect(loaded2).toEqual([]);
    });
  });

  describe('getConversationIds', () => {
    it('should return empty array when no conversations', () => {
      expect(memory.getConversationIds()).toEqual([]);
    });

    it('should return all conversation IDs', async () => {
      await memory.save('conv-1', [createMessage('user', 'Hello')]);
      await memory.save('conv-2', [createMessage('user', 'World')]);

      const ids = memory.getConversationIds();
      expect(ids).toHaveLength(2);
      expect(ids).toContain('conv-1');
      expect(ids).toContain('conv-2');
    });
  });

  describe('size', () => {
    it('should return 0 for empty memory', () => {
      expect(memory.size()).toBe(0);
    });

    it('should return correct number of conversations', async () => {
      await memory.save('conv-1', [createMessage('user', 'Hello')]);
      await memory.save('conv-2', [createMessage('user', 'World')]);
      await memory.save('conv-3', [createMessage('user', 'Test')]);

      expect(memory.size()).toBe(3);
    });

    it('should update after clearing', async () => {
      await memory.save('conv-1', [createMessage('user', 'Hello')]);
      await memory.save('conv-2', [createMessage('user', 'World')]);

      expect(memory.size()).toBe(2);

      await memory.clear('conv-1');
      expect(memory.size()).toBe(1);

      memory.clearAll();
      expect(memory.size()).toBe(0);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SummaryMemory } from '../summary-memory';
import { Message, LLMProvider } from '../../types';

describe('SummaryMemory', () => {
  let memory: SummaryMemory;
  let mockProvider: LLMProvider;

  beforeEach(() => {
    mockProvider = {
      generateResponse: vi.fn().mockResolvedValue({
        content: 'Summary of the conversation',
        stopReason: 'stop',
        usage: { inputTokens: 50, outputTokens: 20 },
      }),
      streamResponse: vi.fn(),
      parseToolCalls: vi.fn(),
    };

    memory = new SummaryMemory(mockProvider, 5);
  });

  describe('constructor', () => {
    it('should create memory with provider', () => {
      expect(memory).toBeDefined();
    });

    it('should use default maxRecentMessages', () => {
      const defaultMemory = new SummaryMemory(mockProvider);
      expect(defaultMemory).toBeDefined();
    });

    it('should use custom maxRecentMessages', () => {
      const customMemory = new SummaryMemory(mockProvider, 3);
      expect(customMemory).toBeDefined();
    });

    it('should use custom summary model', () => {
      const customMemory = new SummaryMemory(mockProvider, 5, 'custom-model');
      expect(customMemory).toBeDefined();
    });
  });

  describe('save', () => {
    it('should save messages without summarization when under limit', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
      ];

      await memory.save('conv-1', messages);

      const loaded = await memory.load('conv-1');

      expect(loaded).toEqual(messages);
      expect(mockProvider.generateResponse).not.toHaveBeenCalled();
    });

    it('should summarize old messages when exceeding limit', async () => {
      const messages: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
        messages.push({ role: 'assistant', content: `Response ${i}` });
      }

      await memory.save('conv-1', messages);

      expect(mockProvider.generateResponse).toHaveBeenCalled();

      const loaded = await memory.load('conv-1');
      // Should have summary (1) + recent (5)
      expect(loaded.length).toBe(6);
      expect(loaded[0].role).toBe('system');
      expect(loaded[0].content).toContain('Previous conversation summary');
    });

    it('should keep only recent messages after summarization', async () => {
      const messages: Message[] = [];
      for (let i = 1; i <= 8; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      await memory.save('conv-1', messages);

      const loaded = await memory.load('conv-1');

      // Should have summary + 5 recent
      expect(loaded.length).toBe(6);
      expect(loaded[1].content).toBe('Message 4');
      expect(loaded[loaded.length - 1].content).toBe('Message 8');
    });

    it('should update summary with existing summary', async () => {
      // First save - creates initial summary
      const messages1: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages1.push({ role: 'user', content: `Message ${i}` });
      }

      await memory.save('conv-1', messages1);

      // Second save - updates summary
      const messages2: Message[] = [];
      for (let i = 1; i <= 12; i++) {
        messages2.push({ role: 'user', content: `Message ${i}` });
      }

      await memory.save('conv-1', messages2);

      expect(mockProvider.generateResponse).toHaveBeenCalledTimes(2);

      const secondCall = (mockProvider.generateResponse as any).mock
        .calls[1][0];
      expect(secondCall[0].content).toContain('Previous summary');
    });

    it('should handle empty messages', async () => {
      await memory.save('conv-1', []);

      const loaded = await memory.load('conv-1');
      expect(loaded).toEqual([]);
    });
  });

  describe('load', () => {
    it('should return empty array for non-existent conversation', async () => {
      const loaded = await memory.load('non-existent');
      expect(loaded).toEqual([]);
    });

    it('should return messages with summary prefix', async () => {
      const messages: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      await memory.save('conv-1', messages);
      const loaded = await memory.load('conv-1');

      expect(loaded[0].role).toBe('system');
      expect(loaded[0].content).toContain('Previous conversation summary');
    });

    it('should not include summary when no summarization occurred', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
      ];

      await memory.save('conv-1', messages);
      const loaded = await memory.load('conv-1');

      expect(loaded[0].role).not.toBe('system');
      expect(loaded).toEqual(messages);
    });
  });

  describe('clear', () => {
    it('should clear conversation', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Message 1' }];

      await memory.save('conv-1', messages);
      await memory.clear('conv-1');

      const loaded = await memory.load('conv-1');
      expect(loaded).toEqual([]);
    });

    it('should handle clearing non-existent conversation', async () => {
      await expect(memory.clear('non-existent')).resolves.not.toThrow();
    });
  });

  describe('summarization', () => {
    it('should generate summary for old messages', async () => {
      const messages: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages.push({ role: 'user', content: `User: Message ${i}` });
        messages.push({
          role: 'assistant',
          content: `Assistant: Response ${i}`,
        });
      }

      await memory.save('conv-1', messages);

      const call = (mockProvider.generateResponse as any).mock.calls[0];
      expect(call[0][0].content).toContain('summarize');
      expect(call[1].temperature).toBe(0.3);
    });

    it('should handle summarization errors gracefully', async () => {
      (mockProvider.generateResponse as any).mockRejectedValue(
        new Error('Summarization failed'),
      );

      const messages: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      // Should handle error gracefully by using fallback (concatenation)
      await memory.save('conv-1', messages);

      // Verify the save succeeded despite summarization failure
      const loaded = await memory.load('conv-1');
      expect(loaded.length).toBeGreaterThan(0);
    });

    it('should use specified summary model', async () => {
      const customMemory = new SummaryMemory(
        mockProvider,
        5,
        'custom-summary-model',
      );

      const messages: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      await customMemory.save('conv-1', messages);

      const call = (mockProvider.generateResponse as any).mock.calls[0];
      expect(call[1].model).toBe('custom-summary-model');
    });

    it('should include both existing summary and new messages in prompt', async () => {
      // First save
      const messages1: Message[] = [];
      for (let i = 1; i <= 7; i++) {
        messages1.push({ role: 'user', content: `Message ${i}` });
      }
      await memory.save('conv-1', messages1);

      // Second save
      const messages2: Message[] = [];
      for (let i = 1; i <= 12; i++) {
        messages2.push({ role: 'user', content: `Message ${i}` });
      }
      await memory.save('conv-1', messages2);

      const secondCall = (mockProvider.generateResponse as any).mock
        .calls[1][0];
      expect(secondCall[0].content).toContain('Previous summary');
      expect(secondCall[0].content).toContain('New messages');
    });
  });

  describe('edge cases', () => {
    it('should handle exactly maxRecentMessages', async () => {
      const messages: Message[] = [];
      for (let i = 1; i <= 5; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      await memory.save('conv-1', messages);

      expect(mockProvider.generateResponse).not.toHaveBeenCalled();

      const loaded = await memory.load('conv-1');
      expect(loaded.length).toBe(5);
    });

    it('should handle one message over maxRecentMessages', async () => {
      const messages: Message[] = [];
      for (let i = 1; i <= 6; i++) {
        messages.push({ role: 'user', content: `Message ${i}` });
      }

      await memory.save('conv-1', messages);

      expect(mockProvider.generateResponse).toHaveBeenCalled();

      const loaded = await memory.load('conv-1');
      // Summary + 5 recent
      expect(loaded.length).toBe(6);
    });

    it('should handle messages with different roles', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'System message' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
        { role: 'tool', content: 'Tool result', toolCallId: 'call-1' },
      ];

      await memory.save('conv-1', messages);

      const loaded = await memory.load('conv-1');
      expect(loaded).toEqual(messages);
    });
  });
});

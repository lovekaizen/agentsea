/**
 * StreamReplayer tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamReplayer } from '../streaming/StreamReplayer.js';
import type { RecordedStream, StreamChunk } from '../types/index.js';

function createTestStream(chunks: Partial<StreamChunk>[]): RecordedStream {
  const timestamp = Date.now();
  return {
    id: 'stream1',
    key: 'test-key',
    chunks: chunks.map((c, i) => ({
      type: 'text',
      timestamp: timestamp + i * 10,
      index: i,
      ...c,
    })) as StreamChunk[],
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Hello' }],
    startTime: timestamp,
    endTime: timestamp + 1000,
    durationMs: 1000,
    totalChars: 10,
    complete: true,
  };
}

describe('StreamReplayer', () => {
  let replayer: StreamReplayer;

  beforeEach(() => {
    replayer = new StreamReplayer({
      speedMultiplier: 1,
      simulateTiming: false,
    });
  });

  describe('Basic Replay', () => {
    it('should replay all chunks', async () => {
      const stream = createTestStream([
        { content: 'Hello' },
        { content: ' ' },
        { content: 'world' },
      ]);

      const chunks: StreamChunk[] = [];
      for await (const chunk of replayer.replay(stream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe('Hello');
      expect(chunks[1].content).toBe(' ');
      expect(chunks[2].content).toBe('world');
    });

    it('should replay chunks in order', async () => {
      const stream = createTestStream([
        { content: 'First', index: 0 },
        { content: 'Third', index: 2 },
        { content: 'Second', index: 1 },
      ]);

      const chunks: StreamChunk[] = [];
      for await (const chunk of replayer.replay(stream)) {
        chunks.push(chunk);
      }

      expect(chunks[0].content).toBe('First');
      expect(chunks[1].content).toBe('Second');
      expect(chunks[2].content).toBe('Third');
    });

    it('should replay empty streams', async () => {
      const stream = createTestStream([]);

      const chunks: StreamChunk[] = [];
      for await (const chunk of replayer.replay(stream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(0);
    });
  });

  describe('Timing Simulation', () => {
    it('should simulate timing when enabled', async () => {
      const simulatingReplayer = new StreamReplayer({
        simulateTiming: true,
        speedMultiplier: 1,
        minDelayMs: 0,
        maxDelayMs: 100,
      });

      const timestamp = Date.now();
      const stream = createTestStream([
        { content: 'A', timestamp: timestamp },
        { content: 'B', timestamp: timestamp + 50 },
        { content: 'C', timestamp: timestamp + 100 },
      ]);

      const startTime = Date.now();
      const chunks: StreamChunk[] = [];

      for await (const chunk of simulatingReplayer.replay(stream)) {
        chunks.push(chunk);
      }

      const duration = Date.now() - startTime;

      // Should take some time due to simulated delays
      expect(duration).toBeGreaterThan(0);
      expect(chunks.length).toBe(3);
    });

    it('should respect speed multiplier', async () => {
      const fastReplayer = new StreamReplayer({
        simulateTiming: true,
        speedMultiplier: 10, // 10x faster
        minDelayMs: 0,
        maxDelayMs: 1000,
      });

      const timestamp = Date.now();
      const stream = createTestStream([
        { content: 'A', timestamp: timestamp },
        { content: 'B', timestamp: timestamp + 100 }, // 100ms delay
      ]);

      const startTime = Date.now();

      for await (const _chunk of fastReplayer.replay(stream)) {
        // Iterate through all chunks
      }

      const duration = Date.now() - startTime;

      // With 10x speed, 100ms delay should become ~10ms (allow CI timing variance)
      expect(duration).toBeLessThan(80);
    });

    it('should respect minimum delay', async () => {
      const minDelayReplayer = new StreamReplayer({
        simulateTiming: true,
        speedMultiplier: 100, // Very fast
        minDelayMs: 10,
        maxDelayMs: 1000,
      });

      const timestamp = Date.now();
      const stream = createTestStream([
        { content: 'A', timestamp: timestamp },
        { content: 'B', timestamp: timestamp + 1 }, // 1ms delay (would be 0.01ms with speedMultiplier)
      ]);

      const startTime = Date.now();

      for await (const _chunk of minDelayReplayer.replay(stream)) {
        // Iterate through all chunks
      }

      const duration = Date.now() - startTime;

      // Should respect minDelay of 10ms (allow 2ms tolerance for timer resolution)
      expect(duration).toBeGreaterThanOrEqual(8);
    });

    it('should respect maximum delay', async () => {
      const maxDelayReplayer = new StreamReplayer({
        simulateTiming: true,
        speedMultiplier: 1,
        minDelayMs: 0,
        maxDelayMs: 5,
      });

      const timestamp = Date.now();
      const stream = createTestStream([
        { content: 'A', timestamp: timestamp },
        { content: 'B', timestamp: timestamp + 1000 }, // 1000ms delay
      ]);

      const startTime = Date.now();

      for await (const _chunk of maxDelayReplayer.replay(stream)) {
        // Iterate through all chunks
      }

      const duration = Date.now() - startTime;

      // Should cap at maxDelay of 5ms (allow generous CI timing variance)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Text Replay', () => {
    it('should replay only text chunks', async () => {
      const stream = createTestStream([
        { type: 'text', content: 'Hello' },
        { type: 'metadata', metadata: { custom: 'value' } },
        { type: 'text', content: 'world' },
      ]);

      const texts: string[] = [];
      for await (const text of replayer.replayText(stream)) {
        texts.push(text);
      }

      expect(texts.length).toBe(2);
      expect(texts).toEqual(['Hello', 'world']);
    });

    it('should skip non-text chunks', async () => {
      const stream = createTestStream([
        {
          type: 'tool_call',
          toolCall: { id: 'call_1', name: 'tool', arguments: '{}' },
        },
        { type: 'text', content: 'Text' },
      ]);

      const texts: string[] = [];
      for await (const text of replayer.replayText(stream)) {
        texts.push(text);
      }

      expect(texts.length).toBe(1);
      expect(texts[0]).toBe('Text');
    });
  });

  describe('Synchronous Replay', () => {
    it('should replay synchronously', () => {
      const stream = createTestStream([
        { content: 'Hello' },
        { content: ' ' },
        { content: 'world' },
      ]);

      const chunks: StreamChunk[] = [];
      for (const chunk of replayer.replaySync(stream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
    });

    it('should not simulate timing in sync mode', () => {
      const syncReplayer = new StreamReplayer({
        simulateTiming: true, // Should be ignored in sync mode
      });

      const stream = createTestStream([{ content: 'A' }, { content: 'B' }]);

      const startTime = Date.now();
      const chunks: StreamChunk[] = [];

      for (const chunk of syncReplayer.replaySync(stream)) {
        chunks.push(chunk);
      }

      const duration = Date.now() - startTime;

      // Should be very fast (no delays)
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Utility Methods', () => {
    it('should get all chunks at once', () => {
      const stream = createTestStream([
        { content: 'A' },
        { content: 'B' },
        { content: 'C' },
      ]);

      const chunks = replayer.getAllChunks(stream);

      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe('A');
    });

    it('should get full text', () => {
      const stream = createTestStream([
        { type: 'text', content: 'Hello' },
        { type: 'text', content: ' ' },
        { type: 'text', content: 'world' },
        { type: 'metadata', metadata: {} },
      ]);

      const fullText = replayer.getFullText(stream);

      expect(fullText).toBe('Hello world');
    });

    it('should get tool calls', () => {
      const stream = createTestStream([
        { type: 'text', content: 'Text' },
        {
          type: 'tool_call',
          toolCall: { id: 'call_1', name: 'calculator', arguments: '{"a":5}' },
        },
        {
          type: 'tool_call',
          toolCall: { id: 'call_2', name: 'search', arguments: '{"q":"test"}' },
        },
      ]);

      const toolCalls = replayer.getToolCalls(stream);

      expect(toolCalls.length).toBe(2);
      expect(toolCalls[0].id).toBe('call_1');
      expect(toolCalls[0].name).toBe('calculator');
      expect(toolCalls[1].id).toBe('call_2');
    });
  });

  describe('Callbacks', () => {
    it('should call onChunk callback', async () => {
      const onChunk = vi.fn();
      const callbackReplayer = new StreamReplayer({ onChunk });

      const stream = createTestStream([{ content: 'A' }, { content: 'B' }]);

      for await (const _chunk of callbackReplayer.replay(stream)) {
        // Iterate
      }

      expect(onChunk).toHaveBeenCalledTimes(2);
    });

    it('should call onComplete callback', async () => {
      const onComplete = vi.fn();
      const callbackReplayer = new StreamReplayer({ onComplete });

      const stream = createTestStream([{ content: 'A' }]);

      for await (const _chunk of callbackReplayer.replay(stream)) {
        // Iterate
      }

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(stream);
    });

    it('should call onError callback on errors', async () => {
      const onError = vi.fn();
      const errorReplayer = new StreamReplayer({ onError });

      // Create a stream that will cause an error during iteration
      const badStream = {
        ...createTestStream([]),
        chunks: null as unknown as StreamChunk[],
      };

      try {
        for await (const _chunk of errorReplayer.replay(badStream)) {
          // Will error
        }
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Stop/Abort', () => {
    it('should stop replay when requested', async () => {
      const stream = createTestStream([
        { content: 'A' },
        { content: 'B' },
        { content: 'C' },
      ]);

      const chunks: StreamChunk[] = [];
      const generator = replayer.replay(stream);

      // Get first chunk
      const first = await generator.next();
      chunks.push(first.value);

      // Stop replay
      replayer.stop();

      // Try to get next chunk
      const second = await generator.next();

      expect(chunks.length).toBe(1);
      expect(second.done).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      expect(() => {
        replayer.configure({
          speedMultiplier: 2,
          minDelayMs: 5,
        });
      }).not.toThrow();
    });

    it('should apply updated configuration', async () => {
      const configReplayer = new StreamReplayer({
        simulateTiming: true,
        speedMultiplier: 1,
      });

      configReplayer.configure({
        speedMultiplier: 100, // Very fast
      });

      const timestamp = Date.now();
      const stream = createTestStream([
        { content: 'A', timestamp: timestamp },
        { content: 'B', timestamp: timestamp + 100 },
      ]);

      const startTime = Date.now();

      for await (const _chunk of configReplayer.replay(stream)) {
        // Iterate
      }

      const duration = Date.now() - startTime;

      // With 100x speed, should be very fast
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle chunks with missing content', () => {
      const stream = createTestStream([
        { type: 'text' }, // No content
        { type: 'text', content: 'Valid' },
      ]);

      const fullText = replayer.getFullText(stream);

      expect(fullText).toBe('Valid');
    });

    it('should handle streams with only metadata', async () => {
      const stream = createTestStream([
        { type: 'metadata', metadata: { key: 'value' } },
      ]);

      const chunks: StreamChunk[] = [];
      for await (const chunk of replayer.replay(stream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0].type).toBe('metadata');
    });

    it('should sort chunks correctly when out of order', async () => {
      const stream: RecordedStream = {
        id: 'stream1',
        key: 'test-key',
        chunks: [
          {
            type: 'text',
            content: 'Third',
            timestamp: Date.now(),
            index: 2,
          },
          {
            type: 'text',
            content: 'First',
            timestamp: Date.now(),
            index: 0,
          },
          {
            type: 'text',
            content: 'Second',
            timestamp: Date.now(),
            index: 1,
          },
        ],
        model: 'gpt-5.5',
        messages: [],
        startTime: Date.now(),
        endTime: Date.now(),
        durationMs: 0,
        totalChars: 0,
        complete: true,
      };

      const text = replayer.getFullText(stream);

      expect(text).toBe('FirstSecondThird');
    });
  });
});

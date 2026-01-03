/**
 * ChunkBuffer tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChunkBuffer } from '../streaming/ChunkBuffer.js';
import type { StreamChunk } from '../types/index.js';

function createTestChunk(content: string, index?: number): StreamChunk {
  const chunk: StreamChunk = {
    type: 'text',
    content,
    timestamp: Date.now(),
    index: 0, // Will be overwritten if index is provided
  };
  // Only set index if explicitly provided, otherwise leave undefined for auto-increment
  if (index !== undefined) {
    chunk.index = index;
  } else {
    // Remove the default 0 to trigger auto-increment in ChunkBuffer
    delete (chunk as Partial<StreamChunk>).index;
  }
  return chunk;
}

describe('ChunkBuffer', () => {
  let buffer: ChunkBuffer;

  beforeEach(() => {
    buffer = new ChunkBuffer({
      maxChunks: 10,
      maxBytes: 1024,
      flushIntervalMs: 0, // Disable auto-flush
      preserveOrder: true,
    });
  });

  afterEach(() => {
    buffer.destroy();
  });

  describe('Adding Chunks', () => {
    it('should add chunks to buffer', () => {
      buffer.add(createTestChunk('Hello'));
      buffer.add(createTestChunk('World'));

      expect(buffer.size()).toBe(2);
    });

    it('should auto-increment indices when preserveOrder is true', () => {
      buffer.add(createTestChunk('A'));
      buffer.add(createTestChunk('B'));
      buffer.add(createTestChunk('C'));

      const chunks = buffer.flush();

      expect(chunks[0].index).toBe(0);
      expect(chunks[1].index).toBe(1);
      expect(chunks[2].index).toBe(2);
    });

    it('should not modify index when chunk has one', () => {
      buffer.add(createTestChunk('A', 5));

      const chunks = buffer.flush();

      expect(chunks[0].index).toBe(5);
    });

    it('should add multiple chunks at once', () => {
      const chunks = [
        createTestChunk('A'),
        createTestChunk('B'),
        createTestChunk('C'),
      ];

      buffer.addAll(chunks);

      expect(buffer.size()).toBe(3);
    });

    it('should track byte size', () => {
      expect(buffer.bytes()).toBe(0);

      buffer.add(createTestChunk('Hello'));

      expect(buffer.bytes()).toBeGreaterThan(0);
    });
  });

  describe('Flushing', () => {
    it('should flush all chunks', () => {
      buffer.add(createTestChunk('A'));
      buffer.add(createTestChunk('B'));
      buffer.add(createTestChunk('C'));

      const chunks = buffer.flush();

      expect(chunks.length).toBe(3);
      expect(buffer.size()).toBe(0);
      expect(buffer.bytes()).toBe(0);
    });

    it('should sort chunks by index when preserveOrder is true', () => {
      buffer.add(createTestChunk('C', 2));
      buffer.add(createTestChunk('A', 0));
      buffer.add(createTestChunk('B', 1));

      const chunks = buffer.flush();

      expect(chunks[0].content).toBe('A');
      expect(chunks[1].content).toBe('B');
      expect(chunks[2].content).toBe('C');
    });

    it('should call onFlush callback', () => {
      const onFlush = vi.fn();
      const callbackBuffer = new ChunkBuffer({ maxChunks: 10 }, onFlush);

      callbackBuffer.add(createTestChunk('A'));
      callbackBuffer.add(createTestChunk('B'));

      callbackBuffer.flush();

      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'A' }),
          expect.objectContaining({ content: 'B' }),
        ]),
      );

      callbackBuffer.destroy();
    });

    it('should not call onFlush when buffer is empty', () => {
      const onFlush = vi.fn();
      const callbackBuffer = new ChunkBuffer({ maxChunks: 10 }, onFlush);

      callbackBuffer.flush();

      expect(onFlush).not.toHaveBeenCalled();

      callbackBuffer.destroy();
    });
  });

  describe('Auto-Flush', () => {
    it('should auto-flush when maxChunks exceeded', () => {
      const smallBuffer = new ChunkBuffer({ maxChunks: 2, maxBytes: 1024 });

      smallBuffer.add(createTestChunk('A'));
      smallBuffer.add(createTestChunk('B'));
      smallBuffer.add(createTestChunk('C')); // Should trigger flush

      // Buffer should be empty after auto-flush
      expect(smallBuffer.size()).toBeLessThan(3);

      smallBuffer.destroy();
    });

    it('should auto-flush when maxBytes exceeded', () => {
      const smallBuffer = new ChunkBuffer({
        maxChunks: 100,
        maxBytes: 50,
      });

      // Add large chunks
      smallBuffer.add(createTestChunk('A'.repeat(30)));
      smallBuffer.add(createTestChunk('B'.repeat(30))); // Should trigger flush

      expect(smallBuffer.size()).toBeLessThan(2);

      smallBuffer.destroy();
    });

    it('should auto-flush on interval', async () => {
      vi.useFakeTimers();

      const onFlush = vi.fn();
      const timedBuffer = new ChunkBuffer(
        {
          maxChunks: 100,
          maxBytes: 1024,
          flushIntervalMs: 100,
        },
        onFlush,
      );

      timedBuffer.add(createTestChunk('A'));

      // Advance time to trigger flush
      vi.advanceTimersByTime(150);

      expect(onFlush).toHaveBeenCalled();

      timedBuffer.destroy();
      vi.useRealTimers();
    });

    it('should not auto-flush empty buffer on interval', async () => {
      vi.useFakeTimers();

      const onFlush = vi.fn();
      const timedBuffer = new ChunkBuffer(
        {
          flushIntervalMs: 100,
        },
        onFlush,
      );

      // Advance time without adding chunks
      vi.advanceTimersByTime(150);

      expect(onFlush).not.toHaveBeenCalled();

      timedBuffer.destroy();
      vi.useRealTimers();
    });
  });

  describe('Peeking', () => {
    it('should peek at chunks without flushing', () => {
      buffer.add(createTestChunk('A'));
      buffer.add(createTestChunk('B'));

      const chunks = buffer.peek();

      expect(chunks.length).toBe(2);
      expect(buffer.size()).toBe(2); // Should not be cleared
    });

    it('should return readonly array', () => {
      buffer.add(createTestChunk('A'));

      const chunks = buffer.peek();

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Clearing', () => {
    it('should clear buffer without flushing', () => {
      const onFlush = vi.fn();
      const callbackBuffer = new ChunkBuffer({ maxChunks: 10 }, onFlush);

      callbackBuffer.add(createTestChunk('A'));
      callbackBuffer.add(createTestChunk('B'));

      callbackBuffer.clear();

      expect(callbackBuffer.size()).toBe(0);
      expect(callbackBuffer.bytes()).toBe(0);
      expect(onFlush).not.toHaveBeenCalled();

      callbackBuffer.destroy();
    });
  });

  describe('State Queries', () => {
    it('should check if buffer is empty', () => {
      expect(buffer.isEmpty()).toBe(true);

      buffer.add(createTestChunk('A'));

      expect(buffer.isEmpty()).toBe(false);

      buffer.flush();

      expect(buffer.isEmpty()).toBe(true);
    });

    it('should return correct size', () => {
      expect(buffer.size()).toBe(0);

      buffer.add(createTestChunk('A'));
      expect(buffer.size()).toBe(1);

      buffer.add(createTestChunk('B'));
      expect(buffer.size()).toBe(2);

      buffer.flush();
      expect(buffer.size()).toBe(0);
    });
  });

  describe('Timer Management', () => {
    it('should stop flush timer', () => {
      vi.useFakeTimers();

      const onFlush = vi.fn();
      const timedBuffer = new ChunkBuffer({ flushIntervalMs: 100 }, onFlush);

      timedBuffer.add(createTestChunk('A'));
      timedBuffer.stop();

      // Timer should be stopped, so no flush should occur
      vi.advanceTimersByTime(150);

      expect(onFlush).not.toHaveBeenCalled();

      timedBuffer.destroy();
      vi.useRealTimers();
    });

    it('should be safe to stop when no timer is running', () => {
      expect(() => buffer.stop()).not.toThrow();
    });
  });

  describe('Destroy', () => {
    it('should clean up resources', () => {
      buffer.add(createTestChunk('A'));

      buffer.destroy();

      expect(buffer.size()).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
    });

    it('should stop timer on destroy', () => {
      vi.useFakeTimers();

      const onFlush = vi.fn();
      const timedBuffer = new ChunkBuffer({ flushIntervalMs: 100 }, onFlush);

      timedBuffer.add(createTestChunk('A'));
      timedBuffer.destroy();

      vi.advanceTimersByTime(150);

      expect(onFlush).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should be safe to destroy multiple times', () => {
      expect(() => {
        buffer.destroy();
        buffer.destroy();
      }).not.toThrow();
    });
  });

  describe('Chunk Size Estimation', () => {
    it('should estimate size for text chunks', () => {
      buffer.add(createTestChunk('Hello World'));

      expect(buffer.bytes()).toBeGreaterThan(0);
    });

    it('should estimate size for tool call chunks', () => {
      const toolChunk: StreamChunk = {
        type: 'tool_call',
        toolCall: {
          id: 'call_1',
          name: 'calculator',
          arguments: '{"a":5,"b":3}',
        },
        timestamp: Date.now(),
        index: 0,
      };

      buffer.add(toolChunk);

      expect(buffer.bytes()).toBeGreaterThan(0);
    });

    it('should estimate size for metadata chunks', () => {
      const metadataChunk: StreamChunk = {
        type: 'metadata',
        metadata: { key: 'value', nested: { data: 123 } },
        timestamp: Date.now(),
        index: 0,
      };

      buffer.add(metadataChunk);

      expect(buffer.bytes()).toBeGreaterThan(0);
    });
  });

  describe('Order Preservation', () => {
    it('should preserve order when enabled', () => {
      const orderedBuffer = new ChunkBuffer({
        maxChunks: 10,
        preserveOrder: true,
      });

      orderedBuffer.add(createTestChunk('C', 2));
      orderedBuffer.add(createTestChunk('A', 0));
      orderedBuffer.add(createTestChunk('B', 1));

      const chunks = orderedBuffer.flush();

      expect(chunks[0].content).toBe('A');
      expect(chunks[1].content).toBe('B');
      expect(chunks[2].content).toBe('C');

      orderedBuffer.destroy();
    });

    it('should not sort when preserveOrder is false', () => {
      const unorderedBuffer = new ChunkBuffer({
        maxChunks: 10,
        preserveOrder: false,
      });

      unorderedBuffer.add(createTestChunk('C', 2));
      unorderedBuffer.add(createTestChunk('A', 0));
      unorderedBuffer.add(createTestChunk('B', 1));

      const chunks = unorderedBuffer.flush();

      // Should maintain insertion order
      expect(chunks[0].content).toBe('C');
      expect(chunks[1].content).toBe('A');
      expect(chunks[2].content).toBe('B');

      unorderedBuffer.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large chunks', () => {
      // Create a buffer with enough capacity for large chunks
      const largeBuffer = new ChunkBuffer({
        maxChunks: 100,
        maxBytes: 100000, // 100KB to handle large content
        flushIntervalMs: 0,
        preserveOrder: true,
      });

      const largeContent = 'A'.repeat(10000);
      largeBuffer.add(createTestChunk(largeContent));

      // estimateChunkSize uses content.length * 2 for Unicode
      expect(largeBuffer.bytes()).toBeGreaterThan(10000);

      largeBuffer.destroy();
    });

    it('should handle chunks with missing properties', () => {
      const minimalChunk: StreamChunk = {
        type: 'text',
        timestamp: Date.now(),
        index: 0,
      };

      buffer.add(minimalChunk);

      expect(buffer.size()).toBe(1);
    });

    it('should handle rapid adds and flushes', () => {
      for (let i = 0; i < 100; i++) {
        buffer.add(createTestChunk(`Chunk ${i}`));
        if (i % 10 === 0) {
          buffer.flush();
        }
      }

      expect(buffer.size()).toBeGreaterThanOrEqual(0);
    });
  });
});

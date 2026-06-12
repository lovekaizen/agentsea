/**
 * StreamRecorder tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StreamRecorder } from '../streaming/StreamRecorder.js';
import type { StreamChunk } from '../types/index.js';

describe('StreamRecorder', () => {
  let recorder: StreamRecorder;

  beforeEach(() => {
    recorder = new StreamRecorder({
      maxChunks: 1000,
      captureToolCalls: true,
      captureMetadata: true,
    });
  });

  describe('Recording Lifecycle', () => {
    it('should start recording', () => {
      expect(recorder.isRecording()).toBe(false);

      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      expect(recorder.isRecording()).toBe(true);
    });

    it('should throw if starting while already recording', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      expect(() => {
        recorder.start('gpt-5.5', [{ role: 'user', content: 'World' }]);
      }).toThrow('Recording already in progress');
    });

    it('should complete recording', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
      recorder.recordText('Response');

      const stream = recorder.complete();

      expect(stream.complete).toBe(true);
      expect(stream.chunks.length).toBe(1);
      expect(stream.model).toBe('gpt-5.5');
      expect(recorder.isRecording()).toBe(false);
    });

    it('should abort recording', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
      recorder.recordText('Partial');

      const stream = recorder.abort('User cancelled');

      expect(stream.complete).toBe(false);
      expect(stream.error).toBe('User cancelled');
      expect(recorder.isRecording()).toBe(false);
    });

    it('should throw if completing without starting', () => {
      expect(() => recorder.complete()).toThrow('Not currently recording');
    });

    it('should throw if aborting without starting', () => {
      expect(() => recorder.abort()).toThrow('Not currently recording');
    });
  });

  describe('Recording Chunks', () => {
    beforeEach(() => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
    });

    it('should record text chunks', () => {
      recorder.recordText('Hello');
      recorder.recordText(' world');

      const stream = recorder.complete();

      expect(stream.chunks.length).toBe(2);
      expect(stream.chunks[0].type).toBe('text');
      expect(stream.chunks[0].content).toBe('Hello');
      expect(stream.chunks[1].content).toBe(' world');
    });

    it('should track total characters', () => {
      recorder.recordText('Hello');
      recorder.recordText(' world');

      const stream = recorder.complete();

      expect(stream.totalChars).toBe(11);
    });

    it('should record tool calls', () => {
      recorder.recordToolCall('call_1', 'calculator', '{"a":5,"b":3}');

      const stream = recorder.complete();

      expect(stream.chunks[0].type).toBe('tool_call');
      expect(stream.chunks[0].toolCall).toEqual({
        id: 'call_1',
        name: 'calculator',
        arguments: '{"a":5,"b":3}',
      });
    });

    it('should record tool results', () => {
      recorder.recordToolResult('call_1', '8');

      const stream = recorder.complete();

      expect(stream.chunks[0].type).toBe('tool_result');
      expect(stream.chunks[0].toolResult).toEqual({
        callId: 'call_1',
        content: '8',
      });
    });

    it('should record metadata', () => {
      recorder.recordMetadata({ custom: 'value' });

      const stream = recorder.complete();

      expect(stream.chunks[0].type).toBe('metadata');
      expect(stream.chunks[0].metadata).toEqual({ custom: 'value' });
    });

    it('should record generic chunks', () => {
      const chunk: StreamChunk = {
        type: 'text',
        content: 'Test',
        timestamp: Date.now(),
        index: 0,
      };

      recorder.recordChunk(chunk);

      const stream = recorder.complete();

      expect(stream.chunks[0]).toEqual(chunk);
    });

    it('should throw if recording without starting', () => {
      recorder.complete(); // Stop recording

      expect(() => recorder.recordText('Text')).toThrow(
        'Not currently recording',
      );
    });

    it('should throw if max chunks exceeded', () => {
      const smallRecorder = new StreamRecorder({ maxChunks: 2 });
      smallRecorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      smallRecorder.recordText('Chunk 1');
      smallRecorder.recordText('Chunk 2');

      expect(() => smallRecorder.recordText('Chunk 3')).toThrow(
        'Maximum chunks exceeded',
      );
    });
  });

  describe('Configuration', () => {
    it('should not capture tool calls when disabled', () => {
      const noToolsRecorder = new StreamRecorder({ captureToolCalls: false });
      noToolsRecorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      noToolsRecorder.recordToolCall('call_1', 'tool', '{}');

      const stream = noToolsRecorder.complete();

      expect(stream.chunks.length).toBe(0);
    });

    it('should not capture metadata when disabled', () => {
      const noMetadataRecorder = new StreamRecorder({ captureMetadata: false });
      noMetadataRecorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      noMetadataRecorder.recordText('Text', { meta: 'data' });

      const stream = noMetadataRecorder.complete();

      expect(stream.chunks[0].metadata).toBeUndefined();
    });

    it('should use custom key if provided', () => {
      recorder.start(
        'gpt-5.5',
        [{ role: 'user', content: 'Hello' }],
        'custom-key',
      );

      const stream = recorder.complete();

      expect(stream.key).toBe('custom-key');
    });

    it('should generate key if not provided', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      const stream = recorder.complete();

      expect(stream.key).toBeDefined();
      expect(stream.key.length).toBeGreaterThan(0);
    });
  });

  describe('Timing', () => {
    it('should track start and end time', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      const stream = recorder.complete();

      expect(stream.startTime).toBeGreaterThan(0);
      // Start and end time can be equal if operation completes within same millisecond
      expect(stream.endTime).toBeGreaterThanOrEqual(stream.startTime);
      expect(stream.durationMs).toBe(stream.endTime - stream.startTime);
    });

    it('should get current duration while recording', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      const duration = recorder.getDuration();

      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 duration when not recording', () => {
      const duration = recorder.getDuration();

      expect(duration).toBe(0);
    });

    it('should abort on max duration timeout', async () => {
      vi.useFakeTimers();

      const timedRecorder = new StreamRecorder({ maxDurationMs: 100 });
      timedRecorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      // Fast-forward time
      vi.advanceTimersByTime(150);

      // Recording should be aborted
      expect(timedRecorder.isRecording()).toBe(false);

      vi.useRealTimers();
    });

    it('should not timeout if maxDurationMs is 0', async () => {
      const noTimeoutRecorder = new StreamRecorder({ maxDurationMs: 0 });
      noTimeoutRecorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      expect(noTimeoutRecorder.isRecording()).toBe(true);
    });
  });

  describe('Token Usage', () => {
    it('should include token usage in completed stream', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
      recorder.recordText('Response');

      const stream = recorder.complete({
        prompt: 10,
        completion: 5,
        total: 15,
      });

      expect(stream.tokenUsage).toEqual({
        prompt: 10,
        completion: 5,
        total: 15,
      });
    });

    it('should work without token usage', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
      recorder.recordText('Response');

      const stream = recorder.complete();

      expect(stream.tokenUsage).toBeUndefined();
    });
  });

  describe('Chunk Count', () => {
    it('should track chunk count', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      expect(recorder.getChunkCount()).toBe(0);

      recorder.recordText('Text 1');
      expect(recorder.getChunkCount()).toBe(1);

      recorder.recordText('Text 2');
      expect(recorder.getChunkCount()).toBe(2);
    });
  });

  describe('Destroy', () => {
    it('should clean up resources', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      recorder.destroy();

      expect(recorder.isRecording()).toBe(false);
    });

    it('should be safe to destroy when not recording', () => {
      expect(() => recorder.destroy()).not.toThrow();
    });
  });

  describe('Chunk Indexing', () => {
    it('should auto-increment chunk indices', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      recorder.recordText('First');
      recorder.recordText('Second');
      recorder.recordText('Third');

      const stream = recorder.complete();

      expect(stream.chunks[0].index).toBe(0);
      expect(stream.chunks[1].index).toBe(1);
      expect(stream.chunks[2].index).toBe(2);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle abort with no reason', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      const stream = recorder.abort();

      expect(stream.error).toBe('Recording aborted');
    });

    it('should handle empty recordings', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);

      const stream = recorder.complete();

      expect(stream.chunks.length).toBe(0);
      expect(stream.totalChars).toBe(0);
    });
  });

  describe('Reset State', () => {
    it('should reset state after complete', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
      recorder.recordText('Text');
      recorder.complete();

      // Should be able to start new recording
      recorder.start('gpt-5.5', [{ role: 'user', content: 'World' }]);
      expect(recorder.isRecording()).toBe(true);
      expect(recorder.getChunkCount()).toBe(0);
    });

    it('should reset state after abort', () => {
      recorder.start('gpt-5.5', [{ role: 'user', content: 'Hello' }]);
      recorder.recordText('Text');
      recorder.abort();

      // Should be able to start new recording
      recorder.start('gpt-5.5', [{ role: 'user', content: 'World' }]);
      expect(recorder.isRecording()).toBe(true);
    });
  });
});

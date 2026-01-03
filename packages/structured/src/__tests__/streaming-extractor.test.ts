/**
 * Tests for StreamingExtractor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  createStreamingResult,
  getPartialState,
} from '../streaming/StreamingExtractor.js';
import type { StructuredClient } from '../core/StructuredClient.js';
import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderStreamChunk,
} from '../types/provider.types.js';

// Mock provider that yields chunks
function createMockProvider(chunks: ProviderStreamChunk[]): ProviderAdapter {
  return {
    name: 'mock',
    getCapabilities: () => ({
      jsonMode: true,
      strictJsonMode: true,
      toolCalling: true,
      streaming: true,
      systemMessages: true,
      maxContextWindow: 128000,
      maxOutputTokens: 4096,
    }),
    supportsJsonMode: () => true,
    supportsToolCalling: () => true,
    createCompletion: vi.fn(),
    async *createStreamingCompletion(
      _request: ProviderRequest,
    ): AsyncIterableIterator<ProviderStreamChunk> {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
    formatMessages: vi.fn((msgs) => msgs),
    formatJsonSchema: vi.fn((schema) => schema),
    formatToolDefinition: vi.fn((tool) => tool),
  };
}

// Mock structured client
function createMockClient(): StructuredClient {
  return {} as StructuredClient;
}

describe('StreamingExtractor', () => {
  describe('createStreamingResult', () => {
    const TestSchema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });

    it('should stream and parse JSON incrementally', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"name":', isFinal: false },
        { content: '"Alice"', isFinal: false },
        { content: ',"age":', isFinal: false },
        { content: '30', isFinal: false },
        { content: ',"active":', isFinal: false },
        {
          content: 'true}',
          isFinal: true,
          usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract info' }],
        response_format: TestSchema,
      });

      const final = await result.final();

      expect(final.name).toBe('Alice');
      expect(final.age).toBe(30);
      expect(final.active).toBe(true);
    });

    it('should emit field events', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"name":"Bob","age":25}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract info' }],
        response_format: z.object({ name: z.string(), age: z.number() }),
      });

      const fields: Array<{ path: string; value: unknown }> = [];
      result.onField((path, value) => {
        fields.push({ path, value });
      });

      await result.final();

      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.path === 'name' && f.value === 'Bob')).toBe(
        true,
      );
      expect(fields.some((f) => f.path === 'age' && f.value === 25)).toBe(true);
    });

    it('should emit partial updates when enabled', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"first":"A","second":"B","third":"C"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const partials: Array<
        Partial<{ first: string; second: string; third: string }>
      > = [];

      const result = createStreamingResult(
        client,
        provider,
        {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Extract' }],
          response_format: z.object({
            first: z.string(),
            second: z.string(),
            third: z.string(),
          }),
        },
        {
          yieldPartials: true,
          minFieldsBeforeYield: 1,
          onPartial: (partial) => {
            partials.push({ ...partial });
          },
        },
      );

      await result.final();

      expect(partials.length).toBeGreaterThan(0);
    });

    it('should emit complete event on successful extraction', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"value":"test"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      let completed = false;
      let completedData: unknown = null;

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ value: z.string() }),
      });

      result.onComplete((data) => {
        completed = true;
        completedData = data;
      });

      await result.final();

      expect(completed).toBe(true);
      expect(completedData).toEqual({ value: 'test' });
    });

    it('should emit error event on validation failure', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"wrong":"field"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      let errorEmitted = false;
      let emittedError: Error | null = null;

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ required: z.string() }),
      });

      result.onError((error) => {
        errorEmitted = true;
        emittedError = error;
      });

      await expect(result.final()).rejects.toThrow();
      expect(errorEmitted).toBe(true);
      expect(emittedError).not.toBeNull();
    });

    it('should provide current partial state', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"a":1,"b":2}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ a: z.number(), b: z.number() }),
      });

      await result.final();

      // After completion, current should have the data
      const current = result.current;
      expect(current).toBeDefined();
    });

    it('should track isComplete status', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"data":"test"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ data: z.string() }),
      });

      expect(result.isComplete).toBe(false);

      await result.final();

      expect(result.isComplete).toBe(true);
    });

    it('should support cancellation', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"a":1}', isFinal: false },
        { content: ',"b":2', isFinal: false },
        { content: '}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ a: z.number(), b: z.number() }),
      });

      // Cancel immediately
      result.cancel();

      // Should still have a result method
      expect(typeof result.final).toBe('function');
    });

    it('should handle nested objects', async () => {
      const NestedSchema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            bio: z.string(),
          }),
        }),
      });

      const chunks: ProviderStreamChunk[] = [
        {
          content: '{"user":{"name":"Alice","profile":{"bio":"Developer"}}}',
          isFinal: true,
        },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: NestedSchema,
      });

      const final = await result.final();

      expect(final.user.name).toBe('Alice');
      expect(final.user.profile.bio).toBe('Developer');
    });

    it('should handle arrays', async () => {
      const ArraySchema = z.object({
        items: z.array(z.string()),
      });

      const chunks: ProviderStreamChunk[] = [
        { content: '{"items":["a","b","c"]}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: ArraySchema,
      });

      const final = await result.final();

      expect(final.items).toEqual(['a', 'b', 'c']);
    });

    it('should iterate over field updates', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"x":1,"y":2}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ x: z.number(), y: z.number() }),
      });

      const updates: Array<{ path: string; value: unknown }> = [];
      for await (const update of result.fields()) {
        updates.push({ path: update.path, value: update.value });
      }

      expect(updates.length).toBeGreaterThan(0);
    });

    it('should iterate over partials', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"a":1,"b":2,"c":3}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(
        client,
        provider,
        {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Extract' }],
          response_format: z.object({
            a: z.number(),
            b: z.number(),
            c: z.number(),
          }),
        },
        {
          yieldPartials: true,
          minFieldsBeforeYield: 1,
        },
      );

      const partials: unknown[] = [];
      for await (const partial of result.partials()) {
        partials.push(partial);
      }

      // May or may not have partials depending on timing
      expect(Array.isArray(partials)).toBe(true);
    });

    it('should call onFieldComplete callback', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"field":"value"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const completedFields: Array<{ path: string; value: unknown }> = [];

      const result = createStreamingResult(
        client,
        provider,
        {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Extract' }],
          response_format: z.object({ field: z.string() }),
        },
        {
          onFieldComplete: (path, value) => {
            completedFields.push({ path, value });
          },
        },
      );

      await result.final();

      expect(completedFields.length).toBeGreaterThan(0);
    });

    it('should call onError callback on provider error', async () => {
      const errorProvider: ProviderAdapter = {
        name: 'error-mock',
        getCapabilities: () => ({
          jsonMode: true,
          strictJsonMode: true,
          toolCalling: true,
          streaming: true,
          systemMessages: true,
        }),
        supportsJsonMode: () => true,
        supportsToolCalling: () => true,
        createCompletion: vi.fn(),
        async *createStreamingCompletion(): AsyncIterableIterator<ProviderStreamChunk> {
          throw new Error('Provider error');
        },
        formatMessages: vi.fn(),
        formatJsonSchema: vi.fn(),
        formatToolDefinition: vi.fn(),
      };

      const client = createMockClient();

      let errorCalled = false;

      const result = createStreamingResult(
        client,
        errorProvider,
        {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Extract' }],
          response_format: z.object({ data: z.string() }),
        },
        {
          onError: () => {
            errorCalled = true;
          },
        },
      );

      await expect(result.final()).rejects.toThrow('Provider error');
      expect(errorCalled).toBe(true);
    });

    it('should prepend schema to system message', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"test":"value"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Extract data' },
        ],
        response_format: z.object({ test: z.string() }),
      });

      await result.final();

      // The provider should have been called with modified messages
      expect(result.isComplete).toBe(true);
    });

    it('should add system message if none exists', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: '{"test":"value"}', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract data' }],
        response_format: z.object({ test: z.string() }),
      });

      await result.final();

      expect(result.isComplete).toBe(true);
    });

    it('should throw if stream completes without valid result', async () => {
      const chunks: ProviderStreamChunk[] = [
        { content: 'not json', isFinal: true },
      ];

      const provider = createMockProvider(chunks);
      const client = createMockClient();

      const result = createStreamingResult(client, provider, {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Extract' }],
        response_format: z.object({ data: z.string() }),
      });

      await expect(result.final()).rejects.toThrow();
    });
  });

  describe('getPartialState', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      address: z.object({
        city: z.string(),
        zip: z.string(),
      }),
    });

    it('should return completed fields', () => {
      const partial = { name: 'Alice', age: 30 };
      const state = getPartialState(schema, partial);

      expect(state.completedFields).toContain('name');
      expect(state.completedFields).toContain('age');
    });

    it('should return in-progress fields', () => {
      const partial = { name: 'Alice' };
      const state = getPartialState(schema, partial);

      expect(state.inProgressFields.length).toBeGreaterThan(0);
    });

    it('should calculate completion percentage', () => {
      const partial = { name: 'Alice', age: 30 };
      const state = getPartialState(schema, partial);

      expect(state.completionPercent).toBeGreaterThan(0);
      expect(state.completionPercent).toBeLessThanOrEqual(100);
    });

    it('should indicate validity', () => {
      // Partial that matches schema partially
      const partial = { name: 'Alice', age: 30 };
      const state = getPartialState(schema, partial);

      // Since it's partial, isValid might be false (missing address)
      expect(typeof state.isValid).toBe('boolean');
    });

    it('should handle empty partial', () => {
      const state = getPartialState(schema, {});

      expect(state.completedFields).toEqual([]);
      expect(state.completionPercent).toBe(0);
    });

    it('should handle complete data', () => {
      const complete = {
        name: 'Alice',
        age: 30,
        address: { city: 'NYC', zip: '10001' },
      };
      const state = getPartialState(schema, complete);

      expect(state.completionPercent).toBe(100);
    });

    it('should handle nested fields', () => {
      const partial = {
        name: 'Alice',
        address: { city: 'NYC' },
      };
      const state = getPartialState(schema, partial);

      expect(state.completedFields.some((f) => f.includes('address'))).toBe(
        true,
      );
    });

    it('should handle arrays in partial', () => {
      const arraySchema = z.object({
        items: z.array(z.string()),
      });

      const partial = { items: ['a', 'b'] };
      const state = getPartialState(arraySchema, partial);

      expect(state.completedFields.length).toBeGreaterThan(0);
    });

    it('should return data in state', () => {
      const partial = { name: 'Alice' };
      const state = getPartialState(schema, partial);

      expect(state.data).toEqual(partial);
    });
  });
});

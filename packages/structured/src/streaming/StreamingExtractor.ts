/**
 * Streaming Extractor
 *
 * Extracts structured data from streaming LLM responses.
 */

import { z } from 'zod';
import { EventEmitter } from 'eventemitter3';
import type {
  StreamingResult,
  StreamingOptions,
  FieldUpdate,
  PartialState,
  StreamMetadata,
} from '../types/streaming.types.js';
import type {
  StructuredRequestOptions,
  ChatMessage,
} from '../types/core.types.js';
import type { ProviderAdapter } from '../types/provider.types.js';
import type { StructuredClient } from '../core/StructuredClient.js';
import { zodToJsonSchema, schemaToPrompt } from '../schema/SchemaToPrompt.js';
import { validatePartial } from '../schema/SchemaValidator.js';
import { IncrementalJsonParser } from './IncrementalJsonParser.js';

/**
 * Events for streaming result
 */
interface StreamingResultEvents<T> {
  partial: { data: Partial<T>; path: string | null };
  field: { path: string; value: unknown };
  complete: { data: T };
  error: { error: Error };
}

/**
 * Create a streaming result for extracting structured data
 */
export function createStreamingResult<T extends z.ZodType>(
  _client: StructuredClient,
  provider: ProviderAdapter,
  options: StructuredRequestOptions<T>,
  streamingOptions?: StreamingOptions,
): StreamingResult<z.infer<T>> {
  const emitter = new EventEmitter<StreamingResultEvents<z.infer<T>>>();
  const parser = new IncrementalJsonParser();

  let isComplete = false;
  const current: Partial<z.infer<T>> = {};
  let finalResult: z.infer<T> | undefined;
  let error: Error | undefined;
  let cancelled = false;

  const metadata: StreamMetadata = {
    totalChunks: 0,
    totalChars: 0,
    startTime: Date.now(),
  };

  // Start streaming extraction
  const streamPromise = executeStreamingExtraction();

  async function executeStreamingExtraction(): Promise<void> {
    try {
      const jsonSchema = zodToJsonSchema(options.response_format);
      const messages = prepareMessages(
        options.messages,
        options.response_format,
      );

      const stream = provider.createStreamingCompletion({
        model: options.model,
        messages,
        mode: 'json',
        jsonSchema,
        stream: true,
      });

      for await (const chunk of stream) {
        if (cancelled) {
          break;
        }

        metadata.totalChunks++;
        metadata.totalChars += chunk.content.length;

        // Feed chunk to parser
        const updates = parser.feed(chunk.content);

        // Process field updates
        for (const update of updates) {
          const fieldUpdate: FieldUpdate = {
            path: update.path.join('.'),
            value: update.value,
            complete: update.complete,
            timestamp: Date.now(),
          };

          // Update current partial
          setNestedValue(current, update.path, update.value);

          // Emit events
          if (streamingOptions?.onFieldComplete && update.complete) {
            streamingOptions.onFieldComplete(fieldUpdate.path, update.value);
          }

          emitter.emit('field', {
            path: fieldUpdate.path,
            value: update.value,
          });

          // Emit partial if we have enough fields
          if (shouldEmitPartial(current, streamingOptions)) {
            if (streamingOptions?.onPartial) {
              streamingOptions.onPartial(current, update.path.join('.'));
            }
            emitter.emit('partial', {
              data: current,
              path: update.path.join('.'),
            });
          }
        }

        if (chunk.isFinal) {
          metadata.endTime = Date.now();
          metadata.usage = chunk.usage;
          break;
        }
      }

      // Get final parsed result
      const parsedResult = parser.getResult();

      // Validate final result
      const validation = options.response_format.safeParse(parsedResult);

      if (validation.success) {
        finalResult = validation.data;
        isComplete = true;
        emitter.emit('complete', { data: finalResult });
      } else {
        error = new Error(
          `Validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`,
        );
        emitter.emit('error', { error });
      }
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      emitter.emit('error', { error });
      if (streamingOptions?.onError) {
        streamingOptions.onError(error);
      }
    }
  }

  function prepareMessages(
    messages: ChatMessage[],
    schema: z.ZodType,
  ): ChatMessage[] {
    const prompt = schemaToPrompt(schema, {
      format: 'json-schema',
      includeConstraints: true,
    });

    const systemIndex = messages.findIndex((m) => m.role === 'system');

    if (systemIndex >= 0) {
      const newMessages = [...messages];
      newMessages[systemIndex] = {
        ...newMessages[systemIndex],
        content: `${newMessages[systemIndex].content}\n\nRespond with valid JSON matching this schema:\n${prompt.text}`,
      };
      return newMessages;
    }

    return [
      {
        role: 'system',
        content: `Respond with valid JSON matching this schema:\n${prompt.text}`,
      },
      ...messages,
    ];
  }

  function shouldEmitPartial(
    partial: Partial<z.infer<T>>,
    options?: StreamingOptions,
  ): boolean {
    if (!options?.yieldPartials) {
      return false;
    }

    const fieldCount = countFields(partial);
    const minFields = options.minFieldsBeforeYield ?? 1;

    return fieldCount >= minFields;
  }

  function countFields(obj: unknown, count = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return count + 1;
    }

    if (Array.isArray(obj)) {
      return obj.reduce((c, item) => countFields(item, c), count);
    }

    return Object.values(obj).reduce(
      (c, value) => countFields(value, c),
      count,
    );
  }

  function setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): void {
    let current = obj;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];

      if (!(key in current)) {
        // Check if next key is numeric (array)
        const nextKey = path[i + 1];
        current[key] = /^\d+$/.test(nextKey) ? [] : {};
      }

      current = current[key] as Record<string, unknown>;
    }

    const lastKey = path[path.length - 1];
    current[lastKey] = value;
  }

  // Return StreamingResult interface
  return {
    async *partials(): AsyncIterableIterator<Partial<z.infer<T>>> {
      const partialQueue: Partial<z.infer<T>>[] = [];
      let resolveNext:
        | ((value: IteratorResult<Partial<z.infer<T>>>) => void)
        | null = null;
      let done = false;

      const onPartial = ({ data }: { data: Partial<z.infer<T>> }) => {
        if (resolveNext) {
          resolveNext({ value: { ...data }, done: false });
          resolveNext = null;
        } else {
          partialQueue.push({ ...data });
        }
      };

      const onComplete = () => {
        done = true;
        if (resolveNext) {
          resolveNext({
            value: undefined as unknown as Partial<z.infer<T>>,
            done: true,
          });
          resolveNext = null;
        }
      };

      const onError = () => {
        done = true;
        if (resolveNext) {
          resolveNext({
            value: undefined as unknown as Partial<z.infer<T>>,
            done: true,
          });
          resolveNext = null;
        }
      };

      emitter.on('partial', onPartial);
      emitter.on('complete', onComplete);
      emitter.on('error', onError);

      try {
        while (!done || partialQueue.length > 0) {
          if (partialQueue.length > 0) {
            yield partialQueue.shift()!;
          } else if (!done) {
            const result = await new Promise<
              IteratorResult<Partial<z.infer<T>>>
            >((resolve) => {
              resolveNext = resolve;
            });
            if (!result.done) {
              yield result.value;
            }
          }
        }
      } finally {
        emitter.off('partial', onPartial);
        emitter.off('complete', onComplete);
        emitter.off('error', onError);
      }
    },

    async *fields(): AsyncIterableIterator<FieldUpdate> {
      const fieldQueue: FieldUpdate[] = [];
      let resolveNext: ((value: IteratorResult<FieldUpdate>) => void) | null =
        null;
      let done = false;

      const onField = ({ path, value }: { path: string; value: unknown }) => {
        const update: FieldUpdate = {
          path,
          value,
          complete: true,
          timestamp: Date.now(),
        };

        if (resolveNext) {
          resolveNext({ value: update, done: false });
          resolveNext = null;
        } else {
          fieldQueue.push(update);
        }
      };

      const onComplete = () => {
        done = true;
        if (resolveNext) {
          resolveNext({
            value: undefined as unknown as FieldUpdate,
            done: true,
          });
          resolveNext = null;
        }
      };

      const onError = () => {
        done = true;
        if (resolveNext) {
          resolveNext({
            value: undefined as unknown as FieldUpdate,
            done: true,
          });
          resolveNext = null;
        }
      };

      emitter.on('field', onField);
      emitter.on('complete', onComplete);
      emitter.on('error', onError);

      try {
        while (!done || fieldQueue.length > 0) {
          if (fieldQueue.length > 0) {
            yield fieldQueue.shift()!;
          } else if (!done) {
            const result = await new Promise<IteratorResult<FieldUpdate>>(
              (resolve) => {
                resolveNext = resolve;
              },
            );
            if (!result.done) {
              yield result.value;
            }
          }
        }
      } finally {
        emitter.off('field', onField);
        emitter.off('complete', onComplete);
        emitter.off('error', onError);
      }
    },

    async final(): Promise<z.infer<T>> {
      await streamPromise;

      if (error) {
        throw error;
      }

      if (!finalResult) {
        throw new Error('Stream completed without valid result');
      }

      return finalResult;
    },

    onPartial(
      callback: (partial: Partial<z.infer<T>>, path: string | null) => void,
    ): void {
      emitter.on('partial', ({ data, path }) => callback(data, path));
    },

    onField(callback: (path: string, value: unknown) => void): void {
      emitter.on('field', ({ path, value }) => callback(path, value));
    },

    onComplete(callback: (result: z.infer<T>) => void): void {
      emitter.on('complete', ({ data }) => callback(data));
    },

    onError(callback: (error: Error) => void): void {
      emitter.on('error', ({ error }) => callback(error));
    },

    cancel(): void {
      cancelled = true;
    },

    get isComplete(): boolean {
      return isComplete;
    },

    get current(): Partial<z.infer<T>> {
      return { ...current };
    },
  };
}

/**
 * Get partial state information
 */
export function getPartialState<T>(
  schema: z.ZodType<T>,
  partial: Partial<T>,
): PartialState<T> {
  const fieldPaths = getAllFieldPaths(partial);
  const schemaFieldPaths = getSchemaFieldPaths(schema);

  const completedFields = fieldPaths.filter((p) => {
    const value = getNestedValue(partial as Record<string, unknown>, p);
    return value !== undefined;
  });

  const inProgressFields = schemaFieldPaths.filter(
    (p) => !completedFields.includes(p),
  );

  const validation = validatePartial(schema, partial);

  return {
    data: partial,
    completedFields,
    inProgressFields,
    completionPercent: (completedFields.length / schemaFieldPaths.length) * 100,
    isValid: validation.success,
  };
}

function getAllFieldPaths(
  obj: unknown,
  prefix = '',
  paths: string[] = [],
): string[] {
  if (typeof obj !== 'object' || obj === null) {
    if (prefix) {
      paths.push(prefix);
    }
    return paths;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      getAllFieldPaths(item, `${prefix}[${index}]`, paths);
    });
    return paths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    getAllFieldPaths(value, newPrefix, paths);
  }

  return paths;
}

function getSchemaFieldPaths(schema: z.ZodType, prefix = ''): string[] {
  const paths: string[] = [];

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    for (const [key, fieldSchema] of Object.entries(shape)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      paths.push(...getSchemaFieldPaths(fieldSchema as z.ZodType, newPrefix));
    }
  } else if (schema instanceof z.ZodArray) {
    // For arrays, just mark the array path
    if (prefix) {
      paths.push(prefix);
    }
  } else {
    if (prefix) {
      paths.push(prefix);
    }
  }

  return paths.length > 0 ? paths : [prefix].filter(Boolean);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

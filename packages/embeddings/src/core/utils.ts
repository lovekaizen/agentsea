/**
 * Core Utilities
 *
 * Utility functions for embeddings.
 */

import { createHash } from 'crypto';

/**
 * Generate a content hash for caching
 */
export function contentHash(
  text: string,
  algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256',
): string {
  return createHash(algorithm).update(text).digest('hex');
}

/**
 * Generate a cache key from text and model
 */
export function cacheKey(text: string, model: string, prefix = 'emb'): string {
  const hash = contentHash(`${model}:${text}`);
  return `${prefix}:${model}:${hash}`;
}

/**
 * Estimate token count (rough approximation)
 * For accurate counting, use a proper tokenizer
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English
  // This is an approximation - real tokenizers vary by model
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks by character limit
 */
export function splitByChars(
  text: string,
  maxChars: number,
  overlap = 0,
): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Split text by separator
 */
export function splitBySeparator(
  text: string,
  separator: string | RegExp,
): string[] {
  return text.split(separator).filter((s) => s.trim().length > 0);
}

/**
 * Batch an array into chunks
 */
export function batch<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Execute promises with concurrency limit
 */
export async function withConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: Error) => boolean;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    retryCondition = () => true,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !retryCondition(lastError)) {
        throw lastError;
      }

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a deferred promise
 */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Calculate percentile from an array of numbers
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (p < 0 || p > 100) throw new Error('Percentile must be between 0 and 100');

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate mean of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate variance of an array of numbers
 */
export function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Normalize a value to a range
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Clamp a value to a range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Measure execution time of a function
 */
export async function measureTime<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  return { result, durationMs };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Create a simple event emitter
 */
export function createEventEmitter<T extends Record<string, unknown[]>>() {
  const listeners: { [K in keyof T]?: Array<(...args: T[K]) => void> } = {};

  return {
    on<K extends keyof T>(
      event: K,
      listener: (...args: T[K]) => void,
    ): () => void {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event]!.push(listener);
      return () => this.off(event, listener);
    },

    off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
      const list = listeners[event];
      if (list) {
        const index = list.indexOf(listener);
        if (index !== -1) {
          list.splice(index, 1);
        }
      }
    },

    emit<K extends keyof T>(event: K, ...args: T[K]): void {
      const list = listeners[event];
      if (list) {
        for (const listener of list) {
          listener(...args);
        }
      }
    },

    removeAllListeners<K extends keyof T>(event?: K): void {
      if (event) {
        delete listeners[event];
      } else {
        for (const key of Object.keys(listeners)) {
          delete listeners[key as keyof T];
        }
      }
    },
  };
}

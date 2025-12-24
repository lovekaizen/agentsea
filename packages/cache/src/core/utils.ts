/**
 * Core Utilities
 *
 * Helper functions for the semantic cache.
 */

import { nanoid } from 'nanoid';

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const id = nanoid(16);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Check if an entry has expired based on TTL
 */
export function isExpired(createdAt: number, ttlSeconds: number): boolean {
  if (ttlSeconds <= 0) return false;
  return now() > createdAt + ttlSeconds * 1000;
}

/**
 * Estimate the size of an object in bytes
 */
export function estimateSize(obj: unknown): number {
  const str = JSON.stringify(obj);
  // Rough estimate: 2 bytes per character for UTF-16
  return str.length * 2;
}

/**
 * Estimate size of a cache entry
 */
export function estimateEntrySize(entry: {
  embedding?: number[];
  request: { messages: Array<{ content: string }> };
  response: { content: string };
}): number {
  // Vector: 4 bytes per float32
  const vectorSize = (entry.embedding?.length ?? 0) * 4;

  // Content: roughly 2 bytes per character
  const messageSize = entry.request.messages.reduce(
    (acc, m) => acc + (m.content?.length ?? 0) * 2,
    0,
  );
  const responseSize = (entry.response.content?.length ?? 0) * 2;

  // Metadata overhead
  const overheadSize = 500;

  return vectorSize + messageSize + responseSize + overheadSize;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Calculate percentile from an array of numbers
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate mean of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

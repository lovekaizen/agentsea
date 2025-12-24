/**
 * Helper Utilities
 *
 * Common utility functions for the debugger.
 */

import { nanoid } from 'nanoid';

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix = ''): string {
  const id = nanoid(12);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Calculate duration between two timestamps
 */
export function duration(start: number, end: number = now()): number {
  return end - start;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Map) {
    const clonedMap = new Map();
    obj.forEach((value, key) => {
      clonedMap.set(deepClone(key), deepClone(value));
    });
    return clonedMap as T;
  }

  if (obj instanceof Set) {
    const clonedSet = new Set();
    obj.forEach((value) => {
      clonedSet.add(deepClone(value));
    });
    return clonedSet as T;
  }

  const clonedObj = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (clonedObj as Record<string, unknown>)[key] = deepClone(
        (obj as Record<string, unknown>)[key],
      );
    }
  }

  return clonedObj;
}

/**
 * Safely serialize an object to JSON
 */
export function safeStringify(obj: unknown, indent = 0): string {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }

      // Handle special types
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }

      if (value instanceof Map) {
        return Object.fromEntries(value);
      }

      if (value instanceof Set) {
        return Array.from(value);
      }

      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`;
      }

      if (typeof value === 'bigint') {
        return value.toString();
      }

      return value;
    },
    indent,
  );
}

/**
 * Safely parse JSON
 */
export function safeParse<T>(json: string, defaultValue?: T): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

/**
 * Format bytes in human-readable format
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Truncate string to max length
 */
export function truncate(
  str: string,
  maxLength: number,
  suffix = '...',
): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Sleep for a given duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 100,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Calculate object size in bytes (approximate)
 */
export function estimateSize(obj: unknown): number {
  return safeStringify(obj).length * 2; // UTF-16
}

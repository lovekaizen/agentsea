/**
 * Hashing utilities for cache keys and request deduplication
 */

import murmurhash from 'murmurhash';

/**
 * Generate a hash for a chat completion request
 * Used for exact cache matching
 */
export function hashRequest(request: {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
}): string {
  // Create a normalized representation of the request
  const normalized = {
    model: request.model,
    messages: request.messages.map((m) => ({
      role: m.role,
      content: normalizeContent(m.content),
    })),
    temperature: request.temperature ?? 1,
    max_tokens: request.max_tokens,
    tools: request.tools ? JSON.stringify(request.tools) : undefined,
    tool_choice: request.tool_choice
      ? JSON.stringify(request.tool_choice)
      : undefined,
  };

  const str = JSON.stringify(normalized);
  return murmurhash.v3(str).toString(16);
}

/**
 * Normalize content for hashing (handles string and array content)
 */
function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content === null || content === undefined) {
    return '';
  }
  return JSON.stringify(content);
}

/**
 * Generate a short unique ID
 */
export function generateId(prefix: string = 'gw'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Generate a request ID in OpenAI format
 */
export function generateRequestId(): string {
  return `chatcmpl-${generateId('')}`;
}

/**
 * Generate a cache key for a request
 */
export function generateCacheKey(
  provider: string,
  model: string,
  requestHash: string,
): string {
  return `gw:cache:${provider}:${model}:${requestHash}`;
}

/**
 * Hash a string using murmur3
 */
export function hash(str: string): string {
  return murmurhash.v3(str).toString(16);
}

/**
 * Create a fingerprint for system configuration
 * (used to invalidate cache when config changes)
 */
export function createSystemFingerprint(config: {
  version: string;
  providers: string[];
}): string {
  const str = JSON.stringify(config);
  return `fp_${murmurhash.v3(str).toString(16)}`;
}

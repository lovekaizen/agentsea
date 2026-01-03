/**
 * Cache Key Generation
 *
 * Utilities for generating and normalizing cache keys.
 */

import murmurhash from 'murmurhash';
import type { CacheMessage, CacheKeyOptions } from '../types/index.js';

/**
 * Default key options
 */
const DEFAULT_KEY_OPTIONS: CacheKeyOptions = {
  includeTemperature: false,
  includeTools: false,
  normalizeWhitespace: true,
  extractUserMessage: false,
};

/**
 * Generate a cache key from request parameters
 *
 * @param model - The model name
 * @param messages - The conversation messages
 * @param options - Key generation options
 * @returns A unique cache key string
 */
export function generateCacheKey(
  model: string,
  messages: CacheMessage[],
  options: CacheKeyOptions = {},
): string {
  const opts = { ...DEFAULT_KEY_OPTIONS, ...options };
  const normalized = normalizeRequest(model, messages, opts);
  const hash = murmurhash.v3(JSON.stringify(normalized)).toString(16);
  return `cache:${model}:${hash}`;
}

/**
 * Normalize request for consistent hashing
 */
export function normalizeRequest(
  model: string,
  messages: CacheMessage[],
  options: CacheKeyOptions = {},
): Record<string, unknown> {
  const normalizedMessages = messages.map((m) => ({
    role: m.role,
    content: options.normalizeWhitespace
      ? normalizeWhitespace(m.content)
      : m.content,
  }));

  return {
    model,
    messages: options.extractUserMessage
      ? extractUserMessage(normalizedMessages)
      : normalizedMessages,
  };
}

/**
 * Normalize whitespace in text
 *
 * - Trims leading/trailing whitespace
 * - Collapses multiple spaces into single space
 * - Normalizes line endings
 */
export function normalizeWhitespace(text: string): string {
  return text.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
}

/**
 * Extract the last user message for semantic comparison
 */
export function extractUserMessage(
  messages: CacheMessage[] | Array<{ role: string; content: string }>,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return messages[i].content;
    }
  }
  return '';
}

/**
 * Extract system prompt from messages
 */
export function extractSystemPrompt(
  messages: CacheMessage[],
): string | undefined {
  const systemMessage = messages.find((m) => m.role === 'system');
  return systemMessage?.content;
}

/**
 * Generate a semantic key for embedding lookup
 * Uses only the user message and model for semantic matching
 */
export function generateSemanticKey(
  model: string,
  messages: CacheMessage[],
): string {
  const userMessage = extractUserMessage(messages);
  const normalized = normalizeWhitespace(userMessage);
  return `${model}:${normalized}`;
}

/**
 * Generate a fingerprint for a conversation
 * Useful for detecting similar conversation patterns
 */
export function generateConversationFingerprint(
  messages: CacheMessage[],
): string {
  const pattern = messages
    .map((m) => `${m.role}:${m.content.length}`)
    .join('|');
  return murmurhash.v3(pattern).toString(16);
}

/**
 * Parse a cache key to extract components
 */
export function parseCacheKey(key: string): {
  prefix: string;
  model: string;
  hash: string;
} | null {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== 'cache') {
    return null;
  }
  return {
    prefix: parts[0],
    model: parts[1],
    hash: parts[2],
  };
}

/**
 * Check if two cache keys are for the same model
 */
export function isSameModel(key1: string, key2: string): boolean {
  const parsed1 = parseCacheKey(key1);
  const parsed2 = parseCacheKey(key2);
  if (!parsed1 || !parsed2) return false;
  return parsed1.model === parsed2.model;
}

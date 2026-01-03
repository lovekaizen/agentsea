/**
 * Core Exports
 *
 * Main cache functionality.
 */

export {
  SemanticCache,
  createSemanticCache,
  type SemanticCacheEvents,
  type CacheRequest,
  type CacheResponseInput,
} from './SemanticCache.js';

export {
  generateCacheKey,
  generateSemanticKey,
  generateConversationFingerprint,
  normalizeRequest,
  normalizeWhitespace,
  extractUserMessage,
  extractSystemPrompt,
  parseCacheKey,
  isSameModel,
} from './CacheKey.js';

export {
  generateId,
  now,
  isExpired,
  estimateSize,
  estimateEntrySize,
  sleep,
  retry,
  chunk,
  deepClone,
  percentile,
  mean,
} from './utils.js';

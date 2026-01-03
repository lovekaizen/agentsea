/**
 * Text Utilities
 *
 * Common text processing utilities for guards.
 */

/**
 * Normalize whitespace in text
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Remove accents from text
 */
export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

/**
 * Extract sentences from text
 */
export function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Truncate text to a maximum length
 */
export function truncate(
  text: string,
  maxLength: number,
  suffix = '...',
): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Escape regex special characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if text contains any of the given keywords
 */
export function containsAny(
  text: string,
  keywords: string[],
  caseInsensitive = true,
): boolean {
  const normalizedText = caseInsensitive ? text.toLowerCase() : text;
  return keywords.some((keyword) => {
    const normalizedKeyword = caseInsensitive ? keyword.toLowerCase() : keyword;
    return normalizedText.includes(normalizedKeyword);
  });
}

/**
 * Find all occurrences of a pattern in text
 */
export function findAllMatches(
  text: string,
  pattern: RegExp,
): Array<{ match: string; index: number }> {
  const matches: Array<{ match: string; index: number }> = [];
  const regex = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g',
  );

  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      match: match[0],
      index: match.index,
    });
  }

  return matches;
}

/**
 * Mask a portion of text
 */
export function maskText(
  text: string,
  start: number,
  end: number,
  maskChar = '*',
): string {
  const before = text.slice(0, start);
  const masked = maskChar.repeat(end - start);
  const after = text.slice(end);
  return before + masked + after;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity ratio between two strings
 */
export function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Simple hash function for strings
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

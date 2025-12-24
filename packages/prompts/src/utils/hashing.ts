/**
 * Hashing Utilities
 */

import murmurhash from 'murmurhash';

/**
 * Generate a content hash for a prompt
 */
export function hashContent(content: string): string {
  const hash = murmurhash.v3(content);
  return hash.toString(16).padStart(8, '0');
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Generate a version string from a number
 */
export function generateVersion(num: number): string {
  return `v${num}`;
}

/**
 * Parse version string to number
 */
export function parseVersion(version: string): number {
  if (version.startsWith('v')) {
    return parseInt(version.slice(1), 10);
  }
  return parseInt(version, 10);
}

/**
 * Increment version string
 */
export function incrementVersion(version: string): string {
  const num = parseVersion(version);
  return generateVersion(num + 1);
}

/**
 * Compare two version strings
 */
export function compareVersions(a: string, b: string): number {
  return parseVersion(a) - parseVersion(b);
}

/**
 * Generate a short hash for display
 */
export function shortHash(hash: string, length: number = 7): string {
  return hash.substring(0, length);
}

/**
 * Diff Utilities
 *
 * State comparison and diff utilities.
 */

import type { ReplayDifference } from '../types/index.js';

/**
 * Difference type
 */
export interface Difference {
  /** Path to the changed value */
  path: string[];
  /** Type of change */
  kind: 'N' | 'D' | 'E' | 'A'; // New, Deleted, Edited, Array
  /** Left-hand side value */
  lhs?: unknown;
  /** Right-hand side value */
  rhs?: unknown;
  /** Array index (for array changes) */
  index?: number;
  /** Item change (for array changes) */
  item?: Difference;
}

/**
 * Compare two objects and return differences
 */
export function diff(
  lhs: unknown,
  rhs: unknown,
  path: string[] = [],
): Difference[] {
  const differences: Difference[] = [];

  if (lhs === rhs) {
    return differences;
  }

  // Handle null/undefined
  if (lhs === null || lhs === undefined) {
    if (rhs !== null && rhs !== undefined) {
      differences.push({ path, kind: 'N', rhs });
    }
    return differences;
  }

  if (rhs === null || rhs === undefined) {
    differences.push({ path, kind: 'D', lhs });
    return differences;
  }

  // Handle different types
  const lhsType = typeof lhs;
  const rhsType = typeof rhs;

  if (lhsType !== rhsType) {
    differences.push({ path, kind: 'E', lhs, rhs });
    return differences;
  }

  // Handle primitives
  if (lhsType !== 'object') {
    if (lhs !== rhs) {
      differences.push({ path, kind: 'E', lhs, rhs });
    }
    return differences;
  }

  // Handle arrays
  if (Array.isArray(lhs) && Array.isArray(rhs)) {
    const maxLen = Math.max(lhs.length, rhs.length);

    for (let i = 0; i < maxLen; i++) {
      if (i >= lhs.length) {
        differences.push({
          path,
          kind: 'A',
          index: i,
          item: { path: [...path, String(i)], kind: 'N', rhs: rhs[i] },
        });
      } else if (i >= rhs.length) {
        differences.push({
          path,
          kind: 'A',
          index: i,
          item: { path: [...path, String(i)], kind: 'D', lhs: lhs[i] },
        });
      } else {
        const itemDiffs = diff(lhs[i], rhs[i], [...path, String(i)]);
        differences.push(...itemDiffs);
      }
    }

    return differences;
  }

  // Handle objects
  if (typeof lhs === 'object' && typeof rhs === 'object') {
    const lhsObj = lhs as Record<string, unknown>;
    const rhsObj = rhs as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(lhsObj), ...Object.keys(rhsObj)]);

    for (const key of allKeys) {
      const keyPath = [...path, key];

      if (!(key in lhsObj)) {
        differences.push({ path: keyPath, kind: 'N', rhs: rhsObj[key] });
      } else if (!(key in rhsObj)) {
        differences.push({ path: keyPath, kind: 'D', lhs: lhsObj[key] });
      } else {
        const propDiffs = diff(lhsObj[key], rhsObj[key], keyPath);
        differences.push(...propDiffs);
      }
    }
  }

  return differences;
}

/**
 * Convert internal diff to ReplayDifference format
 */
export function toReplayDifferences(
  diffs: Difference[],
  stepIndex: number,
): ReplayDifference[] {
  return diffs.map((d) => ({
    stepIndex,
    path: d.path.join('.'),
    original: d.lhs,
    replayed: d.rhs,
    type: d.kind === 'N' ? 'added' : d.kind === 'D' ? 'removed' : 'changed',
  }));
}

/**
 * Apply multiple patches to an object
 */
export function applyPatches<T>(target: T, patches: Difference[]): T {
  let result = target;
  for (const patch of patches) {
    result = applyPatch(result, patch);
  }
  return result;
}

/**
 * Apply a patch to an object
 */
export function applyPatch<T>(target: T, patch: Difference): T {
  const result = JSON.parse(JSON.stringify(target)) as T;

  if (patch.path.length === 0) {
    return patch.rhs as T;
  }

  let current: Record<string, unknown> = result as Record<string, unknown>;

  for (let i = 0; i < patch.path.length - 1; i++) {
    const key = patch.path[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = patch.path[patch.path.length - 1];

  switch (patch.kind) {
    case 'N':
    case 'E':
      current[lastKey] = patch.rhs;
      break;
    case 'D':
      delete current[lastKey];
      break;
    case 'A':
      if (Array.isArray(current[lastKey]) && patch.item) {
        const arr = current[lastKey] as unknown[];
        if (patch.item.kind === 'N') {
          arr.splice(patch.index!, 0, patch.item.rhs);
        } else if (patch.item.kind === 'D') {
          arr.splice(patch.index!, 1);
        } else if (patch.item.kind === 'E') {
          arr[patch.index!] = patch.item.rhs;
        }
      }
      break;
  }

  return result;
}

/**
 * Create a summary of changes
 */
export function summarizeDiff(diffs: Difference[]): {
  added: number;
  removed: number;
  changed: number;
  paths: string[];
} {
  const summary = {
    added: 0,
    removed: 0,
    changed: 0,
    paths: [] as string[],
  };

  for (const d of diffs) {
    const pathStr = d.path.join('.');
    summary.paths.push(pathStr);

    switch (d.kind) {
      case 'N':
        summary.added++;
        break;
      case 'D':
        summary.removed++;
        break;
      case 'E':
        summary.changed++;
        break;
      case 'A':
        if (d.item?.kind === 'N') {
          summary.added++;
        } else if (d.item?.kind === 'D') {
          summary.removed++;
        } else {
          summary.changed++;
        }
        break;
    }
  }

  return summary;
}

/**
 * Check if two objects are deeply equal
 */
export function isEqual(a: unknown, b: unknown): boolean {
  return diff(a, b).length === 0;
}

/**
 * Get value at path
 */
export function getAtPath(obj: unknown, path: string[]): unknown {
  let current = obj;

  for (const key of path) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Set value at path
 */
export function setAtPath<T>(obj: T, path: string[], value: unknown): T {
  if (path.length === 0) {
    return value as T;
  }

  const result = JSON.parse(JSON.stringify(obj)) as T;
  let current: Record<string, unknown> = result as Record<string, unknown>;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[path[path.length - 1]] = value;
  return result;
}

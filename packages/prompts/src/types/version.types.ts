/**
 * Version Control Type Definitions
 */

import type { PromptData } from './prompt.types.js';

/**
 * Version information
 */
export interface VersionInfo {
  version: string;
  hash: string;
  message?: string;
  author?: string;
  createdAt: Date;
  parentVersion?: string;
  branch?: string;
}

/**
 * Version history entry
 */
export interface VersionHistoryEntry extends VersionInfo {
  promptId: string;
  promptName: string;
  environment: string;
  snapshot: PromptData;
}

/**
 * Diff line types
 */
export type DiffLineType = 'added' | 'removed' | 'unchanged';

/**
 * Single diff line
 */
export interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Diff hunk (group of changes)
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/**
 * Complete diff result
 */
export interface DiffResult {
  promptId: string;
  promptName: string;
  fromVersion: string;
  toVersion: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  unchanged: number;
  similarity: number; // 0-1 score
}

/**
 * Diff options
 */
export interface DiffOptions {
  from: string;
  to: string;
  context?: number; // Lines of context around changes
  ignoreWhitespace?: boolean;
}

/**
 * Branch information
 */
export interface BranchInfo {
  name: string;
  promptId: string;
  baseVersion: string;
  headVersion: string;
  createdAt: Date;
  createdBy?: string;
  description?: string;
  isActive: boolean;
}

/**
 * Branch creation input
 */
export interface CreateBranchInput {
  name: string;
  from?: string; // Version or branch name
  description?: string;
}

/**
 * Merge strategy types
 */
export type MergeStrategy =
  | 'fast-forward'
  | 'squash'
  | 'rebase'
  | 'ours'
  | 'theirs';

/**
 * Merge conflict
 */
export interface MergeConflict {
  section: string;
  ours: string;
  theirs: string;
  base?: string;
}

/**
 * Merge result
 */
export interface MergeResult {
  success: boolean;
  strategy: MergeStrategy;
  newVersion?: string;
  conflicts?: MergeConflict[];
  message?: string;
}

/**
 * Merge options
 */
export interface MergeOptions {
  from: string; // Branch name
  to?: string; // Target branch (default: main)
  strategy?: MergeStrategy;
  message?: string;
  author?: string;
  resolveConflicts?: (conflicts: MergeConflict[]) => Promise<string>;
}

/**
 * Rollback options
 */
export interface RollbackOptions {
  to: string; // Version to rollback to
  environment?: string;
  reason?: string;
  author?: string;
}

/**
 * Rollback result
 */
export interface RollbackResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  newVersion: string;
  environment: string;
}

/**
 * Prompt Version
 *
 * Manages version information and history for prompts.
 */

import type {
  VersionInfo,
  VersionHistoryEntry,
  PromptData,
} from '../types/index.js';
import { incrementVersion, compareVersions } from '../utils/hashing.js';

/**
 * PromptVersion class - represents a specific version of a prompt
 */
export class PromptVersion implements VersionHistoryEntry {
  readonly promptId: string;
  readonly promptName: string;
  readonly version: string;
  readonly hash: string;
  readonly message?: string;
  readonly author?: string;
  readonly createdAt: Date;
  readonly parentVersion?: string;
  readonly branch?: string;
  readonly environment: string;
  readonly snapshot: PromptData;

  constructor(data: VersionHistoryEntry) {
    this.promptId = data.promptId;
    this.promptName = data.promptName;
    this.version = data.version;
    this.hash = data.hash;
    this.message = data.message;
    this.author = data.author;
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.parentVersion = data.parentVersion;
    this.branch = data.branch;
    this.environment = data.environment;
    this.snapshot = data.snapshot;
  }

  /**
   * Get version info without snapshot
   */
  getInfo(): VersionInfo {
    return {
      version: this.version,
      hash: this.hash,
      message: this.message,
      author: this.author,
      createdAt: this.createdAt,
      parentVersion: this.parentVersion,
      branch: this.branch,
    };
  }

  /**
   * Convert to plain data object
   */
  toData(): VersionHistoryEntry {
    return {
      promptId: this.promptId,
      promptName: this.promptName,
      version: this.version,
      hash: this.hash,
      message: this.message,
      author: this.author,
      createdAt: this.createdAt,
      parentVersion: this.parentVersion,
      branch: this.branch,
      environment: this.environment,
      snapshot: this.snapshot,
    };
  }

  /**
   * Check if this version is newer than another
   */
  isNewerThan(other: PromptVersion | string): boolean {
    const otherVersion = typeof other === 'string' ? other : other.version;
    return compareVersions(this.version, otherVersion) > 0;
  }

  /**
   * Check if this version is older than another
   */
  isOlderThan(other: PromptVersion | string): boolean {
    const otherVersion = typeof other === 'string' ? other : other.version;
    return compareVersions(this.version, otherVersion) < 0;
  }

  /**
   * Get display string
   */
  toString(): string {
    const parts = [this.version];
    if (this.branch && this.branch !== 'main') {
      parts.push(`(${this.branch})`);
    }
    if (this.message) {
      parts.push(`- ${this.message}`);
    }
    return parts.join(' ');
  }

  /**
   * Create from prompt data
   */
  static fromPrompt(
    prompt: PromptData,
    options: {
      message?: string;
      author?: string;
      parentVersion?: string;
      branch?: string;
    } = {},
  ): PromptVersion {
    return new PromptVersion({
      promptId: prompt.id,
      promptName: prompt.name,
      version: prompt.version,
      hash: prompt.hash,
      message: options.message,
      author: options.author || prompt.createdBy,
      createdAt: new Date(),
      parentVersion: options.parentVersion,
      branch: options.branch || 'main',
      environment: prompt.environment,
      snapshot: prompt,
    });
  }
}

/**
 * Version history manager
 */
export class VersionHistory {
  private versions: PromptVersion[] = [];
  private currentVersion: string = 'v1';

  constructor(versions?: PromptVersion[]) {
    if (versions) {
      this.versions = [...versions].sort((a, b) =>
        compareVersions(b.version, a.version),
      );
      if (this.versions.length > 0) {
        this.currentVersion = this.versions[0].version;
      }
    }
  }

  /**
   * Add a new version
   */
  add(version: PromptVersion): void {
    this.versions.unshift(version);
    this.versions.sort((a, b) => compareVersions(b.version, a.version));
    this.currentVersion = this.versions[0].version;
  }

  /**
   * Get a specific version
   */
  get(version: string): PromptVersion | undefined {
    return this.versions.find((v) => v.version === version);
  }

  /**
   * Get the latest version
   */
  getLatest(): PromptVersion | undefined {
    return this.versions[0];
  }

  /**
   * Get all versions
   */
  getAll(limit?: number): PromptVersion[] {
    if (limit) {
      return this.versions.slice(0, limit);
    }
    return [...this.versions];
  }

  /**
   * Get version count
   */
  get count(): number {
    return this.versions.length;
  }

  /**
   * Get the next version string
   */
  getNextVersion(): string {
    return incrementVersion(this.currentVersion);
  }

  /**
   * Get versions on a specific branch
   */
  getByBranch(branch: string): PromptVersion[] {
    return this.versions.filter((v) => v.branch === branch);
  }

  /**
   * Get versions by author
   */
  getByAuthor(author: string): PromptVersion[] {
    return this.versions.filter((v) => v.author === author);
  }

  /**
   * Get versions in a date range
   */
  getByDateRange(start: Date, end: Date): PromptVersion[] {
    return this.versions.filter(
      (v) => v.createdAt >= start && v.createdAt <= end,
    );
  }

  /**
   * Check if a version exists
   */
  has(version: string): boolean {
    return this.versions.some((v) => v.version === version);
  }

  /**
   * Get the previous version
   */
  getPrevious(version: string): PromptVersion | undefined {
    const current = this.versions.find((v) => v.version === version);
    if (!current?.parentVersion) return undefined;
    return this.get(current.parentVersion);
  }

  /**
   * Get version lineage (chain of versions)
   */
  getLineage(version: string): PromptVersion[] {
    const lineage: PromptVersion[] = [];
    let current = this.get(version);

    while (current) {
      lineage.push(current);
      current = current.parentVersion
        ? this.get(current.parentVersion)
        : undefined;
    }

    return lineage;
  }
}

/**
 * Persistent audit storage.
 *
 * The {@link AuditLogger} keeps a hash-chained log in memory; an {@link AuditStore}
 * lets that chain survive process restarts. The append-only file store maps
 * naturally onto the append-only chain: each entry is one JSON line, so writes
 * are O(1) appends and the whole chain can be replayed (and re-verified) on load.
 */

import {
  appendFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { dirname } from 'node:path';
import type { AuditEntry } from '../types/audit.types.js';

/**
 * Pluggable persistence backend for the audit log. Implementations must
 * preserve insertion order so the hash chain can be replayed verbatim.
 */
export interface AuditStore {
  /** Durably append a single entry. */
  append(entry: AuditEntry): void | Promise<void>;
  /** Load every persisted entry in insertion order. */
  loadAll(): AuditEntry[] | Promise<AuditEntry[]>;
  /** Remove all persisted entries. */
  clear(): void | Promise<void>;
}

/**
 * Append-only, file-backed audit store using JSON Lines (one entry per line).
 *
 * Writes use synchronous appends so an entry is durable the moment
 * {@link AuditLogger.log} returns — important for tamper-evident logging, where
 * losing the most recent entries on a crash would break the chain.
 */
export class FileAuditStore implements AuditStore {
  constructor(private readonly filePath: string) {}

  append(entry: AuditEntry): void {
    this.ensureDir();
    appendFileSync(this.filePath, JSON.stringify(entry) + '\n', 'utf8');
  }

  loadAll(): AuditEntry[] {
    if (!existsSync(this.filePath)) return [];
    const raw = readFileSync(this.filePath, 'utf8');
    const entries: AuditEntry[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      entries.push(JSON.parse(trimmed) as AuditEntry);
    }
    return entries;
  }

  clear(): void {
    this.ensureDir();
    writeFileSync(this.filePath, '', 'utf8');
  }

  private ensureDir(): void {
    const dir = dirname(this.filePath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/** Create a file-backed audit store at the given path. */
export function createFileAuditStore(filePath: string): FileAuditStore {
  return new FileAuditStore(filePath);
}

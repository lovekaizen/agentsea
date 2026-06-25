/**
 * Audit Module - Logging and Evidence Collection
 *
 * Hash-chained, append-only audit logging with query, trail summaries, and
 * tamper-evident integrity verification, plus evidence-package collection.
 */

import { createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { Severity } from '../types/attack.types.js';
import type {
  AuditEntry,
  AuditEventType,
  AuditTrail,
  AuditTrailSummary,
  AuditQuery,
  AuditQueryResult,
  EvidencePackage,
  EvidencePackageSummary,
} from '../types/audit.types.js';
import type { Evidence } from '../types/compliance.types.js';
import {
  type AuditStore,
  FileAuditStore,
  createFileAuditStore,
} from './storage.js';

export { FileAuditStore, createFileAuditStore };
export type { AuditStore };

// Re-export types
export type {
  AuditEntry,
  AuditEventType,
  AuditActor,
  AuditResource,
  AuditTrail,
  AuditTrailSummary,
  AuditLogConfig,
  AuditStorageConfig,
  AuditRetentionPolicy,
  AuditQuery,
  AuditQueryResult,
  EvidenceCollectionConfig,
  EvidenceCollectionType,
  EvidencePackage,
  EvidencePackageSummary,
  AuditReportConfig,
  AuditReportSection,
  AuditReport,
  ChainOfCustodyRecord,
  AuditIntegrityCheckResult,
} from '../types/audit.types.js';

/** Input for a single audit entry (id/timestamp/hashes are filled in by the logger). */
export type AuditEntryInput = Omit<
  AuditEntry,
  'id' | 'timestamp' | 'hash' | 'previousHash'
>;

const GENESIS_HASH = '0'.repeat(64);

function hashEntry(entry: Omit<AuditEntry, 'hash'>): string {
  // Deterministic hash over the entry contents + previous hash (the chain link).
  const payload = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    action: entry.action,
    actor: entry.actor,
    resource: entry.resource,
    outcome: entry.outcome,
    details: entry.details,
    severity: entry.severity ?? null,
    previousHash: entry.previousHash ?? GENESIS_HASH,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Append-only, hash-chained audit logger. Each entry stores the hash of the
 * previous entry, so any later mutation breaks the chain and is detectable via
 * {@link AuditLogger.verifyIntegrity}.
 */
export class AuditLogger {
  private entries: AuditEntry[] = [];
  private readonly enabled: boolean;
  private readonly trailId = nanoid();
  private readonly startTime = Date.now();
  private readonly store?: AuditStore;

  constructor(config: { enabled?: boolean; store?: AuditStore } = {}) {
    this.enabled = config.enabled ?? true;
    this.store = config.store;
  }

  /**
   * Hydrate the in-memory chain from the configured persistent store. Call this
   * once after construction (e.g. on process start) to resume an existing,
   * tamper-evident trail. Returns the number of entries loaded.
   */
  async loadFromStore(): Promise<number> {
    if (!this.store) return 0;
    const loaded = await this.store.loadAll();
    this.entries = loaded;
    return loaded.length;
  }

  /** Append a new entry, linking it to the previous one. Returns the stored entry. */
  log(input: AuditEntryInput): AuditEntry {
    const previousHash =
      this.entries.length > 0
        ? (this.entries[this.entries.length - 1].hash ?? GENESIS_HASH)
        : GENESIS_HASH;

    const base: Omit<AuditEntry, 'hash'> = {
      ...input,
      id: nanoid(),
      timestamp: Date.now(),
      previousHash,
    };

    const entry: AuditEntry = { ...base, hash: hashEntry(base) };

    if (this.enabled) {
      this.entries.push(entry);
      // Persist after linking so the durable record matches the in-memory chain.
      void this.store?.append(entry);
    }
    return entry;
  }

  /** Query the log with filtering, full-text search, sorting and pagination. */
  query(query: AuditQuery = {}): AuditQueryResult {
    const start = Date.now();
    let matches = this.entries.filter((e) => this.matchesQuery(e, query));

    const sortField = query.sort?.field ?? 'timestamp';
    const order = query.sort?.order ?? 'asc';
    matches.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortField] as number;
      const bv = (b as unknown as Record<string, unknown>)[sortField] as number;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return order === 'asc' ? cmp : -cmp;
    });

    const totalCount = matches.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? totalCount;
    matches = matches.slice(offset, offset + limit);

    return {
      entries: matches,
      totalCount,
      pageInfo: {
        offset,
        limit,
        hasMore: offset + matches.length < totalCount,
      },
      queryMetadata: { executionTimeMs: Date.now() - start, query },
    };
  }

  private matchesQuery(entry: AuditEntry, q: AuditQuery): boolean {
    if (
      q.timeRange &&
      (entry.timestamp < q.timeRange.start || entry.timestamp > q.timeRange.end)
    )
      return false;
    if (q.eventTypes && !q.eventTypes.includes(entry.eventType)) return false;
    if (q.actorIds && !q.actorIds.includes(entry.actor.id)) return false;
    if (q.resourceIds && !q.resourceIds.includes(entry.resource.id))
      return false;
    if (q.outcomes && !q.outcomes.includes(entry.outcome)) return false;
    if (
      q.severities &&
      (!entry.severity || !q.severities.includes(entry.severity))
    )
      return false;
    if (q.correlationId && entry.correlationId !== q.correlationId)
      return false;
    if (q.tags && !q.tags.every((t) => entry.tags?.includes(t))) return false;
    if (q.searchText) {
      const hay = JSON.stringify(entry).toLowerCase();
      if (!hay.includes(q.searchText.toLowerCase())) return false;
    }
    return true;
  }

  /** All entries in insertion order (defensive copy). */
  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  /** Build a full trail with a computed summary. */
  getTrail(name = 'audit-trail'): AuditTrail {
    return {
      id: this.trailId,
      name,
      startTime: this.startTime,
      endTime: Date.now(),
      status: 'active',
      entries: this.getEntries(),
      summary: this.summarize(),
    };
  }

  private summarize(): AuditTrailSummary {
    const byEventType = {} as Record<AuditEventType, number>;
    const byOutcome: Record<string, number> = {};
    const bySeverity = {} as Record<Severity, number>;
    const actors = new Set<string>();
    const resources = new Set<string>();
    let min = Infinity;
    let max = -Infinity;

    for (const e of this.entries) {
      byEventType[e.eventType] = (byEventType[e.eventType] ?? 0) + 1;
      byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
      if (e.severity)
        bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      actors.add(e.actor.id);
      resources.add(e.resource.id);
      min = Math.min(min, e.timestamp);
      max = Math.max(max, e.timestamp);
    }

    if (this.entries.length === 0) {
      min = this.startTime;
      max = this.startTime;
    }

    return {
      totalEntries: this.entries.length,
      byEventType,
      byOutcome,
      bySeverity,
      uniqueActors: actors.size,
      uniqueResources: resources.size,
      timeSpan: { start: min, end: max, durationMs: max - min },
    };
  }

  /**
   * Verify the hash chain. Recomputes each entry's hash and checks the
   * previousHash links; any mismatch marks the entry tampered.
   */
  verifyIntegrity(): {
    status: 'valid' | 'tampered';
    totalEntries: number;
    validEntries: number;
    tamperedEntries: AuditEntry[];
    checkedAt: number;
  } {
    const tampered: AuditEntry[] = [];
    let expectedPrev = GENESIS_HASH;

    for (const entry of this.entries) {
      const { hash, ...rest } = entry;
      const recomputed = hashEntry(rest);
      if (entry.previousHash !== expectedPrev || recomputed !== hash) {
        tampered.push(entry);
      }
      expectedPrev = entry.hash ?? GENESIS_HASH;
    }

    return {
      status: tampered.length === 0 ? 'valid' : 'tampered',
      totalEntries: this.entries.length,
      validEntries: this.entries.length - tampered.length,
      tamperedEntries: tampered,
      checkedAt: Date.now(),
    };
  }

  clear(): void {
    this.entries = [];
    void this.store?.clear();
  }
}

/**
 * Collects evidence items and bundles them into hashed, summarized packages.
 */
export class EvidenceCollector {
  private items: Evidence[] = [];
  private readonly enabled: boolean;

  constructor(config: { enabled?: boolean } = {}) {
    this.enabled = config.enabled ?? true;
  }

  /** Record a piece of evidence (fills id/collectedAt if missing). */
  collect(
    evidence: Omit<Evidence, 'id' | 'collectedAt'> &
      Partial<Pick<Evidence, 'id' | 'collectedAt'>>,
  ): Evidence {
    const item: Evidence = {
      ...evidence,
      id: evidence.id ?? nanoid(),
      collectedAt: evidence.collectedAt ?? Date.now(),
    };
    if (this.enabled) this.items.push(item);
    return item;
  }

  getEvidence(): Evidence[] {
    return [...this.items];
  }

  /** Bundle the collected evidence into a hashed package with a summary. */
  createPackage(name: string, description?: string): EvidencePackage {
    const evidence = this.getEvidence();
    const summary = this.summarize(evidence);
    const pkg: Omit<EvidencePackage, 'hash'> = {
      id: nanoid(),
      name,
      description,
      createdAt: Date.now(),
      evidence,
      summary,
    };
    const hash = createHash('sha256')
      .update(JSON.stringify(pkg.evidence))
      .digest('hex');
    return { ...pkg, hash };
  }

  private summarize(evidence: Evidence[]): EvidencePackageSummary {
    const byType: Record<string, number> = {};
    let totalSizeBytes = 0;
    let start = Infinity;
    let end = -Infinity;

    for (const e of evidence) {
      byType[e.type] = (byType[e.type] ?? 0) + 1;
      totalSizeBytes += Buffer.byteLength(e.content ?? '', 'utf8');
      start = Math.min(start, e.collectedAt);
      end = Math.max(end, e.collectedAt);
    }

    if (evidence.length === 0) {
      start = Date.now();
      end = start;
    }

    return {
      totalItems: evidence.length,
      byType,
      totalSizeBytes,
      timeRange: { start, end },
    };
  }

  clear(): void {
    this.items = [];
  }
}

export function createAuditLogger(config?: {
  enabled?: boolean;
  store?: AuditStore;
}): AuditLogger {
  return new AuditLogger(config);
}

export function createEvidenceCollector(config?: {
  enabled?: boolean;
}): EvidenceCollector {
  return new EvidenceCollector(config);
}

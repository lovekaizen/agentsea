import { describe, it, expect } from 'vitest';
import { AuditLogger, EvidenceCollector } from '../audit/index.js';
import type { AuditEntryInput } from '../audit/index.js';

function entry(overrides: Partial<AuditEntryInput> = {}): AuditEntryInput {
  return {
    eventType: 'test_started',
    action: 'run',
    actor: { type: 'system', id: 'sys-1' },
    resource: { type: 'test', id: 'res-1' },
    outcome: 'success',
    details: {},
    ...overrides,
  };
}

describe('AuditLogger', () => {
  it('hash-chains entries (each links to the previous)', () => {
    const log = new AuditLogger();
    const a = log.log(entry());
    const b = log.log(entry());

    expect(a.hash).toBeDefined();
    expect(b.previousHash).toBe(a.hash);
    expect(a.previousHash).toBe('0'.repeat(64));
  });

  it('verifies integrity as valid for an untampered log', () => {
    const log = new AuditLogger();
    log.log(entry());
    log.log(entry({ eventType: 'test_completed' }));

    const result = log.verifyIntegrity();
    expect(result.status).toBe('valid');
    expect(result.validEntries).toBe(2);
    expect(result.tamperedEntries).toHaveLength(0);
  });

  it('detects tampering when an entry is mutated after the fact', () => {
    const log = new AuditLogger();
    log.log(entry());
    log.log(entry());

    // Tamper with a stored entry (mutating its details without rehashing).
    const entries = log.getEntries();
    (log as unknown as { entries: typeof entries }).entries[0].details = {
      tampered: true,
    };

    const result = log.verifyIntegrity();
    expect(result.status).toBe('tampered');
    expect(result.tamperedEntries.length).toBeGreaterThan(0);
  });

  it('filters by event type and supports full-text search', () => {
    const log = new AuditLogger();
    log.log(entry({ eventType: 'test_started', action: 'alpha' }));
    log.log(entry({ eventType: 'vulnerability_found', action: 'beta' }));

    expect(log.query({ eventTypes: ['vulnerability_found'] }).totalCount).toBe(
      1,
    );
    expect(log.query({ searchText: 'alpha' }).entries).toHaveLength(1);
  });

  it('paginates results', () => {
    const log = new AuditLogger();
    for (let i = 0; i < 5; i++) log.log(entry());

    const page = log.query({ limit: 2, offset: 0 });
    expect(page.entries).toHaveLength(2);
    expect(page.totalCount).toBe(5);
    expect(page.pageInfo.hasMore).toBe(true);
  });

  it('summarizes a trail by event type and actor', () => {
    const log = new AuditLogger();
    log.log(entry({ eventType: 'test_started' }));
    log.log(entry({ eventType: 'test_started' }));
    log.log(entry({ eventType: 'test_completed' }));

    const trail = log.getTrail('my-trail');
    expect(trail.summary?.totalEntries).toBe(3);
    expect(trail.summary?.byEventType.test_started).toBe(2);
    expect(trail.summary?.uniqueActors).toBe(1);
  });
});

describe('EvidenceCollector', () => {
  it('collects evidence and builds a hashed package with a summary', () => {
    const collector = new EvidenceCollector();
    collector.collect({
      type: 'log_entry',
      title: 'log A',
      content: 'hello',
    });
    collector.collect({
      type: 'screenshot',
      title: 'shot',
      content: 'x'.repeat(10),
    });

    const pkg = collector.createPackage('case-1');
    expect(pkg.hash).toBeDefined();
    expect(pkg.summary.totalItems).toBe(2);
    expect(pkg.summary.byType.log_entry).toBe(1);
    expect(pkg.summary.totalSizeBytes).toBe(15); // 5 + 10 bytes
  });
});

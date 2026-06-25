/**
 * Tests for the continuous-testing maturity work:
 *  - cron-driven schedules (nextRunAt / nextCronAt)
 *  - real alert delivery (webhook / slack / pagerduty / email)
 *  - persistent, hash-chained audit storage (FileAuditStore)
 *
 * HTTP (fetch), SMTP (nodemailer) are mocked; the file store uses a real temp
 * file so persistence and chain-replay are exercised end to end.
 */

import { describe, it, expect, vi, afterEach, type Mock } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, existsSync } from 'node:fs';
import { nanoid } from 'nanoid';

vi.mock('../utils/optional-import.js', () => ({
  importOptional: vi.fn(),
}));

import { importOptional } from '../utils/optional-import.js';
import { nextRunAt, nextCronAt, AlertManager } from '../continuous/index.js';
import { AuditLogger, FileAuditStore } from '../audit/index.js';
import type { AlertChannel, AlertRule } from '../types/continuous.types.js';

const importOptionalMock = importOptional as unknown as Mock;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('cron schedules', () => {
  it('computes the next fire time for a custom cron expression', () => {
    // 2020-01-01T00:30:00Z; "0 * * * *" fires at the top of every hour.
    const from = Date.UTC(2020, 0, 1, 0, 30, 0);
    const next = nextRunAt(
      { frequency: 'custom', cronExpression: '0 * * * *', timezone: 'UTC' },
      from,
    );
    expect(next).toBe(Date.UTC(2020, 0, 1, 1, 0, 0));
  });

  it('returns null for custom frequency without an expression', () => {
    expect(nextRunAt({ frequency: 'custom' }, 0)).toBeNull();
  });

  it('returns null for an invalid cron expression', () => {
    expect(nextCronAt('not a cron', 0)).toBeNull();
  });
});

describe('AlertManager delivery', () => {
  const rule: AlertRule = {
    id: 'rule-1',
    name: 'High fail rate',
    enabled: true,
    condition: {
      type: 'threshold',
      metric: 'failRate',
      operator: 'greater',
      value: 0.3,
    },
    severity: 'critical',
    channelIds: ['ch-webhook'],
  };

  function channel(over: Partial<AlertChannel>): AlertChannel {
    return {
      id: 'ch-webhook',
      type: 'webhook',
      name: 'hook',
      enabled: true,
      config: { webhookUrl: 'https://example.com/hook' },
      severities: ['critical', 'warning', 'info'],
      ...over,
    };
  }

  it('delivers to a webhook and records success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const mgr = new AlertManager({ rules: [rule], channels: [channel({})] });
    const alerts = await mgr.evaluateAndDeliver({ failRate: 0.9 });

    expect(alerts).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(alerts[0].notificationHistory).toEqual([
      expect.objectContaining({ channelId: 'ch-webhook', status: 'sent' }),
    ]);
  });

  it('records a failure when the webhook URL is missing', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const mgr = new AlertManager({
      rules: [rule],
      channels: [channel({ config: {} })],
    });

    const [alert] = await mgr.evaluateAndDeliver({ failRate: 0.9 });
    expect(alert.notificationHistory[0].status).toBe('failed');
    expect(alert.notificationHistory[0].error).toMatch(/webhookUrl/);
  });

  it('enqueues a PagerDuty Events API v2 trigger', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);

    const mgr = new AlertManager({
      rules: [{ ...rule, channelIds: ['pd'] }],
      channels: [
        channel({
          id: 'pd',
          type: 'pagerduty',
          config: { apiKey: 'routing-key' },
        }),
      ],
    });

    await mgr.evaluateAndDeliver({ failRate: 0.9 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
    const body = JSON.parse((init as { body: string }).body);
    expect(body.routing_key).toBe('routing-key');
    expect(body.payload.severity).toBe('critical');
  });

  it('skips channels whose severity routing excludes the alert', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const mgr = new AlertManager({
      rules: [rule],
      channels: [channel({ severities: ['info'] })], // critical not routed here
    });

    const [alert] = await mgr.evaluateAndDeliver({ failRate: 0.9 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(alert.notificationHistory).toHaveLength(0);
  });

  it('delivers email via the optional nodemailer dependency', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
    const createTransport = vi.fn().mockReturnValue({ sendMail });
    importOptionalMock.mockResolvedValue({ createTransport });

    const mgr = new AlertManager({
      rules: [{ ...rule, channelIds: ['mail'] }],
      channels: [
        channel({
          id: 'mail',
          type: 'email',
          config: {
            emails: ['soc@example.com'],
            settings: { smtp: { host: 'smtp.example.com', port: 587 } },
          },
        }),
      ],
    });

    const [alert] = await mgr.evaluateAndDeliver({ failRate: 0.9 });

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com' }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'soc@example.com' }),
    );
    expect(alert.notificationHistory[0].status).toBe('sent');
  });
});

describe('FileAuditStore persistence', () => {
  function tmpPath(): string {
    return join(tmpdir(), `agentsea-audit-${nanoid()}.jsonl`);
  }

  function entryInput(action: string) {
    return {
      eventType: 'test_started' as const,
      action,
      actor: { id: 'tester', type: 'system' as const },
      resource: { id: 'target-1', type: 'test' as const },
      outcome: 'success' as const,
    };
  }

  it('persists entries and replays a valid chain after restart', async () => {
    const path = tmpPath();
    try {
      const store1 = new FileAuditStore(path);
      const logger1 = new AuditLogger({ store: store1 });
      logger1.log(entryInput('probe-1'));
      logger1.log(entryInput('probe-2'));

      expect(existsSync(path)).toBe(true);

      // Simulate a restart: a fresh logger hydrates from the same store.
      const logger2 = new AuditLogger({ store: new FileAuditStore(path) });
      const loaded = await logger2.loadFromStore();

      expect(loaded).toBe(2);
      expect(logger2.getEntries().map((e) => e.action)).toEqual([
        'probe-1',
        'probe-2',
      ]);

      // The replayed chain is intact, and new entries link onto it.
      expect(logger2.verifyIntegrity().status).toBe('valid');
      logger2.log(entryInput('probe-3'));
      expect(logger2.verifyIntegrity().status).toBe('valid');

      // And the third entry was persisted too.
      const reloaded = new FileAuditStore(path).loadAll();
      expect(reloaded).toHaveLength(3);
    } finally {
      rmSync(path, { force: true });
    }
  });

  it('clear() empties the persisted store', () => {
    const path = tmpPath();
    try {
      const store = new FileAuditStore(path);
      const logger = new AuditLogger({ store });
      logger.log(entryInput('probe-1'));
      logger.clear();
      expect(store.loadAll()).toHaveLength(0);
    } finally {
      rmSync(path, { force: true });
    }
  });
});

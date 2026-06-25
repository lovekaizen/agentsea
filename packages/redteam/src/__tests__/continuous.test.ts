import { describe, it, expect, vi } from 'vitest';
import {
  Scheduler,
  AlertManager,
  ContinuousTesting,
  nextRunAt,
} from '../continuous/index.js';
import type {
  AlertRule,
  ScheduleConfig,
  RunSummary,
} from '../continuous/index.js';

describe('nextRunAt', () => {
  it('computes time-based frequencies', () => {
    expect(nextRunAt({ frequency: 'hourly' }, 0)).toBe(3_600_000);
    expect(nextRunAt({ frequency: 'daily' }, 0)).toBe(86_400_000);
  });

  it('returns null for event-driven frequencies', () => {
    expect(nextRunAt({ frequency: 'on_deploy' }, 0)).toBeNull();
    expect(nextRunAt({ frequency: 'custom' }, 0)).toBeNull();
  });
});

describe('Scheduler', () => {
  const hourly: ScheduleConfig = { frequency: 'hourly' };

  it('runs jobs only once they are due, then reschedules', async () => {
    const scheduler = new Scheduler();
    const run = vi.fn();
    scheduler.schedule(hourly, run, 0);

    // Not due yet at t=30min
    expect(await scheduler.tick(30 * 60_000)).toHaveLength(0);
    expect(run).not.toHaveBeenCalled();

    // Due at t=1h
    expect(await scheduler.tick(3_600_000)).toHaveLength(1);
    expect(run).toHaveBeenCalledTimes(1);

    // Rescheduled to t=2h; not due again immediately
    expect(await scheduler.tick(3_600_001)).toHaveLength(0);
  });

  it('does not run disabled jobs', async () => {
    const scheduler = new Scheduler();
    const run = vi.fn();
    const id = scheduler.schedule(hourly, run, 0);
    scheduler.setEnabled(id, false);

    await scheduler.tick(3_600_000);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('AlertManager', () => {
  const rule = (overrides: Partial<AlertRule> = {}): AlertRule => ({
    id: 'r1',
    name: 'High failure rate',
    enabled: true,
    severity: 'critical',
    condition: {
      type: 'threshold',
      metric: 'failRate',
      operator: 'greater',
      value: 0.2,
    },
    ...overrides,
  });

  it('triggers an alert when a threshold rule is met and emits it', () => {
    const mgr = new AlertManager({ rules: [rule()] });
    const handler = vi.fn();
    mgr.on('alert', handler);

    const alerts = mgr.evaluate({ failRate: 0.5 });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not trigger when the condition is not met', () => {
    const mgr = new AlertManager({ rules: [rule()] });
    expect(mgr.evaluate({ failRate: 0.1 })).toHaveLength(0);
  });

  it('supports between/outside operators', () => {
    const mgr = new AlertManager({
      rules: [
        rule({
          condition: {
            type: 'threshold',
            metric: 'score',
            operator: 'outside',
            value: [0.4, 0.8],
          },
        }),
      ],
    });
    expect(mgr.evaluate({ score: 0.9 })).toHaveLength(1);
    expect(mgr.evaluate({ score: 0.6 })).toHaveLength(0);
  });

  it('skips disabled rules and missing metrics', () => {
    const mgr = new AlertManager({ rules: [rule({ enabled: false })] });
    expect(mgr.evaluate({ failRate: 0.9 })).toHaveLength(0);

    const mgr2 = new AlertManager({ rules: [rule()] });
    expect(mgr2.evaluate({ other: 1 })).toHaveLength(0);
  });
});

describe('ContinuousTesting', () => {
  const summary: RunSummary = { overallStatus: 'passed' };

  it('runs the test function and records history', async () => {
    const ct = new ContinuousTesting({
      runner: async () => ({ summary, metrics: { failRate: 0 } }),
    });

    const run = await ct.runOnce('manual');
    expect(run.status).toBe('completed');
    expect(run.summary?.overallStatus).toBe('passed');
    expect(ct.getHistory()).toHaveLength(1);
    expect(ct.getLastRun()?.id).toBe(run.id);
  });

  it('feeds run metrics into the alert manager', async () => {
    const alerts = new AlertManager({
      rules: [
        {
          id: 'r1',
          name: 'failures',
          enabled: true,
          severity: 'warning',
          condition: {
            type: 'threshold',
            metric: 'failRate',
            operator: 'greater',
            value: 0.5,
          },
        },
      ],
    });
    const ct = new ContinuousTesting({
      alerts,
      runner: async () => ({ summary, metrics: { failRate: 0.9 } }),
    });

    const run = await ct.runOnce();
    expect(run.alerts).toHaveLength(1);
    expect(run.alerts?.[0].ruleName).toBe('failures');
  });

  it('records a failed run when the runner throws', async () => {
    const ct = new ContinuousTesting({
      runner: async () => {
        throw new Error('boom');
      },
    });
    const run = await ct.runOnce();
    expect(run.status).toBe('failed');
    expect(run.error).toContain('boom');
  });
});

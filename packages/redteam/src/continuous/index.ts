/**
 * Continuous Module - Continuous Testing
 *
 * Continuous security testing: a Scheduler computes due runs, an AlertManager
 * evaluates metric-threshold rules and dispatches alerts, and ContinuousTesting
 * ties them together — running a test function on demand or on schedule, feeding
 * the resulting metrics into the alerting rules, and keeping run history.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  ScheduleConfig,
  AlertRule,
  AlertChannel,
  Alert,
  TestRun,
  RunStatus,
  RunSummary,
  TriggerConfig,
} from '../types/continuous.types.js';

// Re-export types
export type {
  ContinuousTestingConfig,
  ScheduleConfig,
  ScheduleFrequency,
  TriggerConfig,
  TriggerCondition,
  AlertConfig,
  AlertChannel,
  AlertChannelConfig,
  AlertRule,
  AlertCondition,
  QuietHours,
  AlertGrouping,
  EscalationPolicy,
  EscalationLevel,
  RetentionConfig,
  FailThreshold,
  TestRun,
  RunStatus,
  RunSummary,
  Alert,
  AlertSeverity,
  NotificationRecord,
  ScheduleStatus,
  HistoricalMetrics,
  MetricDataPoint,
  DashboardSummary,
} from '../types/continuous.types.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Computes the next run time (epoch ms) for a schedule after `from`. Handles the
 * common frequencies; event-driven frequencies (on_deploy/on_change) and custom
 * cron return null (they are triggered externally rather than time-scheduled).
 */
export function nextRunAt(
  schedule: ScheduleConfig,
  from: number,
): number | null {
  switch (schedule.frequency) {
    case 'hourly':
      return from + HOUR;
    case 'daily':
      return from + DAY;
    case 'weekly':
      return from + WEEK;
    case 'monthly':
      return from + 30 * DAY;
    default:
      // on_deploy / on_change / custom are event/cron driven, not time-scheduled.
      return null;
  }
}

interface ScheduledJob {
  id: string;
  schedule: ScheduleConfig;
  run: () => void | Promise<void>;
  nextRun: number | null;
  enabled: boolean;
}

/**
 * A minimal, deterministic scheduler. Jobs declare a schedule and a callback;
 * `tick(now)` runs every job whose next-run time has passed and reschedules it.
 * Use `start()`/`stop()` for a real wall-clock loop, or drive `tick` yourself in
 * tests (no hidden timers).
 */
export class Scheduler {
  private jobs = new Map<string, ScheduledJob>();
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Register a job; returns its id. */
  schedule(
    schedule: ScheduleConfig,
    run: () => void | Promise<void>,
    now: number = Date.now(),
  ): string {
    const id = nanoid();
    this.jobs.set(id, {
      id,
      schedule,
      run,
      nextRun: nextRunAt(schedule, now),
      enabled: true,
    });
    return id;
  }

  unschedule(id: string): boolean {
    return this.jobs.delete(id);
  }

  setEnabled(id: string, enabled: boolean): void {
    const job = this.jobs.get(id);
    if (job) job.enabled = enabled;
  }

  /** Jobs that are due to run at `now`. */
  dueJobs(now: number = Date.now()): string[] {
    return [...this.jobs.values()]
      .filter((j) => j.enabled && j.nextRun !== null && j.nextRun <= now)
      .map((j) => j.id);
  }

  /** Run all due jobs and reschedule them. Returns the ids that ran. */
  async tick(now: number = Date.now()): Promise<string[]> {
    const due = this.dueJobs(now);
    for (const id of due) {
      const job = this.jobs.get(id);
      if (!job) continue;
      await job.run();
      job.nextRun = nextRunAt(job.schedule, now);
    }
    return due;
  }

  /** Start a real wall-clock loop ticking every `intervalMs`. */
  start(intervalMs = MINUTE): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

interface AlertManagerEvents {
  alert: (alert: Alert) => void;
}

/**
 * Evaluates threshold/change alert rules against a metrics snapshot and emits
 * `Alert`s. Records a notification per configured channel (delivery itself is
 * left to the host application — channels are described, not contacted here).
 */
export class AlertManager extends EventEmitter<AlertManagerEvents> {
  private rules: AlertRule[];
  private channels: AlertChannel[];

  constructor(config: { rules?: AlertRule[]; channels?: AlertChannel[] } = {}) {
    super();
    this.rules = config.rules ?? [];
    this.channels = config.channels ?? [];
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  removeRule(id: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== id);
    return this.rules.length < before;
  }

  /**
   * Evaluate all enabled rules against a metrics snapshot. Returns (and emits)
   * an Alert for every rule whose condition is met.
   */
  evaluate(metrics: Record<string, number>, runId?: string): Alert[] {
    const alerts: Alert[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      const value = metrics[rule.condition.metric];
      if (value === undefined) continue;
      if (!this.conditionMet(rule, value)) continue;

      const alert: Alert = {
        id: nanoid(),
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        status: 'triggered',
        title: `${rule.name} triggered`,
        message: `Metric "${rule.condition.metric}" = ${value} met condition ${rule.condition.operator} ${JSON.stringify(rule.condition.value)}`,
        details: { metric: rule.condition.metric, value },
        triggeredAt: Date.now(),
        runId,
        notificationHistory: this.channels.map((ch) => ({
          channelId: ch.id,
          channelType: ch.type,
          sentAt: Date.now(),
          status: 'sent' as const,
        })),
      };

      alerts.push(alert);
      this.emit('alert', alert);
    }

    return alerts;
  }

  private conditionMet(rule: AlertRule, value: number): boolean {
    const { operator, value: target } = rule.condition;
    const arr = Array.isArray(target) ? target : [target];
    switch (operator) {
      case 'greater':
        return value > arr[0];
      case 'less':
        return value < arr[0];
      case 'equals':
        return value === arr[0];
      case 'not_equals':
        return value !== arr[0];
      case 'between':
        return value >= arr[0] && value <= arr[1];
      case 'outside':
        return value < arr[0] || value > arr[1];
      default:
        return false;
    }
  }
}

/** A test function that produces a run summary plus metrics for alerting. */
export type TestRunner = () => Promise<{
  summary: RunSummary;
  metrics?: Record<string, number>;
}>;

/**
 * Orchestrates continuous testing: runs a {@link TestRunner} on demand or on a
 * schedule, records each {@link TestRun}, and feeds the run's metrics to an
 * {@link AlertManager}.
 */
export class ContinuousTesting {
  readonly scheduler = new Scheduler();
  readonly alerts: AlertManager;
  private runner: TestRunner;
  private history: TestRun[] = [];

  constructor(config: {
    runner: TestRunner;
    alerts?: AlertManager;
    enabled?: boolean;
  }) {
    this.runner = config.runner;
    this.alerts = config.alerts ?? new AlertManager();
  }

  /** Execute the test runner once and record the run. */
  async runOnce(trigger: TriggerConfig['type'] = 'manual'): Promise<TestRun> {
    const id = nanoid();
    const startTime = Date.now();
    let status: RunStatus = 'running';
    let summary: RunSummary | undefined;
    let error: string | undefined;
    let triggeredAlerts: Alert[] = [];

    try {
      const result = await this.runner();
      summary = result.summary;
      status = 'completed';
      if (result.metrics) {
        triggeredAlerts = this.alerts.evaluate(result.metrics, id);
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : String(e);
    }

    const endTime = Date.now();
    const run: TestRun = {
      id,
      status,
      trigger,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      summary,
      alerts: triggeredAlerts,
      error,
    };

    this.history.push(run);
    return run;
  }

  /** Schedule recurring runs; returns the scheduler job id. */
  scheduleRuns(schedule: ScheduleConfig, now: number = Date.now()): string {
    return this.scheduler.schedule(
      schedule,
      () => void this.runOnce('schedule'),
      now,
    );
  }

  getHistory(): TestRun[] {
    return [...this.history];
  }

  getLastRun(): TestRun | undefined {
    return this.history[this.history.length - 1];
  }
}

export function createScheduler(): Scheduler {
  return new Scheduler();
}

export function createAlertManager(config?: {
  rules?: AlertRule[];
  channels?: AlertChannel[];
}): AlertManager {
  return new AlertManager(config);
}

export function createContinuousTesting(config: {
  runner: TestRunner;
  alerts?: AlertManager;
  enabled?: boolean;
}): ContinuousTesting {
  return new ContinuousTesting(config);
}

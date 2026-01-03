/**
 * KPI Tracker
 *
 * Tracks and monitors Key Performance Indicators.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  KPIDefinition,
  KPIResult,
  KPIStatus,
  KPIReport,
  MetricTrend,
  MetricDataPoint,
  TimeRange,
  TimePeriod,
  AnalyticsStorageAdapter,
} from '../types/index.js';
import { MetricsEngine } from './MetricsEngine.js';

/**
 * KPI tracker events
 */
export interface KPITrackerEvents {
  'kpi:evaluated': (result: KPIResult) => void;
  'kpi:alert': (kpi: KPIResult) => void;
  'kpi:registered': (definition: KPIDefinition) => void;
  error: (error: Error) => void;
}

/**
 * KPITracker - Tracks KPIs
 */
export class KPITracker extends EventEmitter<KPITrackerEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly metricsEngine: MetricsEngine;
  private readonly kpis = new Map<string, KPIDefinition>();
  private readonly history = new Map<string, KPIResult[]>();

  constructor(storage: AnalyticsStorageAdapter, metricsEngine?: MetricsEngine) {
    super();
    this.storage = storage;
    this.metricsEngine = metricsEngine ?? new MetricsEngine(storage);

    // Register default KPIs
    this.registerDefaultKPIs();
  }

  /**
   * Register default KPIs
   */
  private registerDefaultKPIs(): void {
    this.registerKPI({
      name: 'success_rate',
      displayName: 'Success Rate',
      description: 'Percentage of successful conversations',
      calculation: 'success_rate',
      target: 0.85,
      targetType: 'above',
      warningThreshold: 0.75,
      criticalThreshold: 0.65,
      format: 'percentage',
    });

    this.registerKPI({
      name: 'avg_satisfaction',
      displayName: 'Average Satisfaction',
      description: 'Average user satisfaction score',
      calculation: 'avg_satisfaction',
      target: 4.0,
      targetType: 'above',
      warningThreshold: 3.5,
      criticalThreshold: 3.0,
      format: 'number',
    });

    this.registerKPI({
      name: 'escalation_rate',
      displayName: 'Escalation Rate',
      description: 'Percentage of conversations escalated',
      calculation: 'conversations_escalated / conversations_total',
      target: 0.1,
      targetType: 'below',
      warningThreshold: 0.15,
      criticalThreshold: 0.25,
      format: 'percentage',
    });

    this.registerKPI({
      name: 'avg_response_time',
      displayName: 'Average Response Time',
      description: 'Average time to first response',
      calculation: 'avg_duration',
      target: 60000, // 1 minute
      targetType: 'below',
      warningThreshold: 120000, // 2 minutes
      criticalThreshold: 300000, // 5 minutes
      unit: 'ms',
      format: 'duration',
    });
  }

  /**
   * Register a KPI
   */
  registerKPI(definition: KPIDefinition): void {
    this.kpis.set(definition.name, definition);
    this.history.set(definition.name, []);
    this.emit('kpi:registered', definition);
  }

  /**
   * Remove a KPI
   */
  removeKPI(name: string): boolean {
    const removed = this.kpis.delete(name);
    if (removed) {
      this.history.delete(name);
    }
    return removed;
  }

  /**
   * Get a KPI definition
   */
  getKPIDefinition(name: string): KPIDefinition | undefined {
    return this.kpis.get(name);
  }

  /**
   * List all KPIs
   */
  listKPIs(): KPIDefinition[] {
    return Array.from(this.kpis.values());
  }

  /**
   * Evaluate a single KPI
   */
  async evaluate(
    kpiName: string,
    period?: TimePeriod | TimeRange,
  ): Promise<KPIResult> {
    const definition = this.kpis.get(kpiName);
    if (!definition) {
      throw new Error(`KPI not found: ${kpiName}`);
    }

    const timeRange = period
      ? this.resolveTimeRange(period)
      : this.getDefaultTimeRange();

    // Calculate current value
    const metricValue = await this.metricsEngine.calculate(
      definition.calculation,
      timeRange,
    );

    // Determine status
    const status = this.determineStatus(metricValue.value, definition);

    // Calculate achievement
    const achievement = this.calculateAchievement(
      metricValue.value,
      definition,
    );

    // Calculate gap to target
    const gap = definition.target - metricValue.value;

    // Get trend
    const trend = this.calculateTrend(kpiName, timeRange);

    const result: KPIResult = {
      name: kpiName,
      displayName: definition.displayName,
      value: metricValue.value,
      formatted: metricValue.formatted,
      target: definition.target,
      status,
      achievement,
      gap,
      trend,
      period: timeRange,
    };

    // Store in history
    const kpiHistory = this.history.get(kpiName) ?? [];
    kpiHistory.push(result);
    // Keep last 100 evaluations
    if (kpiHistory.length > 100) {
      kpiHistory.shift();
    }
    this.history.set(kpiName, kpiHistory);

    // Emit events
    this.emit('kpi:evaluated', result);
    if (status === 'off-track' || status === 'at-risk') {
      this.emit('kpi:alert', result);
    }

    return result;
  }

  /**
   * Evaluate all KPIs
   */
  async evaluateAll(period?: TimePeriod | TimeRange): Promise<KPIReport> {
    const results: KPIResult[] = [];

    for (const kpiName of this.kpis.keys()) {
      try {
        const result = await this.evaluate(kpiName, period);
        results.push(result);
      } catch (error) {
        console.error(`Error evaluating KPI ${kpiName}:`, error);
      }
    }

    // Determine overall status
    const summary = {
      onTrack: results.filter((r) => r.status === 'on-track').length,
      atRisk: results.filter((r) => r.status === 'at-risk').length,
      offTrack: results.filter((r) => r.status === 'off-track').length,
      exceeded: results.filter((r) => r.status === 'exceeded').length,
    };

    let overallStatus: KPIStatus;
    if (summary.offTrack > 0) {
      overallStatus = 'off-track';
    } else if (summary.atRisk > 0) {
      overallStatus = 'at-risk';
    } else if (summary.exceeded === results.length) {
      overallStatus = 'exceeded';
    } else {
      overallStatus = 'on-track';
    }

    return {
      kpis: results,
      overallStatus,
      summary,
      period: period
        ? this.resolveTimeRange(period)
        : this.getDefaultTimeRange(),
      generatedAt: Date.now(),
    };
  }

  /**
   * Determine KPI status
   */
  private determineStatus(value: number, definition: KPIDefinition): KPIStatus {
    const { target, targetType, warningThreshold, criticalThreshold } =
      definition;

    switch (targetType) {
      case 'above':
        if (value >= target) return 'exceeded';
        if (criticalThreshold !== undefined && value < criticalThreshold)
          return 'off-track';
        if (warningThreshold !== undefined && value < warningThreshold)
          return 'at-risk';
        return 'on-track';

      case 'below':
        if (value <= target) return 'exceeded';
        if (criticalThreshold !== undefined && value > criticalThreshold)
          return 'off-track';
        if (warningThreshold !== undefined && value > warningThreshold)
          return 'at-risk';
        return 'on-track';

      case 'between': {
        // For between, target is the middle, thresholds define range
        const range = criticalThreshold ?? target * 0.2;
        if (Math.abs(value - target) > range) return 'off-track';
        if (Math.abs(value - target) > (warningThreshold ?? range * 0.5))
          return 'at-risk';
        return 'on-track';
      }

      case 'exact': {
        if (value === target) return 'exceeded';
        const tolerance = warningThreshold ?? target * 0.05;
        if (Math.abs(value - target) > tolerance) return 'off-track';
        return 'on-track';
      }

      default:
        // Default to 'above' behavior
        if (value >= target) return 'on-track';
        return 'off-track';
    }
  }

  /**
   * Calculate achievement percentage
   */
  private calculateAchievement(
    value: number,
    definition: KPIDefinition,
  ): number {
    const { target, targetType } = definition;

    switch (targetType) {
      case 'above':
        return target > 0 ? (value / target) * 100 : 100;

      case 'below':
        // For below targets, achievement is inverse
        if (value <= target) return 100;
        return target > 0 ? (target / value) * 100 : 0;

      case 'between':
      case 'exact': {
        const diff = Math.abs(value - target);
        const maxDiff = Math.max(target * 0.5, 1);
        return Math.max(0, (1 - diff / maxDiff) * 100);
      }

      default:
        return target > 0 ? (value / target) * 100 : 100;
    }
  }

  /**
   * Calculate trend for a KPI
   */
  private calculateTrend(
    kpiName: string,
    _period: TimeRange,
  ): MetricTrend | undefined {
    const history = this.history.get(kpiName);
    if (!history || history.length < 2) {
      return undefined;
    }

    // Get last 10 data points
    const recentHistory = history.slice(-10);
    const dataPoints: MetricDataPoint[] = recentHistory.map((h) => ({
      timestamp: h.period.end,
      value: h.value,
    }));

    // Calculate direction
    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, p) => sum + p.value, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, p) => sum + p.value, 0) / secondHalf.length;

    const changePercent =
      firstAvg !== 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

    let direction: MetricTrend['direction'];
    if (changePercent > 5) {
      direction = 'up';
    } else if (changePercent < -5) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    return {
      direction,
      changePercent,
      dataPoints,
    };
  }

  /**
   * Get KPI history
   */
  getHistory(kpiName: string, limit?: number): KPIResult[] {
    const history = this.history.get(kpiName) ?? [];
    return limit ? history.slice(-limit) : [...history];
  }

  /**
   * Forecast KPI value
   */
  forecast(
    kpiName: string,
    forecastPeriod: number = 7, // days
  ): {
    predicted: number;
    confidence: number;
    range: { low: number; high: number };
  } {
    const history = this.history.get(kpiName);
    if (!history || history.length < 3) {
      throw new Error('Not enough history for forecasting');
    }

    // Simple linear regression forecast
    const values = history.slice(-30).map((h) => h.value);
    const n = values.length;

    // Calculate trend
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict value
    const predicted = intercept + slope * (n + forecastPeriod);

    // Calculate confidence based on variance
    const variance =
      values.reduce((sum, v) => {
        const predicted = intercept + slope * values.indexOf(v);
        return sum + Math.pow(v - predicted, 2);
      }, 0) / n;
    const stdDev = Math.sqrt(variance);

    const confidence = Math.max(0.5, 1 - stdDev / (sumY / n));

    return {
      predicted,
      confidence,
      range: {
        low: predicted - 2 * stdDev,
        high: predicted + 2 * stdDev,
      },
    };
  }

  /**
   * Resolve time range
   */
  private resolveTimeRange(period: TimePeriod | TimeRange): TimeRange {
    if (typeof period === 'object' && 'start' in period) {
      return period;
    }

    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    const DAY = 24 * HOUR;
    const periods: Record<TimePeriod, number> = {
      hour: HOUR,
      day: DAY,
      week: 7 * DAY,
      month: 30 * DAY,
      quarter: 90 * DAY,
      year: 365 * DAY,
      'last-hour': HOUR,
      'last-24-hours': DAY,
      'last-7-days': 7 * DAY,
      'last-30-days': 30 * DAY,
      'last-90-days': 90 * DAY,
      'last-year': 365 * DAY,
      today: DAY,
      'this-week': 7 * DAY,
      'this-month': 30 * DAY,
      'this-quarter': 90 * DAY,
      'this-year': 365 * DAY,
      'all-time': Number.MAX_SAFE_INTEGER,
    };

    return {
      start: now - periods[period],
      end: now,
    };
  }

  /**
   * Get default time range
   */
  private getDefaultTimeRange(): TimeRange {
    return this.resolveTimeRange('week');
  }
}

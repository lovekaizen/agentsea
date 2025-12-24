/**
 * Custom Metrics
 *
 * Allows defining and calculating custom metrics.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  CustomMetricDefinition,
  MetricValue,
  TimeRange,
  TimePeriod,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Custom metrics events
 */
export interface CustomMetricsEvents {
  'metric:registered': (name: string) => void;
  'metric:calculated': (result: MetricValue) => void;
  error: (error: Error) => void;
}

/**
 * Metric dependency graph node
 */
interface _DependencyNode {
  name: string;
  dependencies: string[];
  value?: number;
  calculated: boolean;
}

/**
 * CustomMetrics - Custom metric definitions and calculations
 */
export class CustomMetrics extends EventEmitter<CustomMetricsEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly definitions = new Map<string, CustomMetricDefinition>();
  private readonly cache = new Map<
    string,
    { value: MetricValue; expires: number }
  >();
  private readonly cacheTTL: number;

  constructor(
    storage: AnalyticsStorageAdapter,
    options: { cacheTTL?: number } = {},
  ) {
    super();
    this.storage = storage;
    this.cacheTTL = options.cacheTTL ?? 60000;
  }

  /**
   * Register a custom metric
   */
  register(definition: CustomMetricDefinition): void {
    // Validate dependencies exist
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        if (!this.definitions.has(dep)) {
          throw new Error(
            `Dependency "${dep}" not found for metric "${definition.name}"`,
          );
        }
      }
    }

    // Check for circular dependencies
    if (
      this.hasCircularDependency(definition.name, definition.dependencies ?? [])
    ) {
      throw new Error(
        `Circular dependency detected for metric "${definition.name}"`,
      );
    }

    this.definitions.set(definition.name, definition);
    this.emit('metric:registered', definition.name);
  }

  /**
   * Unregister a custom metric
   */
  unregister(name: string): boolean {
    // Check if other metrics depend on this one
    for (const [metricName, def] of this.definitions) {
      if (def.dependencies?.includes(name)) {
        throw new Error(
          `Cannot unregister "${name}": metric "${metricName}" depends on it`,
        );
      }
    }

    return this.definitions.delete(name);
  }

  /**
   * Check for circular dependencies
   */
  private hasCircularDependency(
    name: string,
    dependencies: string[],
    visited = new Set<string>(),
  ): boolean {
    if (visited.has(name)) {
      return true;
    }
    visited.add(name);

    for (const dep of dependencies) {
      const depDef = this.definitions.get(dep);
      if (depDef?.dependencies) {
        if (this.hasCircularDependency(dep, depDef.dependencies, visited)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate a custom metric
   */
  async calculate(
    name: string,
    period?: TimePeriod | TimeRange,
  ): Promise<MetricValue> {
    const definition = this.definitions.get(name);
    if (!definition) {
      throw new Error(`Custom metric not found: ${name}`);
    }

    const timeRange = period
      ? this.resolveTimeRange(period)
      : this.getDefaultTimeRange();
    const cacheKey = `${name}:${timeRange.start}:${timeRange.end}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    // Calculate dependencies first
    const dependencyValues = new Map<string, number>();
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        const depValue = await this.calculate(dep, timeRange);
        dependencyValues.set(dep, depValue.value);
      }
    }

    // Calculate the metric
    const value = await definition.calculate(timeRange);
    const formatted = this.formatValue(
      value,
      definition.format,
      definition.unit,
    );

    const result: MetricValue = {
      name,
      value,
      formatted,
      timestamp: Date.now(),
      metadata: {
        dependencies: Object.fromEntries(dependencyValues),
      },
    };

    // Cache result
    this.cache.set(cacheKey, {
      value: result,
      expires: Date.now() + this.cacheTTL,
    });

    this.emit('metric:calculated', result);
    return result;
  }

  /**
   * Calculate multiple custom metrics
   */
  async calculateBatch(
    names: string[],
    period?: TimePeriod | TimeRange,
  ): Promise<Map<string, MetricValue>> {
    const results = new Map<string, MetricValue>();

    // Sort by dependencies to ensure correct calculation order
    const sorted = this.topologicalSort(names);

    for (const name of sorted) {
      try {
        const value = await this.calculate(name, period);
        results.set(name, value);
      } catch (error) {
        console.error(`Error calculating metric ${name}:`, error);
      }
    }

    return results;
  }

  /**
   * Topological sort of metrics by dependencies
   */
  private topologicalSort(names: string[]): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) return; // Circular, skip

      visiting.add(name);

      const def = this.definitions.get(name);
      if (def?.dependencies) {
        for (const dep of def.dependencies) {
          if (names.includes(dep) || this.definitions.has(dep)) {
            visit(dep);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);
      result.push(name);
    };

    for (const name of names) {
      visit(name);
    }

    return result;
  }

  /**
   * Create a derived metric from existing metrics
   */
  createDerivedMetric(options: {
    name: string;
    displayName?: string;
    description?: string;
    expression: (values: Map<string, number>) => number;
    dependencies: string[];
    unit?: string;
    format?: CustomMetricDefinition['format'];
  }): void {
    const { name, expression, dependencies, ...rest } = options;

    this.register({
      name,
      ...rest,
      dependencies,
      calculate: async (period) => {
        const values = new Map<string, number>();

        for (const dep of dependencies) {
          const depValue = await this.calculate(dep, period);
          values.set(dep, depValue.value);
        }

        return expression(values);
      },
    });
  }

  /**
   * Create a ratio metric
   */
  createRatioMetric(
    name: string,
    numeratorMetric: string,
    denominatorMetric: string,
    options?: {
      displayName?: string;
      description?: string;
      asPercentage?: boolean;
    },
  ): void {
    this.createDerivedMetric({
      name,
      displayName: options?.displayName ?? name,
      description: options?.description,
      expression: (values) => {
        const numerator = values.get(numeratorMetric) ?? 0;
        const denominator = values.get(denominatorMetric) ?? 1;
        const ratio = denominator !== 0 ? numerator / denominator : 0;
        return options?.asPercentage ? ratio * 100 : ratio;
      },
      dependencies: [numeratorMetric, denominatorMetric],
      format: options?.asPercentage ? 'percentage' : 'number',
    });
  }

  /**
   * Create a sum metric
   */
  createSumMetric(
    name: string,
    metrics: string[],
    options?: {
      displayName?: string;
      description?: string;
    },
  ): void {
    this.createDerivedMetric({
      name,
      displayName: options?.displayName ?? name,
      description: options?.description,
      expression: (values) => {
        let sum = 0;
        for (const metric of metrics) {
          sum += values.get(metric) ?? 0;
        }
        return sum;
      },
      dependencies: metrics,
      format: 'number',
    });
  }

  /**
   * Create an average metric
   */
  createAverageMetric(
    name: string,
    metrics: string[],
    options?: {
      displayName?: string;
      description?: string;
    },
  ): void {
    this.createDerivedMetric({
      name,
      displayName: options?.displayName ?? name,
      description: options?.description,
      expression: (values) => {
        let sum = 0;
        let count = 0;
        for (const metric of metrics) {
          const val = values.get(metric);
          if (val !== undefined) {
            sum += val;
            count++;
          }
        }
        return count > 0 ? sum / count : 0;
      },
      dependencies: metrics,
      format: 'number',
    });
  }

  /**
   * List all custom metrics
   */
  list(): CustomMetricDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get a metric definition
   */
  get(name: string): CustomMetricDefinition | undefined {
    return this.definitions.get(name);
  }

  /**
   * Check if a metric exists
   */
  has(name: string): boolean {
    return this.definitions.has(name);
  }

  /**
   * Get metric dependency tree
   */
  getDependencyTree(name: string): Record<string, string[]> {
    const tree: Record<string, string[]> = {};

    const traverse = (metricName: string): void => {
      if (tree[metricName]) return;

      const def = this.definitions.get(metricName);
      tree[metricName] = def?.dependencies ?? [];

      for (const dep of tree[metricName]) {
        traverse(dep);
      }
    };

    traverse(name);
    return tree;
  }

  /**
   * Format a metric value
   */
  private formatValue(value: number, format?: string, unit?: string): string {
    let formatted: string;

    switch (format) {
      case 'percentage':
        formatted = `${(value * 100).toFixed(1)}%`;
        break;
      case 'duration':
        if (value < 1000) formatted = `${Math.round(value)}ms`;
        else if (value < 60000) formatted = `${(value / 1000).toFixed(1)}s`;
        else formatted = `${(value / 60000).toFixed(1)}m`;
        break;
      case 'count':
        formatted = Math.round(value).toLocaleString();
        break;
      case 'currency':
        formatted = `$${value.toFixed(2)}`;
        break;
      default:
        formatted = value.toFixed(2);
    }

    if (unit && !format) {
      formatted = `${formatted} ${unit}`;
    }

    return formatted;
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

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Metrics Module
 *
 * Exports metrics classes for calculation and tracking.
 */

export {
  MetricsEngine,
  type MetricsEngineEvents,
  type BuiltInMetric,
} from './MetricsEngine.js';

export { KPITracker, type KPITrackerEvents } from './KPITracker.js';

export { CustomMetrics, type CustomMetricsEvents } from './CustomMetrics.js';

export { Aggregations, AggregationBuilder } from './Aggregations.js';

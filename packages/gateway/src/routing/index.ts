/**
 * Routing module exports
 */

export {
  Router,
  createRouterConfig,
  DEFAULT_MODEL_MAPPINGS,
  VIRTUAL_MODELS,
  type RoutingStrategyInterface,
  type RoutingContext,
  type ModelMapping,
  type VirtualModel,
} from './Router.js';

export {
  RoundRobinStrategy,
  type RoundRobinConfig,
  FailoverStrategy,
  type FailoverConfig,
  CostOptimizedStrategy,
  type CostOptimizedConfig,
  LatencyOptimizedStrategy,
  type LatencyOptimizedConfig,
} from './strategies/index.js';

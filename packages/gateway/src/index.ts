/**
 * @lov3kaizen/agentsea-gateway
 *
 * High-performance TypeScript-native LLM gateway with unified API access,
 * intelligent routing, semantic caching, and cost optimization.
 */

// Core
export { Gateway, type GatewayEvents } from './core/Gateway.js';
export {
  // Types
  type ChatMessage,
  type ContentPart,
  type ToolCall,
  type Tool,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ChatCompletionChoice,
  type ChatCompletionChunk,
  type ChatCompletionChunkChoice,
  type UsageInfo,
  type GatewayRequestMetadata,
  type GatewayResponseMetadata,
  type ProviderConfig,
  type ProviderHealth,
  type ModelInfo,
  type ModelCapabilities,
  type RoutingStrategy,
  type RoutingDecision,
  type RouterConfig,
  type RoutingRule,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  type RateLimitConfig,
  type RateLimitResult,
  type TelemetryConfig,
  type GatewayMetrics,
  type GatewayConfig,
  type AuthConfig,
  type ServerConfig,
  // Errors
  GatewayError,
  ProviderError,
  RateLimitError,
  AuthenticationError,
  ValidationError,
} from './core/types.js';

// Providers
export {
  Provider,
  type ProviderOptions,
  ProviderRegistry,
  type ProviderWithModels,
  CircuitBreaker,
  HealthMonitor,
  type CircuitState,
  type CircuitBreakerConfig,
  type HealthMonitorConfig,
  // Concrete providers
  OpenAIProvider,
  type OpenAIProviderOptions,
  AnthropicProvider,
  type AnthropicProviderOptions,
  GoogleProvider,
  type GoogleProviderOptions,
} from './providers/index.js';

// Routing
export {
  Router,
  createRouterConfig,
  DEFAULT_MODEL_MAPPINGS,
  VIRTUAL_MODELS,
  type RoutingStrategyInterface,
  type RoutingContext,
  type ModelMapping,
  type VirtualModel,
  // Strategies
  RoundRobinStrategy,
  type RoundRobinConfig,
  FailoverStrategy,
  type FailoverConfig,
  CostOptimizedStrategy,
  type CostOptimizedConfig,
  LatencyOptimizedStrategy,
  type LatencyOptimizedConfig,
} from './routing/index.js';

// Server
export {
  createHTTPServer,
  startServer,
  type HTTPServerOptions,
} from './server/index.js';

// Telemetry
export {
  MetricsCollector,
  type MetricsConfig,
  type HistogramData,
} from './telemetry/index.js';

// Utilities
export {
  // Pricing
  MODEL_PRICING,
  MODEL_CONTEXT_WINDOWS,
  MODEL_MAX_OUTPUT,
  calculateCost,
  estimateCost,
  getModelPricing,
  getModelInfo,
  getModelCapabilities,
  findCheapestModel,
  sortModelsByCost,
  // Tokenizer
  countTokens,
  countMessageTokens,
  estimateRequestTokens,
  truncateToTokenLimit,
  freeEncoder,
  // Hashing
  hashRequest,
  generateId,
  generateRequestId,
  generateCacheKey,
  hash,
  createSystemFingerprint,
} from './utils/index.js';

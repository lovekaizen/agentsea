/**
 * @lov3kaizen/agentsea-structured
 *
 * TypeScript-native structured output framework that guarantees
 * LLM responses match your Zod schemas.
 *
 * @packageDocumentation
 */

// Core
export { StructuredClient, createStructuredClient } from './core/index.js';

// Schema utilities
export {
  schemaToPrompt,
  zodToJsonSchema,
  analyzeSchema,
  extractFieldInfo,
  generateExample,
  SchemaPromptGenerator,
  validateSchema,
  validateSchemaOrThrow,
  validatePartial,
  matchesSchema,
  coerceToSchema,
  getValidationHints,
  formatZodErrors,
  SchemaValidator,
} from './schema/index.js';

// Streaming
export {
  createStreamingResult,
  getPartialState,
  IncrementalJsonParser,
  tokenizeJson,
  type FieldParseUpdate,
} from './streaming/index.js';

// Providers
export {
  OpenAIAdapter,
  createOpenAIAdapter,
  AnthropicAdapter,
  createAnthropicAdapter,
  GoogleAdapter,
  createGoogleAdapter,
} from './providers/index.js';

// AgentSea integration
export {
  StructuredProvider,
  TypedExtractor,
  createStructuredProvider,
  Extractors,
  type AgentSeaProviderType,
  type StructuredProviderOptions,
} from './integrations/index.js';

// Types
export type {
  // Core types
  ExtractionMode,
  StructuredProvider as StructuredProviderType,
  MessageRole,
  ChatMessage,
  StructuredRequestOptions,
  ExtractionModeConfig,
  JsonModeConfig,
  ToolModeConfig,
  PromptModeConfig,
  HybridModeConfig,
  RetryConfig,
  FixHintConfig,
  RetryCondition,
  RecoveryConfig,
  ValidationError,
  ExtractionResult,
  ExtractionMetadata,
  TokenUsage,
  ExtractionAttempt,
  StructuredClientConfig,
} from './types/core.types.js';

export { StructuredError } from './types/core.types.js';

export type {
  // Schema types
  SchemaFormat,
  SchemaPromptOptions,
  SchemaPrompt,
  JsonSchema,
  SchemaAnalysis,
  SchemaExample,
  FieldInfo,
  FieldConstraint,
  SchemaWithExamples,
  ToolDefinition,
  ToolCall,
  SchemaValidationResult,
  ValidationErrorDetail,
} from './types/schema.types.js';

export type {
  // Streaming types
  StreamingOptions,
  StreamingResult,
  FieldUpdate,
  PartialState,
  JsonToken,
  JsonTokenType,
  ParserState,
  StreamChunk,
  StreamMetadata,
} from './types/streaming.types.js';

export type {
  // Provider types
  ProviderCapabilities,
  ProviderAdapter,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
  ProviderStreamChunk,
  ProviderToolCallDelta,
  OpenAIOptions,
  AnthropicOptions,
  GoogleOptions,
  ProviderFactoryOptions,
  GenericCompletionFn,
  GenericCompletionOptions,
} from './types/provider.types.js';

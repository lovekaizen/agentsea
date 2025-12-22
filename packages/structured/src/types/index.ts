/**
 * Structured Output Types
 *
 * Central export for all type definitions.
 */

// Core types
export type {
  ExtractionMode,
  StructuredProvider,
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
} from './core.types.js';

export { StructuredError } from './core.types.js';

// Schema types
export type {
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
} from './schema.types.js';

// Streaming types
export type {
  StreamingOptions,
  StreamingResult,
  FieldUpdate,
  PartialState,
  JsonToken,
  JsonTokenType,
  ParserState,
  StreamChunk,
  StreamMetadata,
} from './streaming.types.js';

// Provider types
export type {
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
} from './provider.types.js';

/**
 * Schema Types
 *
 * Type definitions for schema processing.
 */

import type { z } from 'zod';

/**
 * Schema format for prompt generation
 */
export type SchemaFormat =
  | 'json-schema'
  | 'typescript'
  | 'natural'
  | 'examples';

/**
 * Schema prompt options
 */
export interface SchemaPromptOptions {
  /** Output format */
  format?: SchemaFormat;
  /** Include field descriptions */
  includeDescriptions?: boolean;
  /** Include examples */
  includeExamples?: boolean;
  /** Include constraints */
  includeConstraints?: boolean;
  /** Max depth for nested objects */
  maxDepth?: number;
  /** Indentation */
  indent?: number;
}

/**
 * Generated schema prompt
 */
export interface SchemaPrompt {
  /** The generated prompt text */
  text: string;
  /** Format used */
  format: SchemaFormat;
  /** JSON schema (if generated) */
  jsonSchema?: JsonSchema;
  /** TypeScript type (if generated) */
  typeScript?: string;
}

/**
 * JSON Schema representation
 */
export interface JsonSchema {
  $schema?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean | JsonSchema;
  format?: string;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  [key: string]: unknown;
}

/**
 * Schema analysis result
 */
export interface SchemaAnalysis {
  /** Root type */
  rootType: string;
  /** All field paths */
  fieldPaths: string[];
  /** Required fields */
  requiredFields: string[];
  /** Optional fields */
  optionalFields: string[];
  /** Has recursion */
  hasRecursion: boolean;
  /** Has union types */
  hasUnions: boolean;
  /** Has arrays */
  hasArrays: boolean;
  /** Max nesting depth */
  maxDepth: number;
  /** Estimated complexity (1-10) */
  complexity: number;
}

/**
 * Schema example
 */
export interface SchemaExample {
  /** Example value */
  value: unknown;
  /** Description */
  description?: string;
  /** Whether it's a valid example */
  isValid: boolean;
}

/**
 * Field info
 */
export interface FieldInfo {
  /** Field path */
  path: string;
  /** Field name */
  name: string;
  /** Zod type name */
  zodType: string;
  /** JSON Schema type */
  jsonType: string;
  /** Description */
  description?: string;
  /** Is required */
  required: boolean;
  /** Has default */
  hasDefault: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Constraints */
  constraints: FieldConstraint[];
  /** Child fields (for objects) */
  children?: FieldInfo[];
}

/**
 * Field constraint
 */
export interface FieldConstraint {
  /** Constraint type */
  type: string;
  /** Constraint value */
  value: unknown;
  /** Human-readable description */
  description: string;
}

/**
 * Schema with examples
 */
export interface SchemaWithExamples<T extends z.ZodType> {
  /** The schema */
  schema: T;
  /** Examples */
  examples: z.infer<T>[];
}

/**
 * Tool definition (OpenAI format)
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
    strict?: boolean;
  };
}

/**
 * Tool call
 */
export interface ToolCall {
  /** Call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Arguments (validated) */
  arguments: unknown;
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult<T> {
  /** Whether validation succeeded */
  success: boolean;
  /** Validated data (if successful) */
  data?: T;
  /** Validation errors (if failed) */
  errors?: ValidationErrorDetail[];
}

/**
 * Validation error detail
 */
export interface ValidationErrorDetail {
  /** Error path */
  path: (string | number)[];
  /** Error message */
  message: string;
  /** Expected value/type */
  expected?: string;
  /** Received value */
  received?: unknown;
  /** Zod error code */
  code: string;
}

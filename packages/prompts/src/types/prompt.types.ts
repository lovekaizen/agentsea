/**
 * Prompt Type Definitions
 */

import { z } from 'zod';

/**
 * Variable type definitions
 */
export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'enum'
  | 'object';

export interface VariableDefinition {
  type: VariableType;
  required?: boolean;
  default?: unknown;
  description?: string;
  values?: string[]; // For enum type
  items?: VariableDefinition; // For array type
  properties?: Record<string, VariableDefinition>; // For object type
  validation?: z.ZodSchema;
}

export type VariableDefinitions = Record<string, VariableDefinition>;

/**
 * Prompt metadata
 */
export interface PromptMetadata {
  author?: string;
  tags?: string[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  category?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Prompt status
 */
export type PromptStatus = 'draft' | 'active' | 'deprecated' | 'archived';

/**
 * Core prompt data structure
 */
export interface PromptData {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: VariableDefinitions;
  metadata: PromptMetadata;
  status: PromptStatus;
  version: string;
  environment: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  hash: string;
}

/**
 * Input for creating a prompt
 */
export interface CreatePromptInput {
  name: string;
  description?: string;
  template: string;
  variables?: VariableDefinitions;
  metadata?: PromptMetadata;
  status?: PromptStatus;
  environment?: string;
}

/**
 * Input for updating a prompt
 */
export interface UpdatePromptInput {
  description?: string;
  template?: string;
  variables?: VariableDefinitions;
  metadata?: PromptMetadata;
  status?: PromptStatus;
  message?: string; // Commit message for version
}

/**
 * Prompt query options
 */
export interface PromptQueryOptions {
  environment?: string;
  version?: string;
  status?: PromptStatus;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Render options for template
 */
export interface RenderOptions {
  strict?: boolean; // Throw on missing variables
  partials?: Record<string, string>;
  helpers?: Record<string, (...args: unknown[]) => string>;
}

/**
 * Rendered prompt result
 */
export interface RenderedPrompt {
  content: string;
  variables: Record<string, unknown>;
  warnings?: string[];
}

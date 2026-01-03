/**
 * Prompt Entity
 *
 * Represents a prompt with its template, variables, and metadata.
 */

import type {
  PromptData,
  PromptMetadata,
  PromptStatus,
  VariableDefinitions,
  RenderedPrompt,
  RenderOptions,
} from '../types/index.js';
import { generateId, hashContent } from '../utils/hashing.js';
import {
  validatePromptName,
  validateTemplate,
  validateVariables,
} from '../utils/validation.js';
import { normalizeTemplate } from '../utils/formatting.js';
import Handlebars from 'handlebars';

/**
 * Prompt class - represents a single prompt entity
 */
export class Prompt implements PromptData {
  readonly id: string;
  readonly name: string;
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

  private compiledTemplate?: HandlebarsTemplateDelegate;

  constructor(data: Partial<PromptData> & { name: string; template: string }) {
    // Validate name
    const nameValidation = validatePromptName(data.name);
    if (!nameValidation.valid) {
      throw new Error(nameValidation.error);
    }

    // Validate and extract variables from template
    const templateValidation = validateTemplate(data.template);
    if (!templateValidation.valid) {
      throw new Error(templateValidation.error);
    }

    this.id = data.id || generateId();
    this.name = data.name;
    this.description = data.description;
    this.template = normalizeTemplate(data.template);
    this.variables =
      data.variables || this.inferVariables(templateValidation.variables);
    this.metadata = data.metadata || {};
    this.status = data.status || 'draft';
    this.version = data.version || 'v1';
    this.environment = data.environment || 'development';
    this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
    this.updatedAt = data.updatedAt ? new Date(data.updatedAt) : new Date();
    this.createdBy = data.createdBy;
    this.hash = data.hash || hashContent(this.template);
  }

  /**
   * Infer variable definitions from variable names
   */
  private inferVariables(variableNames: string[]): VariableDefinitions {
    const definitions: VariableDefinitions = {};
    for (const name of variableNames) {
      definitions[name] = {
        type: 'string',
        required: true,
      };
    }
    return definitions;
  }

  /**
   * Render the prompt with variables
   */
  render(
    variables: Record<string, unknown>,
    options: RenderOptions = {},
  ): RenderedPrompt {
    const { strict = false, partials = {}, helpers = {} } = options;
    const warnings: string[] = [];

    // Validate variables if strict mode
    if (strict) {
      const validation = validateVariables(variables, this.variables);
      if (!validation.valid) {
        throw new Error(
          `Variable validation failed: ${validation.errors.join(', ')}`,
        );
      }
    }

    // Apply defaults for missing variables
    const resolvedVariables: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(this.variables)) {
      if (name in variables) {
        resolvedVariables[name] = variables[name];
      } else if (def.default !== undefined) {
        resolvedVariables[name] = def.default;
        warnings.push(`Using default value for '${name}'`);
      } else if (!def.required) {
        resolvedVariables[name] = '';
      } else if (!strict) {
        warnings.push(`Missing required variable '${name}'`);
        resolvedVariables[name] = `{{${name}}}`; // Keep placeholder
      }
    }

    // Add any extra variables not in definitions
    for (const [name, value] of Object.entries(variables)) {
      if (!(name in resolvedVariables)) {
        resolvedVariables[name] = value;
      }
    }

    // Compile template if not cached
    if (!this.compiledTemplate) {
      // Register partials
      const handlebars = Handlebars.create();
      for (const [name, partial] of Object.entries(partials)) {
        handlebars.registerPartial(name, partial);
      }

      // Register helpers
      for (const [name, helper] of Object.entries(helpers)) {
        handlebars.registerHelper(name, helper);
      }

      this.compiledTemplate = handlebars.compile(this.template, {
        strict: false, // We handle strictness ourselves
        noEscape: true, // Don't escape HTML
      });
    }

    // Render template
    const content = this.compiledTemplate(resolvedVariables);

    return {
      content,
      variables: resolvedVariables,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get variable names from the template
   */
  getVariableNames(): string[] {
    return Object.keys(this.variables);
  }

  /**
   * Check if a variable is defined
   */
  hasVariable(name: string): boolean {
    return name in this.variables;
  }

  /**
   * Get required variables
   */
  getRequiredVariables(): string[] {
    return Object.entries(this.variables)
      .filter(([, def]) => def.required)
      .map(([name]) => name);
  }

  /**
   * Get optional variables
   */
  getOptionalVariables(): string[] {
    return Object.entries(this.variables)
      .filter(([, def]) => !def.required)
      .map(([name]) => name);
  }

  /**
   * Create a copy of this prompt
   */
  clone(overrides?: Partial<PromptData>): Prompt {
    return new Prompt({
      ...this.toData(),
      ...overrides,
      id: overrides?.id || generateId(), // New ID by default
    });
  }

  /**
   * Convert to plain data object
   */
  toData(): PromptData {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      template: this.template,
      variables: this.variables,
      metadata: this.metadata,
      status: this.status,
      version: this.version,
      environment: this.environment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      createdBy: this.createdBy,
      hash: this.hash,
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.toData(), null, 2);
  }

  /**
   * Create a Prompt from data
   */
  static fromData(data: PromptData): Prompt {
    return new Prompt(data);
  }

  /**
   * Create a Prompt from JSON
   */
  static fromJSON(json: string): Prompt {
    const data = JSON.parse(json) as PromptData;
    return Prompt.fromData(data);
  }

  /**
   * Update prompt properties (returns new Prompt instance)
   */
  update(updates: {
    template?: string;
    description?: string;
    variables?: VariableDefinitions;
    metadata?: PromptMetadata;
    status?: PromptStatus;
  }): Prompt {
    const newTemplate = updates.template || this.template;
    const normalizedTemplate = normalizeTemplate(newTemplate);
    const newHash = hashContent(normalizedTemplate);

    return new Prompt({
      ...this.toData(),
      template: normalizedTemplate,
      description: updates.description ?? this.description,
      variables: updates.variables || this.variables,
      metadata: { ...this.metadata, ...updates.metadata },
      status: updates.status || this.status,
      hash: newHash,
      updatedAt: new Date(),
    });
  }

  /**
   * Check if content has changed compared to another prompt
   */
  hasChanges(other: Prompt): boolean {
    return this.hash !== other.hash;
  }

  /**
   * Get display name
   */
  getDisplayName(): string {
    return this.description || this.name;
  }

  /**
   * Get template preview
   */
  getPreview(maxLength: number = 100): string {
    const preview = this.template.replace(/\n/g, ' ').trim();
    if (preview.length <= maxLength) {
      return preview;
    }
    return preview.substring(0, maxLength - 3) + '...';
  }
}

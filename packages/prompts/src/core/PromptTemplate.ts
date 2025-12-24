/**
 * Prompt Template
 *
 * Enhanced template system with partials, composition, and validation.
 */

import Handlebars from 'handlebars';
import type {
  VariableDefinitions,
  RenderOptions,
  RenderedPrompt,
} from '../types/index.js';
import { validateTemplate, validateVariables } from '../utils/validation.js';
import { normalizeTemplate } from '../utils/formatting.js';

/**
 * Template compilation options
 */
export interface TemplateCompileOptions {
  strict?: boolean;
  noEscape?: boolean;
  knownHelpers?: Record<string, boolean>;
  knownHelpersOnly?: boolean;
}

/**
 * PromptTemplate class - handles template compilation and rendering
 */
export class PromptTemplate {
  readonly template: string;
  readonly variables: VariableDefinitions;
  private compiledTemplate?: HandlebarsTemplateDelegate;
  private handlebars: typeof Handlebars;

  constructor(
    template: string,
    variables?: VariableDefinitions,
    options: {
      partials?: Record<string, string>;
      helpers?: Record<string, unknown>;
    } = {},
  ) {
    const validation = validateTemplate(template);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    this.template = normalizeTemplate(template);
    this.variables = variables || this.inferVariables(validation.variables);
    this.handlebars = Handlebars.create();

    // Register partials
    if (options.partials) {
      for (const [name, partial] of Object.entries(options.partials)) {
        this.handlebars.registerPartial(name, partial);
      }
    }

    // Register helpers
    this.registerDefaultHelpers();
    if (options.helpers) {
      for (const [name, helper] of Object.entries(options.helpers)) {
        this.handlebars.registerHelper(
          name,
          helper as Handlebars.HelperDelegate,
        );
      }
    }
  }

  /**
   * Register default helpers
   */
  private registerDefaultHelpers(): void {
    // Uppercase helper
    this.handlebars.registerHelper('upper', (str: string) =>
      typeof str === 'string' ? str.toUpperCase() : str,
    );

    // Lowercase helper
    this.handlebars.registerHelper('lower', (str: string) =>
      typeof str === 'string' ? str.toLowerCase() : str,
    );

    // Capitalize helper
    this.handlebars.registerHelper('capitalize', (str: string) =>
      typeof str === 'string'
        ? str.charAt(0).toUpperCase() + str.slice(1)
        : str,
    );

    // Truncate helper
    this.handlebars.registerHelper(
      'truncate',
      (str: string, length: number) => {
        if (typeof str !== 'string') return str;
        if (str.length <= length) return str;
        return str.substring(0, length - 3) + '...';
      },
    );

    // Default value helper
    this.handlebars.registerHelper(
      'default',
      (value: unknown, defaultValue: unknown) => value ?? defaultValue,
    );

    // JSON stringify helper
    this.handlebars.registerHelper('json', (obj: unknown) =>
      JSON.stringify(obj, null, 2),
    );

    // Join array helper
    this.handlebars.registerHelper(
      'join',
      (arr: unknown[], separator: string) =>
        Array.isArray(arr) ? arr.join(separator) : arr,
    );

    // Conditional equals helper
    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    // Date formatting helper
    this.handlebars.registerHelper(
      'date',
      (date: Date | string, format?: string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (format === 'iso') {
          return d.toISOString();
        }
        return d.toLocaleDateString();
      },
    );

    // Number formatting helper
    this.handlebars.registerHelper(
      'number',
      (num: number, decimals?: number) => {
        if (typeof num !== 'number') return num;
        return decimals !== undefined ? num.toFixed(decimals) : num.toString();
      },
    );
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
   * Compile the template
   */
  compile(options: TemplateCompileOptions = {}): HandlebarsTemplateDelegate {
    if (!this.compiledTemplate) {
      this.compiledTemplate = this.handlebars.compile(this.template, {
        strict: options.strict ?? false,
        noEscape: options.noEscape ?? true,
        knownHelpers: options.knownHelpers,
        knownHelpersOnly: options.knownHelpersOnly,
      });
    }
    return this.compiledTemplate;
  }

  /**
   * Render the template with variables
   */
  render(
    variables: Record<string, unknown>,
    options: RenderOptions = {},
  ): RenderedPrompt {
    const { strict = false } = options;
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
        resolvedVariables[name] = `{{${name}}}`;
      }
    }

    // Add extra variables
    for (const [name, value] of Object.entries(variables)) {
      if (!(name in resolvedVariables)) {
        resolvedVariables[name] = value;
      }
    }

    // Register additional partials from options
    if (options.partials) {
      for (const [name, partial] of Object.entries(options.partials)) {
        this.handlebars.registerPartial(name, partial);
      }
    }

    // Register additional helpers from options
    if (options.helpers) {
      for (const [name, helper] of Object.entries(options.helpers)) {
        this.handlebars.registerHelper(name, helper);
      }
    }

    // Compile and render
    const compiled = this.compile({ strict });
    const content = compiled(resolvedVariables);

    return {
      content,
      variables: resolvedVariables,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Register a partial
   */
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
    // Reset compiled template to pick up new partial
    this.compiledTemplate = undefined;
  }

  /**
   * Register a helper
   */
  registerHelper(name: string, helper: Handlebars.HelperDelegate): void {
    this.handlebars.registerHelper(name, helper);
    // Reset compiled template to pick up new helper
    this.compiledTemplate = undefined;
  }

  /**
   * Get variable names
   */
  getVariableNames(): string[] {
    return Object.keys(this.variables);
  }

  /**
   * Clone with modifications
   */
  clone(overrides?: {
    template?: string;
    variables?: VariableDefinitions;
  }): PromptTemplate {
    return new PromptTemplate(
      overrides?.template || this.template,
      overrides?.variables || this.variables,
    );
  }
}

/**
 * Partial definition for reusable template snippets
 */
export class Partial {
  readonly name: string;
  readonly template: string;
  readonly description?: string;
  readonly variables: string[];

  constructor(config: {
    name: string;
    template: string;
    description?: string;
  }) {
    this.name = config.name;
    this.template = normalizeTemplate(config.template);
    this.description = config.description;

    // Extract variables from partial
    const validation = validateTemplate(config.template);
    this.variables = validation.variables;
  }

  /**
   * Convert to plain object
   */
  toData(): {
    name: string;
    template: string;
    description?: string;
    variables: string[];
  } {
    return {
      name: this.name,
      template: this.template,
      description: this.description,
      variables: this.variables,
    };
  }
}

/**
 * Compose multiple templates/partials into one
 */
export function compose(
  parts: Array<
    | { partial: string; variables?: Record<string, unknown> }
    | { template: string; variables?: Record<string, unknown> }
  >,
  separator: string = '\n\n',
): string {
  const renderedParts: string[] = [];

  for (const part of parts) {
    if ('partial' in part) {
      // Reference to a partial - keep as partial reference
      renderedParts.push(`{{> ${part.partial}}}`);
    } else {
      // Inline template
      renderedParts.push(part.template);
    }
  }

  return renderedParts.join(separator);
}

/**
 * Create a template from multiple parts
 */
export function createComposedTemplate(
  parts: Array<{
    name?: string;
    template: string;
    condition?: string;
  }>,
  options: {
    separator?: string;
    wrapInConditional?: boolean;
  } = {},
): string {
  const { separator = '\n\n', wrapInConditional = false } = options;
  const renderedParts: string[] = [];

  for (const part of parts) {
    let content = part.template;

    if (wrapInConditional && part.condition) {
      content = `{{#if ${part.condition}}}\n${content}\n{{/if}}`;
    }

    if (part.name) {
      content = `{{!-- ${part.name} --}}\n${content}`;
    }

    renderedParts.push(content);
  }

  return renderedParts.join(separator);
}

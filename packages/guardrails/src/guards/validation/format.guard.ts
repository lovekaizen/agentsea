/**
 * Format Guard
 *
 * Validates content format (JSON, XML, Markdown, etc.).
 */

import type {
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  DetectionDetail,
} from '../../types';
import { BaseGuard } from '../../core/base-guard';
import { GuardRegistry } from '../../core/guard-registry';

/**
 * Supported formats
 */
export type FormatType =
  | 'json'
  | 'xml'
  | 'markdown'
  | 'yaml'
  | 'html'
  | 'custom';

/**
 * Format guard configuration
 */
export interface FormatGuardOptions extends Partial<GuardConfig> {
  /** Expected format */
  format?: FormatType;
  /** Custom validator function */
  customValidator?: (content: string) => FormatValidationResult;
  /** Allow empty content */
  allowEmpty?: boolean;
  /** Format-specific options */
  formatOptions?: Record<string, unknown>;
}

/**
 * Format validation result
 */
export interface FormatValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Format validation details
 */
export interface FormatDetails {
  /** Detected format */
  format: FormatType | 'unknown';
  /** Whether format is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Format metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Format validators
 */
const FORMAT_VALIDATORS: Record<
  FormatType,
  (content: string) => FormatValidationResult
> = {
  json: (content: string): FormatValidationResult => {
    try {
      const parsed = JSON.parse(content);
      return {
        valid: true,
        errors: [],
        metadata: {
          type: typeof parsed,
          isArray: Array.isArray(parsed),
          keys:
            typeof parsed === 'object' && parsed !== null
              ? Object.keys(parsed)
              : [],
        },
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Invalid JSON';
      return {
        valid: false,
        errors: [error],
      };
    }
  },

  xml: (content: string): FormatValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic XML validation
    const trimmed = content.trim();

    // Check for XML declaration
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
      errors.push('Content does not appear to be XML');
      return { valid: false, errors };
    }

    // Check for balanced tags
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(trimmed)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];

      if (fullTag.startsWith('</')) {
        // Closing tag
        const lastOpen = openTags.pop();
        if (lastOpen !== tagName) {
          errors.push(
            `Mismatched tag: expected </${lastOpen}>, found </${tagName}>`,
          );
        }
      } else if (!fullTag.endsWith('/>')) {
        // Opening tag (not self-closing)
        openTags.push(tagName);
      }
    }

    if (openTags.length > 0) {
      errors.push(`Unclosed tags: ${openTags.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  markdown: (content: string): FormatValidationResult => {
    const warnings: string[] = [];

    // Markdown is generally permissive, just check for common issues
    const lines = content.split('\n');

    // Check for unclosed code blocks
    let codeBlockCount = 0;
    for (const line of lines) {
      if (line.trim().startsWith('```')) {
        codeBlockCount++;
      }
    }
    if (codeBlockCount % 2 !== 0) {
      warnings.push('Potentially unclosed code block');
    }

    // Check for unmatched inline code
    const inlineCodeMatches = content.match(/`[^`]+`/g) || [];
    const backtickCount = (content.match(/`/g) || []).length;
    if (backtickCount > inlineCodeMatches.length * 2) {
      warnings.push('Potentially unmatched inline code markers');
    }

    return {
      valid: true,
      errors: [],
      warnings,
      metadata: {
        lineCount: lines.length,
        hasCodeBlocks: codeBlockCount > 0,
        hasHeaders: /^#{1,6}\s/.test(content),
        hasList: /^[\s]*[-*+]\s/.test(content) || /^\d+\.\s/.test(content),
      },
    };
  },

  yaml: (content: string): FormatValidationResult => {
    // Basic YAML validation
    const errors: string[] = [];
    const trimmed = content.trim();

    if (!trimmed) {
      return { valid: true, errors: [] };
    }

    // Check indentation consistency
    const lines = trimmed.split('\n');
    let indentSize: number | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (leadingSpaces > 0) {
        if (line.startsWith('\t')) {
          errors.push(`Line ${i + 1}: Tabs not allowed in YAML indentation`);
          continue;
        }

        if (indentSize === null) {
          indentSize = leadingSpaces;
        } else if (leadingSpaces % indentSize !== 0) {
          errors.push(`Line ${i + 1}: Inconsistent indentation`);
        }
      }
    }

    // Check for basic syntax issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      // Check for key-value pairs
      if (line.includes(':') && !line.startsWith('-')) {
        const colonIndex = line.indexOf(':');
        const afterColon = line.slice(colonIndex + 1);
        if (
          afterColon &&
          !afterColon.startsWith(' ') &&
          !afterColon.startsWith('\n')
        ) {
          errors.push(`Line ${i + 1}: Missing space after colon`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  html: (content: string): FormatValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for doctype
    if (!content.trim().toLowerCase().startsWith('<!doctype')) {
      warnings.push('Missing DOCTYPE declaration');
    }

    // Check for basic structure
    const hasHtml = /<html[^>]*>/i.test(content);
    const hasHead = /<head[^>]*>/i.test(content);
    const hasBody = /<body[^>]*>/i.test(content);

    if (!hasHtml) warnings.push('Missing <html> tag');
    if (!hasHead) warnings.push('Missing <head> tag');
    if (!hasBody) warnings.push('Missing <body> tag');

    // Check for unclosed tags (simplified)
    const selfClosingTags = [
      'br',
      'hr',
      'img',
      'input',
      'meta',
      'link',
      'area',
      'base',
      'col',
    ];
    const tagStack: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();

      if (selfClosingTags.includes(tagName)) continue;

      if (fullTag.startsWith('</')) {
        const lastOpen = tagStack.pop();
        if (lastOpen !== tagName) {
          errors.push(
            `Mismatched tag: expected </${lastOpen}>, found </${tagName}>`,
          );
        }
      } else if (!fullTag.endsWith('/>')) {
        tagStack.push(tagName);
      }
    }

    if (tagStack.length > 0) {
      errors.push(`Unclosed tags: ${tagStack.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  },

  custom: (): FormatValidationResult => {
    return {
      valid: true,
      errors: [],
      warnings: ['Custom validator not provided'],
    };
  },
};

/**
 * Format Guard
 *
 * Validates content format.
 */
export class FormatGuard extends BaseGuard<void, FormatDetails> {
  readonly name = 'format';
  readonly supportedTypes: ContentType[] = ['output'];

  private format: FormatType;
  private customValidator?: (content: string) => FormatValidationResult;
  private allowEmpty: boolean;

  constructor(options: FormatGuardOptions = {}) {
    super(options);
    this.format = options.format ?? 'json';
    this.customValidator = options.customValidator;
    this.allowEmpty = options.allowEmpty ?? false;
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<FormatDetails>> {
    const { input } = context;

    // Check for empty content
    if (!input.trim()) {
      if (this.allowEmpty) {
        return Promise.resolve(
          this.pass(
            { format: this.format, valid: true, errors: [], warnings: [] },
            'Empty content allowed',
          ),
        );
      }
      return Promise.resolve(
        this.fail('Content is empty', {
          format: 'unknown',
          valid: false,
          errors: ['Content is empty'],
          warnings: [],
        }),
      );
    }

    // Get validator
    const validator =
      this.format === 'custom' && this.customValidator
        ? this.customValidator
        : FORMAT_VALIDATORS[this.format];

    if (!validator) {
      return Promise.resolve(this.skip(`Unsupported format: ${this.format}`));
    }

    // Validate
    const result = validator(input);

    const details: FormatDetails = {
      format: this.format,
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings ?? [],
      metadata: result.metadata,
    };

    if (!result.valid) {
      const detections: DetectionDetail[] = result.errors.map((e) => ({
        category: 'format',
        pattern: this.format,
        matchedText: e,
      }));

      return Promise.resolve(
        this.fail(
          `Invalid ${this.format.toUpperCase()} format: ${result.errors.join('; ')}`,
          details,
          detections,
        ),
      );
    }

    // Warn if there are warnings
    if (result.warnings && result.warnings.length > 0) {
      return Promise.resolve(
        this.warn(
          `${this.format.toUpperCase()} format valid with warnings: ${result.warnings.join('; ')}`,
          details,
        ),
      );
    }

    return Promise.resolve(
      this.pass(details, `Valid ${this.format.toUpperCase()} format`),
    );
  }
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'format',
    description: 'Validates content format (JSON, XML, Markdown, etc.)',
    category: 'validation',
    supportedTypes: ['output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.0,
      sensitivity: 'medium',
    },
  },
  factory: (config) => new FormatGuard(config),
});

export default FormatGuard;

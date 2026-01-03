/**
 * Schema Guard
 *
 * Validates content against a Zod schema.
 */

import { z, ZodError } from 'zod';

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
 * Schema guard configuration
 */
export interface SchemaGuardOptions extends Partial<GuardConfig> {
  /** Zod schema for validation */
  schema?: z.ZodType;
  /** Strict mode (no extra properties) */
  strict?: boolean;
  /** Parse JSON before validation */
  parseJson?: boolean;
  /** Custom error messages */
  errorMessages?: Record<string, string>;
}

/**
 * Schema validation details
 */
export interface SchemaDetails {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
  /** Parsed data (if successful) */
  parsedData?: unknown;
}

/**
 * Schema Guard
 *
 * Validates output content against a Zod schema.
 */
export class SchemaGuard extends BaseGuard<void, SchemaDetails> {
  readonly name = 'schema';
  readonly supportedTypes: ContentType[] = ['output'];

  private schema?: z.ZodType;
  private strict: boolean;
  private parseJson: boolean;
  private errorMessages: Record<string, string>;

  constructor(options: SchemaGuardOptions = {}) {
    super(options);
    this.schema = options.schema;
    this.strict = options.strict ?? false;
    this.parseJson = options.parseJson ?? true;
    this.errorMessages = options.errorMessages ?? {};
  }

  /**
   * Set the schema at runtime
   */
  setSchema(schema: z.ZodType): void {
    this.schema = schema;
  }

  protected doCheck(
    context: GuardContext,
  ): Promise<GuardResult<SchemaDetails>> {
    const { input } = context;

    // If no schema configured, skip
    if (!this.schema) {
      return Promise.resolve(this.skip('No schema configured'));
    }

    // Parse JSON if needed
    let data: unknown;
    if (this.parseJson) {
      try {
        data = JSON.parse(input);
      } catch (e) {
        const details: SchemaDetails = {
          valid: false,
          errors: [
            {
              path: '',
              message: 'Invalid JSON',
              code: 'invalid_json',
            },
          ],
        };
        return Promise.resolve(this.fail('Content is not valid JSON', details));
      }
    } else {
      data = input;
    }

    // Validate against schema
    try {
      const parsed = this.schema.parse(data);

      const details: SchemaDetails = {
        valid: true,
        errors: [],
        parsedData: parsed,
      };

      return Promise.resolve(this.pass(details, 'Schema validation passed'));
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: this.getErrorMessage(e.path.join('.'), e.message),
          code: e.code,
        }));

        const detections: DetectionDetail[] = errors.map((e) => ({
          category: 'schema',
          pattern: e.code,
          context: e.path,
          matchedText: e.message,
        }));

        const details: SchemaDetails = {
          valid: false,
          errors,
        };

        return Promise.resolve(
          this.fail(
            `Schema validation failed: ${errors.map((e) => e.message).join('; ')}`,
            details,
            detections,
          ),
        );
      }

      throw error;
    }
  }

  /**
   * Get custom error message if defined
   */
  private getErrorMessage(path: string, defaultMessage: string): string {
    return this.errorMessages[path] ?? defaultMessage;
  }
}

/**
 * Create a schema guard with a specific schema
 */
export function createSchemaGuard(
  schema: z.ZodType,
  options?: Partial<SchemaGuardOptions>,
): SchemaGuard {
  return new SchemaGuard({
    ...options,
    schema,
  });
}

// Register the guard
GuardRegistry.register({
  metadata: {
    name: 'schema',
    description: 'Validates content against a Zod schema',
    category: 'validation',
    supportedTypes: ['output'],
    defaultConfig: {
      enabled: true,
      onFailure: 'block',
      threshold: 0.0,
      sensitivity: 'high',
    },
  },
  factory: (config) => new SchemaGuard(config),
});

export default SchemaGuard;

/**
 * Schema Validator
 *
 * Validates data against Zod schemas with detailed error reporting.
 */

import { z, ZodError, ZodIssue } from 'zod';
import type {
  SchemaValidationResult,
  ValidationErrorDetail,
} from '../types/schema.types.js';

/**
 * Validates data against a Zod schema
 */
export function validateSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): SchemaValidationResult<z.infer<T>> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validates data and throws on failure
 */
export function validateSchemaOrThrow<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.infer<T> {
  return schema.parse(data);
}

/**
 * Validates partial data against a schema
 */
export function validatePartial<T extends z.ZodType>(
  schema: T,
  data: unknown,
  options: { requiredFields?: string[] } = {},
): SchemaValidationResult<Partial<z.infer<T>>> {
  // Create a partial version of the schema
  const partialSchema = makePartial(schema);

  const result = partialSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: formatZodErrors(result.error),
    };
  }

  // Check required fields if specified
  if (options.requiredFields && options.requiredFields.length > 0) {
    const missingFields: ValidationErrorDetail[] = [];

    for (const field of options.requiredFields) {
      const value = getNestedValue(result.data, field);
      if (value === undefined) {
        missingFields.push({
          path: field.split('.'),
          message: `Required field '${field}' is missing`,
          expected: 'value',
          received: undefined,
          code: 'custom',
        });
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        errors: missingFields,
      };
    }
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Checks if a value matches a schema without full validation
 */
export function matchesSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): boolean {
  return schema.safeParse(data).success;
}

/**
 * Coerces data to match a schema where possible
 */
export function coerceToSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): SchemaValidationResult<z.infer<T>> {
  // First try direct validation
  const directResult = schema.safeParse(data);
  if (directResult.success) {
    return { success: true, data: directResult.data };
  }

  // Try to coerce common types
  const coerced = coerceData(data, schema);
  const coercedResult = schema.safeParse(coerced);

  if (coercedResult.success) {
    return { success: true, data: coercedResult.data };
  }

  return {
    success: false,
    errors: formatZodErrors(coercedResult.error),
  };
}

/**
 * Gets validation hints for fixing invalid data
 */
export function getValidationHints<T extends z.ZodType>(
  schema: T,
  data: unknown,
): string[] {
  const result = schema.safeParse(data);

  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => generateHint(issue, data));
}

/**
 * Formats Zod errors into validation error details
 */
export function formatZodErrors(error: ZodError): ValidationErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((p) => (typeof p === 'number' ? p : String(p))),
    message: issue.message,
    expected: getExpectedFromIssue(issue),
    received: getReceivedFromIssue(issue),
    code: issue.code,
  }));
}

/**
 * Creates a partial version of a Zod schema
 */
function makePartial<T extends z.ZodType>(schema: T): z.ZodType {
  if (schema instanceof z.ZodObject) {
    return schema.partial();
  }

  if (schema instanceof z.ZodArray) {
    return z.array(makePartial(schema.element));
  }

  if (schema instanceof z.ZodUnion) {
    return z.union(
      schema.options.map((opt: z.ZodType) => makePartial(opt)) as [
        z.ZodType,
        z.ZodType,
        ...z.ZodType[],
      ],
    );
  }

  if (schema instanceof z.ZodIntersection) {
    return z.intersection(
      makePartial(schema._def.left),
      makePartial(schema._def.right),
    );
  }

  // For other types, make them optional
  return schema.optional();
}

/**
 * Gets a nested value from an object
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    // Handle array indices
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) {
        return undefined;
      }
      current = arr[parseInt(index, 10)];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Attempts to coerce data to match a schema
 */
function coerceData(data: unknown, schema: z.ZodType): unknown {
  // Use instanceof checks for type narrowing
  if (schema instanceof z.ZodString && typeof data === 'number') {
    return String(data);
  }

  if (schema instanceof z.ZodNumber && typeof data === 'string') {
    const num = Number(data);
    if (!isNaN(num)) {
      return num;
    }
  }

  if (schema instanceof z.ZodBoolean) {
    if (data === 'true' || data === 1) return true;
    if (data === 'false' || data === 0) return false;
  }

  if (schema instanceof z.ZodArray && typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not valid JSON array
    }
  }

  if (schema instanceof z.ZodObject && typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      // Not valid JSON object
    }
  }

  if (
    schema instanceof z.ZodObject &&
    typeof data === 'object' &&
    data !== null
  ) {
    const objSchema = schema as z.ZodObject<z.ZodRawShape>;
    const shape = objSchema.shape;
    const result: Record<string, unknown> = {
      ...(data as Record<string, unknown>),
    };

    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (key in result) {
        result[key] = coerceData(result[key], fieldSchema as z.ZodType);
      }
    }

    return result;
  }

  return data;
}

/**
 * Generates a hint for fixing a validation issue
 */
function generateHint(issue: ZodIssue, _data: unknown): string {
  const path = issue.path.join('.');
  const pathPrefix = path ? `At '${path}': ` : '';

  switch (issue.code) {
    case 'invalid_type':
      return `${pathPrefix}Expected ${issue.expected}, but received ${issue.received}. Please provide a value of type ${issue.expected}.`;

    case 'invalid_literal':
      return `${pathPrefix}Expected the exact value ${JSON.stringify(issue.expected)}, but received ${JSON.stringify(issue.received)}.`;

    case 'unrecognized_keys':
      return `${pathPrefix}Unexpected keys: ${(issue as { keys: string[] }).keys.join(', ')}. Remove these keys or check the schema.`;

    case 'invalid_union':
      return `${pathPrefix}Value doesn't match any of the allowed types. Check the schema for valid options.`;

    case 'invalid_enum_value':
      return `${pathPrefix}Value must be one of: ${(issue as { options: unknown[] }).options.join(', ')}`;

    case 'invalid_string':
      if ('validation' in issue) {
        const validation = issue.validation;
        if (typeof validation === 'string') {
          return `${pathPrefix}String must be a valid ${validation}.`;
        }
      }
      return `${pathPrefix}Invalid string format.`;

    case 'too_small': {
      const smallIssue = issue as {
        type: string;
        minimum: number;
        inclusive: boolean;
      };
      if (smallIssue.type === 'string') {
        return `${pathPrefix}String must be at least ${smallIssue.minimum} characters.`;
      }
      if (smallIssue.type === 'number') {
        return `${pathPrefix}Number must be ${smallIssue.inclusive ? 'at least' : 'greater than'} ${smallIssue.minimum}.`;
      }
      if (smallIssue.type === 'array') {
        return `${pathPrefix}Array must have at least ${smallIssue.minimum} items.`;
      }
      return `${pathPrefix}Value is too small.`;
    }

    case 'too_big': {
      const bigIssue = issue as {
        type: string;
        maximum: number;
        inclusive: boolean;
      };
      if (bigIssue.type === 'string') {
        return `${pathPrefix}String must be at most ${bigIssue.maximum} characters.`;
      }
      if (bigIssue.type === 'number') {
        return `${pathPrefix}Number must be ${bigIssue.inclusive ? 'at most' : 'less than'} ${bigIssue.maximum}.`;
      }
      if (bigIssue.type === 'array') {
        return `${pathPrefix}Array must have at most ${bigIssue.maximum} items.`;
      }
      return `${pathPrefix}Value is too big.`;
    }

    case 'custom':
      return `${pathPrefix}${issue.message}`;

    case 'invalid_date':
      return `${pathPrefix}Invalid date value. Provide a valid date string or Date object.`;

    default:
      return `${pathPrefix}${issue.message}`;
  }
}

/**
 * Gets expected value description from a Zod issue
 */
function getExpectedFromIssue(issue: ZodIssue): string | undefined {
  if ('expected' in issue) {
    return String(issue.expected);
  }
  return undefined;
}

/**
 * Gets received value from a Zod issue
 */
function getReceivedFromIssue(issue: ZodIssue): unknown {
  if ('received' in issue) {
    return issue.received;
  }
  return undefined;
}

/**
 * Schema Validator utility object
 */
export const SchemaValidator = {
  validate: validateSchema,
  validateOrThrow: validateSchemaOrThrow,
  validatePartial,
  matches: matchesSchema,
  coerce: coerceToSchema,
  getHints: getValidationHints,
  formatErrors: formatZodErrors,
};

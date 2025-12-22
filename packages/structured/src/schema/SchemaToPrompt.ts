/**
 * Schema to Prompt
 *
 * Converts Zod schemas to prompt-friendly representations.
 */

import { z } from 'zod';
import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema';
import type {
  SchemaPromptOptions,
  SchemaPrompt,
  JsonSchema,
  FieldInfo,
  FieldConstraint,
} from '../types/index.js';

/**
 * Default prompt options
 */
const DEFAULT_OPTIONS: Required<SchemaPromptOptions> = {
  format: 'json-schema',
  includeDescriptions: true,
  includeExamples: true,
  includeConstraints: true,
  maxDepth: 10,
  indent: 2,
};

/**
 * Convert Zod schema to JSON Schema
 */
export function zodToJsonSchema<T extends z.ZodType>(schema: T): JsonSchema {
  return zodToJsonSchemaLib(schema, { $refStrategy: 'none' }) as JsonSchema;
}

/**
 * Convert Zod schema to prompt-friendly representation
 */
export function schemaToPrompt<T extends z.ZodType>(
  schema: T,
  options: SchemaPromptOptions = {},
): SchemaPrompt {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  switch (opts.format) {
    case 'json-schema':
      return generateJsonSchemaPrompt(schema, opts);
    case 'typescript':
      return generateTypeScriptPrompt(schema, opts);
    case 'natural':
      return generateNaturalPrompt(schema, opts);
    case 'examples':
      return generateExamplesPrompt(schema, opts);
    default:
      return generateJsonSchemaPrompt(schema, opts);
  }
}

/**
 * Generate JSON Schema based prompt
 */
function generateJsonSchemaPrompt<T extends z.ZodType>(
  schema: T,
  opts: Required<SchemaPromptOptions>,
): SchemaPrompt {
  const jsonSchema = zodToJsonSchemaLib(schema, {
    $refStrategy: 'none',
    errorMessages: true,
  }) as JsonSchema;

  // Clean up the schema
  const cleanedSchema = cleanJsonSchema(jsonSchema);

  const text = [
    'Respond with a JSON object that matches this schema:',
    '',
    '```json',
    JSON.stringify(cleanedSchema, null, opts.indent),
    '```',
  ].join('\n');

  return {
    text,
    format: 'json-schema',
    jsonSchema: cleanedSchema,
  };
}

/**
 * Generate TypeScript-style prompt
 */
function generateTypeScriptPrompt<T extends z.ZodType>(
  schema: T,
  opts: Required<SchemaPromptOptions>,
): SchemaPrompt {
  const typeScript = zodToTypeScript(schema, opts);
  const jsonSchema = zodToJsonSchemaLib(schema, {
    $refStrategy: 'none',
  }) as JsonSchema;

  const text = [
    'Respond with a JSON object matching this TypeScript type:',
    '',
    '```typescript',
    typeScript,
    '```',
  ].join('\n');

  return {
    text,
    format: 'typescript',
    jsonSchema,
    typeScript,
  };
}

/**
 * Generate natural language prompt
 */
function generateNaturalPrompt<T extends z.ZodType>(
  schema: T,
  opts: Required<SchemaPromptOptions>,
): SchemaPrompt {
  const fieldInfos = analyzeSchema(schema, opts);
  const jsonSchema = zodToJsonSchemaLib(schema, {
    $refStrategy: 'none',
  }) as JsonSchema;

  const lines: string[] = [
    'Respond with a JSON object containing the following fields:',
    '',
  ];

  for (const field of fieldInfos) {
    const requiredStr = field.required ? '(required)' : '(optional)';
    let line = `- ${field.name} ${requiredStr}: ${field.jsonType}`;

    if (opts.includeDescriptions && field.description) {
      line += ` - ${field.description}`;
    }

    if (opts.includeConstraints && field.constraints.length > 0) {
      const constraintStrs = field.constraints.map((c) => c.description);
      line += ` [${constraintStrs.join(', ')}]`;
    }

    lines.push(line);

    // Add nested fields
    if (field.children && field.children.length > 0) {
      for (const child of field.children) {
        lines.push(`  - ${child.name}: ${child.jsonType}`);
      }
    }
  }

  return {
    text: lines.join('\n'),
    format: 'natural',
    jsonSchema,
  };
}

/**
 * Generate examples-based prompt
 */
function generateExamplesPrompt<T extends z.ZodType>(
  schema: T,
  opts: Required<SchemaPromptOptions>,
): SchemaPrompt {
  const jsonSchema = zodToJsonSchemaLib(schema, {
    $refStrategy: 'none',
  }) as JsonSchema;
  const example = generateExample(jsonSchema, opts.maxDepth);

  const text = [
    'Respond with a JSON object following this example structure:',
    '',
    '```json',
    JSON.stringify(example, null, opts.indent),
    '```',
  ].join('\n');

  return {
    text,
    format: 'examples',
    jsonSchema,
  };
}

/**
 * Clean JSON schema for prompt
 */
function cleanJsonSchema(schema: JsonSchema): JsonSchema {
  const cleaned: JsonSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    // Skip internal fields
    if (key.startsWith('$') && key !== '$defs') continue;
    if (key === 'additionalProperties' && value === false) continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      cleaned[key] = cleanJsonSchema(value as JsonSchema);
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? cleanJsonSchema(item as JsonSchema)
          : item,
      );
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

/**
 * Convert Zod schema to TypeScript-like type string
 */
function zodToTypeScript<T extends z.ZodType>(
  schema: T,
  opts: Required<SchemaPromptOptions>,
  depth = 0,
): string {
  if (depth > opts.maxDepth) return 'any';

  const indent = '  '.repeat(depth);
  const innerIndent = '  '.repeat(depth + 1);

  // Handle ZodObject
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const lines: string[] = ['{'];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType;
      const isOptional = fieldSchema.isOptional?.() ?? false;
      const typeStr = zodToTypeScript(fieldSchema, opts, depth + 1);
      const optionalMarker = isOptional ? '?' : '';
      const description = (fieldSchema as { description?: string }).description;
      const descComment =
        opts.includeDescriptions && description ? ` // ${description}` : '';

      lines.push(
        `${innerIndent}${key}${optionalMarker}: ${typeStr};${descComment}`,
      );
    }

    lines.push(`${indent}}`);
    return lines.join('\n');
  }

  // Handle ZodArray
  if (schema instanceof z.ZodArray) {
    const elementType = zodToTypeScript(schema.element, opts, depth);
    return `${elementType}[]`;
  }

  // Handle ZodString
  if (schema instanceof z.ZodString) {
    return 'string';
  }

  // Handle ZodNumber
  if (schema instanceof z.ZodNumber) {
    return 'number';
  }

  // Handle ZodBoolean
  if (schema instanceof z.ZodBoolean) {
    return 'boolean';
  }

  // Handle ZodNull
  if (schema instanceof z.ZodNull) {
    return 'null';
  }

  // Handle ZodUndefined
  if (schema instanceof z.ZodUndefined) {
    return 'undefined';
  }

  // Handle ZodLiteral
  if (schema instanceof z.ZodLiteral) {
    const value = schema.value;
    return typeof value === 'string' ? `'${value}'` : String(value);
  }

  // Handle ZodEnum
  if (schema instanceof z.ZodEnum) {
    const values = schema.options as string[];
    return values.map((v) => `'${v}'`).join(' | ');
  }

  // Handle ZodNativeEnum
  if (schema instanceof z.ZodNativeEnum) {
    return 'enum';
  }

  // Handle ZodUnion
  if (schema instanceof z.ZodUnion) {
    const options = (schema as { options: z.ZodType[] }).options;
    return options.map((o) => zodToTypeScript(o, opts, depth)).join(' | ');
  }

  // Handle ZodOptional
  if (schema instanceof z.ZodOptional) {
    const innerType = zodToTypeScript(schema.unwrap(), opts, depth);
    return `${innerType} | undefined`;
  }

  // Handle ZodNullable
  if (schema instanceof z.ZodNullable) {
    const innerType = zodToTypeScript(schema.unwrap(), opts, depth);
    return `${innerType} | null`;
  }

  // Handle ZodDefault
  if (schema instanceof z.ZodDefault) {
    return zodToTypeScript(schema.removeDefault(), opts, depth);
  }

  // Handle ZodRecord
  if (schema instanceof z.ZodRecord) {
    const valueType = zodToTypeScript(schema.valueSchema, opts, depth);
    return `Record<string, ${valueType}>`;
  }

  // Handle ZodTuple
  if (schema instanceof z.ZodTuple) {
    const items = (schema as { items: z.ZodType[] }).items;
    const types = items.map((item) => zodToTypeScript(item, opts, depth));
    return `[${types.join(', ')}]`;
  }

  // Handle ZodDate
  if (schema instanceof z.ZodDate) {
    return 'Date';
  }

  // Default
  return 'unknown';
}

/**
 * Analyze schema and extract field information
 */
export function analyzeSchema<T extends z.ZodType>(
  schema: T,
  opts: Required<SchemaPromptOptions>,
  path = '',
): FieldInfo[] {
  const fields: FieldInfo[] = [];

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodType;
      const fieldPath = path ? `${path}.${key}` : key;
      const info = extractFieldInfo(key, fieldSchema, fieldPath, opts);
      fields.push(info);
    }
  }

  return fields;
}

/**
 * Extract field information from a Zod schema
 */
export function extractFieldInfo(
  name: string,
  schema: z.ZodType,
  path: string,
  opts: Required<SchemaPromptOptions>,
): FieldInfo {
  const constraints = extractConstraints(schema);
  const { zodType, jsonType } = getTypeNames(schema);
  const description = (schema as { description?: string }).description;
  const isOptional = schema.isOptional?.() ?? false;
  const hasDefault = schema instanceof z.ZodDefault;
  const defaultValue = hasDefault
    ? (schema as z.ZodDefault<z.ZodType>)._def.defaultValue()
    : undefined;

  let children: FieldInfo[] | undefined;

  // Get unwrapped schema for nested analysis
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodObject) {
    children = analyzeSchema(unwrapped, opts, path);
  }

  return {
    path,
    name,
    zodType,
    jsonType,
    description,
    required: !isOptional,
    hasDefault,
    defaultValue,
    constraints,
    children,
  };
}

/**
 * Extract constraints from a Zod schema
 */
function extractConstraints(schema: z.ZodType): FieldConstraint[] {
  const constraints: FieldConstraint[] = [];

  // Get checks for string/number schemas
  const def = (
    schema as { _def?: { checks?: Array<{ kind: string; value?: unknown }> } }
  )._def;
  const checks = def?.checks ?? [];

  for (const check of checks) {
    switch (check.kind) {
      case 'min':
        constraints.push({
          type: 'min',
          value: check.value,
          description: `minimum: ${String(check.value)}`,
        });
        break;
      case 'max':
        constraints.push({
          type: 'max',
          value: check.value,
          description: `maximum: ${String(check.value)}`,
        });
        break;
      case 'length':
        constraints.push({
          type: 'length',
          value: check.value,
          description: `length: ${String(check.value)}`,
        });
        break;
      case 'email':
        constraints.push({
          type: 'email',
          value: true,
          description: 'must be valid email',
        });
        break;
      case 'url':
        constraints.push({
          type: 'url',
          value: true,
          description: 'must be valid URL',
        });
        break;
      case 'regex':
        constraints.push({
          type: 'regex',
          value: check.value,
          description: `must match pattern`,
        });
        break;
      case 'int':
        constraints.push({
          type: 'int',
          value: true,
          description: 'must be integer',
        });
        break;
      case 'positive':
        constraints.push({
          type: 'positive',
          value: true,
          description: 'must be positive',
        });
        break;
      case 'negative':
        constraints.push({
          type: 'negative',
          value: true,
          description: 'must be negative',
        });
        break;
    }
  }

  return constraints;
}

/**
 * Get type names for a schema
 */
function getTypeNames(schema: z.ZodType): {
  zodType: string;
  jsonType: string;
} {
  const unwrapped = unwrapSchema(schema);

  if (unwrapped instanceof z.ZodString)
    return { zodType: 'ZodString', jsonType: 'string' };
  if (unwrapped instanceof z.ZodNumber)
    return { zodType: 'ZodNumber', jsonType: 'number' };
  if (unwrapped instanceof z.ZodBoolean)
    return { zodType: 'ZodBoolean', jsonType: 'boolean' };
  if (unwrapped instanceof z.ZodNull)
    return { zodType: 'ZodNull', jsonType: 'null' };
  if (unwrapped instanceof z.ZodArray)
    return { zodType: 'ZodArray', jsonType: 'array' };
  if (unwrapped instanceof z.ZodObject)
    return { zodType: 'ZodObject', jsonType: 'object' };
  if (unwrapped instanceof z.ZodEnum)
    return { zodType: 'ZodEnum', jsonType: 'string' };
  if (unwrapped instanceof z.ZodLiteral) {
    const value = unwrapped.value;
    const type = typeof value;
    return { zodType: 'ZodLiteral', jsonType: type };
  }
  if (unwrapped instanceof z.ZodUnion)
    return { zodType: 'ZodUnion', jsonType: 'union' };
  if (unwrapped instanceof z.ZodRecord)
    return { zodType: 'ZodRecord', jsonType: 'object' };
  if (unwrapped instanceof z.ZodDate)
    return { zodType: 'ZodDate', jsonType: 'string' };

  return { zodType: 'unknown', jsonType: 'unknown' };
}

/**
 * Unwrap optional/nullable/default wrappers
 */
function unwrapSchema(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodOptional) return unwrapSchema(schema.unwrap());
  if (schema instanceof z.ZodNullable) return unwrapSchema(schema.unwrap());
  if (schema instanceof z.ZodDefault)
    return unwrapSchema(schema.removeDefault());
  return schema;
}

/**
 * Generate example value from JSON schema
 */
export function generateExample(
  schema: JsonSchema,
  maxDepth: number,
  depth = 0,
): unknown {
  if (depth > maxDepth) return null;

  // Use provided example
  if (schema.examples && schema.examples.length > 0) {
    return schema.examples[0];
  }

  // Use default
  if (schema.default !== undefined) {
    return schema.default;
  }

  // Use const
  if (schema.const !== undefined) {
    return schema.const;
  }

  // Use first enum value
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Handle type
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case 'string':
      return schema.format === 'email'
        ? 'example@email.com'
        : schema.format === 'uri'
          ? 'https://example.com'
          : 'string';

    case 'number':
    case 'integer':
      return schema.minimum ?? 0;

    case 'boolean':
      return true;

    case 'null':
      return null;

    case 'array':
      if (schema.items) {
        const itemExample = generateExample(
          Array.isArray(schema.items) ? schema.items[0] : schema.items,
          maxDepth,
          depth + 1,
        );
        return [itemExample];
      }
      return [];

    case 'object':
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          obj[key] = generateExample(propSchema, maxDepth, depth + 1);
        }
        return obj;
      }
      return {};

    default:
      // Handle anyOf/oneOf
      if (schema.anyOf && schema.anyOf.length > 0) {
        return generateExample(schema.anyOf[0], maxDepth, depth);
      }
      if (schema.oneOf && schema.oneOf.length > 0) {
        return generateExample(schema.oneOf[0], maxDepth, depth);
      }
      return null;
  }
}

/**
 * Export helper for creating prompts
 */
export const SchemaPromptGenerator = {
  toJsonSchema: <T extends z.ZodType>(
    schema: T,
    options?: SchemaPromptOptions,
  ) => schemaToPrompt(schema, { ...options, format: 'json-schema' }),

  toTypeScript: <T extends z.ZodType>(
    schema: T,
    options?: SchemaPromptOptions,
  ) => schemaToPrompt(schema, { ...options, format: 'typescript' }),

  toNatural: <T extends z.ZodType>(schema: T, options?: SchemaPromptOptions) =>
    schemaToPrompt(schema, { ...options, format: 'natural' }),

  toExamples: <T extends z.ZodType>(schema: T, options?: SchemaPromptOptions) =>
    schemaToPrompt(schema, { ...options, format: 'examples' }),

  generateExample,
};

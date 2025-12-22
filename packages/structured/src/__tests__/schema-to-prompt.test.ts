import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  zodToJsonSchema,
  schemaToPrompt,
  analyzeSchema,
  extractFieldInfo,
  generateExample,
  SchemaPromptGenerator,
} from '../schema/SchemaToPrompt.js';
import type { SchemaPromptOptions, JsonSchema } from '../types/index.js';

// Test schemas
const simpleSchema = z.object({
  name: z.string().describe('User name'),
  age: z.number().int().positive().describe('User age in years'),
  email: z.string().email().describe('Email address'),
});

const complexSchema = z.object({
  user: z.object({
    name: z.string(),
    profile: z.object({
      bio: z.string().optional(),
      website: z.string().url().optional(),
    }),
  }),
  tags: z.array(z.string()),
  status: z.enum(['active', 'inactive', 'pending']),
  metadata: z.record(z.unknown()).optional(),
});

const constrainedSchema = z.object({
  username: z.string().min(3).max(20),
  score: z.number().min(0).max(100),
  items: z.array(z.string()).min(1).max(10),
});

describe('zodToJsonSchema', () => {
  it('should convert simple object schema', () => {
    const jsonSchema = zodToJsonSchema(simpleSchema);

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();
    expect(jsonSchema.properties!.name.type).toBe('string');
    expect(jsonSchema.properties!.age.type).toBe('integer');
    expect(jsonSchema.properties!.email.type).toBe('string');
  });

  it('should include required fields', () => {
    const jsonSchema = zodToJsonSchema(simpleSchema);

    expect(jsonSchema.required).toContain('name');
    expect(jsonSchema.required).toContain('age');
    expect(jsonSchema.required).toContain('email');
  });

  it('should include descriptions', () => {
    const jsonSchema = zodToJsonSchema(simpleSchema);

    expect(jsonSchema.properties!.name.description).toBe('User name');
    expect(jsonSchema.properties!.age.description).toBe('User age in years');
  });

  it('should handle nested objects', () => {
    const jsonSchema = zodToJsonSchema(complexSchema);

    expect(jsonSchema.properties!.user.type).toBe('object');
    expect(jsonSchema.properties!.user.properties!.profile.type).toBe('object');
  });

  it('should handle arrays', () => {
    const jsonSchema = zodToJsonSchema(complexSchema);

    expect(jsonSchema.properties!.tags.type).toBe('array');
    expect(jsonSchema.properties!.tags.items).toBeDefined();
  });

  it('should handle enums', () => {
    const jsonSchema = zodToJsonSchema(complexSchema);

    expect(jsonSchema.properties!.status.enum).toEqual([
      'active',
      'inactive',
      'pending',
    ]);
  });

  it('should handle optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.required).toContain('required');
    expect(jsonSchema.required).not.toContain('optional');
  });

  it('should handle union types', () => {
    const schema = z.union([z.string(), z.number()]);
    const jsonSchema = zodToJsonSchema(schema);

    // Union types may produce anyOf, oneOf, or type array depending on zod-to-json-schema version
    const hasUnionType =
      jsonSchema.anyOf || jsonSchema.oneOf || Array.isArray(jsonSchema.type);
    expect(hasUnionType).toBeTruthy();
  });

  it('should handle literals', () => {
    const schema = z.literal('exact');
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.const).toBe('exact');
  });

  it('should handle nullable fields', () => {
    const schema = z.object({
      value: z.string().nullable(),
    });

    const jsonSchema = zodToJsonSchema(schema);

    // Nullable produces anyOf with null type
    expect(
      jsonSchema.properties!.value.anyOf || jsonSchema.properties!.value.type,
    ).toBeDefined();
  });

  it('should handle default values', () => {
    const schema = z.object({
      name: z.string().default('Anonymous'),
    });

    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.properties!.name.default).toBe('Anonymous');
  });

  it('should handle string constraints', () => {
    const schema = z.string().min(5).max(10).email();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.minLength).toBe(5);
    expect(jsonSchema.maxLength).toBe(10);
    expect(jsonSchema.format).toBe('email');
  });

  it('should handle number constraints', () => {
    const schema = z.number().min(0).max(100);
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.minimum).toBe(0);
    expect(jsonSchema.maximum).toBe(100);
  });

  it('should handle integer constraint', () => {
    const schema = z.number().int();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe('integer');
  });

  it('should handle array constraints', () => {
    const schema = z.array(z.string()).min(1).max(5);
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.minItems).toBe(1);
    expect(jsonSchema.maxItems).toBe(5);
  });

  it('should handle records', () => {
    const schema = z.record(z.number());
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.additionalProperties).toBeDefined();
  });

  it('should handle tuples', () => {
    const schema = z.tuple([z.string(), z.number()]);
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe('array');
    expect(jsonSchema.items).toBeDefined();
  });

  it('should handle date', () => {
    const schema = z.date();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe('string');
    expect(jsonSchema.format).toBe('date-time');
  });
});

describe('schemaToPrompt', () => {
  describe('json-schema format', () => {
    it('should generate JSON schema prompt', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'json-schema' });

      expect(prompt.format).toBe('json-schema');
      expect(prompt.text).toContain('JSON');
      expect(prompt.text).toContain('schema');
      expect(prompt.jsonSchema).toBeDefined();
    });

    it('should include code block', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'json-schema' });

      expect(prompt.text).toContain('```json');
      expect(prompt.text).toContain('```');
    });

    it('should use custom indentation', () => {
      const prompt = schemaToPrompt(simpleSchema, {
        format: 'json-schema',
        indent: 4,
      });

      // Check for 4-space indentation in the output
      expect(prompt.text).toContain('    ');
    });
  });

  describe('typescript format', () => {
    it('should generate TypeScript prompt', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'typescript' });

      expect(prompt.format).toBe('typescript');
      expect(prompt.text).toContain('TypeScript');
      expect(prompt.typeScript).toBeDefined();
    });

    it('should include TypeScript code block', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'typescript' });

      expect(prompt.text).toContain('```typescript');
    });

    it('should generate valid TypeScript type', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('name:');
      expect(prompt.typeScript).toContain('string');
      expect(prompt.typeScript).toContain('age:');
      expect(prompt.typeScript).toContain('number');
    });

    it('should mark optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('optional?:');
    });

    it('should include descriptions as comments', () => {
      const prompt = schemaToPrompt(simpleSchema, {
        format: 'typescript',
        includeDescriptions: true,
      });

      expect(prompt.typeScript).toContain('// User name');
    });

    it('should handle arrays', () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('string[]');
    });

    it('should handle enums', () => {
      const schema = z.object({
        status: z.enum(['a', 'b', 'c']),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain("'a'");
      expect(prompt.typeScript).toContain('|');
    });

    it('should handle nested objects', () => {
      const schema = z.object({
        nested: z.object({
          value: z.string(),
        }),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('nested:');
      expect(prompt.typeScript).toContain('value:');
    });

    it('should handle union types', () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('string');
      expect(prompt.typeScript).toContain('number');
      expect(prompt.typeScript).toContain('|');
    });

    it('should handle Record types', () => {
      const schema = z.object({
        map: z.record(z.number()),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('Record<string, number>');
    });

    it('should handle nullable types', () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      const prompt = schemaToPrompt(schema, { format: 'typescript' });

      expect(prompt.typeScript).toContain('null');
    });

    it('should respect maxDepth', () => {
      const schema = z.object({
        l1: z.object({
          l2: z.object({
            l3: z.object({
              l4: z.string(),
            }),
          }),
        }),
      });

      const prompt = schemaToPrompt(schema, {
        format: 'typescript',
        maxDepth: 2,
      });

      expect(prompt.typeScript).toContain('any');
    });
  });

  describe('natural format', () => {
    it('should generate natural language prompt', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'natural' });

      expect(prompt.format).toBe('natural');
      expect(prompt.text).toContain('JSON object');
      expect(prompt.text).toContain('fields');
    });

    it('should list fields with types', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'natural' });

      expect(prompt.text).toContain('name');
      expect(prompt.text).toContain('string');
      expect(prompt.text).toContain('age');
      expect(prompt.text).toContain('number');
    });

    it('should mark required fields', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'natural' });

      expect(prompt.text).toContain('(required)');
    });

    it('should mark optional fields', () => {
      const schema = z.object({
        optional: z.string().optional(),
      });

      const prompt = schemaToPrompt(schema, { format: 'natural' });

      expect(prompt.text).toContain('(optional)');
    });

    it('should include descriptions', () => {
      const prompt = schemaToPrompt(simpleSchema, {
        format: 'natural',
        includeDescriptions: true,
      });

      expect(prompt.text).toContain('User name');
    });

    it('should include constraints', () => {
      const prompt = schemaToPrompt(constrainedSchema, {
        format: 'natural',
        includeConstraints: true,
      });

      expect(prompt.text).toContain('minimum');
      expect(prompt.text).toContain('maximum');
    });
  });

  describe('examples format', () => {
    it('should generate examples-based prompt', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'examples' });

      expect(prompt.format).toBe('examples');
      expect(prompt.text).toContain('example');
    });

    it('should include JSON code block', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'examples' });

      expect(prompt.text).toContain('```json');
    });

    it('should generate valid JSON example', () => {
      const prompt = schemaToPrompt(simpleSchema, { format: 'examples' });

      // Extract JSON from code block
      const jsonMatch = prompt.text.match(/```json\n([\s\S]*?)\n```/);
      expect(jsonMatch).toBeTruthy();

      const exampleJson = jsonMatch![1];
      const parsed = JSON.parse(exampleJson);

      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('age');
      expect(parsed).toHaveProperty('email');
    });
  });

  describe('default format', () => {
    it('should default to json-schema', () => {
      const prompt = schemaToPrompt(simpleSchema);

      expect(prompt.format).toBe('json-schema');
    });
  });
});

describe('analyzeSchema', () => {
  const defaultOpts: Required<SchemaPromptOptions> = {
    format: 'json-schema',
    includeDescriptions: true,
    includeExamples: true,
    includeConstraints: true,
    maxDepth: 10,
    indent: 2,
  };

  it('should extract field information', () => {
    const fields = analyzeSchema(simpleSchema, defaultOpts);

    expect(fields.length).toBe(3);
    expect(fields.map((f) => f.name)).toEqual(['name', 'age', 'email']);
  });

  it('should identify required fields', () => {
    const fields = analyzeSchema(simpleSchema, defaultOpts);

    expect(fields.every((f) => f.required)).toBe(true);
  });

  it('should identify optional fields', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const fields = analyzeSchema(schema, defaultOpts);

    const optionalField = fields.find((f) => f.name === 'optional');
    expect(optionalField?.required).toBe(false);
  });

  it('should extract field types', () => {
    const fields = analyzeSchema(simpleSchema, defaultOpts);

    const nameField = fields.find((f) => f.name === 'name');
    expect(nameField?.zodType).toBe('ZodString');
    expect(nameField?.jsonType).toBe('string');

    const ageField = fields.find((f) => f.name === 'age');
    expect(ageField?.zodType).toBe('ZodNumber');
    expect(ageField?.jsonType).toBe('number');
  });

  it('should extract descriptions', () => {
    const fields = analyzeSchema(simpleSchema, defaultOpts);

    const nameField = fields.find((f) => f.name === 'name');
    expect(nameField?.description).toBe('User name');
  });

  it('should extract constraints', () => {
    const fields = analyzeSchema(constrainedSchema, defaultOpts);

    const usernameField = fields.find((f) => f.name === 'username');
    expect(usernameField?.constraints.length).toBeGreaterThan(0);
    expect(usernameField?.constraints.some((c) => c.type === 'min')).toBe(true);
    expect(usernameField?.constraints.some((c) => c.type === 'max')).toBe(true);
  });

  it('should analyze nested objects', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        email: z.string(),
      }),
    });

    const fields = analyzeSchema(schema, defaultOpts);

    const userField = fields.find((f) => f.name === 'user');
    expect(userField?.children).toBeDefined();
    expect(userField?.children?.length).toBe(2);
  });

  it('should handle default values', () => {
    const schema = z.object({
      name: z.string().default('Anonymous'),
    });

    const fields = analyzeSchema(schema, defaultOpts);

    const nameField = fields.find((f) => f.name === 'name');
    expect(nameField?.hasDefault).toBe(true);
    expect(nameField?.defaultValue).toBe('Anonymous');
  });
});

describe('extractFieldInfo', () => {
  const defaultOpts: Required<SchemaPromptOptions> = {
    format: 'json-schema',
    includeDescriptions: true,
    includeExamples: true,
    includeConstraints: true,
    maxDepth: 10,
    indent: 2,
  };

  it('should extract string field info', () => {
    const info = extractFieldInfo('name', z.string(), 'name', defaultOpts);

    expect(info.name).toBe('name');
    expect(info.path).toBe('name');
    expect(info.zodType).toBe('ZodString');
    expect(info.jsonType).toBe('string');
  });

  it('should extract number field info', () => {
    const info = extractFieldInfo('age', z.number(), 'age', defaultOpts);

    expect(info.zodType).toBe('ZodNumber');
    expect(info.jsonType).toBe('number');
  });

  it('should extract boolean field info', () => {
    const info = extractFieldInfo('active', z.boolean(), 'active', defaultOpts);

    expect(info.zodType).toBe('ZodBoolean');
    expect(info.jsonType).toBe('boolean');
  });

  it('should extract array field info', () => {
    const info = extractFieldInfo(
      'items',
      z.array(z.string()),
      'items',
      defaultOpts,
    );

    expect(info.zodType).toBe('ZodArray');
    expect(info.jsonType).toBe('array');
  });

  it('should extract object field info', () => {
    const schema = z.object({ value: z.string() });
    const info = extractFieldInfo('config', schema, 'config', defaultOpts);

    expect(info.zodType).toBe('ZodObject');
    expect(info.jsonType).toBe('object');
    expect(info.children).toBeDefined();
  });

  it('should extract enum field info', () => {
    const info = extractFieldInfo(
      'status',
      z.enum(['a', 'b']),
      'status',
      defaultOpts,
    );

    expect(info.zodType).toBe('ZodEnum');
    expect(info.jsonType).toBe('string');
  });

  it('should extract email constraint', () => {
    const info = extractFieldInfo(
      'email',
      z.string().email(),
      'email',
      defaultOpts,
    );

    expect(info.constraints.some((c) => c.type === 'email')).toBe(true);
  });

  it('should extract url constraint', () => {
    const info = extractFieldInfo(
      'website',
      z.string().url(),
      'website',
      defaultOpts,
    );

    expect(info.constraints.some((c) => c.type === 'url')).toBe(true);
  });

  it('should extract min/max constraints for strings', () => {
    const info = extractFieldInfo(
      'text',
      z.string().min(5).max(100),
      'text',
      defaultOpts,
    );

    expect(
      info.constraints.some((c) => c.type === 'min' && c.value === 5),
    ).toBe(true);
    expect(
      info.constraints.some((c) => c.type === 'max' && c.value === 100),
    ).toBe(true);
  });

  it('should extract min/max constraints for numbers', () => {
    const info = extractFieldInfo(
      'score',
      z.number().min(0).max(100),
      'score',
      defaultOpts,
    );

    expect(
      info.constraints.some((c) => c.type === 'min' && c.value === 0),
    ).toBe(true);
    expect(
      info.constraints.some((c) => c.type === 'max' && c.value === 100),
    ).toBe(true);
  });

  it('should extract int constraint', () => {
    const info = extractFieldInfo(
      'count',
      z.number().int(),
      'count',
      defaultOpts,
    );

    expect(info.constraints.some((c) => c.type === 'int')).toBe(true);
  });

  it('should extract positive constraint', () => {
    const info = extractFieldInfo(
      'amount',
      z.number().positive(),
      'amount',
      defaultOpts,
    );

    // Zod's positive() constraint may be represented as 'positive' or 'min' with value 0
    const hasPositiveConstraint = info.constraints.some(
      (c) => c.type === 'positive' || (c.type === 'min' && c.value === 0),
    );
    expect(hasPositiveConstraint).toBe(true);
  });

  it('should unwrap optional schema', () => {
    const info = extractFieldInfo(
      'value',
      z.string().optional(),
      'value',
      defaultOpts,
    );

    expect(info.required).toBe(false);
    expect(info.zodType).toBe('ZodString');
  });

  it('should unwrap nullable schema', () => {
    const info = extractFieldInfo(
      'value',
      z.string().nullable(),
      'value',
      defaultOpts,
    );

    expect(info.zodType).toBe('ZodString');
  });

  it('should unwrap default schema', () => {
    const info = extractFieldInfo(
      'value',
      z.string().default('default'),
      'value',
      defaultOpts,
    );

    expect(info.hasDefault).toBe(true);
    expect(info.defaultValue).toBe('default');
    expect(info.zodType).toBe('ZodString');
  });
});

describe('generateExample', () => {
  it('should generate string example', () => {
    const schema: JsonSchema = { type: 'string' };
    const example = generateExample(schema, 10);

    expect(typeof example).toBe('string');
  });

  it('should generate number example', () => {
    const schema: JsonSchema = { type: 'number' };
    const example = generateExample(schema, 10);

    expect(typeof example).toBe('number');
  });

  it('should generate integer example', () => {
    const schema: JsonSchema = { type: 'integer' };
    const example = generateExample(schema, 10);

    expect(typeof example).toBe('number');
  });

  it('should generate boolean example', () => {
    const schema: JsonSchema = { type: 'boolean' };
    const example = generateExample(schema, 10);

    expect(typeof example).toBe('boolean');
  });

  it('should generate null example', () => {
    const schema: JsonSchema = { type: 'null' };
    const example = generateExample(schema, 10);

    expect(example).toBeNull();
  });

  it('should generate array example', () => {
    const schema: JsonSchema = {
      type: 'array',
      items: { type: 'string' },
    };
    const example = generateExample(schema, 10);

    expect(Array.isArray(example)).toBe(true);
    expect((example as unknown[]).length).toBe(1);
  });

  it('should generate object example', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    const example = generateExample(schema, 10) as Record<string, unknown>;

    expect(typeof example).toBe('object');
    expect(example).toHaveProperty('name');
    expect(example).toHaveProperty('age');
  });

  it('should use provided examples', () => {
    const schema: JsonSchema = {
      type: 'string',
      examples: ['custom example'],
    };
    const example = generateExample(schema, 10);

    expect(example).toBe('custom example');
  });

  it('should use default value', () => {
    const schema: JsonSchema = {
      type: 'string',
      default: 'default value',
    };
    const example = generateExample(schema, 10);

    expect(example).toBe('default value');
  });

  it('should use const value', () => {
    const schema: JsonSchema = {
      const: 'exact value',
    };
    const example = generateExample(schema, 10);

    expect(example).toBe('exact value');
  });

  it('should use first enum value', () => {
    const schema: JsonSchema = {
      enum: ['first', 'second', 'third'],
    };
    const example = generateExample(schema, 10);

    expect(example).toBe('first');
  });

  it('should generate email format', () => {
    const schema: JsonSchema = {
      type: 'string',
      format: 'email',
    };
    const example = generateExample(schema, 10);

    expect(example).toContain('@');
  });

  it('should generate uri format', () => {
    const schema: JsonSchema = {
      type: 'string',
      format: 'uri',
    };
    const example = generateExample(schema, 10);

    expect((example as string).startsWith('https://')).toBe(true);
  });

  it('should use minimum for numbers', () => {
    const schema: JsonSchema = {
      type: 'number',
      minimum: 10,
    };
    const example = generateExample(schema, 10);

    expect(example).toBe(10);
  });

  it('should handle anyOf', () => {
    const schema: JsonSchema = {
      anyOf: [{ type: 'string' }, { type: 'number' }],
    };
    const example = generateExample(schema, 10);

    expect(typeof example).toBe('string');
  });

  it('should handle oneOf', () => {
    const schema: JsonSchema = {
      oneOf: [{ type: 'boolean' }, { type: 'number' }],
    };
    const example = generateExample(schema, 10);

    expect(typeof example).toBe('boolean');
  });

  it('should respect maxDepth', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      },
    };
    const example = generateExample(schema, 0) as Record<string, unknown>;

    // At maxDepth 0, it generates the object but nested properties are null
    expect(example).toBeDefined();
    expect(example.nested).toBeNull();
  });

  it('should handle empty array schema', () => {
    const schema: JsonSchema = {
      type: 'array',
    };
    const example = generateExample(schema, 10);

    expect(example).toEqual([]);
  });

  it('should handle empty object schema', () => {
    const schema: JsonSchema = {
      type: 'object',
    };
    const example = generateExample(schema, 10);

    expect(example).toEqual({});
  });

  it('should handle nested arrays', () => {
    const schema: JsonSchema = {
      type: 'array',
      items: {
        type: 'array',
        items: { type: 'number' },
      },
    };
    const example = generateExample(schema, 10);

    expect(Array.isArray(example)).toBe(true);
    expect(Array.isArray((example as unknown[][])[0])).toBe(true);
  });
});

describe('SchemaPromptGenerator', () => {
  it('should have toJsonSchema method', () => {
    const prompt = SchemaPromptGenerator.toJsonSchema(simpleSchema);

    expect(prompt.format).toBe('json-schema');
  });

  it('should have toTypeScript method', () => {
    const prompt = SchemaPromptGenerator.toTypeScript(simpleSchema);

    expect(prompt.format).toBe('typescript');
  });

  it('should have toNatural method', () => {
    const prompt = SchemaPromptGenerator.toNatural(simpleSchema);

    expect(prompt.format).toBe('natural');
  });

  it('should have toExamples method', () => {
    const prompt = SchemaPromptGenerator.toExamples(simpleSchema);

    expect(prompt.format).toBe('examples');
  });

  it('should have generateExample method', () => {
    const schema: JsonSchema = { type: 'string' };
    const example = SchemaPromptGenerator.generateExample(schema, 10);

    expect(typeof example).toBe('string');
  });

  it('should pass options through methods', () => {
    const prompt = SchemaPromptGenerator.toJsonSchema(simpleSchema, {
      indent: 4,
    });

    expect(prompt.text).toContain('    ');
  });
});

describe('edge cases', () => {
  it('should handle empty object schema', () => {
    const schema = z.object({});
    const prompt = schemaToPrompt(schema);

    expect(prompt.text).toBeDefined();
  });

  it('should handle deeply nested schemas', () => {
    const schema = z.object({
      a: z.object({
        b: z.object({
          c: z.object({
            d: z.string(),
          }),
        }),
      }),
    });

    const prompt = schemaToPrompt(schema, { format: 'typescript' });
    expect(prompt.typeScript).toContain('d:');
  });

  it('should handle complex union types', () => {
    const schema = z.object({
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    });

    const prompt = schemaToPrompt(schema, { format: 'typescript' });
    expect(prompt.typeScript).toBeDefined();
  });

  it('should handle arrays of objects', () => {
    const schema = z.object({
      users: z.array(
        z.object({
          name: z.string(),
          email: z.string(),
        }),
      ),
    });

    const prompt = schemaToPrompt(schema, { format: 'examples' });
    const jsonMatch = prompt.text.match(/```json\n([\s\S]*?)\n```/);
    const parsed = JSON.parse(jsonMatch![1]);

    expect(Array.isArray(parsed.users)).toBe(true);
    expect(parsed.users[0]).toHaveProperty('name');
  });

  it('should handle discriminated unions', () => {
    const schema = z.discriminatedUnion('type', [
      z.object({ type: z.literal('a'), value: z.string() }),
      z.object({ type: z.literal('b'), value: z.number() }),
    ]);

    const jsonSchema = zodToJsonSchema(schema);
    expect(jsonSchema).toBeDefined();
  });

  it('should handle recursive schemas', () => {
    interface TreeNode {
      value: string;
      children?: TreeNode[];
    }

    const treeSchema: z.ZodType<TreeNode> = z.lazy(() =>
      z.object({
        value: z.string(),
        children: z.array(treeSchema).optional(),
      }),
    );

    const jsonSchema = zodToJsonSchema(treeSchema);
    expect(jsonSchema).toBeDefined();
  });

  it('should handle branded types', () => {
    const schema = z.object({
      id: z.string().brand<'UserId'>(),
    });

    const prompt = schemaToPrompt(schema);
    expect(prompt.text).toBeDefined();
  });

  it('should handle transform', () => {
    const schema = z.object({
      date: z.string().transform((s) => new Date(s)),
    });

    const jsonSchema = zodToJsonSchema(schema);
    expect(jsonSchema.properties!.date.type).toBe('string');
  });

  it('should handle refine', () => {
    const schema = z.object({
      password: z.string().refine((s) => s.length >= 8),
    });

    const prompt = schemaToPrompt(schema);
    expect(prompt.text).toBeDefined();
  });
});

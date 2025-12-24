import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateSchema,
  validateSchemaOrThrow,
  validatePartial,
  matchesSchema,
  coerceToSchema,
  getValidationHints,
  formatZodErrors,
  SchemaValidator,
} from '../schema/SchemaValidator.js';

// Test schemas
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().positive(),
});

const addressSchema = z.object({
  street: z.string(),
  city: z.string(),
  zipCode: z.string(),
});

const nestedSchema = z.object({
  user: userSchema,
  address: addressSchema.optional(),
});

describe('SchemaValidator', () => {
  describe('validateSchema', () => {
    it('should return success for valid data', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const result = validateSchema(userSchema, data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should return errors for invalid data', () => {
      const data = { name: '', email: 'invalid', age: -5 };
      const result = validateSchema(userSchema, data);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should return error with path for nested objects', () => {
      const data = {
        user: { name: 'John', email: 'invalid', age: 30 },
      };
      const result = validateSchema(nestedSchema, data);

      expect(result.success).toBe(false);
      expect(result.errors![0].path).toContain('user');
    });

    it('should handle arrays', () => {
      const arraySchema = z.array(z.string());
      const result = validateSchema(arraySchema, ['a', 'b', 'c']);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['a', 'b', 'c']);
    });

    it('should return errors for invalid array items', () => {
      const arraySchema = z.array(z.string());
      const result = validateSchema(arraySchema, ['a', 123, 'c']);

      expect(result.success).toBe(false);
      expect(result.errors![0].path).toContain(1);
    });

    it('should handle union types', () => {
      const unionSchema = z.union([z.string(), z.number()]);

      expect(validateSchema(unionSchema, 'hello').success).toBe(true);
      expect(validateSchema(unionSchema, 42).success).toBe(true);
      expect(validateSchema(unionSchema, true).success).toBe(false);
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const result = validateSchema(schema, { required: 'value' });
      expect(result.success).toBe(true);
    });

    it('should handle default values', () => {
      const schema = z.object({
        name: z.string().default('Anonymous'),
      });

      const result = validateSchema(schema, {});
      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Anonymous');
    });

    it('should validate enums', () => {
      const schema = z.enum(['red', 'green', 'blue']);

      expect(validateSchema(schema, 'red').success).toBe(true);
      expect(validateSchema(schema, 'yellow').success).toBe(false);
    });

    it('should validate literals', () => {
      const schema = z.literal('exact');

      expect(validateSchema(schema, 'exact').success).toBe(true);
      expect(validateSchema(schema, 'other').success).toBe(false);
    });
  });

  describe('validateSchemaOrThrow', () => {
    it('should return data for valid input', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const result = validateSchemaOrThrow(userSchema, data);

      expect(result).toEqual(data);
    });

    it('should throw for invalid input', () => {
      const data = { name: '', email: 'invalid', age: -5 };

      expect(() => validateSchemaOrThrow(userSchema, data)).toThrow();
    });

    it('should throw ZodError', () => {
      const data = { name: '' };

      expect(() => validateSchemaOrThrow(userSchema, data)).toThrow(z.ZodError);
    });
  });

  describe('validatePartial', () => {
    it('should validate partial data', () => {
      const result = validatePartial(userSchema, { name: 'John' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John' });
    });

    it('should accept empty objects', () => {
      const result = validatePartial(userSchema, {});

      expect(result.success).toBe(true);
    });

    it('should still validate field types', () => {
      const result = validatePartial(userSchema, { age: 'not a number' });

      expect(result.success).toBe(false);
    });

    it('should check required fields when specified', () => {
      const result = validatePartial(
        userSchema,
        { name: 'John' },
        {
          requiredFields: ['email'],
        },
      );

      expect(result.success).toBe(false);
      expect(result.errors![0].path).toContain('email');
    });

    it('should pass when required fields are present', () => {
      const result = validatePartial(
        userSchema,
        { name: 'John', email: 'john@example.com' },
        {
          requiredFields: ['name', 'email'],
        },
      );

      expect(result.success).toBe(true);
    });

    it('should handle nested required fields', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          profile: z.object({
            bio: z.string(),
          }),
        }),
      });

      const result = validatePartial(
        schema,
        { user: { name: 'John' } },
        {
          requiredFields: ['user.profile.bio'],
        },
      );

      expect(result.success).toBe(false);
    });

    it('should handle arrays in partial validation', () => {
      const schema = z.object({
        items: z.array(z.string()),
      });

      const result = validatePartial(schema, { items: ['a', 'b'] });
      expect(result.success).toBe(true);
    });
  });

  describe('matchesSchema', () => {
    it('should return true for matching data', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      expect(matchesSchema(userSchema, data)).toBe(true);
    });

    it('should return false for non-matching data', () => {
      const data = { name: '', email: 'invalid' };
      expect(matchesSchema(userSchema, data)).toBe(false);
    });

    it('should work with primitive schemas', () => {
      expect(matchesSchema(z.string(), 'hello')).toBe(true);
      expect(matchesSchema(z.string(), 123)).toBe(false);
      expect(matchesSchema(z.number(), 42)).toBe(true);
      expect(matchesSchema(z.number(), 'hello')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(matchesSchema(z.null(), null)).toBe(true);
      expect(matchesSchema(z.undefined(), undefined)).toBe(true);
      expect(matchesSchema(z.null(), undefined)).toBe(false);
    });
  });

  describe('coerceToSchema', () => {
    it('should return data unchanged when valid', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const result = coerceToSchema(userSchema, data);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });

    it('should coerce string to number', () => {
      const schema = z.object({
        count: z.number(),
      });

      const result = coerceToSchema(schema, { count: '42' });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(42);
    });

    it('should coerce number to string', () => {
      const schema = z.object({
        label: z.string(),
      });

      const result = coerceToSchema(schema, { label: 123 });

      expect(result.success).toBe(true);
      expect(result.data?.label).toBe('123');
    });

    it('should coerce string true to boolean', () => {
      const schema = z.object({
        active: z.boolean(),
      });

      expect(coerceToSchema(schema, { active: 'true' }).data?.active).toBe(
        true,
      );
      expect(coerceToSchema(schema, { active: 'false' }).data?.active).toBe(
        false,
      );
    });

    it('should coerce 1/0 to boolean', () => {
      const schema = z.object({
        active: z.boolean(),
      });

      expect(coerceToSchema(schema, { active: 1 }).data?.active).toBe(true);
      expect(coerceToSchema(schema, { active: 0 }).data?.active).toBe(false);
    });

    it('should coerce JSON string to array', () => {
      const schema = z.object({
        items: z.array(z.number()),
      });

      const result = coerceToSchema(schema, { items: '[1, 2, 3]' });

      expect(result.success).toBe(true);
      expect(result.data?.items).toEqual([1, 2, 3]);
    });

    it('should coerce JSON string to object', () => {
      const schema = z.object({
        config: z.object({
          enabled: z.boolean(),
        }),
      });

      const result = coerceToSchema(schema, { config: '{"enabled": true}' });

      expect(result.success).toBe(true);
      expect(result.data?.config).toEqual({ enabled: true });
    });

    it('should recursively coerce nested objects', () => {
      const schema = z.object({
        user: z.object({
          age: z.number(),
        }),
      });

      const result = coerceToSchema(schema, { user: { age: '25' } });

      expect(result.success).toBe(true);
      expect(result.data?.user.age).toBe(25);
    });

    it('should return errors when coercion fails', () => {
      const schema = z.object({
        count: z.number(),
      });

      const result = coerceToSchema(schema, { count: 'not a number' });

      expect(result.success).toBe(false);
    });
  });

  describe('getValidationHints', () => {
    it('should return empty array for valid data', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const hints = getValidationHints(userSchema, data);

      expect(hints).toEqual([]);
    });

    it('should return hints for invalid type', () => {
      const hints = getValidationHints(z.string(), 123);

      expect(hints.length).toBe(1);
      expect(hints[0]).toContain('Expected');
      expect(hints[0]).toContain('string');
    });

    it('should include path in hints', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
        }),
      });

      const hints = getValidationHints(schema, { user: { name: 123 } });

      expect(hints[0]).toContain('user.name');
    });

    it('should hint for too small string', () => {
      const schema = z.string().min(5);
      const hints = getValidationHints(schema, 'hi');

      expect(hints[0]).toContain('at least');
      expect(hints[0]).toContain('5');
    });

    it('should hint for too big string', () => {
      const schema = z.string().max(5);
      const hints = getValidationHints(schema, 'hello world');

      expect(hints[0]).toContain('at most');
      expect(hints[0]).toContain('5');
    });

    it('should hint for too small number', () => {
      const schema = z.number().min(10);
      const hints = getValidationHints(schema, 5);

      expect(hints[0]).toContain('at least');
      expect(hints[0]).toContain('10');
    });

    it('should hint for invalid email', () => {
      const schema = z.string().email();
      const hints = getValidationHints(schema, 'invalid');

      expect(hints[0]).toContain('email');
    });

    it('should hint for invalid enum value', () => {
      const schema = z.enum(['red', 'green', 'blue']);
      const hints = getValidationHints(schema, 'yellow');

      expect(hints[0]).toContain('red');
      expect(hints[0]).toContain('green');
      expect(hints[0]).toContain('blue');
    });

    it('should hint for invalid literal', () => {
      const schema = z.literal('exact');
      const hints = getValidationHints(schema, 'other');

      expect(hints[0]).toContain('exact');
    });

    it('should hint for array too small', () => {
      const schema = z.array(z.number()).min(3);
      const hints = getValidationHints(schema, [1]);

      expect(hints[0]).toContain('at least');
      expect(hints[0]).toContain('3');
    });
  });

  describe('formatZodErrors', () => {
    it('should format basic error', () => {
      const result = z.string().safeParse(123);
      if (result.success) throw new Error('Expected failure');

      const errors = formatZodErrors(result.error);

      expect(errors.length).toBe(1);
      expect(errors[0].message).toBeDefined();
      expect(errors[0].code).toBe('invalid_type');
    });

    it('should include path for nested errors', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
        }),
      });

      const result = schema.safeParse({ user: { name: 123 } });
      if (result.success) throw new Error('Expected failure');

      const errors = formatZodErrors(result.error);

      expect(errors[0].path).toEqual(['user', 'name']);
    });

    it('should handle array index in path', () => {
      const schema = z.array(z.string());
      const result = schema.safeParse(['a', 123, 'c']);
      if (result.success) throw new Error('Expected failure');

      const errors = formatZodErrors(result.error);

      expect(errors[0].path).toContain(1);
    });

    it('should include expected and received values', () => {
      const result = z.string().safeParse(123);
      if (result.success) throw new Error('Expected failure');

      const errors = formatZodErrors(result.error);

      expect(errors[0].expected).toBe('string');
      expect(errors[0].received).toBe('number');
    });
  });

  describe('SchemaValidator utility object', () => {
    it('should have validate method', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const result = SchemaValidator.validate(userSchema, data);

      expect(result.success).toBe(true);
    });

    it('should have validateOrThrow method', () => {
      const data = { name: 'John', email: 'john@example.com', age: 30 };
      const result = SchemaValidator.validateOrThrow(userSchema, data);

      expect(result).toEqual(data);
    });

    it('should have validatePartial method', () => {
      const result = SchemaValidator.validatePartial(userSchema, {
        name: 'John',
      });

      expect(result.success).toBe(true);
    });

    it('should have matches method', () => {
      expect(SchemaValidator.matches(z.string(), 'hello')).toBe(true);
    });

    it('should have coerce method', () => {
      const schema = z.object({ count: z.number() });
      const result = SchemaValidator.coerce(schema, { count: '42' });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(42);
    });

    it('should have getHints method', () => {
      const hints = SchemaValidator.getHints(z.string(), 123);

      expect(hints.length).toBeGreaterThan(0);
    });

    it('should have formatErrors method', () => {
      const result = z.string().safeParse(123);
      if (result.success) throw new Error('Expected failure');

      const errors = SchemaValidator.formatErrors(result.error);

      expect(errors.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle deeply nested objects', () => {
      const schema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              value: z.string(),
            }),
          }),
        }),
      });

      const data = { level1: { level2: { level3: { value: 'deep' } } } };
      const result = validateSchema(schema, data);

      expect(result.success).toBe(true);
    });

    it('should handle recursive schemas with z.lazy', () => {
      interface Category {
        name: string;
        children?: Category[];
      }

      const categorySchema: z.ZodType<Category> = z.lazy(() =>
        z.object({
          name: z.string(),
          children: z.array(categorySchema).optional(),
        }),
      );

      const data = {
        name: 'Root',
        children: [
          { name: 'Child 1' },
          { name: 'Child 2', children: [{ name: 'Grandchild' }] },
        ],
      };

      const result = validateSchema(categorySchema, data);
      expect(result.success).toBe(true);
    });

    it('should handle nullable fields', () => {
      const schema = z.object({
        value: z.string().nullable(),
      });

      expect(validateSchema(schema, { value: 'hello' }).success).toBe(true);
      expect(validateSchema(schema, { value: null }).success).toBe(true);
    });

    it('should handle tuple schemas', () => {
      const schema = z.tuple([z.string(), z.number(), z.boolean()]);

      expect(validateSchema(schema, ['hello', 42, true]).success).toBe(true);
      expect(validateSchema(schema, ['hello', 'world', true]).success).toBe(
        false,
      );
    });

    it('should handle record schemas', () => {
      const schema = z.record(z.number());

      expect(validateSchema(schema, { a: 1, b: 2 }).success).toBe(true);
      expect(validateSchema(schema, { a: 'not a number' }).success).toBe(false);
    });

    it('should handle intersection types', () => {
      const schema = z.intersection(
        z.object({ name: z.string() }),
        z.object({ age: z.number() }),
      );

      expect(validateSchema(schema, { name: 'John', age: 30 }).success).toBe(
        true,
      );
      expect(validateSchema(schema, { name: 'John' }).success).toBe(false);
    });

    it('should handle discriminated unions', () => {
      const schema = z.discriminatedUnion('type', [
        z.object({ type: z.literal('a'), valueA: z.string() }),
        z.object({ type: z.literal('b'), valueB: z.number() }),
      ]);

      expect(
        validateSchema(schema, { type: 'a', valueA: 'hello' }).success,
      ).toBe(true);
      expect(validateSchema(schema, { type: 'b', valueB: 42 }).success).toBe(
        true,
      );
      expect(validateSchema(schema, { type: 'c' }).success).toBe(false);
    });

    it('should handle refine/transform', () => {
      const schema = z.string().transform((s) => s.toUpperCase());
      const result = validateSchema(schema, 'hello');

      expect(result.success).toBe(true);
      expect(result.data).toBe('HELLO');
    });
  });
});

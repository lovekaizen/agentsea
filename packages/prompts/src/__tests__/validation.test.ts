import { describe, it, expect } from 'vitest';
import {
  validatePromptName,
  validateTemplate,
  validateVariables,
  createVariableSchema,
  validateBranchName,
  validateEnvironmentName,
} from '../utils/validation.js';
import type { VariableDefinitions } from '../types/index.js';

describe('validation utilities', () => {
  describe('validatePromptName', () => {
    it('should accept valid names', () => {
      expect(validatePromptName('my-prompt')).toEqual({ valid: true });
      expect(validatePromptName('MyPrompt')).toEqual({ valid: true });
      expect(validatePromptName('my_prompt_123')).toEqual({ valid: true });
      expect(validatePromptName('a')).toEqual({ valid: true });
    });

    it('should reject empty names', () => {
      expect(validatePromptName('')).toEqual({
        valid: false,
        error: 'Prompt name cannot be empty',
      });
      expect(validatePromptName('   ')).toEqual({
        valid: false,
        error: 'Prompt name cannot be empty',
      });
    });

    it('should reject names exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(validatePromptName(longName)).toEqual({
        valid: false,
        error: 'Prompt name cannot exceed 100 characters',
      });
    });

    it('should reject names starting with numbers', () => {
      expect(validatePromptName('123prompt')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter'),
      });
    });

    it('should reject names with invalid characters', () => {
      expect(validatePromptName('my prompt')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter'),
      });
      expect(validatePromptName('my.prompt')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter'),
      });
    });
  });

  describe('validateTemplate', () => {
    it('should accept valid templates', () => {
      const result = validateTemplate('Hello {{name}}!');
      expect(result.valid).toBe(true);
      expect(result.variables).toContain('name');
    });

    it('should extract multiple variables', () => {
      const result = validateTemplate(
        'Hello {{name}}, you have {{count}} messages.',
      );
      expect(result.valid).toBe(true);
      expect(result.variables).toHaveLength(2);
      expect(result.variables).toContain('name');
      expect(result.variables).toContain('count');
    });

    it('should handle nested variable paths', () => {
      const result = validateTemplate('Hello {{user.name}}!');
      expect(result.valid).toBe(true);
      expect(result.variables).toContain('user');
    });

    it('should skip partials', () => {
      const result = validateTemplate('Hello {{> header}} {{name}}!');
      expect(result.valid).toBe(true);
      expect(result.variables).toEqual(['name']);
    });

    it('should skip block helpers', () => {
      const result = validateTemplate('{{#if condition}}Hello{{/if}} {{name}}');
      expect(result.valid).toBe(true);
      expect(result.variables).toContain('name');
      expect(result.variables).not.toContain('if');
    });

    it('should reject empty templates', () => {
      expect(validateTemplate('')).toEqual({
        valid: false,
        error: 'Template cannot be empty',
        variables: [],
      });
      expect(validateTemplate('   ')).toEqual({
        valid: false,
        error: 'Template cannot be empty',
        variables: [],
      });
    });

    it('should not duplicate variable names', () => {
      const result = validateTemplate('{{name}} and {{name}} again');
      expect(result.variables).toHaveLength(1);
      expect(result.variables).toEqual(['name']);
    });
  });

  describe('validateVariables', () => {
    const definitions: VariableDefinitions = {
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
      active: { type: 'boolean', required: false },
      tags: { type: 'array', required: false },
      role: {
        type: 'enum',
        values: ['admin', 'user', 'guest'],
        required: false,
      },
      config: { type: 'object', required: false },
    };

    it('should accept valid variables', () => {
      const result = validateVariables(
        { name: 'John', age: 30, active: true },
        definitions,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required variables', () => {
      const result = validateVariables({ name: 'John' }, definitions);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required variable: age');
    });

    it('should reject invalid string type', () => {
      const result = validateVariables({ name: 123, age: 30 }, definitions);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'name' must be a string");
    });

    it('should reject invalid number type', () => {
      const result = validateVariables(
        { name: 'John', age: 'thirty' },
        definitions,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'age' must be a number");
    });

    it('should reject NaN for number type', () => {
      const result = validateVariables({ name: 'John', age: NaN }, definitions);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'age' must be a number");
    });

    it('should reject invalid boolean type', () => {
      const result = validateVariables(
        { name: 'John', age: 30, active: 'yes' },
        definitions,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'active' must be a boolean");
    });

    it('should reject invalid array type', () => {
      const result = validateVariables(
        { name: 'John', age: 30, tags: 'not-an-array' },
        definitions,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'tags' must be an array");
    });

    it('should reject invalid enum value', () => {
      const result = validateVariables(
        { name: 'John', age: 30, role: 'superuser' },
        definitions,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'role' must be one of: admin, user, guest",
      );
    });

    it('should reject invalid object type', () => {
      const result = validateVariables(
        { name: 'John', age: 30, config: 'not-an-object' },
        definitions,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'config' must be an object");
    });

    it('should reject array as object', () => {
      const result = validateVariables(
        { name: 'John', age: 30, config: [] },
        definitions,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'config' must be an object");
    });

    it('should allow unknown variables', () => {
      const result = validateVariables(
        { name: 'John', age: 30, extra: 'ignored' },
        definitions,
      );
      expect(result.valid).toBe(true);
    });

    it('should allow optional variables to be omitted', () => {
      const result = validateVariables({ name: 'John', age: 30 }, definitions);
      expect(result.valid).toBe(true);
    });
  });

  describe('createVariableSchema', () => {
    it('should create a Zod schema from definitions', () => {
      const definitions: VariableDefinitions = {
        name: { type: 'string', required: true },
        count: { type: 'number', required: false },
      };

      const schema = createVariableSchema(definitions);

      expect(schema.safeParse({ name: 'test' }).success).toBe(true);
      expect(schema.safeParse({ name: 'test', count: 5 }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ name: 123 }).success).toBe(false);
    });

    it('should handle all variable types', () => {
      const definitions: VariableDefinitions = {
        str: { type: 'string', required: true },
        num: { type: 'number', required: true },
        bool: { type: 'boolean', required: true },
        arr: { type: 'array', required: true },
        obj: { type: 'object', required: true },
      };

      const schema = createVariableSchema(definitions);

      const validData = {
        str: 'hello',
        num: 42,
        bool: true,
        arr: [1, 2, 3],
        obj: { key: 'value' },
      };

      expect(schema.safeParse(validData).success).toBe(true);
    });

    it('should handle enum types', () => {
      const definitions: VariableDefinitions = {
        status: {
          type: 'enum',
          values: ['active', 'inactive'],
          required: true,
        },
      };

      const schema = createVariableSchema(definitions);

      expect(schema.safeParse({ status: 'active' }).success).toBe(true);
      expect(schema.safeParse({ status: 'inactive' }).success).toBe(true);
      expect(schema.safeParse({ status: 'unknown' }).success).toBe(false);
    });

    it('should apply default values', () => {
      const definitions: VariableDefinitions = {
        name: { type: 'string', required: false, default: 'Anonymous' },
      };

      const schema = createVariableSchema(definitions);
      const result = schema.parse({});

      expect(result.name).toBe('Anonymous');
    });
  });

  describe('validateBranchName', () => {
    it('should accept valid branch names', () => {
      expect(validateBranchName('feature-branch')).toEqual({ valid: true });
      expect(validateBranchName('feature/new-feature')).toEqual({
        valid: true,
      });
      expect(validateBranchName('fix_bug_123')).toEqual({ valid: true });
    });

    it('should reject empty names', () => {
      expect(validateBranchName('')).toEqual({
        valid: false,
        error: 'Branch name cannot be empty',
      });
    });

    it('should reject names exceeding 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(validateBranchName(longName)).toEqual({
        valid: false,
        error: 'Branch name cannot exceed 100 characters',
      });
    });

    it('should reject names starting with numbers', () => {
      expect(validateBranchName('123-branch')).toEqual({
        valid: false,
        error: expect.stringContaining('must start with a letter'),
      });
    });

    it('should reject reserved names', () => {
      expect(validateBranchName('main')).toEqual({
        valid: false,
        error: "'main' is a reserved branch name",
      });
      expect(validateBranchName('master')).toEqual({
        valid: false,
        error: "'master' is a reserved branch name",
      });
      expect(validateBranchName('HEAD')).toEqual({
        valid: false,
        error: "'HEAD' is a reserved branch name",
      });
    });
  });

  describe('validateEnvironmentName', () => {
    it('should accept valid environment names', () => {
      expect(validateEnvironmentName('production')).toEqual({ valid: true });
      expect(validateEnvironmentName('staging-1')).toEqual({ valid: true });
      expect(validateEnvironmentName('dev_local')).toEqual({ valid: true });
    });

    it('should reject empty names', () => {
      expect(validateEnvironmentName('')).toEqual({
        valid: false,
        error: 'Environment name cannot be empty',
      });
    });

    it('should reject names exceeding 50 characters', () => {
      const longName = 'a'.repeat(51);
      expect(validateEnvironmentName(longName)).toEqual({
        valid: false,
        error: 'Environment name cannot exceed 50 characters',
      });
    });

    it('should reject uppercase letters', () => {
      expect(validateEnvironmentName('Production')).toEqual({
        valid: false,
        error: expect.stringContaining('must be lowercase'),
      });
    });

    it('should reject names starting with numbers', () => {
      expect(validateEnvironmentName('1-env')).toEqual({
        valid: false,
        error: expect.stringContaining('must be lowercase'),
      });
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Prompt } from '../core/Prompt.js';
import type { PromptData } from '../types/index.js';

describe('Prompt', () => {
  describe('constructor', () => {
    it('should create a prompt with required fields', () => {
      const prompt = new Prompt({
        name: 'test-prompt',
        template: 'Hello {{name}}!',
      });

      expect(prompt.name).toBe('test-prompt');
      expect(prompt.template).toContain('Hello {{name}}');
      expect(prompt.id).toBeDefined();
      expect(prompt.hash).toBeDefined();
    });

    it('should auto-generate ID if not provided', () => {
      const prompt1 = new Prompt({
        name: 'test',
        template: 'Test',
      });
      const prompt2 = new Prompt({
        name: 'test',
        template: 'Test',
      });

      expect(prompt1.id).toBeDefined();
      expect(prompt2.id).toBeDefined();
      expect(prompt1.id).not.toBe(prompt2.id);
    });

    it('should use provided ID', () => {
      const prompt = new Prompt({
        id: 'custom-id',
        name: 'test',
        template: 'Test',
      });

      expect(prompt.id).toBe('custom-id');
    });

    it('should infer variables from template', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}, you are {{age}} years old',
      });

      expect(prompt.getVariableNames()).toContain('name');
      expect(prompt.getVariableNames()).toContain('age');
      expect(prompt.variables.name).toBeDefined();
      expect(prompt.variables.age).toBeDefined();
    });

    it('should use provided variable definitions', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Count: {{count}}',
        variables: {
          count: { type: 'number', required: true, description: 'The count' },
        },
      });

      expect(prompt.variables.count.type).toBe('number');
      expect(prompt.variables.count.description).toBe('The count');
    });

    it('should set default status to draft', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.status).toBe('draft');
    });

    it('should set default version to v1', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.version).toBe('v1');
    });

    it('should set default environment to development', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.environment).toBe('development');
    });

    it('should throw for invalid name', () => {
      expect(() => new Prompt({ name: '', template: 'Test' })).toThrow();
      expect(() => new Prompt({ name: '123test', template: 'Test' })).toThrow();
    });

    it('should throw for empty template', () => {
      expect(() => new Prompt({ name: 'test', template: '' })).toThrow(
        'Template cannot be empty',
      );
    });

    it('should set timestamps', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.createdAt).toBeInstanceOf(Date);
      expect(prompt.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('render', () => {
    it('should render template with variables', () => {
      const prompt = new Prompt({
        name: 'greeting',
        template: 'Hello {{name}}!',
      });

      const result = prompt.render({ name: 'World' });

      expect(result.content.trim()).toBe('Hello World!');
      expect(result.variables).toEqual({ name: 'World' });
    });

    it('should apply default values', () => {
      const prompt = new Prompt({
        name: 'greeting',
        template: 'Hello {{name}}!',
        variables: {
          name: { type: 'string', required: false, default: 'Guest' },
        },
      });

      const result = prompt.render({});

      expect(result.content.trim()).toBe('Hello Guest!');
      expect(result.warnings).toContain("Using default value for 'name'");
    });

    it('should preserve placeholders for missing required variables in non-strict mode', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
        variables: {
          name: { type: 'string', required: true },
        },
      });

      const result = prompt.render({});

      expect(result.content.trim()).toBe('Hello {{name}}!');
      expect(result.warnings).toContain("Missing required variable 'name'");
    });

    it('should throw in strict mode for missing required variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
        variables: {
          name: { type: 'string', required: true },
        },
      });

      expect(() => prompt.render({}, { strict: true })).toThrow(
        'Variable validation failed',
      );
    });

    it('should handle empty string for optional variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
        variables: {
          name: { type: 'string', required: false },
        },
      });

      const result = prompt.render({});

      expect(result.content.trim()).toBe('Hello !');
    });

    it('should allow extra variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
      });

      const result = prompt.render({ name: 'World', extra: 'value' });

      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should support partials', () => {
      const prompt = new Prompt({
        name: 'test',
        template: '{{> header}} Content',
      });

      const result = prompt.render(
        {},
        { partials: { header: '=== HEADER ===' } },
      );

      expect(result.content).toContain('=== HEADER ===');
    });

    it('should support helpers', () => {
      const prompt = new Prompt({
        name: 'test',
        template: '{{shout text}}',
      });

      const result = prompt.render(
        { text: 'hello' },
        {
          helpers: {
            shout: (str: string) => str.toUpperCase() + '!!!',
          },
        },
      );

      expect(result.content.trim()).toBe('HELLO!!!');
    });
  });

  describe('getVariableNames', () => {
    it('should return all variable names', () => {
      const prompt = new Prompt({
        name: 'test',
        template: '{{a}} {{b}} {{c}}',
        variables: {
          a: { type: 'string', required: true },
          b: { type: 'string', required: true },
          c: { type: 'string', required: true },
        },
      });

      const names = prompt.getVariableNames();
      expect(names).toHaveLength(3);
      expect(names).toContain('a');
      expect(names).toContain('b');
      expect(names).toContain('c');
    });
  });

  describe('hasVariable', () => {
    it('should return true for defined variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
      });

      expect(prompt.hasVariable('name')).toBe(true);
    });

    it('should return false for undefined variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
      });

      expect(prompt.hasVariable('age')).toBe(false);
    });
  });

  describe('getRequiredVariables', () => {
    it('should return only required variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: '{{required}} {{optional}}',
        variables: {
          required: { type: 'string', required: true },
          optional: { type: 'string', required: false },
        },
      });

      const required = prompt.getRequiredVariables();
      expect(required).toHaveLength(1);
      expect(required).toContain('required');
    });
  });

  describe('getOptionalVariables', () => {
    it('should return only optional variables', () => {
      const prompt = new Prompt({
        name: 'test',
        template: '{{required}} {{optional}}',
        variables: {
          required: { type: 'string', required: true },
          optional: { type: 'string', required: false },
        },
      });

      const optional = prompt.getOptionalVariables();
      expect(optional).toHaveLength(1);
      expect(optional).toContain('optional');
    });
  });

  describe('clone', () => {
    it('should create a copy with new ID', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
      });

      const clone = prompt.clone();

      expect(clone.id).not.toBe(prompt.id);
      expect(clone.name).toBe(prompt.name);
      expect(clone.template).toBe(prompt.template);
    });

    it('should apply overrides', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Hello {{name}}!',
      });

      const clone = prompt.clone({ name: 'test-clone' });

      expect(clone.name).toBe('test-clone');
    });

    it('should preserve existing ID if provided', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      const clone = prompt.clone({ id: 'custom-id' });

      expect(clone.id).toBe('custom-id');
    });
  });

  describe('toData', () => {
    it('should convert to plain data object', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
        description: 'A test prompt',
      });

      const data = prompt.toData();

      expect(data.name).toBe('test');
      expect(data.template).toContain('Test');
      expect(data.description).toBe('A test prompt');
      expect(data.id).toBe(prompt.id);
      expect(data.hash).toBe(prompt.hash);
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      const json = prompt.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.name).toBe('test');
      expect(parsed.template).toContain('Test');
    });
  });

  describe('fromData', () => {
    it('should create Prompt from data object', () => {
      const data: PromptData = {
        id: 'test-id',
        name: 'test',
        template: 'Test',
        variables: {},
        metadata: {},
        status: 'draft',
        version: 'v1',
        environment: 'development',
        createdAt: new Date(),
        updatedAt: new Date(),
        hash: 'test-hash',
      };

      const prompt = Prompt.fromData(data);

      expect(prompt.id).toBe('test-id');
      expect(prompt.name).toBe('test');
    });
  });

  describe('fromJSON', () => {
    it('should create Prompt from JSON string', () => {
      const data = {
        id: 'test-id',
        name: 'test',
        template: 'Test',
        variables: {},
        metadata: {},
        status: 'draft',
        version: 'v1',
        environment: 'development',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hash: 'test-hash',
      };

      const json = JSON.stringify(data);
      const prompt = Prompt.fromJSON(json);

      expect(prompt.id).toBe('test-id');
      expect(prompt.name).toBe('test');
    });
  });

  describe('update', () => {
    it('should update template', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Old template',
      });

      const updated = prompt.update({ template: 'New template' });

      expect(updated.template).toContain('New template');
      expect(updated.id).toBe(prompt.id);
    });

    it('should update description', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      const updated = prompt.update({ description: 'New description' });

      expect(updated.description).toBe('New description');
    });

    it('should update status', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
        status: 'draft',
      });

      const updated = prompt.update({ status: 'active' });

      expect(updated.status).toBe('active');
    });

    it('should update hash when template changes', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Old template',
      });

      const oldHash = prompt.hash;
      const updated = prompt.update({ template: 'New template' });

      expect(updated.hash).not.toBe(oldHash);
    });

    it('should update updatedAt timestamp', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      const oldUpdatedAt = prompt.updatedAt;
      const updated = prompt.update({ template: 'New' });

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        oldUpdatedAt.getTime(),
      );
    });
  });

  describe('hasChanges', () => {
    it('should detect changes in template', () => {
      const prompt1 = new Prompt({
        name: 'test',
        template: 'Template 1',
      });

      const prompt2 = new Prompt({
        name: 'test',
        template: 'Template 2',
      });

      expect(prompt1.hasChanges(prompt2)).toBe(true);
    });

    it('should return false for identical templates', () => {
      const template = 'Same template';
      const prompt1 = new Prompt({
        name: 'test',
        template,
      });

      const prompt2 = new Prompt({
        name: 'test',
        template,
      });

      expect(prompt1.hasChanges(prompt2)).toBe(false);
    });
  });

  describe('getDisplayName', () => {
    it('should return description if available', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
        description: 'My Description',
      });

      expect(prompt.getDisplayName()).toBe('My Description');
    });

    it('should return name if no description', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.getDisplayName()).toBe('test');
    });
  });

  describe('getPreview', () => {
    it('should return full template if short', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Short template',
      });

      const preview = prompt.getPreview();
      expect(preview).toBe('Short template');
    });

    it('should truncate long templates', () => {
      const longTemplate = 'A'.repeat(200);
      const prompt = new Prompt({
        name: 'test',
        template: longTemplate,
      });

      const preview = prompt.getPreview(100);
      expect(preview.length).toBeLessThanOrEqual(100);
      expect(preview).toContain('...');
    });

    it('should replace newlines with spaces', () => {
      const prompt = new Prompt({
        name: 'test',
        template: 'Line 1\nLine 2\nLine 3',
      });

      const preview = prompt.getPreview();
      expect(preview).not.toContain('\n');
      expect(preview).toContain(' ');
    });
  });
});

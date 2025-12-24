import { describe, it, expect } from 'vitest';
import {
  PromptTemplate,
  Partial,
  compose,
  createComposedTemplate,
} from '../core/PromptTemplate.js';

describe('PromptTemplate', () => {
  describe('constructor', () => {
    it('should create a template from a string', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      // normalizeTemplate adds trailing newline
      expect(template.template).toBe('Hello {{name}}!\n');
    });

    it('should infer variables from template', () => {
      const template = new PromptTemplate(
        'Hello {{name}}, you are {{age}} years old.',
      );
      expect(template.getVariableNames()).toContain('name');
      expect(template.getVariableNames()).toContain('age');
    });

    it('should use provided variable definitions', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: true, description: 'User name' },
      });
      expect(template.variables.name).toEqual({
        type: 'string',
        required: true,
        description: 'User name',
      });
    });

    it('should throw for empty template', () => {
      expect(() => new PromptTemplate('')).toThrow('Template cannot be empty');
    });

    it('should register partials', () => {
      const template = new PromptTemplate(
        '{{> header}} Hello!',
        {},
        {
          partials: { header: '=== HEADER ===' },
        },
      );
      const result = template.render({});
      expect(result.content).toContain('=== HEADER ===');
    });

    it('should register custom helpers', () => {
      const template = new PromptTemplate(
        '{{shout name}}',
        {
          name: { type: 'string', required: true },
        },
        {
          helpers: {
            shout: (str: string) => str.toUpperCase() + '!!!',
          },
        },
      );
      const result = template.render({ name: 'hello' });
      expect(result.content.trim()).toBe('HELLO!!!');
    });
  });

  describe('render', () => {
    it('should render template with variables', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      const result = template.render({ name: 'World' });
      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should render with multiple variables', () => {
      const template = new PromptTemplate('{{greeting}} {{name}}!');
      const result = template.render({ greeting: 'Hello', name: 'World' });
      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should apply default values', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: false, default: 'Guest' },
      });
      const result = template.render({});
      expect(result.content.trim()).toBe('Hello Guest!');
      expect(result.warnings).toContain("Using default value for 'name'");
    });

    it('should include warnings for missing optional variables', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: false },
      });
      const result = template.render({});
      expect(result.content.trim()).toBe('Hello !');
    });

    it('should preserve missing required variables in non-strict mode', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: true },
      });
      const result = template.render({});
      expect(result.content.trim()).toBe('Hello {{name}}!');
      expect(result.warnings).toContain("Missing required variable 'name'");
    });

    it('should throw in strict mode for missing required variables', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: true },
      });
      expect(() => template.render({}, { strict: true })).toThrow(
        'Variable validation failed',
      );
    });

    it('should throw in strict mode for invalid types', () => {
      const template = new PromptTemplate('Count: {{count}}', {
        count: { type: 'number', required: true },
      });
      expect(() =>
        template.render({ count: 'not a number' }, { strict: true }),
      ).toThrow('Variable validation failed');
    });

    it('should allow extra variables', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      const result = template.render({ name: 'World', extra: 'ignored' });
      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should return resolved variables', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: true },
      });
      const result = template.render({ name: 'World' });
      expect(result.variables).toEqual({ name: 'World' });
    });
  });

  describe('built-in helpers', () => {
    it('upper helper should uppercase strings', () => {
      const template = new PromptTemplate('{{upper name}}');
      const result = template.render({ name: 'hello' });
      expect(result.content.trim()).toBe('HELLO');
    });

    it('lower helper should lowercase strings', () => {
      const template = new PromptTemplate('{{lower name}}');
      const result = template.render({ name: 'HELLO' });
      expect(result.content.trim()).toBe('hello');
    });

    it('capitalize helper should capitalize first letter', () => {
      const template = new PromptTemplate('{{capitalize name}}');
      const result = template.render({ name: 'hello world' });
      expect(result.content.trim()).toBe('Hello world');
    });

    it('truncate helper should truncate long strings', () => {
      const template = new PromptTemplate('{{truncate text 10}}');
      const result = template.render({ text: 'This is a very long text' });
      expect(result.content.trim()).toBe('This is...');
    });

    it('truncate helper should not truncate short strings', () => {
      const template = new PromptTemplate('{{truncate text 50}}');
      const result = template.render({ text: 'Short text' });
      expect(result.content.trim()).toBe('Short text');
    });

    it('default helper should provide fallback value', () => {
      const template = new PromptTemplate('{{default name "Anonymous"}}');
      const result = template.render({});
      expect(result.content.trim()).toBe('Anonymous');
    });

    it('json helper should stringify objects', () => {
      const template = new PromptTemplate('{{json data}}');
      const result = template.render({ data: { key: 'value' } });
      expect(result.content).toContain('"key": "value"');
    });

    it('join helper should join arrays', () => {
      const template = new PromptTemplate('{{join items ", "}}');
      const result = template.render({ items: ['a', 'b', 'c'] });
      expect(result.content.trim()).toBe('a, b, c');
    });

    it('eq helper should compare values', () => {
      const template = new PromptTemplate(
        '{{#if (eq status "active")}}Active{{else}}Inactive{{/if}}',
      );
      expect(template.render({ status: 'active' }).content.trim()).toBe(
        'Active',
      );
      expect(template.render({ status: 'inactive' }).content.trim()).toBe(
        'Inactive',
      );
    });

    it('number helper should format numbers', () => {
      const template = new PromptTemplate('{{number value 2}}');
      const result = template.render({ value: 3.14159 });
      expect(result.content.trim()).toBe('3.14');
    });
  });

  describe('registerPartial', () => {
    it('should register a partial for use in template', () => {
      const template = new PromptTemplate('{{> greeting}} {{name}}!');
      template.registerPartial('greeting', 'Hello');
      const result = template.render({ name: 'World' });
      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should reset compiled template when registering partial', () => {
      const template = new PromptTemplate('{{> greeting}}');
      template.compile();
      template.registerPartial('greeting', 'Hi');
      const result = template.render({});
      expect(result.content.trim()).toBe('Hi');
    });
  });

  describe('registerHelper', () => {
    it('should register a custom helper', () => {
      const template = new PromptTemplate('{{reverse text}}');
      template.registerHelper('reverse', (str: string) =>
        typeof str === 'string' ? str.split('').reverse().join('') : str,
      );
      const result = template.render({ text: 'hello' });
      expect(result.content.trim()).toBe('olleh');
    });
  });

  describe('clone', () => {
    it('should create a copy of the template', () => {
      const template = new PromptTemplate('Hello {{name}}!', {
        name: { type: 'string', required: true },
      });
      const cloned = template.clone();

      expect(cloned.template).toBe(template.template);
      expect(cloned.variables).toEqual(template.variables);
      expect(cloned).not.toBe(template);
    });

    it('should apply overrides when cloning', () => {
      const template = new PromptTemplate('Hello {{name}}!');
      const cloned = template.clone({ template: 'Hi {{name}}!' });

      // normalizeTemplate adds trailing newline
      expect(cloned.template).toBe('Hi {{name}}!\n');
    });
  });

  describe('getVariableNames', () => {
    it('should return all variable names', () => {
      const template = new PromptTemplate('{{a}} {{b}} {{c}}', {
        a: { type: 'string', required: true },
        b: { type: 'string', required: true },
        c: { type: 'string', required: true },
      });
      const names = template.getVariableNames();
      expect(names).toEqual(['a', 'b', 'c']);
    });
  });
});

describe('Partial', () => {
  it('should create a partial with template', () => {
    const partial = new Partial({
      name: 'greeting',
      template: 'Hello {{name}}!',
      description: 'A greeting partial',
    });

    expect(partial.name).toBe('greeting');
    // normalizeTemplate adds trailing newline
    expect(partial.template).toBe('Hello {{name}}!\n');
    expect(partial.description).toBe('A greeting partial');
    expect(partial.variables).toContain('name');
  });

  it('should convert to data object', () => {
    const partial = new Partial({
      name: 'test',
      template: '{{value}}',
    });

    const data = partial.toData();

    expect(data.name).toBe('test');
    // normalizeTemplate adds trailing newline
    expect(data.template).toBe('{{value}}\n');
    expect(data.description).toBeUndefined();
    expect(data.variables).toEqual(['value']);
  });
});

describe('compose', () => {
  it('should compose multiple templates', () => {
    const result = compose([{ template: 'Part 1' }, { template: 'Part 2' }]);

    expect(result).toBe('Part 1\n\nPart 2');
  });

  it('should include partial references', () => {
    const result = compose([{ partial: 'header' }, { template: 'Content' }]);

    expect(result).toBe('{{> header}}\n\nContent');
  });

  it('should use custom separator', () => {
    const result = compose([{ template: 'A' }, { template: 'B' }], '\n---\n');

    expect(result).toBe('A\n---\nB');
  });
});

describe('createComposedTemplate', () => {
  it('should create a composed template', () => {
    const result = createComposedTemplate([
      { template: 'Part 1' },
      { template: 'Part 2' },
    ]);

    expect(result).toBe('Part 1\n\nPart 2');
  });

  it('should add comments for named parts', () => {
    const result = createComposedTemplate([
      { name: 'Intro', template: 'Introduction' },
      { name: 'Body', template: 'Main content' },
    ]);

    expect(result).toContain('{{!-- Intro --}}');
    expect(result).toContain('{{!-- Body --}}');
  });

  it('should wrap in conditionals when specified', () => {
    const result = createComposedTemplate(
      [{ template: 'Optional', condition: 'showOptional' }],
      { wrapInConditional: true },
    );

    expect(result).toContain('{{#if showOptional}}');
    expect(result).toContain('{{/if}}');
  });

  it('should use custom separator', () => {
    const result = createComposedTemplate(
      [{ template: 'A' }, { template: 'B' }],
      { separator: '\n' },
    );

    expect(result).toBe('A\nB');
  });
});

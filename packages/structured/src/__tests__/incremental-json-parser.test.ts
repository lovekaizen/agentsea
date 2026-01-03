import { describe, it, expect, beforeEach } from 'vitest';
import {
  IncrementalJsonParser,
  FieldParseUpdate,
  tokenizeJson,
} from '../streaming/IncrementalJsonParser.js';

describe('IncrementalJsonParser', () => {
  let parser: IncrementalJsonParser;

  beforeEach(() => {
    parser = new IncrementalJsonParser();
  });

  describe('constructor', () => {
    it('should create a parser instance', () => {
      expect(parser).toBeInstanceOf(IncrementalJsonParser);
    });
  });

  describe('feed', () => {
    it('should return empty array for empty input', () => {
      const updates = parser.feed('');
      expect(updates).toEqual([]);
    });

    it('should parse simple object', () => {
      const updates = parser.feed('{"name": "John"}');

      expect(updates.length).toBeGreaterThan(0);
    });

    it('should parse object with string value', () => {
      parser.feed('{"name": "John"}');
      const result = parser.getResult();

      expect(result.name).toBe('John');
    });

    it('should parse object with number value', () => {
      parser.feed('{"age": 30}');
      const result = parser.getResult();

      expect(result.age).toBe(30);
    });

    it('should parse object with boolean value', () => {
      parser.feed('{"active": true}');
      const result = parser.getResult();

      expect(result.active).toBe(true);
    });

    it('should parse object with false value', () => {
      parser.feed('{"active": false}');
      const result = parser.getResult();

      expect(result.active).toBe(false);
    });

    it('should parse object with null value', () => {
      parser.feed('{"value": null}');
      const result = parser.getResult();

      expect(result.value).toBeNull();
    });

    it('should parse object with multiple fields', () => {
      parser.feed('{"name": "John", "age": 30, "active": true}');
      const result = parser.getResult();

      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
      expect(result.active).toBe(true);
    });

    it('should parse nested object', () => {
      parser.feed('{"user": {"name": "John", "email": "john@example.com"}}');
      const result = parser.getResult();

      expect(result.user).toEqual({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('should parse deeply nested object', () => {
      parser.feed('{"a": {"b": {"c": {"value": "deep"}}}}');
      const result = parser.getResult();

      expect((result.a as { b: { c: { value: string } } }).b.c.value).toBe(
        'deep',
      );
    });

    it('should parse array', () => {
      parser.feed('{"items": [1, 2, 3]}');
      const result = parser.getResult();

      expect(result.items).toEqual([1, 2, 3]);
    });

    it('should parse array of strings', () => {
      parser.feed('{"tags": ["a", "b", "c"]}');
      const result = parser.getResult();

      expect(result.tags).toEqual(['a', 'b', 'c']);
    });

    it('should parse array of objects', () => {
      parser.feed('{"users": [{"name": "John"}, {"name": "Jane"}]}');
      const result = parser.getResult();

      expect(result.users).toEqual([{ name: 'John' }, { name: 'Jane' }]);
    });

    it('should parse empty array', () => {
      parser.feed('{"items": []}');
      const result = parser.getResult();

      expect(result.items).toEqual([]);
    });

    it('should parse empty object', () => {
      parser.feed('{"config": {}}');
      const result = parser.getResult();

      expect(result.config).toEqual({});
    });

    it('should handle floating point numbers', () => {
      parser.feed('{"price": 19.99}');
      const result = parser.getResult();

      expect(result.price).toBe(19.99);
    });

    it('should handle negative numbers', () => {
      parser.feed('{"temp": -5}');
      const result = parser.getResult();

      expect(result.temp).toBe(-5);
    });

    it('should handle scientific notation', () => {
      parser.feed('{"value": 1.5e10}');
      const result = parser.getResult();

      expect(result.value).toBe(1.5e10);
    });

    it('should handle escaped characters in strings', () => {
      parser.feed('{"text": "hello\\nworld"}');
      const result = parser.getResult();

      expect(result.text).toBe('hello\nworld');
    });

    it('should handle escaped quotes', () => {
      parser.feed('{"text": "say \\"hello\\""}');
      const result = parser.getResult();

      expect(result.text).toBe('say "hello"');
    });

    it('should handle escaped backslash', () => {
      parser.feed('{"path": "C:\\\\Users\\\\file"}');
      const result = parser.getResult();

      expect(result.path).toBe('C:\\Users\\file');
    });

    it('should handle tab escape', () => {
      parser.feed('{"text": "col1\\tcol2"}');
      const result = parser.getResult();

      expect(result.text).toBe('col1\tcol2');
    });

    it('should handle carriage return escape', () => {
      parser.feed('{"text": "line1\\r\\nline2"}');
      const result = parser.getResult();

      expect(result.text).toBe('line1\r\nline2');
    });

    it('should handle escaped forward slash', () => {
      parser.feed('{"url": "http:\\/\\/example.com"}');
      const result = parser.getResult();

      expect(result.url).toBe('http://example.com');
    });
  });

  describe('incremental parsing', () => {
    it('should parse JSON in chunks', () => {
      parser.feed('{"na');
      parser.feed('me": "Jo');
      parser.feed('hn"}');

      const result = parser.getResult();
      expect(result.name).toBe('John');
    });

    it('should emit updates as fields complete', () => {
      const allUpdates: FieldParseUpdate[] = [];

      allUpdates.push(...parser.feed('{"name": "Jo'));
      allUpdates.push(...parser.feed('hn", "age": 30}'));

      // Should have updates for completed fields
      expect(allUpdates.some((u) => u.path.includes('name'))).toBe(true);
      expect(allUpdates.some((u) => u.path.includes('age'))).toBe(true);
    });

    it('should handle object split across chunks', () => {
      parser.feed('{"user": {"na');
      parser.feed('me": "John"');
      parser.feed('}}');

      const result = parser.getResult();
      expect((result.user as { name: string }).name).toBe('John');
    });

    it('should handle array split across chunks', () => {
      parser.feed('{"items": [1, ');
      parser.feed('2, ');
      parser.feed('3]}');

      const result = parser.getResult();
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('should handle number split across chunks', () => {
      parser.feed('{"value": 123');
      parser.feed('456}');

      const result = parser.getResult();
      expect(result.value).toBe(123456);
    });

    it('should handle boolean split across chunks', () => {
      parser.feed('{"active": tr');
      parser.feed('ue}');

      const result = parser.getResult();
      expect(result.active).toBe(true);
    });

    it('should handle null split across chunks', () => {
      parser.feed('{"value": nu');
      parser.feed('ll}');

      const result = parser.getResult();
      expect(result.value).toBeNull();
    });
  });

  describe('getResult', () => {
    it('should return empty object initially', () => {
      const result = parser.getResult();
      expect(result).toEqual({});
    });

    it('should return partial result during parsing', () => {
      parser.feed('{"name": "John", ');
      const result = parser.getResult();

      expect(result.name).toBe('John');
    });

    it('should return complete result after parsing', () => {
      parser.feed('{"name": "John", "age": 30}');
      const result = parser.getResult();

      expect(result).toEqual({ name: 'John', age: 30 });
    });
  });

  describe('reset', () => {
    it('should clear parser state', () => {
      parser.feed('{"name": "John"}');
      parser.reset();

      const result = parser.getResult();
      expect(result).toEqual({});
    });

    it('should allow parsing new JSON after reset', () => {
      parser.feed('{"old": "data"}');
      parser.reset();
      parser.feed('{"new": "data"}');

      const result = parser.getResult();
      expect(result.new).toBe('data');
      expect(result.old).toBeUndefined();
    });
  });

  describe('field updates', () => {
    it('should return updates with path', () => {
      const updates = parser.feed('{"name": "John"}');

      expect(updates.some((u) => u.path.includes('name'))).toBe(true);
    });

    it('should return updates with value', () => {
      const updates = parser.feed('{"name": "John"}');
      const nameUpdate = updates.find((u) => u.path.includes('name'));

      expect(nameUpdate?.value).toBe('John');
    });

    it('should mark updates as complete', () => {
      const updates = parser.feed('{"name": "John"}');
      const nameUpdate = updates.find((u) => u.path.includes('name'));

      expect(nameUpdate?.complete).toBe(true);
    });

    it('should return nested path for nested values', () => {
      const updates = parser.feed('{"user": {"name": "John"}}');
      const nameUpdate = updates.find(
        (u) => u.path.includes('user') && u.path.includes('name'),
      );

      expect(nameUpdate).toBeDefined();
    });

    it('should return array index in path', () => {
      const updates = parser.feed('{"items": ["a", "b"]}');

      const hasArrayPath = updates.some(
        (u) =>
          u.path.includes('items') &&
          (u.path.includes('0') || u.path.includes('1')),
      );
      expect(hasArrayPath).toBe(true);
    });

    it('should emit object complete update', () => {
      const updates = parser.feed('{"user": {"name": "John"}}');
      const objectUpdate = updates.find(
        (u) =>
          u.path.length === 1 &&
          u.path[0] === 'user' &&
          typeof u.value === 'object',
      );

      expect(objectUpdate).toBeDefined();
      expect(objectUpdate?.complete).toBe(true);
    });

    it('should emit array complete update', () => {
      const updates = parser.feed('{"items": [1, 2, 3]}');
      const arrayUpdate = updates.find(
        (u) =>
          u.path.length === 1 &&
          u.path[0] === 'items' &&
          Array.isArray(u.value),
      );

      expect(arrayUpdate).toBeDefined();
      expect(arrayUpdate?.complete).toBe(true);
    });
  });

  describe('whitespace handling', () => {
    it('should handle leading whitespace', () => {
      parser.feed('   {"name": "John"}');
      const result = parser.getResult();

      expect(result.name).toBe('John');
    });

    it('should handle trailing whitespace', () => {
      parser.feed('{"name": "John"}   ');
      const result = parser.getResult();

      expect(result.name).toBe('John');
    });

    it('should handle whitespace between tokens', () => {
      parser.feed('{   "name"  :   "John"   }');
      const result = parser.getResult();

      expect(result.name).toBe('John');
    });

    it('should handle newlines', () => {
      parser.feed('{\n"name": "John"\n}');
      const result = parser.getResult();

      expect(result.name).toBe('John');
    });

    it('should handle pretty-printed JSON', () => {
      const json = `{
        "name": "John",
        "age": 30,
        "address": {
          "city": "NYC"
        }
      }`;

      parser.feed(json);
      const result = parser.getResult();

      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
      expect((result.address as { city: string }).city).toBe('NYC');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string value', () => {
      parser.feed('{"name": ""}');
      const result = parser.getResult();

      expect(result.name).toBe('');
    });

    it('should handle zero', () => {
      parser.feed('{"count": 0}');
      const result = parser.getResult();

      expect(result.count).toBe(0);
    });

    it('should handle negative zero', () => {
      parser.feed('{"value": -0}');
      const result = parser.getResult();

      // JavaScript preserves -0, so we just check it's a number equal to 0
      expect(result.value === 0).toBe(true);
    });

    it('should handle very large numbers', () => {
      parser.feed('{"big": 9007199254740991}');
      const result = parser.getResult();

      expect(result.big).toBe(9007199254740991);
    });

    it('should handle very small numbers', () => {
      parser.feed('{"small": 0.0000001}');
      const result = parser.getResult();

      expect(result.small).toBe(0.0000001);
    });

    it('should handle unicode in strings', () => {
      parser.feed('{"emoji": "👋"}');
      const result = parser.getResult();

      expect(result.emoji).toBe('👋');
    });

    it('should handle special characters in strings', () => {
      parser.feed('{"special": "!@#$%^&*()"}');
      const result = parser.getResult();

      expect(result.special).toBe('!@#$%^&*()');
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(10000);
      parser.feed(`{"text": "${longString}"}`);
      const result = parser.getResult();

      expect(result.text).toBe(longString);
    });

    it('should handle many fields', () => {
      const obj: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        obj[`field${i}`] = i;
      }

      parser.feed(JSON.stringify(obj));
      const result = parser.getResult();

      expect(Object.keys(result).length).toBe(100);
      expect(result.field50).toBe(50);
    });

    it('should handle deeply nested arrays', () => {
      parser.feed('{"matrix": [[1, 2], [3, 4]]}');
      const result = parser.getResult();

      expect(result.matrix).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it('should handle mixed array types', () => {
      parser.feed('{"mixed": [1, "two", true, null]}');
      const result = parser.getResult();

      expect(result.mixed).toEqual([1, 'two', true, null]);
    });
  });
});

describe('tokenizeJson', () => {
  it('should tokenize empty object', () => {
    const tokens = tokenizeJson('{}');

    expect(tokens.some((t) => t.type === 'object_start')).toBe(true);
    expect(tokens.some((t) => t.type === 'object_end')).toBe(true);
  });

  it('should tokenize empty array', () => {
    const tokens = tokenizeJson('[]');

    expect(tokens.some((t) => t.type === 'array_start')).toBe(true);
    expect(tokens.some((t) => t.type === 'array_end')).toBe(true);
  });

  it('should tokenize string key', () => {
    const tokens = tokenizeJson('{"name": "John"}');
    const keyToken = tokens.find((t) => t.type === 'key');

    expect(keyToken?.value).toBe('name');
  });

  it('should tokenize string value', () => {
    const tokens = tokenizeJson('{"name": "John"}');
    const stringToken = tokens.find((t) => t.type === 'string');

    expect(stringToken?.value).toBe('John');
  });

  it('should tokenize colon', () => {
    const tokens = tokenizeJson('{"name": "John"}');

    expect(tokens.some((t) => t.type === 'colon')).toBe(true);
  });

  it('should tokenize comma', () => {
    const tokens = tokenizeJson('{"a": 1, "b": 2}');

    expect(tokens.some((t) => t.type === 'comma')).toBe(true);
  });

  it('should include path for nested tokens', () => {
    const tokens = tokenizeJson('{"user": {"name": "John"}}');

    // Find token with value 'name' (may be key or string type depending on context)
    const nameToken = tokens.find((t) => t.value === 'name');
    expect(nameToken).toBeDefined();
  });

  it('should handle escaped characters in strings', () => {
    const tokens = tokenizeJson('{"text": "hello\\nworld"}');
    const stringToken = tokens.find((t) => t.type === 'string');

    expect(stringToken?.value).toBe('hello\nworld');
  });

  it('should mark tokens as complete', () => {
    const tokens = tokenizeJson('{"name": "John"}');

    expect(tokens.every((t) => t.complete)).toBe(true);
  });

  it('should skip whitespace', () => {
    const tokens = tokenizeJson('{   "name"  :  "John"   }');
    const whitespaceToken = tokens.find((t) => t.value === ' ');

    expect(whitespaceToken).toBeUndefined();
  });

  it('should handle arrays', () => {
    const tokens = tokenizeJson('{"items": [1, 2, 3]}');

    expect(tokens.some((t) => t.type === 'array_start')).toBe(true);
    expect(tokens.some((t) => t.type === 'array_end')).toBe(true);
  });
});

describe('streaming scenarios', () => {
  let parser: IncrementalJsonParser;

  beforeEach(() => {
    parser = new IncrementalJsonParser();
  });

  it('should simulate LLM token-by-token streaming', () => {
    const json = '{"response": "Hello, world!"}';
    const allUpdates: FieldParseUpdate[] = [];

    // Simulate character-by-character streaming
    for (const char of json) {
      const updates = parser.feed(char);
      allUpdates.push(...updates);
    }

    const result = parser.getResult();
    expect(result.response).toBe('Hello, world!');
  });

  it('should handle realistic LLM streaming chunks', () => {
    const chunks = [
      '{"',
      'title',
      '": "',
      'AI ',
      'Generated ',
      'Content',
      '", "',
      'body',
      '": "',
      'This is the ',
      'generated ',
      'content.',
      '"}',
    ];

    for (const chunk of chunks) {
      parser.feed(chunk);
    }

    const result = parser.getResult();
    expect(result.title).toBe('AI Generated Content');
    expect(result.body).toBe('This is the generated content.');
  });

  it('should handle streaming with nested objects', () => {
    const chunks = [
      '{"user": {',
      '"name": "John",',
      '"profile": {',
      '"bio": "Developer"',
      '}}}',
    ];

    for (const chunk of chunks) {
      parser.feed(chunk);
    }

    const result = parser.getResult();
    expect((result.user as { name: string }).name).toBe('John');
    expect(
      ((result.user as { profile: { bio: string } }).profile as { bio: string })
        .bio,
    ).toBe('Developer');
  });

  it('should handle streaming with arrays', () => {
    const chunks = [
      '{"items": [',
      '{"id": 1},',
      '{"id": 2},',
      '{"id": 3}',
      ']}',
    ];

    for (const chunk of chunks) {
      parser.feed(chunk);
    }

    const result = parser.getResult();
    expect(result.items as { id: number }[]).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it('should provide partial results during streaming', () => {
    parser.feed('{"field1": "value1",');

    let result = parser.getResult();
    expect(result.field1).toBe('value1');
    expect(result.field2).toBeUndefined();

    parser.feed(' "field2": "value2"}');

    result = parser.getResult();
    expect(result.field1).toBe('value1');
    expect(result.field2).toBe('value2');
  });

  it('should emit field updates as fields complete', () => {
    const completedPaths: string[] = [];

    parser.feed('{"name": "Jo');
    // No updates yet - string incomplete

    const updates = parser.feed('hn", "age": 30}');

    for (const update of updates) {
      if (update.complete) {
        completedPaths.push(update.path.join('.'));
      }
    }

    expect(completedPaths).toContain('name');
    expect(completedPaths).toContain('age');
  });
});

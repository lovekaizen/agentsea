import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  countTokens,
  countMessageTokens,
  estimateRequestTokens,
  truncateToTokenLimit,
  freeEncoder,
} from '../utils/tokenizer.js';

describe('tokenizer', () => {
  afterEach(() => {
    freeEncoder();
  });

  describe('countTokens', () => {
    it('should count tokens in a simple string', () => {
      const count = countTokens('Hello, world!');
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(10);
    });

    it('should count tokens in an empty string', () => {
      const count = countTokens('');
      expect(count).toBe(0);
    });

    it('should count tokens in a long string', () => {
      const longText =
        'This is a longer piece of text with many words and tokens.';
      const count = countTokens(longText);
      expect(count).toBeGreaterThan(10);
    });

    it('should handle special characters', () => {
      const count = countTokens('Special: @#$%^&*()');
      expect(count).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const count = countTokens('Hello 世界! 🌍');
      expect(count).toBeGreaterThan(0);
    });

    it('should handle code snippets', () => {
      const code = 'function add(a, b) { return a + b; }';
      const count = countTokens(code);
      expect(count).toBeGreaterThan(5);
    });

    it('should use fallback on error', () => {
      // The fallback estimate is roughly 1 token per 4 characters
      const text = 'test';
      const count = countTokens(text);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countMessageTokens', () => {
    it('should count tokens in a single message', () => {
      const messages = [{ role: 'user', content: 'Hello, how are you?' }];
      const count = countMessageTokens(messages);

      // Should include: 4 (formatting) + message tokens + 2 (priming)
      expect(count).toBeGreaterThan(6);
    });

    it('should count tokens in multiple messages', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const count = countMessageTokens(messages);

      // Should include: (3 * 4) formatting + message tokens + 2 priming
      expect(count).toBeGreaterThan(14);
    });

    it('should handle empty messages array', () => {
      const messages: Array<{ role: string; content: string }> = [];
      const count = countMessageTokens(messages);

      // Should only include the 2 tokens for priming
      expect(count).toBe(2);
    });

    it('should handle messages with null content', () => {
      const messages = [{ role: 'user', content: null }];
      const count = countMessageTokens(messages);

      // Should include: 4 (formatting) + 2 (priming)
      expect(count).toBe(6);
    });

    it('should handle messages with object content', () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is this?' },
            {
              type: 'image_url',
              image_url: { url: 'https://example.com/image.jpg' },
            },
          ],
        },
      ];
      const count = countMessageTokens(messages);

      // Should stringify the object and count tokens
      expect(count).toBeGreaterThan(6);
    });

    it('should add formatting tokens per message', () => {
      const singleMessage = [{ role: 'user', content: 'Hi' }];
      const doubleMessage = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hi' },
      ];

      const count1 = countMessageTokens(singleMessage);
      const count2 = countMessageTokens(doubleMessage);

      // Double message should have ~4 more tokens (formatting overhead)
      expect(count2).toBeGreaterThan(count1 + 3);
    });
  });

  describe('estimateRequestTokens', () => {
    it('should estimate tokens for messages only', () => {
      const messages = [{ role: 'user', content: 'Hello!' }];
      const estimate = estimateRequestTokens(messages);

      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBe(countMessageTokens(messages));
    });

    it('should include tool definitions in estimate', () => {
      const messages = [{ role: 'user', content: 'What is the weather?' }];
      const tools = [
        {
          function: {
            name: 'get_weather',
            description: 'Get the current weather for a location',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ];

      const withoutTools = estimateRequestTokens(messages);
      const withTools = estimateRequestTokens(messages, tools);

      expect(withTools).toBeGreaterThan(withoutTools);
    });

    it('should handle multiple tools', () => {
      const messages = [{ role: 'user', content: 'Help me' }];
      const tools = [
        {
          function: {
            name: 'tool1',
            description: 'First tool',
          },
        },
        {
          function: {
            name: 'tool2',
            description: 'Second tool',
          },
        },
      ];

      const estimate = estimateRequestTokens(messages, tools);
      const messagesOnly = estimateRequestTokens(messages);

      // Should be significantly higher with tools
      expect(estimate).toBeGreaterThan(messagesOnly + 20);
    });

    it('should handle tools without description', () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const tools = [
        {
          function: {
            name: 'simple_tool',
          },
        },
      ];

      const estimate = estimateRequestTokens(messages, tools);
      expect(estimate).toBeGreaterThan(countMessageTokens(messages));
    });

    it('should handle tools without parameters', () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const tools = [
        {
          function: {
            name: 'simple_tool',
            description: 'A simple tool',
          },
        },
      ];

      const estimate = estimateRequestTokens(messages, tools);
      expect(estimate).toBeGreaterThan(countMessageTokens(messages));
    });

    it('should add overhead per tool', () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const singleTool = [{ function: { name: 'tool' } }];
      const doubleTool = [
        { function: { name: 'tool1' } },
        { function: { name: 'tool2' } },
      ];

      const estimate1 = estimateRequestTokens(messages, singleTool);
      const estimate2 = estimateRequestTokens(messages, doubleTool);

      // Should add at least 10 tokens overhead per tool
      expect(estimate2).toBeGreaterThan(estimate1 + 10);
    });

    it('should handle empty tools array', () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const tools: Array<{
        function: { name: string; description?: string; parameters?: unknown };
      }> = [];

      const estimate = estimateRequestTokens(messages, tools);
      expect(estimate).toBe(countMessageTokens(messages));
    });
  });

  describe('truncateToTokenLimit', () => {
    it('should not truncate text within limit', () => {
      const text = 'Hello, world!';
      const tokenCount = countTokens(text);
      const truncated = truncateToTokenLimit(text, tokenCount + 10);

      expect(truncated).toBe(text);
    });

    it('should truncate text exceeding limit', () => {
      const text = 'This is a longer piece of text that needs to be truncated.';
      const maxTokens = 5;
      const truncated = truncateToTokenLimit(text, maxTokens);

      expect(countTokens(truncated)).toBeLessThanOrEqual(maxTokens);
      expect(truncated.length).toBeLessThan(text.length);
    });

    it('should handle empty string', () => {
      const truncated = truncateToTokenLimit('', 10);
      expect(truncated).toBe('');
    });

    it('should handle zero token limit', () => {
      const truncated = truncateToTokenLimit('Hello', 0);
      expect(truncated).toBe('');
    });

    it('should preserve text structure when possible', () => {
      const text = 'Hello world';
      const truncated = truncateToTokenLimit(text, 1);

      // Should be truncated but decodable
      expect(typeof truncated).toBe('string');
      expect(truncated.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode text truncation', () => {
      const text = 'Hello 世界 🌍';
      const maxTokens = 3;
      const truncated = truncateToTokenLimit(text, maxTokens);

      expect(countTokens(truncated)).toBeLessThanOrEqual(maxTokens);
    });

    it('should handle code truncation', () => {
      const code = 'function add(a, b) { return a + b; }';
      const maxTokens = 5;
      const truncated = truncateToTokenLimit(code, maxTokens);

      expect(countTokens(truncated)).toBeLessThanOrEqual(maxTokens);
      expect(truncated.length).toBeLessThan(code.length);
    });

    it('should work for very long text', () => {
      const longText = 'word '.repeat(1000);
      const maxTokens = 50;
      const truncated = truncateToTokenLimit(longText, maxTokens);

      expect(countTokens(truncated)).toBeLessThanOrEqual(maxTokens);
      expect(truncated.length).toBeLessThan(longText.length);
    });
  });

  describe('freeEncoder', () => {
    it('should free encoder resources', () => {
      // Use the encoder first
      countTokens('test');

      // Free it
      expect(() => freeEncoder()).not.toThrow();
    });

    it('should allow reuse after freeing', () => {
      // Use encoder
      const count1 = countTokens('test');

      // Free it
      freeEncoder();

      // Use again (should create new encoder)
      const count2 = countTokens('test');

      expect(count1).toBe(count2);
    });

    it('should not error when called multiple times', () => {
      freeEncoder();
      expect(() => freeEncoder()).not.toThrow();
    });

    it('should not error when called before any usage', () => {
      freeEncoder();
      expect(() => freeEncoder()).not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should accurately estimate tokens for a typical chat request', () => {
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful coding assistant.',
        },
        {
          role: 'user',
          content: 'Write a function to reverse a string in JavaScript',
        },
      ];

      const estimate = estimateRequestTokens(messages);

      // Should be reasonable for this request (~20-30 tokens)
      expect(estimate).toBeGreaterThan(15);
      expect(estimate).toBeLessThan(50);
    });

    it('should estimate higher for complex requests with tools', () => {
      const messages = [
        {
          role: 'user',
          content: 'What is the weather in San Francisco?',
        },
      ];

      const tools = [
        {
          function: {
            name: 'get_current_weather',
            description: 'Get the current weather in a given location',
            parameters: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city and state, e.g. San Francisco, CA',
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                },
              },
              required: ['location'],
            },
          },
        },
      ];

      const estimate = estimateRequestTokens(messages, tools);

      // Should be higher due to tool definition
      expect(estimate).toBeGreaterThan(50);
    });

    it('should handle conversation context estimation', () => {
      const conversation = [
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi! How can I help you today?' },
        { role: 'user', content: 'Tell me about TypeScript' },
        {
          role: 'assistant',
          content:
            'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
        },
        { role: 'user', content: 'Thanks!' },
      ];

      const estimate = estimateRequestTokens(conversation);

      // Should account for all messages
      expect(estimate).toBeGreaterThan(30);
    });
  });
});

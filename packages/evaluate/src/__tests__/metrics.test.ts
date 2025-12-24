/**
 * Tests for Evaluation Metrics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Accuracy } from '../evaluation/metrics/Accuracy.js';
import { Relevance } from '../evaluation/metrics/Relevance.js';
import { Coherence } from '../evaluation/metrics/Coherence.js';
import type { EvaluationInput, LLMProviderInterface } from '../types/index.js';

describe('Accuracy Metric', () => {
  describe('exact matching', () => {
    it('should return 1 for exact match', async () => {
      const metric = new Accuracy({ type: 'exact' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Hello World',
        expectedOutput: 'Hello World',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(1);
      expect(result.explanation).toContain('exactly matches');
    });

    it('should return 0 for non-match', async () => {
      const metric = new Accuracy({ type: 'exact' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Hello',
        expectedOutput: 'Goodbye',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(0);
    });

    it('should be case-insensitive by default', async () => {
      const metric = new Accuracy({ type: 'exact' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'HELLO WORLD',
        expectedOutput: 'hello world',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(1);
    });

    it('should respect case-sensitive option', async () => {
      const metric = new Accuracy({ type: 'exact', caseSensitive: true });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'HELLO',
        expectedOutput: 'hello',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(0);
    });

    it('should ignore whitespace by default', async () => {
      const metric = new Accuracy({ type: 'exact' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Hello    World',
        expectedOutput: 'Hello World',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(1);
    });

    it('should respect ignoreWhitespace option', async () => {
      const metric = new Accuracy({ type: 'exact', ignoreWhitespace: false });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Hello  World',
        expectedOutput: 'Hello World',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(0);
    });
  });

  describe('fuzzy matching', () => {
    it('should calculate similarity for similar strings', async () => {
      const metric = new Accuracy({ type: 'fuzzy' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Hello World',
        expectedOutput: 'Hello World!',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBeGreaterThan(0.9);
      expect(result.score).toBeLessThan(1);
    });

    it('should return 1 for identical strings', async () => {
      const metric = new Accuracy({ type: 'fuzzy' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Test',
        expectedOutput: 'Test',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(1);
    });

    it('should return 0 for empty strings', async () => {
      const metric = new Accuracy({ type: 'fuzzy' });
      const input: EvaluationInput = {
        input: 'Question',
        output: '',
        expectedOutput: 'Something',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(0);
    });

    it('should calculate low score for very different strings', async () => {
      const metric = new Accuracy({ type: 'fuzzy' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Complete different text',
        expectedOutput: 'abc',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBeLessThan(0.3);
    });
  });

  describe('semantic matching', () => {
    it('should fall back to fuzzy for semantic mode', async () => {
      const metric = new Accuracy({ type: 'semantic' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Hello World',
        expectedOutput: 'Hello World!',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBeGreaterThan(0);
      expect(result.explanation).toContain('approximated');
    });
  });

  describe('edge cases', () => {
    it('should handle missing expected output', async () => {
      const metric = new Accuracy({ type: 'exact' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Answer',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(1);
      expect(result.details?.skipped).toBe(true);
    });

    it('should include metadata in result', async () => {
      const metric = new Accuracy({ type: 'fuzzy' });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Short',
        expectedOutput: 'Longer answer',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.matchType).toBe('fuzzy');
      expect(result.details?.outputLength).toBeDefined();
      expect(result.details?.expectedLength).toBeDefined();
    });
  });
});

describe('Relevance Metric', () => {
  describe('heuristic evaluation', () => {
    it('should calculate keyword overlap', async () => {
      const metric = new Relevance();
      const input: EvaluationInput = {
        input: 'What is machine learning?',
        output: 'Machine learning is a subset of artificial intelligence',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBeGreaterThan(0);
      expect(result.details?.method).toBe('heuristic');
    });

    it('should detect question types', async () => {
      const metric = new Relevance();
      const input: EvaluationInput = {
        input: 'How does this work?',
        output: 'This works by using multiple steps',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.questionType).toBe('how');
    });

    it('should score yes/no questions appropriately', async () => {
      const metric = new Relevance();
      const input: EvaluationInput = {
        input: 'Is this correct?',
        output: 'Yes, that is correct',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should handle inputs with no keywords', async () => {
      const metric = new Relevance();
      const input: EvaluationInput = {
        input: 'a an the',
        output: 'some answer',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBe(1);
    });
  });

  describe('LLM evaluation', () => {
    it('should use LLM when provider is set', async () => {
      const mockProvider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'Score: 4\nThe response is highly relevant',
        })),
      };

      const metric = new Relevance();
      metric.setProvider(mockProvider);

      const input: EvaluationInput = {
        input: 'What is AI?',
        output: 'AI stands for Artificial Intelligence',
      };

      const result = await metric.evaluate(input);

      expect(mockProvider.complete).toHaveBeenCalled();
      expect(result.details?.method).toBe('llm');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should fall back to heuristic on LLM error', async () => {
      const mockProvider: LLMProviderInterface = {
        complete: vi.fn(async () => {
          throw new Error('LLM failed');
        }),
      };

      const metric = new Relevance();
      metric.setProvider(mockProvider);

      const input: EvaluationInput = {
        input: 'Question',
        output: 'Answer',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.llmError).toBeDefined();
      expect(result.details?.method).toBe('heuristic');
    });

    it('should use custom prompt when provided', async () => {
      const mockProvider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'Score: 5',
        })),
      };

      const customPrompt = 'Custom: {input} -> {output}';
      const metric = new Relevance({ prompt: customPrompt });
      metric.setProvider(mockProvider);

      const input: EvaluationInput = {
        input: 'test',
        output: 'answer',
      };

      await metric.evaluate(input);

      expect(mockProvider.complete).toHaveBeenCalled();
    });
  });
});

describe('Coherence Metric', () => {
  describe('structural coherence', () => {
    it('should give high score to well-structured text', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output:
          'This is a well-structured response. It has multiple sentences. Each sentence starts properly.',
      };

      const result = await metric.evaluate(input);

      expect(result.score).toBeGreaterThan(0.7);
    });

    it('should penalize incomplete sentences', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'This sentence is incomplete and ends with,',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.structural).toBeLessThan(1);
    });

    it('should detect unbalanced parentheses', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Text with (unbalanced parentheses.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.structural).toBeLessThan(1);
    });
  });

  describe('logical flow', () => {
    it('should recognize transition words', async () => {
      const metric = new Coherence({ checkLogicalFlow: true });
      const input: EvaluationInput = {
        input: 'Question',
        output:
          'First, we do this. Then, we do that. Finally, we complete the task. Therefore, the process is complete.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.logicalFlow).toBeGreaterThan(0.8);
    });

    it('should handle single sentence gracefully', async () => {
      const metric = new Coherence({ checkLogicalFlow: true });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Single sentence response.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.logicalFlow).toBe(1);
    });

    it('should penalize abrupt topic changes', async () => {
      const metric = new Coherence({ checkLogicalFlow: true });
      const input: EvaluationInput = {
        input: 'Question',
        output:
          'Machine learning is important. Pizza is delicious. The weather is nice today. Cars are fast.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.logicalFlow).toBeLessThan(1);
    });
  });

  describe('consistency checking', () => {
    it('should detect contradictions', async () => {
      const metric = new Coherence({ checkConsistency: true });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'This is correct. This is not correct.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.consistency).toBeLessThan(1);
    });

    it('should penalize repeated sentences', async () => {
      const metric = new Coherence({ checkConsistency: true });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'This is a sentence. This is a sentence. This is a sentence.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.consistency).toBeLessThan(1);
    });
  });

  describe('completeness', () => {
    it('should detect incomplete responses', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'The answer is',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.completeness).toBeLessThan(1);
    });

    it('should handle ellipsis', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'The answer is...',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.completeness).toBe(0.7);
    });

    it('should score complete responses highly', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'This is a complete response with proper ending.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.completeness).toBe(1);
    });

    it('should handle empty text', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: '',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.completeness).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should disable flow checking when configured', async () => {
      const metric = new Coherence({ checkLogicalFlow: false });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Test response.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.logicalFlow).toBeUndefined();
    });

    it('should disable consistency checking when configured', async () => {
      const metric = new Coherence({ checkConsistency: false });
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Test response.',
      };

      const result = await metric.evaluate(input);

      expect(result.details?.consistency).toBeUndefined();
    });
  });

  describe('explanation generation', () => {
    it('should provide helpful explanations', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'Incomplete sentence and',
      };

      const result = await metric.evaluate(input);

      expect(result.explanation).toBeTruthy();
      expect(result.explanation).toContain('Issues:');
    });

    it('should indicate when response is good', async () => {
      const metric = new Coherence();
      const input: EvaluationInput = {
        input: 'Question',
        output: 'This is a well-formed response. It has good structure.',
      };

      const result = await metric.evaluate(input);

      expect(result.explanation).toContain('coherent');
    });
  });
});

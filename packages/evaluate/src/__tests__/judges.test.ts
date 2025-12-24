/**
 * Tests for LLM Judges
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMJudge } from '../evaluation/judges/LLMJudge.js';
import type {
  LLMProviderInterface,
  EvaluationInput,
  JudgeCriterion,
} from '../types/index.js';

describe('LLMJudge', () => {
  let mockProvider: LLMProviderInterface;
  let criteria: JudgeCriterion[];

  beforeEach(() => {
    mockProvider = {
      complete: vi.fn(async () => ({
        content: 'Score: 4\nThe response is good quality.',
      })),
    };

    criteria = [
      {
        name: 'quality',
        prompt:
          'Evaluate the quality of this response:\nInput: {input}\nOutput: {output}',
        weight: 1,
      },
    ];
  });

  describe('constructor', () => {
    it('should create judge with provider and criteria', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'claude-sonnet-4',
        criteria,
      });

      expect(judge).toBeDefined();
      expect(judge.type).toBe('llm');
    });

    it('should throw error without provider', () => {
      expect(() => {
        new LLMJudge({
          provider: null as any,
          model: 'test',
          criteria,
        });
      }).toThrow('requires a provider');
    });

    it('should throw error without criteria', () => {
      expect(() => {
        new LLMJudge({
          provider: mockProvider,
          model: 'test',
          criteria: [],
        });
      }).toThrow('requires at least one criterion');
    });

    it('should accept custom system prompt', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria,
        systemPrompt: 'Custom system prompt',
      });

      expect(judge).toBeDefined();
    });

    it('should use default temperature when not provided', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria,
      });

      expect(judge).toBeDefined();
    });
  });

  describe('evaluate', () => {
    it('should evaluate with single criterion', async () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria,
      });

      const input: EvaluationInput = {
        input: 'What is AI?',
        output: 'AI is Artificial Intelligence',
      };

      const result = await judge.evaluate(input);

      expect(result.scores.quality).toBeDefined();
      expect(result.explanations.quality).toBeTruthy();
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should evaluate with multiple criteria', async () => {
      const multiCriteria: JudgeCriterion[] = [
        {
          name: 'accuracy',
          prompt: 'Rate accuracy: {input} -> {output}',
          weight: 2,
        },
        {
          name: 'clarity',
          prompt: 'Rate clarity: {output}',
          weight: 1,
        },
      ];

      const provider: LLMProviderInterface = {
        complete: vi
          .fn()
          .mockResolvedValueOnce({ content: 'Score: 5' })
          .mockResolvedValueOnce({ content: 'Score: 3' }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: multiCriteria,
      });

      const input: EvaluationInput = {
        input: 'Question',
        output: 'Answer',
      };

      const result = await judge.evaluate(input);

      expect(result.scores.accuracy).toBeDefined();
      expect(result.scores.clarity).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should calculate weighted average correctly', async () => {
      const weightedCriteria: JudgeCriterion[] = [
        { name: 'c1', prompt: 'test {output}', weight: 3 },
        { name: 'c2', prompt: 'test {output}', weight: 1 },
      ];

      const provider: LLMProviderInterface = {
        complete: vi
          .fn()
          .mockResolvedValueOnce({ content: 'Score: 5' }) // normalized to 1
          .mockResolvedValueOnce({ content: 'Score: 1' }), // normalized to 0
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: weightedCriteria,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      // (1 * 3 + 0 * 1) / (3 + 1) = 0.75
      expect(result.overallScore).toBeCloseTo(0.75);
    });

    it('should replace placeholders in prompts', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async (params) => {
          expect(params.messages[1].content).toContain('What is AI?');
          expect(params.messages[1].content).toContain('AI is intelligence');
          return { content: 'Score: 4' };
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          {
            name: 'test',
            prompt: 'Input: {input}\nOutput: {output}',
          },
        ],
      });

      await judge.evaluate({
        input: 'What is AI?',
        output: 'AI is intelligence',
      });

      expect(provider.complete).toHaveBeenCalled();
    });

    it('should handle expected output in prompts', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async (params) => {
          expect(params.messages[1].content).toContain(
            'Expected: correct answer',
          );
          return { content: 'Score: 5' };
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          {
            name: 'test',
            prompt: 'Output: {output}\nExpected: {expected}',
          },
        ],
      });

      await judge.evaluate({
        input: 'Question',
        output: 'Answer',
        expectedOutput: 'correct answer',
      });
    });

    it('should handle context in prompts', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async (params) => {
          expect(params.messages[1].content).toContain('Context 1');
          expect(params.messages[1].content).toContain('Context 2');
          return { content: 'Score: 4' };
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          {
            name: 'test',
            prompt: 'Context: {context}\nOutput: {output}',
          },
        ],
      });

      await judge.evaluate({
        input: 'Question',
        output: 'Answer',
        context: ['Context 1', 'Context 2'],
      });
    });

    it('should retry on failures', async () => {
      let attempts = 0;
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('LLM failed');
          }
          return { content: 'Score: 4' };
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
        maxRetries: 2,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(attempts).toBe(2);
      expect(result.scores.quality).toBeGreaterThan(0);
    });

    it('should return error after max retries', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => {
          throw new Error('LLM failed');
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
        maxRetries: 1,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.quality).toBe(0);
      expect(result.explanations.quality).toContain('failed');
    });

    it('should calculate confidence based on score consistency', async () => {
      const provider: LLMProviderInterface = {
        complete: vi
          .fn()
          .mockResolvedValueOnce({ content: 'Score: 5' })
          .mockResolvedValueOnce({ content: 'Score: 5' }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          { name: 'c1', prompt: 'test {output}' },
          { name: 'c2', prompt: 'test {output}' },
        ],
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('score parsing', () => {
    it('should parse score from "Score: X" format', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'Score: 4.5\nThe response is good.',
        })),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.quality).toBeGreaterThan(0);
    });

    it('should parse score from "Rating: X" format', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'Rating: 3\nNot bad.',
        })),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.quality).toBeGreaterThan(0);
    });

    it('should parse score from "X/5" format', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'The rating is 4/5',
        })),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.quality).toBeGreaterThan(0);
    });

    it('should normalize scores to 0-1 range', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'Score: 5',
        })),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          {
            name: 'test',
            prompt: 'test {output}',
            scoreRange: { min: 1, max: 5 },
          },
        ],
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.test).toBe(1);
    });

    it('should handle custom score ranges', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'Score: 50',
        })),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          {
            name: 'test',
            prompt: 'test {output}',
            scoreRange: { min: 0, max: 100 },
          },
        ],
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.test).toBe(0.5);
    });

    it('should default to 0.5 when score not found', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async () => ({
          content: 'No score in this response',
        })),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.scores.quality).toBe(0.5);
    });
  });

  describe('criteria management', () => {
    it('should add criterion', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria,
      });

      judge.addCriterion({
        name: 'new_criterion',
        prompt: 'test {output}',
      });

      const allCriteria = judge.getCriteria();
      expect(allCriteria).toHaveLength(2);
      expect(allCriteria.some((c) => c.name === 'new_criterion')).toBe(true);
    });

    it('should remove criterion', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria: [...criteria, { name: 'extra', prompt: 'test {output}' }],
      });

      const removed = judge.removeCriterion('extra');

      expect(removed).toBe(true);
      expect(judge.getCriteria()).toHaveLength(1);
    });

    it('should return false when removing non-existent criterion', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria,
      });

      const removed = judge.removeCriterion('nonexistent');

      expect(removed).toBe(false);
    });

    it('should return copy of criteria', () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria,
      });

      const criteriaCopy = judge.getCriteria();
      criteriaCopy.push({ name: 'new', prompt: 'test {output}' });

      expect(judge.getCriteria()).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle single criterion with default weight', async () => {
      const judge = new LLMJudge({
        provider: mockProvider,
        model: 'test',
        criteria: [{ name: 'test', prompt: 'test {output}' }],
      });

      const result = await judge.evaluate({
        input: 'test',
        output: 'test',
      });

      expect(result.overallScore).toBeDefined();
    });

    it('should handle reference in prompts', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async (params) => {
          expect(params.messages[1].content).toContain('Reference text');
          return { content: 'Score: 4' };
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria: [
          {
            name: 'test',
            prompt: 'Reference: {reference}\nOutput: {output}',
          },
        ],
      });

      await judge.evaluate({
        input: 'Question',
        output: 'Answer',
        reference: 'Reference text',
      });
    });

    it('should use configured temperature', async () => {
      const provider: LLMProviderInterface = {
        complete: vi.fn(async (params) => {
          expect(params.temperature).toBe(0.5);
          return { content: 'Score: 4' };
        }),
      };

      const judge = new LLMJudge({
        provider,
        model: 'test',
        criteria,
        temperature: 0.5,
      });

      await judge.evaluate({
        input: 'test',
        output: 'test',
      });
    });
  });
});

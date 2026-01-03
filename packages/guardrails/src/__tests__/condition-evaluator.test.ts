import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateConditionGroup,
  evaluate,
  ConditionEvaluator,
} from '../rules/condition-evaluator.js';
import type { Condition, ConditionGroup, RuleContext } from '../types/index.js';

// Helper to create a rule context
function createContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    input: 'test input',
    type: 'input',
    timestamp: new Date(),
    guardResults: {},
    metadata: {},
    variables: {},
    ...overrides,
  };
}

describe('ConditionEvaluator', () => {
  describe('evaluateCondition', () => {
    describe('equals operator', () => {
      it('should match equal strings', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'equals',
          value: 'test input',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match different strings', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'equals',
          value: 'different',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });

      it('should support case-insensitive comparison', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'equals',
          value: 'TEST INPUT',
          caseInsensitive: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });
    });

    describe('not_equals operator', () => {
      it('should match when values are different', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'not_equals',
          value: 'different',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when values are equal', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'not_equals',
          value: 'test input',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('should match when string contains substring', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'contains',
          value: 'test',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when substring is missing', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'contains',
          value: 'xyz',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });

      it('should work with arrays', () => {
        const context = createContext({
          variables: { tags: ['a', 'b', 'c'] },
        });
        const condition: Condition = {
          field: 'tags',
          operator: 'contains',
          value: 'b',
        };
        const result = evaluateCondition(condition, context);
        expect(result).toBe(true);
      });
    });

    describe('not_contains operator', () => {
      it('should match when string does not contain substring', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'not_contains',
          value: 'xyz',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when substring is present', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'not_contains',
          value: 'test',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('starts_with operator', () => {
      it('should match when string starts with prefix', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'starts_with',
          value: 'test',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when string does not start with prefix', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'starts_with',
          value: 'input',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('ends_with operator', () => {
      it('should match when string ends with suffix', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'ends_with',
          value: 'input',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when string does not end with suffix', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'ends_with',
          value: 'test',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('matches operator', () => {
      it('should match regex patterns', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'matches',
          value: '^test.*$',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match non-matching patterns', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'matches',
          value: '^foo.*$',
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });

      it('should support case-insensitive regex', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'matches',
          value: '^TEST.*$',
          caseInsensitive: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });
    });

    describe('numeric operators', () => {
      const numericContext = createContext({
        variables: { count: 10 },
      });

      it('gt should match when greater', () => {
        const condition: Condition = {
          field: 'count',
          operator: 'gt',
          value: 5,
        };
        expect(evaluateCondition(condition, numericContext)).toBe(true);
      });

      it('gt should not match when equal', () => {
        const condition: Condition = {
          field: 'count',
          operator: 'gt',
          value: 10,
        };
        expect(evaluateCondition(condition, numericContext)).toBe(false);
      });

      it('gte should match when equal', () => {
        const condition: Condition = {
          field: 'count',
          operator: 'gte',
          value: 10,
        };
        expect(evaluateCondition(condition, numericContext)).toBe(true);
      });

      it('lt should match when less', () => {
        const condition: Condition = {
          field: 'count',
          operator: 'lt',
          value: 15,
        };
        expect(evaluateCondition(condition, numericContext)).toBe(true);
      });

      it('lt should not match when equal', () => {
        const condition: Condition = {
          field: 'count',
          operator: 'lt',
          value: 10,
        };
        expect(evaluateCondition(condition, numericContext)).toBe(false);
      });

      it('lte should match when equal', () => {
        const condition: Condition = {
          field: 'count',
          operator: 'lte',
          value: 10,
        };
        expect(evaluateCondition(condition, numericContext)).toBe(true);
      });
    });

    describe('in operator', () => {
      it('should match when value is in array', () => {
        const condition: Condition = {
          field: 'type',
          operator: 'in',
          value: ['input', 'output'],
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when value is not in array', () => {
        const condition: Condition = {
          field: 'type',
          operator: 'in',
          value: ['foo', 'bar'],
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('not_in operator', () => {
      it('should match when value is not in array', () => {
        const condition: Condition = {
          field: 'type',
          operator: 'not_in',
          value: ['foo', 'bar'],
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when value is in array', () => {
        const condition: Condition = {
          field: 'type',
          operator: 'not_in',
          value: ['input', 'output'],
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('exists operator', () => {
      it('should match when field exists', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'exists',
          value: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when field does not exist', () => {
        const condition: Condition = {
          field: 'nonexistent',
          operator: 'exists',
          value: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('not_exists operator', () => {
      it('should match when field does not exist', () => {
        const condition: Condition = {
          field: 'nonexistent',
          operator: 'not_exists',
          value: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(true);
      });

      it('should not match when field exists', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'not_exists',
          value: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });

    describe('nested fields', () => {
      it('should access nested fields with dot notation', () => {
        const context = createContext({
          metadata: { user: { role: 'admin' } },
        });
        const condition: Condition = {
          field: 'user.role',
          operator: 'equals',
          value: 'admin',
        };
        const result = evaluateCondition(condition, context);
        expect(result).toBe(true);
      });
    });

    describe('negate option', () => {
      it('should negate the result when negate is true', () => {
        const condition: Condition = {
          field: 'input',
          operator: 'equals',
          value: 'test input',
          negate: true,
        };
        const result = evaluateCondition(condition, createContext());
        expect(result).toBe(false);
      });
    });
  });

  describe('evaluateConditionGroup', () => {
    describe('and operator', () => {
      it('should return true when all conditions match', () => {
        const group: ConditionGroup = {
          operator: 'and',
          conditions: [
            { field: 'type', operator: 'equals', value: 'input' },
            { field: 'input', operator: 'contains', value: 'test' },
          ],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(true);
      });

      it('should return false when any condition fails', () => {
        const group: ConditionGroup = {
          operator: 'and',
          conditions: [
            { field: 'type', operator: 'equals', value: 'input' },
            { field: 'input', operator: 'contains', value: 'xyz' },
          ],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(false);
      });
    });

    describe('or operator', () => {
      it('should return true when any condition matches', () => {
        const group: ConditionGroup = {
          operator: 'or',
          conditions: [
            { field: 'type', operator: 'equals', value: 'output' },
            { field: 'input', operator: 'contains', value: 'test' },
          ],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(true);
      });

      it('should return false when all conditions fail', () => {
        const group: ConditionGroup = {
          operator: 'or',
          conditions: [
            { field: 'type', operator: 'equals', value: 'output' },
            { field: 'input', operator: 'contains', value: 'xyz' },
          ],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(false);
      });
    });

    describe('not operator', () => {
      it('should negate the first condition result', () => {
        const group: ConditionGroup = {
          operator: 'not',
          conditions: [{ field: 'type', operator: 'equals', value: 'output' }],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(true);
      });
    });

    describe('empty conditions', () => {
      it('should return true for empty condition group', () => {
        const group: ConditionGroup = {
          operator: 'and',
          conditions: [],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(true);
      });
    });

    describe('nested groups', () => {
      it('should evaluate nested condition groups', () => {
        const group: ConditionGroup = {
          operator: 'and',
          conditions: [
            { field: 'type', operator: 'equals', value: 'input' },
            {
              operator: 'or',
              conditions: [
                { field: 'input', operator: 'contains', value: 'foo' },
                { field: 'input', operator: 'contains', value: 'test' },
              ],
            },
          ],
        };
        const result = evaluateConditionGroup(group, createContext());
        expect(result).toBe(true);
      });
    });
  });

  describe('evaluate', () => {
    it('should evaluate a single condition', () => {
      const condition: Condition = {
        field: 'type',
        operator: 'equals',
        value: 'input',
      };
      const result = evaluate(condition, createContext());
      expect(result).toBe(true);
    });

    it('should evaluate a condition group', () => {
      const group: ConditionGroup = {
        operator: 'and',
        conditions: [{ field: 'type', operator: 'equals', value: 'input' }],
      };
      const result = evaluate(group, createContext());
      expect(result).toBe(true);
    });
  });

  describe('ConditionEvaluator class', () => {
    it('should provide class-based API', () => {
      const evaluator = new ConditionEvaluator();
      const context = createContext();

      const condition: Condition = {
        field: 'type',
        operator: 'equals',
        value: 'input',
      };

      expect(evaluator.evaluateCondition(condition, context)).toBe(true);
    });

    it('should evaluate condition groups', () => {
      const evaluator = new ConditionEvaluator();
      const context = createContext();

      const group: ConditionGroup = {
        operator: 'and',
        conditions: [{ field: 'type', operator: 'equals', value: 'input' }],
      };

      expect(evaluator.evaluateConditionGroup(group, context)).toBe(true);
    });

    it('should evaluate via main evaluate method', () => {
      const evaluator = new ConditionEvaluator();
      const context = createContext();

      const condition: Condition = {
        field: 'type',
        operator: 'equals',
        value: 'input',
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });
  });
});

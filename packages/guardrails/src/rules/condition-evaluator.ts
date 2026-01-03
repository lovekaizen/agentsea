/**
 * Condition Evaluator
 *
 * Evaluates rule conditions against context.
 */

import type {
  Condition,
  ConditionGroup,
  ConditionOperator,
  RuleContext,
} from '../types';

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Compare values based on operator
 */
function compareValues(
  actual: unknown,
  expected: unknown,
  operator: ConditionOperator,
  caseInsensitive = false,
): boolean {
  // Handle string case sensitivity
  let actualValue = actual;
  let expectedValue = expected;

  if (caseInsensitive && typeof actual === 'string') {
    actualValue = actual.toLowerCase();
  }
  if (caseInsensitive && typeof expected === 'string') {
    expectedValue = expected.toLowerCase();
  }

  switch (operator) {
    case 'equals':
      return actualValue === expectedValue;

    case 'not_equals':
      return actualValue !== expectedValue;

    case 'contains':
      if (
        typeof actualValue === 'string' &&
        typeof expectedValue === 'string'
      ) {
        return actualValue.includes(expectedValue);
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue);
      }
      return false;

    case 'not_contains':
      if (
        typeof actualValue === 'string' &&
        typeof expectedValue === 'string'
      ) {
        return !actualValue.includes(expectedValue);
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(expectedValue);
      }
      return true;

    case 'starts_with':
      if (
        typeof actualValue === 'string' &&
        typeof expectedValue === 'string'
      ) {
        return actualValue.startsWith(expectedValue);
      }
      return false;

    case 'ends_with':
      if (
        typeof actualValue === 'string' &&
        typeof expectedValue === 'string'
      ) {
        return actualValue.endsWith(expectedValue);
      }
      return false;

    case 'matches':
      if (
        typeof actualValue === 'string' &&
        typeof expectedValue === 'string'
      ) {
        const flags = caseInsensitive ? 'gi' : 'g';
        const regex = new RegExp(expectedValue, flags);
        return regex.test(actualValue);
      }
      return false;

    case 'gt':
      if (
        typeof actualValue === 'number' &&
        typeof expectedValue === 'number'
      ) {
        return actualValue > expectedValue;
      }
      return false;

    case 'gte':
      if (
        typeof actualValue === 'number' &&
        typeof expectedValue === 'number'
      ) {
        return actualValue >= expectedValue;
      }
      return false;

    case 'lt':
      if (
        typeof actualValue === 'number' &&
        typeof expectedValue === 'number'
      ) {
        return actualValue < expectedValue;
      }
      return false;

    case 'lte':
      if (
        typeof actualValue === 'number' &&
        typeof expectedValue === 'number'
      ) {
        return actualValue <= expectedValue;
      }
      return false;

    case 'in':
      if (Array.isArray(expectedValue)) {
        return expectedValue.includes(actualValue);
      }
      return false;

    case 'not_in':
      if (Array.isArray(expectedValue)) {
        return !expectedValue.includes(actualValue);
      }
      return true;

    case 'exists':
      return actualValue !== undefined && actualValue !== null;

    case 'not_exists':
      return actualValue === undefined || actualValue === null;

    default:
      return false;
  }
}

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: Condition,
  context: RuleContext,
): boolean {
  // Build evaluation context with all available fields
  const evalContext: Record<string, unknown> = {
    input: context.input,
    type: context.type,
    sessionId: context.sessionId,
    userId: context.userId,
    ...context.metadata,
    ...context.variables,
    guardResults: context.guardResults,
    timestamp: context.timestamp.getTime(),
  };

  // Get field value
  const actualValue = getNestedValue(evalContext, condition.field);

  // Evaluate
  let result = compareValues(
    actualValue,
    condition.value,
    condition.operator,
    condition.caseInsensitive,
  );

  // Apply negation
  if (condition.negate) {
    result = !result;
  }

  return result;
}

/**
 * Evaluate a condition group
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  context: RuleContext,
): boolean {
  if (group.conditions.length === 0) {
    return true;
  }

  const results = group.conditions.map((condition) => {
    if ('operator' in condition && 'conditions' in condition) {
      // Nested condition group
      return evaluateConditionGroup(condition, context);
    } else {
      // Single condition
      return evaluateCondition(condition, context);
    }
  });

  switch (group.operator) {
    case 'and':
      return results.every((r) => r);
    case 'or':
      return results.some((r) => r);
    case 'not':
      return !results[0];
    default:
      return false;
  }
}

/**
 * Evaluate conditions (either single or group)
 */
export function evaluate(
  conditions: Condition | ConditionGroup,
  context: RuleContext,
): boolean {
  if ('operator' in conditions && 'conditions' in conditions) {
    return evaluateConditionGroup(conditions, context);
  }
  return evaluateCondition(conditions, context);
}

/**
 * Condition Evaluator class
 */
export class ConditionEvaluator {
  /**
   * Evaluate conditions against context
   */
  evaluate(
    conditions: Condition | ConditionGroup,
    context: RuleContext,
  ): boolean {
    return evaluate(conditions, context);
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition: Condition, context: RuleContext): boolean {
    return evaluateCondition(condition, context);
  }

  /**
   * Evaluate a condition group
   */
  evaluateConditionGroup(group: ConditionGroup, context: RuleContext): boolean {
    return evaluateConditionGroup(group, context);
  }
}

export default ConditionEvaluator;

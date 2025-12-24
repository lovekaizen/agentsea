/**
 * Rules Engine
 *
 * JSON-based rules engine for dynamic guardrails configuration.
 */

import type {
  Rule,
  RuleSet,
  RuleContext,
  RuleEvaluationResult,
  RuleSetEvaluationResult,
  RulesEngineConfig,
  CustomActionHandler,
  GuardAction,
  GuardContext,
} from '../types';
import { ConditionEvaluator } from './condition-evaluator';
import { ActionExecutor } from './action-executor';

/**
 * Rules Engine
 *
 * Evaluates JSON-based rules against content.
 *
 * @example
 * ```typescript
 * const engine = new RulesEngine({
 *   ruleSets: [{
 *     id: 'security',
 *     name: 'Security Rules',
 *     version: '1.0.0',
 *     rules: [{
 *       id: 'block-sql',
 *       name: 'Block SQL Injection',
 *       priority: 100,
 *       enabled: true,
 *       conditions: {
 *         field: 'input',
 *         operator: 'matches',
 *         value: '(SELECT|INSERT|UPDATE|DELETE|DROP).*FROM',
 *         caseInsensitive: true,
 *       },
 *       actions: [{ type: 'block', message: 'SQL injection detected' }],
 *     }],
 *   }],
 * });
 *
 * const result = await engine.evaluate('SELECT * FROM users');
 * ```
 */
export class RulesEngine {
  private ruleSets: Map<string, RuleSet> = new Map();
  private conditionEvaluator: ConditionEvaluator;
  private actionExecutor: ActionExecutor;
  private defaultAction: GuardAction;

  constructor(config: RulesEngineConfig = {}) {
    this.conditionEvaluator = new ConditionEvaluator();
    this.actionExecutor = new ActionExecutor(config.customHandlers);
    this.defaultAction = config.defaultAction ?? 'allow';

    // Load rule sets
    if (config.ruleSets) {
      for (const ruleSet of config.ruleSets) {
        this.addRuleSet(ruleSet);
      }
    }
  }

  /**
   * Add a rule set
   */
  addRuleSet(ruleSet: RuleSet): void {
    // Sort rules by priority (descending)
    const sortedRules = [...ruleSet.rules].sort(
      (a, b) => b.priority - a.priority,
    );
    this.ruleSets.set(ruleSet.id, { ...ruleSet, rules: sortedRules });
  }

  /**
   * Remove a rule set
   */
  removeRuleSet(id: string): boolean {
    return this.ruleSets.delete(id);
  }

  /**
   * Get a rule set
   */
  getRuleSet(id: string): RuleSet | undefined {
    return this.ruleSets.get(id);
  }

  /**
   * Get all rule sets
   */
  getAllRuleSets(): RuleSet[] {
    return Array.from(this.ruleSets.values());
  }

  /**
   * Add a rule to a rule set
   */
  addRule(ruleSetId: string, rule: Rule): void {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) {
      throw new Error(`Rule set '${ruleSetId}' not found`);
    }

    // Add and re-sort
    const rules = [...ruleSet.rules, rule].sort(
      (a, b) => b.priority - a.priority,
    );
    this.ruleSets.set(ruleSetId, { ...ruleSet, rules });
  }

  /**
   * Remove a rule from a rule set
   */
  removeRule(ruleSetId: string, ruleId: string): boolean {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) return false;

    const rules = ruleSet.rules.filter((r) => r.id !== ruleId);
    if (rules.length === ruleSet.rules.length) return false;

    this.ruleSets.set(ruleSetId, { ...ruleSet, rules });
    return true;
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleSetId: string, ruleId: string, enabled: boolean): boolean {
    const ruleSet = this.ruleSets.get(ruleSetId);
    if (!ruleSet) return false;

    const rule = ruleSet.rules.find((r) => r.id === ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    return true;
  }

  /**
   * Register a custom action handler
   */
  registerCustomHandler(name: string, handler: CustomActionHandler): void {
    this.actionExecutor.registerHandler(name, handler);
  }

  /**
   * Evaluate all rule sets against content
   */
  async evaluate(
    input: string,
    context?: Partial<GuardContext>,
  ): Promise<{
    passed: boolean;
    action: GuardAction;
    results: RuleSetEvaluationResult[];
    message?: string;
    transformedContent?: string;
  }> {
    const fullContext: RuleContext = {
      input,
      type: context?.type ?? 'input',
      sessionId: context?.sessionId,
      userId: context?.userId,
      metadata: context?.metadata,
      timestamp: context?.timestamp ?? new Date(),
      guardResults: [],
      variables: {},
    };

    const results: RuleSetEvaluationResult[] = [];
    let finalAction: GuardAction = this.defaultAction;
    let transformedContent: string | undefined;
    let message: string | undefined;

    for (const ruleSet of this.ruleSets.values()) {
      const result = await this.evaluateRuleSet(ruleSet, fullContext);
      results.push(result);

      // Update final action based on priority
      if (result.finalAction === 'block') {
        finalAction = 'block';
        message = result.message;
        break; // Stop on block
      } else if (result.finalAction === 'transform') {
        finalAction = 'transform';
        // Continue to apply more transformations
      } else if (result.finalAction === 'warn' && finalAction !== 'transform') {
        finalAction = 'warn';
        message = result.message;
      }
    }

    return {
      passed: finalAction !== 'block',
      action: finalAction,
      results,
      message,
      transformedContent,
    };
  }

  /**
   * Evaluate a single rule set
   */
  async evaluateRuleSet(
    ruleSet: RuleSet,
    context: RuleContext,
  ): Promise<RuleSetEvaluationResult> {
    const startTime = Date.now();
    const ruleResults: RuleEvaluationResult[] = [];
    let matchedCount = 0;
    let finalAction: GuardAction = ruleSet.defaultAction ?? this.defaultAction;
    let message: string | undefined;

    for (const rule of ruleSet.rules) {
      if (!rule.enabled) continue;

      const result = await this.evaluateRule(rule, context);
      ruleResults.push(result);

      if (result.matched) {
        matchedCount++;

        // Execute actions and get guard action
        const actionResults = await this.actionExecutor.executeActions(
          result.actionsExecuted,
          { ...context, currentRule: rule },
        );

        const guardAction =
          this.actionExecutor.getFinalGuardAction(actionResults);

        // Update final action
        if (guardAction === 'block') {
          finalAction = 'block';
          message = rule.name;
          if (ruleSet.stopOnFirstMatch) break;
        } else if (guardAction === 'transform') {
          finalAction = 'transform';
        } else if (
          guardAction === 'warn' &&
          finalAction !== 'transform' &&
          finalAction !== 'block'
        ) {
          finalAction = 'warn';
          message = rule.name;
        }

        if (ruleSet.stopOnFirstMatch) break;
      }
    }

    return {
      ruleSetId: ruleSet.id,
      ruleResults,
      finalAction,
      totalLatencyMs: Date.now() - startTime,
      matchedCount,
      message,
    };
  }

  /**
   * Evaluate a single rule
   */
  async evaluateRule(
    rule: Rule,
    context: RuleContext,
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    try {
      const matched = this.conditionEvaluator.evaluate(
        rule.conditions,
        context,
      );

      return Promise.resolve({
        ruleId: rule.id,
        ruleName: rule.name,
        matched,
        actionsExecuted: matched ? rule.actions : [],
        latencyMs: Date.now() - startTime,
      });
    } catch (error) {
      return Promise.resolve({
        ruleId: rule.id,
        ruleName: rule.name,
        matched: false,
        actionsExecuted: [],
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

/**
 * Create a rules engine
 */
export function createRulesEngine(config?: RulesEngineConfig): RulesEngine {
  return new RulesEngine(config);
}

export default RulesEngine;

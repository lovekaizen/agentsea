/**
 * Action Executor
 *
 * Executes rule actions.
 */

import type {
  RuleAction,
  RuleActionType,
  RuleContext,
  CustomActionHandler,
  GuardAction,
} from '../types';

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  /** Action that was executed */
  action: RuleAction;
  /** Whether execution was successful */
  success: boolean;
  /** Result data */
  data?: unknown;
  /** Error if failed */
  error?: Error;
  /** Transformed content (for transform actions) */
  transformedContent?: string;
  /** Guard action to take */
  guardAction?: GuardAction;
}

/**
 * Built-in action handlers
 */
const BUILTIN_HANDLERS: Record<
  RuleActionType,
  (action: RuleAction, context: RuleContext) => Promise<ActionExecutionResult>
> = {
  allow: (action, _context) =>
    Promise.resolve({
      action,
      success: true,
      guardAction: 'allow',
    }),

  block: (action, _context) =>
    Promise.resolve({
      action,
      success: true,
      guardAction: 'block',
      data: { reason: action.message ?? 'Blocked by rule' },
    }),

  transform: (action, context) => {
    const { params } = action;
    let content = context.input;

    if (params?.replace && typeof params.replace === 'object') {
      const replace = params.replace as {
        pattern: string;
        replacement: string;
      };
      const regex = new RegExp(replace.pattern, 'g');
      content = content.replace(regex, replace.replacement);
    }

    if (params?.mask && typeof params.mask === 'object') {
      const mask = params.mask as { pattern: string; maskChar?: string };
      const regex = new RegExp(mask.pattern, 'g');
      content = content.replace(regex, (match) =>
        (mask.maskChar ?? '*').repeat(match.length),
      );
    }

    if (params?.truncate && typeof params.truncate === 'number') {
      content = content.slice(0, params.truncate);
    }

    return Promise.resolve({
      action,
      success: true,
      guardAction: 'transform',
      transformedContent: content,
    });
  },

  warn: (action, _context) =>
    Promise.resolve({
      action,
      success: true,
      guardAction: 'warn',
      data: { warning: action.message ?? 'Warning from rule' },
    }),

  log: (action, context) => {
    const logData = {
      timestamp: new Date().toISOString(),
      rule: context.currentRule?.name,
      action: 'log',
      message: action.message,
      params: action.params,
      context: {
        input: context.input.slice(0, 100),
        type: context.type,
        sessionId: context.sessionId,
        userId: context.userId,
      },
    };

    // Log to console (in production, this would go to a logging service)
    console.log('[Guardrails Rule Log]', JSON.stringify(logData));

    return Promise.resolve({
      action,
      success: true,
      data: logData,
    });
  },

  notify: (action, context) => {
    const notifyData = {
      timestamp: new Date().toISOString(),
      rule: context.currentRule?.name,
      message: action.message,
      params: action.params,
      severity: action.params?.severity ?? 'info',
    };

    // In production, this would send to a notification service
    console.warn('[Guardrails Notification]', JSON.stringify(notifyData));

    return Promise.resolve({
      action,
      success: true,
      data: notifyData,
    });
  },

  custom: (action, _context) =>
    Promise.resolve({
      action,
      success: false,
      error: new Error('Custom handler not provided'),
    }),
};

/**
 * Action Executor
 *
 * Executes rule actions with support for custom handlers.
 */
export class ActionExecutor {
  private customHandlers: Map<string, CustomActionHandler>;

  constructor(customHandlers?: Record<string, CustomActionHandler>) {
    this.customHandlers = new Map(Object.entries(customHandlers ?? {}));
  }

  /**
   * Register a custom action handler
   */
  registerHandler(name: string, handler: CustomActionHandler): void {
    this.customHandlers.set(name, handler);
  }

  /**
   * Unregister a custom action handler
   */
  unregisterHandler(name: string): void {
    this.customHandlers.delete(name);
  }

  /**
   * Execute a single action
   */
  async executeAction(
    action: RuleAction,
    context: RuleContext,
  ): Promise<ActionExecutionResult> {
    try {
      // Check for custom handler
      if (action.type === 'custom' && action.handler) {
        const handler = this.customHandlers.get(action.handler);
        if (handler) {
          await handler(action, context);
          return {
            action,
            success: true,
            data: { handler: action.handler },
          };
        }
        return {
          action,
          success: false,
          error: new Error(`Custom handler '${action.handler}' not found`),
        };
      }

      // Use built-in handler
      const handler = BUILTIN_HANDLERS[action.type];
      if (handler) {
        return handler(action, context);
      }

      return {
        action,
        success: false,
        error: new Error(`Unknown action type: ${action.type}`),
      };
    } catch (error) {
      return {
        action,
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute multiple actions
   */
  async executeActions(
    actions: RuleAction[],
    context: RuleContext,
  ): Promise<ActionExecutionResult[]> {
    const results: ActionExecutionResult[] = [];

    for (const action of actions) {
      const result = await this.executeAction(action, context);
      results.push(result);

      // Stop on blocking actions if configured
      if (result.guardAction === 'block') {
        break;
      }
    }

    return results;
  }

  /**
   * Get the final guard action from action results
   */
  getFinalGuardAction(results: ActionExecutionResult[]): GuardAction {
    // Priority: block > transform > warn > allow
    for (const result of results) {
      if (result.guardAction === 'block') return 'block';
    }
    for (const result of results) {
      if (result.guardAction === 'transform') return 'transform';
    }
    for (const result of results) {
      if (result.guardAction === 'warn') return 'warn';
    }
    return 'allow';
  }

  /**
   * Get transformed content from results
   */
  getTransformedContent(results: ActionExecutionResult[]): string | undefined {
    // Apply transformations in order
    let content: string | undefined;
    for (const result of results) {
      if (result.transformedContent) {
        content = result.transformedContent;
      }
    }
    return content;
  }
}

export default ActionExecutor;

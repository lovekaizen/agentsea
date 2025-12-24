/**
 * Base Guard
 *
 * Abstract base class for all guardrails guards.
 * Provides common functionality and helper methods.
 */

import type {
  Guard,
  GuardConfig,
  GuardContext,
  GuardResult,
  GuardAction,
  ContentType,
  DetectionDetail,
} from '../types';

/**
 * Default guard configuration
 */
const DEFAULT_CONFIG: GuardConfig = {
  name: 'base-guard',
  enabled: true,
  onFailure: 'block',
  threshold: 0.5,
  sensitivity: 'medium',
};

/**
 * Abstract base class for guards
 *
 * Extend this class to create custom guards. Implement the abstract
 * `doCheck` method to provide the guard's specific logic.
 *
 * @example
 * ```typescript
 * class MyGuard extends BaseGuard<void, MyDetails> {
 *   readonly name = 'my-guard';
 *   readonly supportedTypes: ContentType[] = ['input', 'output'];
 *
 *   protected async doCheck(context: GuardContext): Promise<GuardResult<MyDetails>> {
 *     // Your guard logic here
 *     if (isValid(context.input)) {
 *       return this.pass();
 *     }
 *     return this.fail('Content is invalid');
 *   }
 * }
 * ```
 */
export abstract class BaseGuard<TInput = unknown, TOutput = unknown>
  implements Guard<TInput, TOutput>
{
  /** Unique guard name */
  abstract readonly name: string;

  /** Content types this guard supports */
  abstract readonly supportedTypes: ContentType[];

  /** Guard configuration */
  readonly config: GuardConfig;

  /** Start time for latency tracking */
  private startTime: number = 0;

  constructor(config: Partial<GuardConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      name: config.name ?? DEFAULT_CONFIG.name,
    };
  }

  /**
   * Check content against this guard
   *
   * This is the main entry point. It handles timing, validation,
   * and calls the abstract `doCheck` method for the actual logic.
   */
  async check(context: GuardContext<TInput>): Promise<GuardResult<TOutput>> {
    this.startTime = Date.now();

    // Validate context type is supported
    if (!this.supportsType(context.type)) {
      return this.skip(`Guard does not support content type: ${context.type}`);
    }

    // Check if guard is enabled
    if (!this.config.enabled) {
      return this.skip('Guard is disabled');
    }

    try {
      const result = await this.doCheck(context);
      return {
        ...result,
        latencyMs: this.getLatency(),
        timestamp: new Date(),
      };
    } catch (error) {
      return this.error(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Implement this method to provide the guard's specific checking logic
   */
  protected abstract doCheck(
    context: GuardContext<TInput>,
  ): Promise<GuardResult<TOutput>>;

  /**
   * Optional transformation function
   * Override to provide content transformation
   */
  transform(content: string, _context: GuardContext<TInput>): Promise<string> {
    return Promise.resolve(content);
  }

  /**
   * Check if this guard supports a content type
   */
  protected supportsType(type: ContentType): boolean {
    return (
      this.supportedTypes.includes(type) || this.supportedTypes.includes('both')
    );
  }

  /**
   * Create a passing result
   */
  protected pass(details?: TOutput, message?: string): GuardResult<TOutput> {
    return {
      passed: true,
      guardName: this.name,
      action: 'allow',
      message: message ?? 'Check passed',
      details,
      latencyMs: this.getLatency(),
      timestamp: new Date(),
    };
  }

  /**
   * Create a failing result
   */
  protected fail(
    message: string,
    details?: TOutput,
    detections?: DetectionDetail[],
  ): GuardResult<TOutput> {
    return {
      passed: false,
      guardName: this.name,
      action: this.config.onFailure,
      message,
      details,
      detections,
      latencyMs: this.getLatency(),
      timestamp: new Date(),
    };
  }

  /**
   * Create a warning result (passes but with a warning)
   */
  protected warn(
    message: string,
    details?: TOutput,
    detections?: DetectionDetail[],
  ): GuardResult<TOutput> {
    return {
      passed: true,
      guardName: this.name,
      action: 'warn',
      message,
      details,
      detections,
      latencyMs: this.getLatency(),
      timestamp: new Date(),
    };
  }

  /**
   * Create a transform result
   */
  protected transformed(
    transformedContent: string,
    details?: TOutput,
    message?: string,
  ): GuardResult<TOutput> {
    return {
      passed: true,
      guardName: this.name,
      action: 'transform',
      message: message ?? 'Content was transformed',
      details,
      transformedContent,
      latencyMs: this.getLatency(),
      timestamp: new Date(),
    };
  }

  /**
   * Create a skip result (when guard doesn't apply)
   */
  protected skip(reason: string): GuardResult<TOutput> {
    return {
      passed: true,
      guardName: this.name,
      action: 'allow',
      message: reason,
      latencyMs: this.getLatency(),
      timestamp: new Date(),
    };
  }

  /**
   * Create an error result
   */
  protected error(error: Error): GuardResult<TOutput> {
    // In fail-safe mode, errors should not block
    const action: GuardAction =
      this.config.onFailure === 'warn' ? 'warn' : 'block';

    return {
      passed: false,
      guardName: this.name,
      action,
      message: `Guard error: ${error.message}`,
      latencyMs: this.getLatency(),
      timestamp: new Date(),
    };
  }

  /**
   * Create a result with confidence score
   */
  protected withConfidence(
    result: GuardResult<TOutput>,
    confidence: number,
  ): GuardResult<TOutput> {
    const threshold = this.config.threshold ?? 0.5;

    // If confidence is below threshold, treat as pass
    if (confidence < threshold && !result.passed) {
      return {
        ...result,
        passed: true,
        action: 'allow',
        confidence,
        message: `${result.message} (below threshold: ${confidence.toFixed(2)} < ${threshold})`,
      };
    }

    return {
      ...result,
      confidence,
    };
  }

  /**
   * Get latency since check started
   */
  private getLatency(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Create a guard from a simple check function
 */
export function createGuard<TOutput = unknown>(options: {
  name: string;
  supportedTypes: ContentType[];
  check: (context: GuardContext) => Promise<GuardResult<TOutput>>;
  transform?: (content: string, context: GuardContext) => Promise<string>;
  config?: Partial<GuardConfig>;
}): Guard<unknown, TOutput> {
  const { name, supportedTypes, check, transform, config } = options;

  return {
    name,
    config: {
      name,
      enabled: true,
      onFailure: 'block',
      ...config,
    },
    supportedTypes,
    check,
    transform,
  };
}

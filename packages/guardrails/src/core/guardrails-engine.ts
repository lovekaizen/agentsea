/**
 * Guardrails Engine
 *
 * Main orchestrator for the guardrails system.
 * Manages guard execution, caching, and result aggregation.
 */

import { LRUCache } from 'lru-cache';

import type {
  Guard,
  GuardContext,
  GuardResult,
  GuardConfig,
  GuardrailsConfig,
  PipelineConfig,
  PipelineResult,
  ContentType,
} from '../types';
import { GuardRegistry } from './guard-registry';
import { Pipeline } from './pipeline';
import type { createPipeline as _createPipeline } from './pipeline';

/**
 * Result of a guardrails check
 */
export interface GuardrailsResult {
  /** Whether all checks passed */
  passed: boolean;
  /** Final action to take */
  action: 'allow' | 'block' | 'transform' | 'warn';
  /** Individual guard results */
  results: GuardResult[];
  /** Summary message */
  message: string;
  /** Transformed content (if applicable) */
  transformedContent?: string;
  /** Total latency in ms */
  totalLatencyMs: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: GuardrailsConfig = {
  guards: [],
  failureMode: 'fail-fast',
  defaultAction: 'block',
  executionMode: 'sequential',
  defaultSensitivity: 'medium',
  timeoutMs: 30000,
};

/**
 * Guardrails Engine
 *
 * The main entry point for the guardrails system.
 *
 * @example
 * ```typescript
 * const engine = new GuardrailsEngine({
 *   guards: [
 *     { name: 'toxicity', enabled: true, onFailure: 'block' },
 *     { name: 'pii', enabled: true, onFailure: 'transform' },
 *   ],
 *   failureMode: 'fail-fast',
 *   defaultAction: 'block',
 * });
 *
 * const result = await engine.checkInput('Hello world');
 * if (!result.passed) {
 *   console.log('Content blocked:', result.message);
 * }
 * ```
 */
export class GuardrailsEngine {
  private config: GuardrailsConfig;
  private guards: Map<string, Guard> = new Map();
  private pipelines: Map<string, Pipeline> = new Map();
  private cache?: LRUCache<string, GuardrailsResult>;

  constructor(config: Partial<GuardrailsConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeGuards();
    this.initializeCache();
  }

  /**
   * Check input content
   */
  async checkInput(
    input: string,
    context?: Partial<GuardContext>,
  ): Promise<GuardrailsResult> {
    return this.check(input, 'input', context);
  }

  /**
   * Check output content
   */
  async checkOutput(
    output: string,
    context?: Partial<GuardContext>,
  ): Promise<GuardrailsResult> {
    return this.check(output, 'output', context);
  }

  /**
   * Check both input and output
   */
  async checkBoth(
    input: string,
    output: string,
    context?: Partial<GuardContext>,
  ): Promise<{
    input: GuardrailsResult;
    output: GuardrailsResult;
    passed: boolean;
  }> {
    const [inputResult, outputResult] = await Promise.all([
      this.checkInput(input, context),
      this.checkOutput(output, context),
    ]);

    return {
      input: inputResult,
      output: outputResult,
      passed: inputResult.passed && outputResult.passed,
    };
  }

  /**
   * Register a guard instance
   */
  registerGuard(guard: Guard): void {
    this.guards.set(guard.name, guard);
  }

  /**
   * Remove a guard
   */
  removeGuard(name: string): void {
    this.guards.delete(name);
  }

  /**
   * Get a guard by name
   */
  getGuard(name: string): Guard | undefined {
    return this.guards.get(name) ?? GuardRegistry.get(name);
  }

  /**
   * Create a named pipeline
   */
  createPipeline(
    name: string,
    guardNames: string[],
    options?: Partial<PipelineConfig>,
  ): Pipeline {
    const pipeline = new Pipeline({
      name,
      guards: guardNames,
      executionMode:
        options?.executionMode ?? this.config.executionMode ?? 'sequential',
      failureMode: options?.failureMode ?? this.config.failureMode,
      timeoutMs: options?.timeoutMs ?? this.config.timeoutMs,
      ...options,
    });

    this.pipelines.set(name, pipeline);
    return pipeline;
  }

  /**
   * Get a pipeline by name
   */
  getPipeline(name: string): Pipeline | undefined {
    return this.pipelines.get(name);
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineName: string,
    content: string,
    type: ContentType,
    context?: Partial<GuardContext>,
  ): Promise<PipelineResult> {
    const pipeline = this.pipelines.get(pipelineName);
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineName}' not found`);
    }

    const fullContext = this.createContext(content, type, context);
    return pipeline.execute(fullContext);
  }

  /**
   * Get all registered guard names
   */
  getGuardNames(): string[] {
    return [
      ...Array.from(this.guards.keys()),
      ...GuardRegistry.getNames(),
    ].filter((name, index, arr) => arr.indexOf(name) === index);
  }

  /**
   * Get configuration
   */
  getConfig(): GuardrailsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GuardrailsConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.guards) {
      this.initializeGuards();
    }
    if (config.cache) {
      this.initializeCache();
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache?.clear();
  }

  /**
   * Main check function
   */
  private async check(
    content: string,
    type: ContentType,
    context?: Partial<GuardContext>,
  ): Promise<GuardrailsResult> {
    const startTime = Date.now();

    // Check cache
    const cacheKey = this.getCacheKey(content, type);
    if (this.cache && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, totalLatencyMs: Date.now() - startTime };
      }
    }

    // Create full context
    const fullContext = this.createContext(content, type, context);

    // Get guards to execute
    const guardsToExecute = this.getGuardsForType(type);

    if (guardsToExecute.length === 0) {
      return this.createPassResult(content, startTime);
    }

    // Execute guards using pipeline
    const pipeline = this.createInternalPipeline(guardsToExecute);
    const pipelineResult = await pipeline.execute(fullContext);

    // Build result
    const result = this.buildResult(pipelineResult, startTime);

    // Cache result
    if (this.cache && cacheKey && result.passed) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Initialize guards from configuration
   */
  private initializeGuards(): void {
    for (const guardConfig of this.config.guards) {
      const guard = this.resolveGuard(guardConfig);
      if (guard) {
        this.guards.set(guard.name, guard);
      }
    }
  }

  /**
   * Resolve a guard from config
   */
  private resolveGuard(config: GuardConfig): Guard | undefined {
    // Try to get from registry
    return GuardRegistry.get(config.name, config);
  }

  /**
   * Initialize cache if configured
   */
  private initializeCache(): void {
    if (this.config.cache?.enabled) {
      this.cache = new LRUCache({
        max: this.config.cache.maxSize,
        ttl: this.config.cache.ttlMs,
      });
    }
  }

  /**
   * Create a full guard context
   */
  private createContext(
    input: string,
    type: ContentType,
    partial?: Partial<GuardContext>,
  ): GuardContext {
    return {
      input,
      type,
      timestamp: new Date(),
      ...partial,
    };
  }

  /**
   * Get guards that support the given type
   */
  private getGuardsForType(type: ContentType): Guard[] {
    const guards: Guard[] = [];

    for (const [, guard] of this.guards) {
      if (
        guard.config.enabled &&
        (guard.supportedTypes.includes(type) ||
          guard.supportedTypes.includes('both'))
      ) {
        guards.push(guard);
      }
    }

    return guards;
  }

  /**
   * Create an internal pipeline for guard execution
   */
  private createInternalPipeline(guards: Guard[]): Pipeline {
    return new Pipeline(
      {
        name: '_internal',
        guards: guards.map((g) => g.name),
        executionMode: this.config.executionMode ?? 'sequential',
        failureMode: this.config.failureMode,
        timeoutMs: this.config.timeoutMs,
      },
      guards,
    );
  }

  /**
   * Build guardrails result from pipeline result
   */
  private buildResult(
    pipelineResult: PipelineResult,
    startTime: number,
  ): GuardrailsResult {
    return {
      passed: pipelineResult.passed,
      action: pipelineResult.action,
      results: pipelineResult.results,
      message: pipelineResult.message ?? '',
      transformedContent: pipelineResult.transformedContent,
      totalLatencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Create a pass result
   */
  private createPassResult(
    content: string,
    startTime: number,
  ): GuardrailsResult {
    return {
      passed: true,
      action: 'allow',
      results: [],
      message: 'No guards configured for this content type',
      totalLatencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Generate cache key
   */
  private getCacheKey(content: string, type: ContentType): string | null {
    if (!this.config.cache?.enabled) return null;

    if (this.config.cache.keyGenerator) {
      return this.config.cache.keyGenerator(content, type);
    }

    // Default: hash of content + type + guard names
    const guardNames = this.getGuardsForType(type)
      .map((g) => g.name)
      .sort()
      .join(',');

    return `${type}:${guardNames}:${this.simpleHash(content)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

/**
 * Create a new guardrails engine
 */
export function createGuardrailsEngine(
  config?: Partial<GuardrailsConfig>,
): GuardrailsEngine {
  return new GuardrailsEngine(config);
}

/**
 * Guardrails Service
 *
 * Injectable NestJS service for guardrails functionality.
 */

import { Injectable, Inject, Optional } from '@nestjs/common';

import type { GuardContext, GuardrailsConfig, PipelineConfig } from '../types';
import { GuardrailsEngine, GuardrailsResult } from '../core/guardrails-engine';
import { Pipeline } from '../core/pipeline';
import { GuardRegistry } from '../core/guard-registry';

/**
 * Injection tokens
 */
export const GUARDRAILS_CONFIG = Symbol('GUARDRAILS_CONFIG');
export const GUARDRAILS_ENGINE = Symbol('GUARDRAILS_ENGINE');

/**
 * Guardrails Service
 *
 * Provides guardrails functionality as an injectable NestJS service.
 */
@Injectable()
export class GuardrailsService {
  private engine: GuardrailsEngine;

  constructor(
    @Optional() @Inject(GUARDRAILS_CONFIG) config?: GuardrailsConfig,
    @Optional() @Inject(GUARDRAILS_ENGINE) engine?: GuardrailsEngine,
  ) {
    this.engine = engine ?? new GuardrailsEngine(config);
  }

  /**
   * Check input content
   */
  async checkInput(
    input: string,
    context?: Partial<GuardContext>,
  ): Promise<GuardrailsResult> {
    return this.engine.checkInput(input, context);
  }

  /**
   * Check output content
   */
  async checkOutput(
    output: string,
    context?: Partial<GuardContext>,
  ): Promise<GuardrailsResult> {
    return this.engine.checkOutput(output, context);
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
    return this.engine.checkBoth(input, output, context);
  }

  /**
   * Create a named pipeline
   */
  createPipeline(
    name: string,
    guardNames: string[],
    options?: Partial<PipelineConfig>,
  ): Pipeline {
    return this.engine.createPipeline(name, guardNames, options);
  }

  /**
   * Get a pipeline
   */
  getPipeline(name: string): Pipeline | undefined {
    return this.engine.getPipeline(name);
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineName: string,
    content: string,
    type: 'input' | 'output',
    context?: Partial<GuardContext>,
  ) {
    return this.engine.executePipeline(pipelineName, content, type, context);
  }

  /**
   * Get all guard names
   */
  getGuardNames(): string[] {
    return this.engine.getGuardNames();
  }

  /**
   * Get guard metadata
   */
  getGuardMetadata() {
    return GuardRegistry.getAllMetadata();
  }

  /**
   * Get the underlying engine
   */
  getEngine(): GuardrailsEngine {
    return this.engine;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GuardrailsConfig>): void {
    this.engine.updateConfig(config);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.engine.clearCache();
  }
}

export default GuardrailsService;

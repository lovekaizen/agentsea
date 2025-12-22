/**
 * Logger
 *
 * Structured logging for guardrails.
 */

import pino from 'pino';

import type {
  GuardResult,
  GuardrailsConfig as _GuardrailsConfig,
} from '../types';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Log level */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** Pretty print (for development) */
  pretty?: boolean;
  /** Service name */
  serviceName?: string;
  /** Custom pino options */
  pinoOptions?: pino.LoggerOptions;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  pretty: process.env.NODE_ENV !== 'production',
  serviceName: 'guardrails',
};

/**
 * Create a pino logger instance
 */
function createPinoLogger(config: LoggerConfig): pino.Logger {
  const options: pino.LoggerOptions = {
    level: config.level,
    name: config.serviceName,
    ...config.pinoOptions,
  };

  if (config.pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(options);
}

/**
 * Guardrails Logger
 *
 * Structured logging for guardrails events.
 */
export class GuardrailsLogger {
  private logger: pino.Logger;
  private serviceName: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    this.logger = createPinoLogger(fullConfig);
    this.serviceName = fullConfig.serviceName ?? 'guardrails';
  }

  /**
   * Log guard check start
   */
  guardCheckStart(
    guardName: string,
    type: 'input' | 'output',
    contentLength: number,
  ): void {
    this.logger.debug({
      event: 'guard_check_start',
      guard: guardName,
      type,
      contentLength,
    });
  }

  /**
   * Log guard check result
   */
  guardCheckResult(result: GuardResult): void {
    const level = result.passed ? 'debug' : 'warn';

    this.logger[level]({
      event: 'guard_check_result',
      guard: result.guardName,
      passed: result.passed,
      action: result.action,
      confidence: result.confidence,
      latencyMs: result.latencyMs,
      message: result.message,
    });
  }

  /**
   * Log guard blocked content
   */
  guardBlocked(result: GuardResult): void {
    this.logger.warn({
      event: 'guard_blocked',
      guard: result.guardName,
      action: result.action,
      message: result.message,
      detections: result.detections?.length ?? 0,
    });
  }

  /**
   * Log guard transformed content
   */
  guardTransformed(result: GuardResult): void {
    this.logger.info({
      event: 'guard_transformed',
      guard: result.guardName,
      message: result.message,
    });
  }

  /**
   * Log pipeline start
   */
  pipelineStart(pipelineName: string, guardCount: number): void {
    this.logger.debug({
      event: 'pipeline_start',
      pipeline: pipelineName,
      guardCount,
    });
  }

  /**
   * Log pipeline complete
   */
  pipelineComplete(
    pipelineName: string,
    passed: boolean,
    totalLatencyMs: number,
    guardCount: number,
  ): void {
    const level = passed ? 'debug' : 'warn';

    this.logger[level]({
      event: 'pipeline_complete',
      pipeline: pipelineName,
      passed,
      totalLatencyMs,
      guardCount,
    });
  }

  /**
   * Log error
   */
  error(
    message: string,
    error: Error,
    context?: Record<string, unknown>,
  ): void {
    this.logger.error({
      event: 'error',
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    });
  }

  /**
   * Log custom event
   */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    event: string,
    data: Record<string, unknown>,
  ): void {
    this.logger[level]({
      event,
      ...data,
    });
  }

  /**
   * Get the underlying pino logger
   */
  getPino(): pino.Logger {
    return this.logger;
  }

  /**
   * Create a child logger
   */
  child(bindings: Record<string, unknown>): pino.Logger {
    return this.logger.child(bindings);
  }
}

/**
 * Create a logger
 */
export function createLogger(config?: Partial<LoggerConfig>): GuardrailsLogger {
  return new GuardrailsLogger(config);
}

export default GuardrailsLogger;

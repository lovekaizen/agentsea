/**
 * Provider Health monitoring and circuit breaker
 */

import type { ProviderHealth } from '../core/types.js';
import { EventEmitter } from 'events';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold?: number;
}

export interface HealthMonitorConfig {
  checkInterval: number;
  unhealthyThreshold: number;
  degradedThreshold: number;
  circuitBreaker?: CircuitBreakerConfig;
}

/**
 * Circuit breaker for a single provider
 */
export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: Date | null = null;
  private nextAttempt: Date | null = null;

  constructor(
    private readonly providerName: string,
    private readonly config: CircuitBreakerConfig,
  ) {}

  /**
   * Check if requests are allowed
   */
  isAllowed(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      // Check if timeout has passed
      if (this.nextAttempt && new Date() >= this.nextAttempt) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open: allow limited requests
    return true;
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailure = new Date();

    if (this.state === 'half-open') {
      this.trip();
    } else if (
      this.state === 'closed' &&
      this.failures >= this.config.failureThreshold
    ) {
      this.trip();
    }
  }

  /**
   * Trip the circuit breaker (open it)
   */
  private trip(): void {
    this.state = 'open';
    this.nextAttempt = new Date(Date.now() + this.config.timeout);
    this.successes = 0;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = null;
  }

  /**
   * Get the current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit status
   */
  getStatus(): {
    providerName: string;
    state: CircuitState;
    failures: number;
    nextAttempt: Date | null;
    lastFailure: Date | null;
  } {
    return {
      providerName: this.providerName,
      state: this.state,
      failures: this.failures,
      nextAttempt: this.nextAttempt,
      lastFailure: this.lastFailure,
    };
  }
}

/**
 * Health monitor for tracking provider health over time
 */
export class HealthMonitor extends EventEmitter {
  private healthHistory: Map<string, ProviderHealth[]> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private readonly maxHistorySize = 100;

  constructor(private readonly config: HealthMonitorConfig) {
    super();
  }

  /**
   * Record a health check result
   */
  recordHealth(providerName: string, health: ProviderHealth): void {
    const history = this.healthHistory.get(providerName) || [];
    history.push(health);

    // Keep only recent history
    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.healthHistory.set(providerName, history);

    // Emit events based on health changes
    if (health.status === 'unhealthy') {
      this.emit('unhealthy', providerName, health);
    } else if (health.status === 'degraded') {
      this.emit('degraded', providerName, health);
    }
  }

  /**
   * Record a request result
   */
  recordRequest(
    providerName: string,
    success: boolean,
    _latencyMs: number,
  ): void {
    const breaker = this.getOrCreateCircuitBreaker(providerName);

    if (success) {
      breaker.recordSuccess();
    } else {
      breaker.recordFailure();

      // Check if circuit was just opened
      if (breaker.getState() === 'open') {
        this.emit('circuit-open', providerName);
      }
    }
  }

  /**
   * Check if requests are allowed for a provider
   */
  isRequestAllowed(providerName: string): boolean {
    const breaker = this.circuitBreakers.get(providerName);
    return breaker ? breaker.isAllowed() : true;
  }

  /**
   * Get or create a circuit breaker for a provider
   */
  private getOrCreateCircuitBreaker(providerName: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(providerName);
    if (!breaker && this.config.circuitBreaker) {
      breaker = new CircuitBreaker(providerName, this.config.circuitBreaker);
      this.circuitBreakers.set(providerName, breaker);
    }
    return (
      breaker ||
      new CircuitBreaker(providerName, {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
      })
    );
  }

  /**
   * Get health history for a provider
   */
  getHistory(providerName: string): ProviderHealth[] {
    return this.healthHistory.get(providerName) || [];
  }

  /**
   * Get average latency for a provider
   */
  getAverageLatency(providerName: string): number {
    const history = this.healthHistory.get(providerName) || [];
    if (history.length === 0) return 0;

    const sum = history.reduce((acc, h) => acc + h.latencyMs, 0);
    return sum / history.length;
  }

  /**
   * Get error rate for a provider
   */
  getErrorRate(providerName: string): number {
    const history = this.healthHistory.get(providerName) || [];
    if (history.length === 0) return 0;

    const lastHealth = history[history.length - 1];
    return lastHealth.errorRate;
  }

  /**
   * Get circuit breaker status for a provider
   */
  getCircuitStatus(
    providerName: string,
  ): ReturnType<CircuitBreaker['getStatus']> | null {
    const breaker = this.circuitBreakers.get(providerName);
    return breaker ? breaker.getStatus() : null;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllCircuitStatuses(): Record<
    string,
    ReturnType<CircuitBreaker['getStatus']>
  > {
    const statuses: Record<
      string,
      ReturnType<CircuitBreaker['getStatus']>
    > = {};
    for (const [name, breaker] of this.circuitBreakers) {
      statuses[name] = breaker.getStatus();
    }
    return statuses;
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuit(providerName: string): void {
    const breaker = this.circuitBreakers.get(providerName);
    if (breaker) {
      breaker.reset();
      this.emit('circuit-reset', providerName);
    }
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.healthHistory.clear();
    this.circuitBreakers.clear();
  }
}

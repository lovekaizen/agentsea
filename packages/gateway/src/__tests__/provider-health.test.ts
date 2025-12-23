import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CircuitBreaker,
  HealthMonitor,
  type CircuitBreakerConfig,
  type HealthMonitorConfig,
} from '../providers/ProviderHealth.js';
import type { ProviderHealth } from '../core/types.js';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  const config: CircuitBreakerConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 1000,
  };

  beforeEach(() => {
    breaker = new CircuitBreaker('test-provider', config);
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
      expect(breaker.isAllowed()).toBe(true);
    });

    it('should return status with initial values', () => {
      const status = breaker.getStatus();
      expect(status.providerName).toBe('test-provider');
      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
      expect(status.nextAttempt).toBeNull();
      expect(status.lastFailure).toBeNull();
    });
  });

  describe('recordSuccess', () => {
    it('should reduce failure count when closed', () => {
      breaker.recordFailure();
      breaker.recordFailure();
      const statusBefore = breaker.getStatus();
      expect(statusBefore.failures).toBe(2);

      breaker.recordSuccess();
      const statusAfter = breaker.getStatus();
      expect(statusAfter.failures).toBe(1);
    });

    it('should not reduce failures below zero', () => {
      breaker.recordSuccess();
      breaker.recordSuccess();
      const status = breaker.getStatus();
      expect(status.failures).toBe(0);
    });

    it('should increment success count in half-open state', () => {
      // Trip the breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }

      // Wait for timeout and get into half-open state
      vi.useFakeTimers();
      vi.advanceTimersByTime(config.timeout + 1);
      expect(breaker.isAllowed()).toBe(true);

      breaker.recordSuccess();
      const status = breaker.getStatus();
      expect(status.state).toBe('half-open');

      vi.useRealTimers();
    });

    it('should close circuit after enough successes in half-open', () => {
      // Trip the breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }

      // Get into half-open state
      vi.useFakeTimers();
      vi.advanceTimersByTime(config.timeout + 1);
      breaker.isAllowed();

      // Record enough successes to close
      for (let i = 0; i < config.successThreshold; i++) {
        breaker.recordSuccess();
      }

      expect(breaker.getState()).toBe('closed');
      vi.useRealTimers();
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count', () => {
      breaker.recordFailure();
      const status = breaker.getStatus();
      expect(status.failures).toBe(1);
      expect(status.lastFailure).toBeInstanceOf(Date);
    });

    it('should trip circuit when threshold reached', () => {
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe('open');
      expect(breaker.isAllowed()).toBe(false);
    });

    it('should set next attempt time when tripping', () => {
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }
      const status = breaker.getStatus();
      expect(status.nextAttempt).toBeInstanceOf(Date);
    });

    it('should trip from half-open on any failure', () => {
      // Trip the breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }

      // Get into half-open state
      vi.useFakeTimers();
      vi.advanceTimersByTime(config.timeout + 1);
      expect(breaker.isAllowed()).toBe(true);

      // Single failure should trip it again
      breaker.recordFailure();
      expect(breaker.getState()).toBe('open');
      expect(breaker.isAllowed()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('isAllowed', () => {
    it('should allow requests when closed', () => {
      expect(breaker.isAllowed()).toBe(true);
    });

    it('should not allow requests when open', () => {
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }
      expect(breaker.isAllowed()).toBe(false);
    });

    it('should transition to half-open after timeout', () => {
      // Trip the breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }
      expect(breaker.isAllowed()).toBe(false);

      // Wait for timeout
      vi.useFakeTimers();
      vi.advanceTimersByTime(config.timeout + 1);

      expect(breaker.isAllowed()).toBe(true);
      expect(breaker.getState()).toBe('half-open');

      vi.useRealTimers();
    });

    it('should allow requests in half-open state', () => {
      // Trip and transition to half-open
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(config.timeout + 1);
      breaker.isAllowed();

      expect(breaker.isAllowed()).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      // Trip the breaker
      for (let i = 0; i < config.failureThreshold; i++) {
        breaker.recordFailure();
      }

      breaker.reset();
      const status = breaker.getStatus();

      expect(status.state).toBe('closed');
      expect(status.failures).toBe(0);
      expect(status.nextAttempt).toBeNull();
      expect(breaker.isAllowed()).toBe(true);
    });
  });
});

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;
  const config: HealthMonitorConfig = {
    checkInterval: 5000,
    unhealthyThreshold: 3,
    degradedThreshold: 2,
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    },
  };

  beforeEach(() => {
    monitor = new HealthMonitor(config);
  });

  describe('recordHealth', () => {
    it('should record health data', () => {
      const health: ProviderHealth = {
        status: 'healthy',
        latencyMs: 100,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      };

      monitor.recordHealth('test-provider', health);
      const history = monitor.getHistory('test-provider');

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(health);
    });

    it('should emit unhealthy event', () => {
      const unhealthyHandler = vi.fn();
      monitor.on('unhealthy', unhealthyHandler);

      const health: ProviderHealth = {
        status: 'unhealthy',
        latencyMs: 5000,
        lastCheck: new Date(),
        errorRate: 0.8,
        consecutiveFailures: 5,
      };

      monitor.recordHealth('test-provider', health);
      expect(unhealthyHandler).toHaveBeenCalledWith('test-provider', health);
    });

    it('should emit degraded event', () => {
      const degradedHandler = vi.fn();
      monitor.on('degraded', degradedHandler);

      const health: ProviderHealth = {
        status: 'degraded',
        latencyMs: 2000,
        lastCheck: new Date(),
        errorRate: 0.3,
        consecutiveFailures: 2,
      };

      monitor.recordHealth('test-provider', health);
      expect(degradedHandler).toHaveBeenCalledWith('test-provider', health);
    });

    it('should keep only recent history', () => {
      const health: ProviderHealth = {
        status: 'healthy',
        latencyMs: 100,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      };

      // Record 150 health checks (max is 100)
      for (let i = 0; i < 150; i++) {
        monitor.recordHealth('test-provider', health);
      }

      const history = monitor.getHistory('test-provider');
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('recordRequest', () => {
    it('should record successful request', () => {
      monitor.recordRequest('test-provider', true, 100);
      expect(monitor.isRequestAllowed('test-provider')).toBe(true);
    });

    it('should record failed request', () => {
      monitor.recordRequest('test-provider', false, 100);
      const status = monitor.getCircuitStatus('test-provider');
      expect(status?.failures).toBe(1);
    });

    it('should emit circuit-open event when threshold reached', () => {
      const circuitOpenHandler = vi.fn();
      monitor.on('circuit-open', circuitOpenHandler);

      for (let i = 0; i < config.circuitBreaker!.failureThreshold; i++) {
        monitor.recordRequest('test-provider', false, 100);
      }

      expect(circuitOpenHandler).toHaveBeenCalledWith('test-provider');
    });

    it('should reduce failures on success', () => {
      monitor.recordRequest('test-provider', false, 100);
      monitor.recordRequest('test-provider', false, 100);

      const statusBefore = monitor.getCircuitStatus('test-provider');
      expect(statusBefore?.failures).toBe(2);

      monitor.recordRequest('test-provider', true, 100);
      const statusAfter = monitor.getCircuitStatus('test-provider');
      expect(statusAfter?.failures).toBe(1);
    });
  });

  describe('isRequestAllowed', () => {
    it('should allow requests by default', () => {
      expect(monitor.isRequestAllowed('test-provider')).toBe(true);
    });

    it('should not allow requests when circuit is open', () => {
      for (let i = 0; i < config.circuitBreaker!.failureThreshold; i++) {
        monitor.recordRequest('test-provider', false, 100);
      }
      expect(monitor.isRequestAllowed('test-provider')).toBe(false);
    });

    it('should allow requests when no circuit breaker exists', () => {
      const monitorNoCb = new HealthMonitor({
        checkInterval: 5000,
        unhealthyThreshold: 3,
        degradedThreshold: 2,
      });

      expect(monitorNoCb.isRequestAllowed('unknown-provider')).toBe(true);
    });
  });

  describe('getHistory', () => {
    it('should return empty array for unknown provider', () => {
      const history = monitor.getHistory('unknown-provider');
      expect(history).toEqual([]);
    });

    it('should return all health records', () => {
      const health: ProviderHealth = {
        status: 'healthy',
        latencyMs: 100,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      };

      monitor.recordHealth('test-provider', health);
      monitor.recordHealth('test-provider', { ...health, latencyMs: 150 });

      const history = monitor.getHistory('test-provider');
      expect(history).toHaveLength(2);
    });
  });

  describe('getAverageLatency', () => {
    it('should return 0 for unknown provider', () => {
      expect(monitor.getAverageLatency('unknown-provider')).toBe(0);
    });

    it('should calculate average latency', () => {
      monitor.recordHealth('test-provider', {
        status: 'healthy',
        latencyMs: 100,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      });
      monitor.recordHealth('test-provider', {
        status: 'healthy',
        latencyMs: 200,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      });

      expect(monitor.getAverageLatency('test-provider')).toBe(150);
    });
  });

  describe('getErrorRate', () => {
    it('should return 0 for unknown provider', () => {
      expect(monitor.getErrorRate('unknown-provider')).toBe(0);
    });

    it('should return last error rate', () => {
      monitor.recordHealth('test-provider', {
        status: 'healthy',
        latencyMs: 100,
        lastCheck: new Date(),
        errorRate: 0.1,
        consecutiveFailures: 0,
      });
      monitor.recordHealth('test-provider', {
        status: 'degraded',
        latencyMs: 200,
        lastCheck: new Date(),
        errorRate: 0.3,
        consecutiveFailures: 1,
      });

      expect(monitor.getErrorRate('test-provider')).toBe(0.3);
    });
  });

  describe('getCircuitStatus', () => {
    it('should return null for unknown provider', () => {
      expect(monitor.getCircuitStatus('unknown-provider')).toBeNull();
    });

    it('should return circuit breaker status', () => {
      monitor.recordRequest('test-provider', false, 100);
      const status = monitor.getCircuitStatus('test-provider');

      expect(status).toBeDefined();
      expect(status?.providerName).toBe('test-provider');
      expect(status?.state).toBe('closed');
      expect(status?.failures).toBe(1);
    });
  });

  describe('getAllCircuitStatuses', () => {
    it('should return empty object when no circuits exist', () => {
      const statuses = monitor.getAllCircuitStatuses();
      expect(statuses).toEqual({});
    });

    it('should return all circuit statuses', () => {
      monitor.recordRequest('provider-1', false, 100);
      monitor.recordRequest('provider-2', false, 100);

      const statuses = monitor.getAllCircuitStatuses();

      expect(Object.keys(statuses)).toHaveLength(2);
      expect(statuses['provider-1']).toBeDefined();
      expect(statuses['provider-2']).toBeDefined();
    });
  });

  describe('resetCircuit', () => {
    it('should reset circuit breaker', () => {
      for (let i = 0; i < config.circuitBreaker!.failureThreshold; i++) {
        monitor.recordRequest('test-provider', false, 100);
      }

      expect(monitor.isRequestAllowed('test-provider')).toBe(false);

      monitor.resetCircuit('test-provider');
      expect(monitor.isRequestAllowed('test-provider')).toBe(true);
    });

    it('should emit circuit-reset event', () => {
      const resetHandler = vi.fn();
      monitor.on('circuit-reset', resetHandler);

      monitor.recordRequest('test-provider', false, 100);
      monitor.resetCircuit('test-provider');

      expect(resetHandler).toHaveBeenCalledWith('test-provider');
    });

    it('should do nothing for unknown provider', () => {
      expect(() => monitor.resetCircuit('unknown-provider')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all history and circuits', () => {
      monitor.recordHealth('test-provider', {
        status: 'healthy',
        latencyMs: 100,
        lastCheck: new Date(),
        errorRate: 0,
        consecutiveFailures: 0,
      });
      monitor.recordRequest('test-provider', false, 100);

      monitor.clear();

      expect(monitor.getHistory('test-provider')).toEqual([]);
      expect(monitor.getCircuitStatus('test-provider')).toBeNull();
    });
  });
});

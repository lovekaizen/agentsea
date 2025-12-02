import { AgentMetrics } from '../types';

/**
 * Metrics collector for agents
 */
export class MetricsCollector {
  private metrics: AgentMetrics[] = [];
  private listeners: ((metric: AgentMetrics) => void)[] = [];

  /**
   * Record a metric
   */
  record(metric: AgentMetrics): void {
    this.metrics.push(metric);
    this.notifyListeners(metric);
  }

  /**
   * Get all metrics
   */
  getAll(): AgentMetrics[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific agent
   */
  getByAgent(agentName: string): AgentMetrics[] {
    return this.metrics.filter((m) => m.agentName === agentName);
  }

  /**
   * Get metrics within a time range
   */
  getByTimeRange(start: Date, end: Date): AgentMetrics[] {
    return this.metrics.filter(
      (m) => m.timestamp >= start && m.timestamp <= end,
    );
  }

  /**
   * Get aggregated statistics
   */
  getStats(agentName?: string): {
    totalCalls: number;
    successRate: number;
    avgLatency: number;
    totalTokens: number;
    errors: number;
  } {
    const filtered = agentName ? this.getByAgent(agentName) : this.metrics;

    if (filtered.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        avgLatency: 0,
        totalTokens: 0,
        errors: 0,
      };
    }

    const successful = filtered.filter((m) => m.success).length;
    const totalLatency = filtered.reduce((sum, m) => sum + m.latencyMs, 0);
    const totalTokens = filtered.reduce((sum, m) => sum + m.tokensUsed, 0);
    const errors = filtered.filter((m) => !m.success).length;

    return {
      totalCalls: filtered.length,
      successRate: (successful / filtered.length) * 100,
      avgLatency: totalLatency / filtered.length,
      totalTokens,
      errors,
    };
  }

  /**
   * Subscribe to metric events
   */
  subscribe(listener: (metric: AgentMetrics) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(metric: AgentMetrics): void {
    for (const listener of this.listeners) {
      try {
        listener(metric);
      } catch (error) {
        console.error('Error in metrics listener:', error);
      }
    }
  }
}

/**
 * Global metrics collector
 */
export const globalMetrics = new MetricsCollector();

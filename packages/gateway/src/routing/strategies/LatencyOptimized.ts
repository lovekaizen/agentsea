/**
 * Latency-optimized routing strategy
 */

import type {
  ChatCompletionRequest,
  RoutingDecision,
} from '../../core/types.js';
import type { ProviderRegistry } from '../../providers/ProviderRegistry.js';
import type { RoutingStrategyInterface, RoutingContext } from '../Router.js';

export interface LatencyOptimizedConfig {
  /**
   * Maximum acceptable latency in milliseconds
   */
  maxLatencyMs?: number;

  /**
   * Number of requests to collect before adapting routing
   */
  warmupRequests?: number;

  /**
   * Enable adaptive routing based on observed latencies
   */
  adaptiveRouting?: boolean;
}

interface LatencyStats {
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  samples: number[];
}

/**
 * Latency-optimized routing strategy
 * Selects the fastest provider based on observed latencies
 */
export class LatencyOptimizedStrategy implements RoutingStrategyInterface {
  readonly name = 'latency-optimized' as const;
  private config: LatencyOptimizedConfig;
  private latencyStats: Map<string, LatencyStats> = new Map();
  private readonly maxSamples = 100;

  constructor(config: LatencyOptimizedConfig = {}) {
    this.config = {
      warmupRequests: 10,
      adaptiveRouting: true,
      ...config,
    };
  }

  route(
    request: ChatCompletionRequest,
    registry: ProviderRegistry,
    context?: RoutingContext,
  ): RoutingDecision {
    // Get all available providers
    let providers = registry.getAvailableProviders();

    // Filter out excluded providers
    if (context?.excludeProviders) {
      providers = providers.filter(
        (p) => !context.excludeProviders!.includes(p.name),
      );
    }

    if (providers.length === 0) {
      throw new Error('No available providers');
    }

    // Check if we're still in warmup phase
    const totalRequests = Array.from(this.latencyStats.values()).reduce(
      (sum, stats) => sum + stats.count,
      0,
    );
    const isWarmup = totalRequests < (this.config.warmupRequests || 10);

    // Build candidates with latency info
    const candidates: Array<{
      provider: string;
      model: string;
      latency: number;
      confidence: number;
    }> = [];

    for (const provider of providers) {
      // Get latency from stats or health check
      const stats = this.latencyStats.get(provider.name);
      const health = provider.getHealth();

      let latency: number;
      let confidence: number;

      if (stats && stats.count >= 5 && this.config.adaptiveRouting) {
        // Use observed latency with exponential moving average
        latency = stats.avg;
        confidence = Math.min(stats.count / 50, 1);
      } else {
        // Use health check latency or default
        latency = health.latencyMs || 1000;
        confidence = 0.3;
      }

      for (const model of provider.getModels()) {
        // Skip models that don't match the request if specific model requested
        if (
          request.model !== 'fastest' &&
          !provider.supportsModel(request.model) &&
          model !== request.model
        ) {
          continue;
        }

        candidates.push({
          provider: provider.name,
          model:
            request.model !== 'fastest' && provider.supportsModel(request.model)
              ? request.model
              : model,
          latency,
          confidence,
        });

        // Only add one entry per provider
        break;
      }
    }

    // Filter by max latency if specified
    const maxLatency = context?.maxLatency ?? this.config.maxLatencyMs;
    let filtered = candidates;
    if (maxLatency !== undefined) {
      const withinLimit = candidates.filter((c) => c.latency <= maxLatency);
      if (withinLimit.length > 0) {
        filtered = withinLimit;
      }
    }

    // Sort by latency (fastest first)
    filtered.sort((a, b) => a.latency - b.latency);

    // During warmup, occasionally try different providers
    if (isWarmup && Math.random() < 0.3 && filtered.length > 1) {
      const randomIndex = Math.floor(
        Math.random() * Math.min(3, filtered.length),
      );
      const selected = filtered[randomIndex];

      return {
        provider: selected.provider,
        model: selected.model,
        reason: `Warmup exploration (${totalRequests}/${this.config.warmupRequests} requests)`,
        alternatives: filtered
          .filter((c) => c.provider !== selected.provider)
          .slice(0, 3)
          .map((c) => ({
            provider: c.provider,
            model: c.model,
            score: 1 / c.latency,
          })),
        timestamp: new Date(),
      };
    }

    const selected = filtered[0];

    return {
      provider: selected.provider,
      model: selected.model,
      reason: `Fastest provider (${selected.latency.toFixed(0)}ms avg, ${(selected.confidence * 100).toFixed(0)}% confidence)`,
      alternatives: filtered.slice(1, 4).map((c) => ({
        provider: c.provider,
        model: c.model,
        score: 1 / c.latency,
      })),
      timestamp: new Date(),
    };
  }

  /**
   * Record a latency observation
   */
  recordLatency(provider: string, latencyMs: number): void {
    let stats = this.latencyStats.get(provider);

    if (!stats) {
      stats = {
        count: 0,
        total: 0,
        min: Infinity,
        max: 0,
        avg: 0,
        p95: 0,
        samples: [],
      };
      this.latencyStats.set(provider, stats);
    }

    stats.count++;
    stats.total += latencyMs;
    stats.min = Math.min(stats.min, latencyMs);
    stats.max = Math.max(stats.max, latencyMs);

    // Keep samples for percentile calculation
    stats.samples.push(latencyMs);
    if (stats.samples.length > this.maxSamples) {
      stats.samples.shift();
    }

    // Calculate exponential moving average
    const alpha = 0.2; // Smoothing factor
    if (stats.count === 1) {
      stats.avg = latencyMs;
    } else {
      stats.avg = alpha * latencyMs + (1 - alpha) * stats.avg;
    }

    // Calculate p95
    if (stats.samples.length >= 20) {
      const sorted = [...stats.samples].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      stats.p95 = sorted[p95Index];
    }
  }

  /**
   * Get latency statistics for a provider
   */
  getStats(provider: string): LatencyStats | undefined {
    return this.latencyStats.get(provider);
  }

  /**
   * Get all latency statistics
   */
  getAllStats(): Record<string, LatencyStats> {
    const result: Record<string, LatencyStats> = {};
    for (const [provider, stats] of this.latencyStats) {
      result[provider] = { ...stats, samples: [...stats.samples] };
    }
    return result;
  }

  /**
   * Clear latency statistics
   */
  clearStats(): void {
    this.latencyStats.clear();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<LatencyOptimizedConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

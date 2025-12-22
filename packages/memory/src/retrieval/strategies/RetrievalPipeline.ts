/**
 * RetrievalPipeline
 *
 * Chains multiple retrieval strategies together with configurable stages.
 */

import type {
  MemoryEntry,
  RetrievalResult,
  ScoredMemory,
} from '../../types/index.js';

/**
 * Pipeline stage function type
 */
export type PipelineStage = (
  input: PipelineContext,
  config: StageConfig,
) => Promise<PipelineContext>;

/**
 * Stage configuration
 */
export interface StageConfig {
  name: string;
  enabled?: boolean;
  params?: Record<string, unknown>;
}

/**
 * Pipeline context passed between stages
 */
export interface PipelineContext {
  query: string;
  candidates: ScoredMemory[];
  metadata: Record<string, unknown>;
  timing: Record<string, number>;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  stages: StageConfig[];
  maxCandidates?: number;
  minScore?: number;
  timeout?: number;
}

/**
 * Built-in stage types
 */
export type BuiltInStage =
  | 'filter'
  | 'boost'
  | 'rerank'
  | 'dedupe'
  | 'diversify'
  | 'truncate'
  | 'enrich';

/**
 * Retrieval pipeline for chaining retrieval strategies
 */
export class RetrievalPipeline {
  private stages: Map<string, PipelineStage> = new Map();
  private config: PipelineConfig;

  constructor(config: PipelineConfig = { stages: [] }) {
    this.config = {
      maxCandidates: config.maxCandidates ?? 100,
      minScore: config.minScore ?? 0,
      timeout: config.timeout ?? 30000,
      ...config,
    };

    // Register built-in stages
    this.registerBuiltInStages();
  }

  /**
   * Register built-in stages
   */
  private registerBuiltInStages(): void {
    // Filter stage - remove candidates that don't match criteria
    this.register('filter', (ctx, config) => {
      const filters = config.params?.filters as Record<string, unknown>;
      if (!filters) return Promise.resolve(ctx);

      const filtered = ctx.candidates.filter((c) => {
        for (const [key, value] of Object.entries(filters)) {
          const entryValue =
            c.entry.metadata[key] ??
            (c.entry as unknown as Record<string, unknown>)[key];
          if (Array.isArray(value)) {
            if (!value.includes(entryValue)) return false;
          } else if (entryValue !== value) {
            return false;
          }
        }
        return true;
      });

      return Promise.resolve({ ...ctx, candidates: filtered });
    });

    // Boost stage - adjust scores based on criteria
    this.register('boost', (ctx, config) => {
      const boosts = config.params?.boosts as Array<{
        field: string;
        value: unknown;
        factor: number;
      }>;
      if (!boosts) return Promise.resolve(ctx);

      const boosted = ctx.candidates.map((c) => {
        let newScore = c.score;
        for (const boost of boosts) {
          const fieldValue =
            c.entry.metadata[boost.field] ??
            (c.entry as unknown as Record<string, unknown>)[boost.field];
          if (fieldValue === boost.value) {
            newScore *= boost.factor;
          }
        }
        return { ...c, score: newScore };
      });

      boosted.sort((a, b) => b.score - a.score);
      return Promise.resolve({ ...ctx, candidates: boosted });
    });

    // Rerank stage - reorder based on secondary criteria
    this.register('rerank', (ctx, config) => {
      const weights = config.params?.weights as Record<string, number>;
      if (!weights) return Promise.resolve(ctx);

      const reranked = ctx.candidates.map((c) => {
        let newScore = 0;
        let totalWeight = 0;

        for (const [field, weight] of Object.entries(weights)) {
          if (field === 'originalScore') {
            newScore += c.score * weight;
          } else {
            const value =
              c.entry.metadata[field] ??
              (c.entry as unknown as Record<string, unknown>)[field];
            if (typeof value === 'number') {
              newScore += value * weight;
            }
          }
          totalWeight += weight;
        }

        return {
          ...c,
          score: totalWeight > 0 ? newScore / totalWeight : c.score,
        };
      });

      reranked.sort((a, b) => b.score - a.score);
      return Promise.resolve({ ...ctx, candidates: reranked });
    });

    // Dedupe stage - remove duplicates
    this.register('dedupe', (ctx, config) => {
      const field = (config.params?.field as string) ?? 'content';
      // Note: similarity param available for fuzzy deduplication (not yet implemented)

      const seen = new Map<string, ScoredMemory>();
      const deduped: ScoredMemory[] = [];

      for (const candidate of ctx.candidates) {
        const key = this.getDedupeKey(candidate.entry, field);
        const existing = seen.get(key);

        if (!existing) {
          seen.set(key, candidate);
          deduped.push(candidate);
        } else if (candidate.score > existing.score) {
          // Keep higher scored version
          const idx = deduped.indexOf(existing);
          if (idx !== -1) {
            deduped[idx] = candidate;
          }
          seen.set(key, candidate);
        }
      }

      return Promise.resolve({ ...ctx, candidates: deduped });
    });

    // Diversify stage - ensure variety in results
    this.register('diversify', (ctx, config) => {
      const field = (config.params?.field as string) ?? 'type';
      const maxPerCategory = (config.params?.maxPerCategory as number) ?? 3;

      const categoryCounts = new Map<string, number>();
      const diversified: ScoredMemory[] = [];

      for (const candidate of ctx.candidates) {
        const category = String(
          candidate.entry.metadata[field] ??
            (candidate.entry as unknown as Record<string, unknown>)[field] ??
            'unknown',
        );
        const count = categoryCounts.get(category) ?? 0;

        if (count < maxPerCategory) {
          diversified.push(candidate);
          categoryCounts.set(category, count + 1);
        }
      }

      return Promise.resolve({ ...ctx, candidates: diversified });
    });

    // Truncate stage - limit number of results
    this.register('truncate', (ctx, config) => {
      const limit =
        (config.params?.limit as number) ?? this.config.maxCandidates!;
      return Promise.resolve({
        ...ctx,
        candidates: ctx.candidates.slice(0, limit),
      });
    });

    // Enrich stage - add additional data to entries
    this.register('enrich', async (ctx, config) => {
      const enrichFn = config.params?.enrichFn as (
        entry: MemoryEntry,
      ) => Promise<Record<string, unknown>>;
      if (!enrichFn) return ctx;

      const enriched = await Promise.all(
        ctx.candidates.map(async (c) => {
          const enrichment = await enrichFn(c.entry);
          return {
            ...c,
            entry: {
              ...c.entry,
              metadata: { ...c.entry.metadata, ...enrichment },
            },
          };
        }),
      );

      return { ...ctx, candidates: enriched };
    });
  }

  /**
   * Register a custom stage
   */
  register(name: string, stage: PipelineStage): void {
    this.stages.set(name, stage);
  }

  /**
   * Execute the pipeline
   */
  async execute(
    query: string,
    initialCandidates: ScoredMemory[],
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    let context: PipelineContext = {
      query,
      candidates: initialCandidates,
      metadata: {},
      timing: {},
    };

    // Execute each stage
    for (const stageConfig of this.config.stages) {
      if (stageConfig.enabled === false) continue;

      const stage = this.stages.get(stageConfig.name);
      if (!stage) {
        console.warn(
          `Pipeline stage "${stageConfig.name}" not found, skipping`,
        );
        continue;
      }

      const stageStart = Date.now();
      try {
        context = await this.executeWithTimeout(
          stage(context, stageConfig),
          this.config.timeout!,
        );
        context.timing[stageConfig.name] = Date.now() - stageStart;
      } catch (error) {
        console.error(`Pipeline stage "${stageConfig.name}" failed:`, error);
        // Continue with previous context
      }
    }

    // Apply minimum score filter
    if (this.config.minScore! > 0) {
      context.candidates = context.candidates.filter(
        (c) => c.score >= this.config.minScore!,
      );
    }

    // Apply max candidates limit
    context.candidates = context.candidates.slice(0, this.config.maxCandidates);

    return {
      memories: context.candidates.map((c) => c.entry),
      scores: context.candidates.map((c) => c.score),
      totalCandidates: initialCandidates.length,
      retrievalTimeMs: Date.now() - startTime,
      strategy: 'pipeline',
      metadata: {
        ...context.metadata,
        timing: context.timing,
        stagesExecuted: this.config.stages.filter((s) => s.enabled !== false)
          .length,
      },
    };
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Stage timeout')), timeout),
      ),
    ]);
  }

  /**
   * Get dedupe key for an entry
   */
  private getDedupeKey(entry: MemoryEntry, field: string): string {
    if (field === 'id') return entry.id;
    if (field === 'content') {
      // Normalize content for comparison
      return entry.content.toLowerCase().trim().slice(0, 200);
    }
    return String(
      entry.metadata[field] ??
        (entry as unknown as Record<string, unknown>)[field] ??
        entry.id,
    );
  }

  /**
   * Add a stage to the pipeline
   */
  addStage(config: StageConfig): this {
    this.config.stages.push(config);
    return this;
  }

  /**
   * Remove a stage from the pipeline
   */
  removeStage(name: string): this {
    this.config.stages = this.config.stages.filter((s) => s.name !== name);
    return this;
  }

  /**
   * Update pipeline configuration
   */
  configure(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  /**
   * Get registered stage names
   */
  getStageNames(): string[] {
    return Array.from(this.stages.keys());
  }
}

/**
 * Pipeline builder for fluent API
 */
export class PipelineBuilder {
  private stages: StageConfig[] = [];
  private maxCandidates = 100;
  private minScore = 0;
  private timeout = 30000;
  private customStages: Map<string, PipelineStage> = new Map();

  /**
   * Add a filter stage
   */
  filter(filters: Record<string, unknown>): this {
    this.stages.push({
      name: 'filter',
      params: { filters },
    });
    return this;
  }

  /**
   * Add a boost stage
   */
  boost(
    boosts: Array<{ field: string; value: unknown; factor: number }>,
  ): this {
    this.stages.push({
      name: 'boost',
      params: { boosts },
    });
    return this;
  }

  /**
   * Add a rerank stage
   */
  rerank(weights: Record<string, number>): this {
    this.stages.push({
      name: 'rerank',
      params: { weights },
    });
    return this;
  }

  /**
   * Add a dedupe stage
   */
  dedupe(field: string = 'content', similarity: number = 0.95): this {
    this.stages.push({
      name: 'dedupe',
      params: { field, similarity },
    });
    return this;
  }

  /**
   * Add a diversify stage
   */
  diversify(field: string = 'type', maxPerCategory: number = 3): this {
    this.stages.push({
      name: 'diversify',
      params: { field, maxPerCategory },
    });
    return this;
  }

  /**
   * Add a truncate stage
   */
  truncate(limit: number): this {
    this.stages.push({
      name: 'truncate',
      params: { limit },
    });
    return this;
  }

  /**
   * Add an enrich stage
   */
  enrich(
    enrichFn: (entry: MemoryEntry) => Promise<Record<string, unknown>>,
  ): this {
    this.stages.push({
      name: 'enrich',
      params: { enrichFn },
    });
    return this;
  }

  /**
   * Add a custom stage
   */
  custom(
    name: string,
    stage: PipelineStage,
    params?: Record<string, unknown>,
  ): this {
    this.customStages.set(name, stage);
    this.stages.push({ name, params });
    return this;
  }

  /**
   * Set maximum candidates
   */
  withMaxCandidates(max: number): this {
    this.maxCandidates = max;
    return this;
  }

  /**
   * Set minimum score
   */
  withMinScore(min: number): this {
    this.minScore = min;
    return this;
  }

  /**
   * Set timeout
   */
  withTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }

  /**
   * Build the pipeline
   */
  build(): RetrievalPipeline {
    const pipeline = new RetrievalPipeline({
      stages: this.stages,
      maxCandidates: this.maxCandidates,
      minScore: this.minScore,
      timeout: this.timeout,
    });

    // Register custom stages
    for (const [name, stage] of this.customStages) {
      pipeline.register(name, stage);
    }

    return pipeline;
  }
}

/**
 * Create a pipeline builder
 */
export function createPipelineBuilder(): PipelineBuilder {
  return new PipelineBuilder();
}

/**
 * Create a retrieval pipeline
 */
export function createRetrievalPipeline(
  config?: PipelineConfig,
): RetrievalPipeline {
  return new RetrievalPipeline(config);
}

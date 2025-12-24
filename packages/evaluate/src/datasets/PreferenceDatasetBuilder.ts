/**
 * PreferenceDatasetBuilder
 *
 * Build preference datasets from collected feedback.
 */

import { nanoid } from 'nanoid';
import type {
  PreferencePair,
  PreferenceBuildOptions,
  PreferenceDatasetInterface,
  DatasetStats,
  FeedbackStoreRef,
  SamplingConfig,
  PreferenceFeedback,
} from '../types/index.js';

/**
 * Preference dataset
 */
export class PreferenceDataset implements PreferenceDatasetInterface {
  readonly type = 'preference' as const;
  private pairs: PreferencePair[];
  private _stats?: DatasetStats;

  constructor(pairs: PreferencePair[]) {
    this.pairs = pairs;
  }

  get size(): number {
    return this.pairs.length;
  }

  get stats(): DatasetStats {
    if (!this._stats) {
      this._stats = this.calculateStats();
    }
    return this._stats;
  }

  getPairs(): PreferencePair[] {
    return [...this.pairs];
  }

  filter(predicate: (pair: PreferencePair) => boolean): PreferenceDataset {
    return new PreferenceDataset(this.pairs.filter(predicate));
  }

  sample(count: number): PreferenceDataset {
    if (count >= this.pairs.length) {
      return new PreferenceDataset([...this.pairs]);
    }

    const shuffled = [...this.pairs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return new PreferenceDataset(shuffled.slice(0, count));
  }

  split(ratio: number): [PreferenceDataset, PreferenceDataset] {
    const shuffled = [...this.pairs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const splitIndex = Math.floor(shuffled.length * ratio);
    return [
      new PreferenceDataset(shuffled.slice(0, splitIndex)),
      new PreferenceDataset(shuffled.slice(splitIndex)),
    ];
  }

  shuffle(seed?: number): PreferenceDataset {
    const shuffled = [...this.pairs];
    const rng = seed !== undefined ? this.seededRandom(seed) : Math.random;

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return new PreferenceDataset(shuffled);
  }

  private calculateStats(): DatasetStats {
    const models = new Map<string, number>();
    let totalPromptLen = 0;
    let totalResponseLen = 0;
    const uniquePrompts = new Set<string>();

    for (const pair of this.pairs) {
      uniquePrompts.add(pair.prompt);
      totalPromptLen += pair.prompt.length;
      totalResponseLen += (pair.chosen.length + pair.rejected.length) / 2;

      if (pair.chosenModel) {
        models.set(pair.chosenModel, (models.get(pair.chosenModel) ?? 0) + 1);
      }
      if (pair.rejectedModel) {
        models.set(
          pair.rejectedModel,
          (models.get(pair.rejectedModel) ?? 0) + 1,
        );
      }
    }

    return {
      size: this.pairs.length,
      type: 'preference',
      avgPromptLength:
        this.pairs.length > 0 ? totalPromptLen / this.pairs.length : 0,
      avgResponseLength:
        this.pairs.length > 0 ? totalResponseLen / this.pairs.length : 0,
      uniquePrompts: uniquePrompts.size,
      modelDistribution: Object.fromEntries(models),
    };
  }

  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }
}

/**
 * Preference dataset builder
 */
export class PreferenceDatasetBuilder {
  private feedbackStore: FeedbackStoreRef;
  private sampling?: SamplingConfig;

  constructor(config: {
    feedbackStore: FeedbackStoreRef;
    sampling?: SamplingConfig;
  }) {
    this.feedbackStore = config.feedbackStore;
    this.sampling = config.sampling;
  }

  /**
   * Build preference dataset from feedback
   */
  async build(
    options: PreferenceBuildOptions = {},
  ): Promise<PreferenceDataset> {
    const minPairs = options.minPairs ?? 0;
    const maxPairs = options.maxPairs ?? Infinity;

    // Query preference feedback
    const result = await this.feedbackStore.query({
      type: 'preference',
      minConfidence: this.sampling?.minConfidence,
      limit: maxPairs * 2, // Fetch extra to account for filtering
    });

    // Convert feedback to preference pairs
    let pairs: PreferencePair[] = [];

    for (const item of result.items) {
      const feedback = item as PreferenceFeedback;

      if (feedback.preference === 'tie') {
        continue; // Skip ties for DPO
      }

      const chosen =
        feedback.preference === 'A' ? feedback.responseA : feedback.responseB;
      const rejected =
        feedback.preference === 'A' ? feedback.responseB : feedback.responseA;

      const pair: PreferencePair = {
        id: nanoid(),
        prompt: feedback.input,
        chosen: chosen.content,
        rejected: rejected.content,
        chosenModel: chosen.model,
        rejectedModel: rejected.model,
        reason: feedback.reason,
        confidence: feedback.confidence,
        metadata: feedback.metadata,
      };

      pairs.push(pair);
    }

    // Apply custom filter
    if (options.filterFn) {
      pairs = pairs.filter(options.filterFn);
    }

    // Deduplicate
    if (options.deduplication && options.deduplication !== 'none') {
      pairs = this.deduplicate(pairs, options.deduplication);
    }

    // Apply sampling
    if (this.sampling) {
      pairs = this.applySampling(pairs);
    }

    // Apply limits
    if (pairs.length > maxPairs) {
      pairs = pairs.slice(0, maxPairs);
    }

    if (pairs.length < minPairs) {
      console.warn(
        `Only ${pairs.length} pairs available, requested minimum ${minPairs}`,
      );
    }

    return new PreferenceDataset(pairs);
  }

  /**
   * Deduplicate pairs
   */
  private deduplicate(
    pairs: PreferencePair[],
    mode: 'prompt' | 'exact',
  ): PreferencePair[] {
    const seen = new Set<string>();
    const result: PreferencePair[] = [];

    for (const pair of pairs) {
      const key =
        mode === 'prompt'
          ? pair.prompt
          : `${pair.prompt}|${pair.chosen}|${pair.rejected}`;

      if (!seen.has(key)) {
        seen.add(key);
        result.push(pair);
      }
    }

    return result;
  }

  /**
   * Apply sampling strategy
   */
  private applySampling(pairs: PreferencePair[]): PreferencePair[] {
    if (!this.sampling) return pairs;

    switch (this.sampling.type) {
      case 'random':
        return this.randomSample(pairs);
      case 'balanced':
        return this.balancedSample(pairs);
      case 'stratified':
        return this.stratifiedSample(pairs);
      default:
        return pairs;
    }
  }

  private randomSample(pairs: PreferencePair[]): PreferencePair[] {
    const shuffled = [...pairs];
    const seed = this.sampling?.seed;
    const rng = seed !== undefined ? this.seededRandom(seed) : Math.random;

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  private balancedSample(pairs: PreferencePair[]): PreferencePair[] {
    // Filter by confidence
    const minConf = this.sampling?.minConfidence ?? 0;
    return pairs.filter((p) => (p.confidence ?? 1) >= minConf);
  }

  private stratifiedSample(pairs: PreferencePair[]): PreferencePair[] {
    const field = this.sampling?.stratifyBy ?? 'chosenModel';
    const groups = new Map<string, PreferencePair[]>();

    for (const pair of pairs) {
      const key = String(
        (pair as unknown as Record<string, unknown>)[field] ?? 'unknown',
      );
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(pair);
    }

    // Sample proportionally from each group
    const result: PreferencePair[] = [];
    const ratios = this.sampling?.stratifyRatios ?? {};

    for (const [key, group] of groups) {
      const ratio = ratios[key] ?? 1 / groups.size;
      const count = Math.ceil(pairs.length * ratio);
      result.push(...group.slice(0, count));
    }

    return result;
  }

  private seededRandom(seed: number): () => number {
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }
}

/**
 * Create a preference dataset builder
 */
export function createPreferenceDatasetBuilder(config: {
  feedbackStore: FeedbackStoreRef;
  sampling?: SamplingConfig;
}): PreferenceDatasetBuilder {
  return new PreferenceDatasetBuilder(config);
}

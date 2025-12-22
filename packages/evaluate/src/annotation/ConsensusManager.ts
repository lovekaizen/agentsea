/**
 * ConsensusManager
 *
 * Calculate consensus from multiple annotations.
 */

import type {
  Annotation,
  ConsensusConfig,
  ConsensusResult,
  ConsensusMethod,
  Disagreement,
} from '../types/index.js';

/**
 * Consensus manager
 */
export class ConsensusManager {
  private method: ConsensusMethod;
  private weights?: Record<string, number>;
  private expertAnnotatorId?: string;

  constructor(config: ConsensusConfig) {
    this.method = config.method;
    this.weights = config.weights;
    this.expertAnnotatorId = config.expertAnnotatorId;
  }

  /**
   * Calculate consensus from annotations
   */
  calculateConsensus(annotations: Annotation[]): ConsensusResult {
    if (annotations.length === 0) {
      return {
        value: {},
        method: this.method,
        agreement: 0,
        confidence: 0,
        contributingAnnotations: [],
      };
    }

    if (annotations.length === 1) {
      return {
        value: annotations[0].value,
        method: this.method,
        agreement: 1,
        confidence: annotations[0].confidence ?? 0.5,
        contributingAnnotations: [annotations[0].id],
      };
    }

    switch (this.method) {
      case 'majority':
        return this.majorityConsensus(annotations);
      case 'unanimous':
        return this.unanimousConsensus(annotations);
      case 'weighted':
        return this.weightedConsensus(annotations);
      case 'expert':
        return this.expertConsensus(annotations);
      default:
        return this.majorityConsensus(annotations);
    }
  }

  /**
   * Majority vote consensus
   */
  private majorityConsensus(annotations: Annotation[]): ConsensusResult {
    // Get all fields from annotations
    const allFields = new Set<string>();
    for (const ann of annotations) {
      for (const key of Object.keys(ann.value)) {
        allFields.add(key);
      }
    }

    const consensusValue: Record<string, unknown> = {};
    const disagreements: Disagreement[] = [];
    let totalAgreement = 0;

    for (const field of allFields) {
      const values = annotations.map((ann) => ann.value[field]);
      const { value, agreement, disagrees } = this.findMajority(
        values,
        annotations,
      );

      consensusValue[field] = value;
      totalAgreement += agreement;

      if (disagrees) {
        disagreements.push({
          field,
          values: disagrees,
          resolved: true,
          resolution: value,
        });
      }
    }

    const avgAgreement =
      allFields.size > 0 ? totalAgreement / allFields.size : 1;

    return {
      value: consensusValue,
      method: 'majority',
      agreement: avgAgreement,
      confidence: avgAgreement,
      contributingAnnotations: annotations.map((a) => a.id),
      disagreements: disagreements.length > 0 ? disagreements : undefined,
    };
  }

  /**
   * Find majority value
   */
  private findMajority(
    values: unknown[],
    annotations: Annotation[],
  ): {
    value: unknown;
    agreement: number;
    disagrees?: Disagreement['values'];
  } {
    const counts = new Map<
      string,
      { value: unknown; count: number; annotatorIds: string[] }
    >();

    for (let i = 0; i < values.length; i++) {
      const key = JSON.stringify(values[i]);
      if (!counts.has(key)) {
        counts.set(key, { value: values[i], count: 0, annotatorIds: [] });
      }
      counts.get(key)!.count++;
      counts.get(key)!.annotatorIds.push(annotations[i].annotatorId);
    }

    let maxCount = 0;
    let majorityValue: unknown = null;

    for (const { value, count } of counts.values()) {
      if (count > maxCount) {
        maxCount = count;
        majorityValue = value;
      }
    }

    const agreement = maxCount / values.length;

    // Check for disagreement
    if (counts.size > 1) {
      const disagrees = Array.from(counts.entries()).map(([, v]) => ({
        value: v.value,
        annotatorIds: v.annotatorIds,
        count: v.count,
      }));

      return { value: majorityValue, agreement, disagrees };
    }

    return { value: majorityValue, agreement };
  }

  /**
   * Unanimous consensus
   */
  private unanimousConsensus(annotations: Annotation[]): ConsensusResult {
    const firstValue = annotations[0].value;
    const allMatch = annotations.every(
      (ann) => JSON.stringify(ann.value) === JSON.stringify(firstValue),
    );

    return {
      value: allMatch ? firstValue : {},
      method: 'unanimous',
      agreement: allMatch ? 1 : 0,
      confidence: allMatch ? 1 : 0,
      contributingAnnotations: allMatch ? annotations.map((a) => a.id) : [],
    };
  }

  /**
   * Weighted consensus
   */
  private weightedConsensus(annotations: Annotation[]): ConsensusResult {
    if (!this.weights) {
      return this.majorityConsensus(annotations);
    }

    // Get all fields
    const allFields = new Set<string>();
    for (const ann of annotations) {
      for (const key of Object.keys(ann.value)) {
        allFields.add(key);
      }
    }

    const consensusValue: Record<string, unknown> = {};
    let totalWeightedAgreement = 0;
    let totalWeight = 0;

    for (const field of allFields) {
      const values = new Map<string, { value: unknown; weight: number }>();

      for (const ann of annotations) {
        const key = JSON.stringify(ann.value[field]);
        const weight = this.weights[ann.annotatorId] ?? 1;

        if (!values.has(key)) {
          values.set(key, { value: ann.value[field], weight: 0 });
        }
        values.get(key)!.weight += weight;
        totalWeight += weight;
      }

      // Find highest weighted value
      let maxWeight = 0;
      let bestValue: unknown = null;

      for (const { value, weight } of values.values()) {
        if (weight > maxWeight) {
          maxWeight = weight;
          bestValue = value;
        }
      }

      consensusValue[field] = bestValue;
      totalWeightedAgreement += maxWeight;
    }

    const avgAgreement =
      totalWeight > 0 ? totalWeightedAgreement / totalWeight : 1;

    return {
      value: consensusValue,
      method: 'weighted',
      agreement: avgAgreement,
      confidence: avgAgreement,
      contributingAnnotations: annotations.map((a) => a.id),
    };
  }

  /**
   * Expert consensus
   */
  private expertConsensus(annotations: Annotation[]): ConsensusResult {
    if (!this.expertAnnotatorId) {
      return this.majorityConsensus(annotations);
    }

    const expertAnnotation = annotations.find(
      (a) => a.annotatorId === this.expertAnnotatorId,
    );

    if (!expertAnnotation) {
      return this.majorityConsensus(annotations);
    }

    return {
      value: expertAnnotation.value,
      method: 'expert',
      agreement: 1,
      confidence: expertAnnotation.confidence ?? 1,
      contributingAnnotations: [expertAnnotation.id],
    };
  }

  /**
   * Calculate inter-annotator agreement (Fleiss' kappa approximation)
   */
  calculateAgreement(annotations: Annotation[]): number {
    if (annotations.length < 2) return 1;

    // Simple percentage agreement
    const values = annotations.map((a) => JSON.stringify(a.value));
    const counts = new Map<string, number>();

    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }

    const maxCount = Math.max(...counts.values());
    return maxCount / values.length;
  }
}

/**
 * Create a consensus manager
 */
export function createConsensusManager(
  config: ConsensusConfig,
): ConsensusManager {
  return new ConsensusManager(config);
}

/**
 * Taxonomy Manager
 *
 * Manages intent and topic taxonomies with versioning.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  IntentTaxonomy,
  IntentDefinition,
  TopicDefinition,
  TaxonomyManagerConfig,
  TaxonomyUpdate,
  ClassificationFeedback,
  ClassificationMetrics,
} from '../types/index.js';

/**
 * Taxonomy manager events
 */
export interface TaxonomyManagerEvents {
  'taxonomy:created': (taxonomy: IntentTaxonomy) => void;
  'taxonomy:updated': (
    taxonomy: IntentTaxonomy,
    update: TaxonomyUpdate,
  ) => void;
  'taxonomy:versioned': (
    taxonomy: IntentTaxonomy,
    previousVersion: string,
  ) => void;
  'feedback:received': (feedback: ClassificationFeedback) => void;
  error: (error: Error) => void;
}

/**
 * Taxonomy version
 */
interface TaxonomyVersion {
  version: string;
  timestamp: number;
  taxonomy: IntentTaxonomy;
  description?: string;
}

/**
 * Topic taxonomy
 */
interface TopicTaxonomy {
  id: string;
  name: string;
  version: string;
  topics: TopicDefinition[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TaxonomyManagerConfig = {
  maxVersions: 10,
  autoVersion: true,
  trackChanges: true,
};

/**
 * TaxonomyManager - Manages classification taxonomies
 */
export class TaxonomyManager extends EventEmitter<TaxonomyManagerEvents> {
  private readonly config: TaxonomyManagerConfig;
  private intentTaxonomies = new Map<string, IntentTaxonomy>();
  private topicTaxonomies = new Map<string, TopicTaxonomy>();
  private intentVersionHistory = new Map<string, TaxonomyVersion[]>();
  private topicVersionHistory = new Map<string, TaxonomyVersion[]>();
  private feedback: ClassificationFeedback[] = [];
  private metrics = new Map<string, ClassificationMetrics>();

  constructor(config: Partial<TaxonomyManagerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== Intent Taxonomy Methods ====================

  /**
   * Create a new intent taxonomy
   */
  createIntentTaxonomy(
    name: string,
    intents: IntentDefinition[],
    description?: string,
  ): IntentTaxonomy {
    const taxonomy: IntentTaxonomy = {
      id: nanoid(),
      name,
      version: '1.0.0',
      intents,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.intentTaxonomies.set(taxonomy.id, taxonomy);

    // Initialize version history
    this.intentVersionHistory.set(taxonomy.id, [
      {
        version: taxonomy.version,
        timestamp: Date.now(),
        taxonomy: { ...taxonomy },
        description: 'Initial version',
      },
    ]);

    // Initialize metrics
    this.metrics.set(`intent:${taxonomy.id}`, {
      totalClassifications: 0,
      correctClassifications: 0,
      accuracy: 0,
      intentMetrics: new Map(),
    });

    this.emit('taxonomy:created', taxonomy);
    return taxonomy;
  }

  /**
   * Get an intent taxonomy by ID
   */
  getIntentTaxonomy(id: string): IntentTaxonomy | undefined {
    return this.intentTaxonomies.get(id);
  }

  /**
   * List all intent taxonomies
   */
  listIntentTaxonomies(): IntentTaxonomy[] {
    return Array.from(this.intentTaxonomies.values());
  }

  /**
   * Update an intent taxonomy
   */
  updateIntentTaxonomy(id: string, update: TaxonomyUpdate): IntentTaxonomy {
    const taxonomy = this.intentTaxonomies.get(id);
    if (!taxonomy) {
      throw new Error(`Intent taxonomy not found: ${id}`);
    }

    const previousVersion = taxonomy.version;

    // Apply updates
    if (update.name) {
      taxonomy.name = update.name;
    }
    if (update.description !== undefined) {
      taxonomy.description = update.description;
    }
    if (update.addIntents) {
      for (const intent of update.addIntents) {
        const existing = taxonomy.intents.findIndex((i) => i.id === intent.id);
        if (existing >= 0) {
          taxonomy.intents[existing] = intent;
        } else {
          taxonomy.intents.push(intent);
        }
      }
    }
    if (update.removeIntents) {
      taxonomy.intents = taxonomy.intents.filter(
        (i) => !update.removeIntents!.includes(i.id),
      );
    }
    if (update.updateIntents) {
      for (const intentUpdate of update.updateIntents) {
        const intent = taxonomy.intents.find((i) => i.id === intentUpdate.id);
        if (intent) {
          Object.assign(intent, intentUpdate);
        }
      }
    }

    taxonomy.updatedAt = Date.now();

    // Auto-version if enabled
    if (this.config.autoVersion) {
      taxonomy.version = this.incrementVersion(taxonomy.version);
      this.addVersionToHistory(id, taxonomy, previousVersion);
    }

    this.emit('taxonomy:updated', taxonomy, update);
    return taxonomy;
  }

  /**
   * Add intent to taxonomy
   */
  addIntentToTaxonomy(
    taxonomyId: string,
    intent: IntentDefinition,
  ): IntentTaxonomy {
    return this.updateIntentTaxonomy(taxonomyId, { addIntents: [intent] });
  }

  /**
   * Remove intent from taxonomy
   */
  removeIntentFromTaxonomy(
    taxonomyId: string,
    intentId: string,
  ): IntentTaxonomy {
    return this.updateIntentTaxonomy(taxonomyId, { removeIntents: [intentId] });
  }

  /**
   * Delete an intent taxonomy
   */
  deleteIntentTaxonomy(id: string): boolean {
    const deleted = this.intentTaxonomies.delete(id);
    if (deleted) {
      this.intentVersionHistory.delete(id);
      this.metrics.delete(`intent:${id}`);
    }
    return deleted;
  }

  // ==================== Topic Taxonomy Methods ====================

  /**
   * Create a new topic taxonomy
   */
  createTopicTaxonomy(
    name: string,
    topics: TopicDefinition[],
    _description?: string,
  ): TopicTaxonomy {
    const taxonomy: TopicTaxonomy = {
      id: nanoid(),
      name,
      version: '1.0.0',
      topics,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.topicTaxonomies.set(taxonomy.id, taxonomy);

    // Initialize version history
    this.topicVersionHistory.set(taxonomy.id, [
      {
        version: taxonomy.version,
        timestamp: Date.now(),
        taxonomy: taxonomy as unknown as IntentTaxonomy,
        description: 'Initial version',
      },
    ]);

    // Initialize metrics
    this.metrics.set(`topic:${taxonomy.id}`, {
      totalClassifications: 0,
      correctClassifications: 0,
      accuracy: 0,
      intentMetrics: new Map(),
    });

    return taxonomy;
  }

  /**
   * Get a topic taxonomy by ID
   */
  getTopicTaxonomy(id: string): TopicTaxonomy | undefined {
    return this.topicTaxonomies.get(id);
  }

  /**
   * List all topic taxonomies
   */
  listTopicTaxonomies(): TopicTaxonomy[] {
    return Array.from(this.topicTaxonomies.values());
  }

  /**
   * Add topic to taxonomy
   */
  addTopicToTaxonomy(
    taxonomyId: string,
    topic: TopicDefinition,
  ): TopicTaxonomy {
    const taxonomy = this.topicTaxonomies.get(taxonomyId);
    if (!taxonomy) {
      throw new Error(`Topic taxonomy not found: ${taxonomyId}`);
    }

    const existing = taxonomy.topics.findIndex((t) => t.id === topic.id);
    if (existing >= 0) {
      taxonomy.topics[existing] = topic;
    } else {
      taxonomy.topics.push(topic);
    }

    taxonomy.updatedAt = Date.now();

    if (this.config.autoVersion) {
      taxonomy.version = this.incrementVersion(taxonomy.version);
    }

    return taxonomy;
  }

  /**
   * Remove topic from taxonomy
   */
  removeTopicFromTaxonomy(taxonomyId: string, topicId: string): TopicTaxonomy {
    const taxonomy = this.topicTaxonomies.get(taxonomyId);
    if (!taxonomy) {
      throw new Error(`Topic taxonomy not found: ${taxonomyId}`);
    }

    taxonomy.topics = taxonomy.topics.filter((t) => t.id !== topicId);
    taxonomy.updatedAt = Date.now();

    if (this.config.autoVersion) {
      taxonomy.version = this.incrementVersion(taxonomy.version);
    }

    return taxonomy;
  }

  // ==================== Version Management ====================

  /**
   * Get version history for a taxonomy
   */
  getVersionHistory(
    taxonomyId: string,
    type: 'intent' | 'topic',
  ): TaxonomyVersion[] {
    const history =
      type === 'intent'
        ? this.intentVersionHistory.get(taxonomyId)
        : this.topicVersionHistory.get(taxonomyId);
    return history ? [...history] : [];
  }

  /**
   * Rollback to a specific version
   */
  rollbackToVersion(
    taxonomyId: string,
    version: string,
    type: 'intent' | 'topic',
  ): IntentTaxonomy | TopicTaxonomy {
    const history =
      type === 'intent'
        ? this.intentVersionHistory.get(taxonomyId)
        : this.topicVersionHistory.get(taxonomyId);

    if (!history) {
      throw new Error(`No version history found for: ${taxonomyId}`);
    }

    const versionEntry = history.find((v) => v.version === version);
    if (!versionEntry) {
      throw new Error(`Version not found: ${version}`);
    }

    if (type === 'intent') {
      const taxonomy = { ...versionEntry.taxonomy };
      taxonomy.updatedAt = Date.now();
      this.intentTaxonomies.set(taxonomyId, taxonomy);
      return taxonomy;
    } else {
      const taxonomy = versionEntry.taxonomy as unknown as TopicTaxonomy;
      taxonomy.updatedAt = Date.now();
      this.topicTaxonomies.set(taxonomyId, taxonomy);
      return taxonomy;
    }
  }

  /**
   * Add version to history
   */
  private addVersionToHistory(
    taxonomyId: string,
    taxonomy: IntentTaxonomy,
    previousVersion: string,
  ): void {
    const history = this.intentVersionHistory.get(taxonomyId) ?? [];

    history.push({
      version: taxonomy.version,
      timestamp: Date.now(),
      taxonomy: { ...taxonomy },
      description: `Updated from ${previousVersion}`,
    });

    // Trim old versions if needed
    if (history.length > this.config.maxVersions!) {
      history.shift();
    }

    this.intentVersionHistory.set(taxonomyId, history);
    this.emit('taxonomy:versioned', taxonomy, previousVersion);
  }

  /**
   * Increment semantic version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }

  // ==================== Feedback & Metrics ====================

  /**
   * Record classification feedback
   */
  recordFeedback(feedback: ClassificationFeedback): void {
    this.feedback.push({
      ...feedback,
      timestamp: feedback.timestamp ?? Date.now(),
    });

    // Update metrics
    const metricsKey = `${feedback.type}:${feedback.taxonomyId}`;
    const metrics = this.metrics.get(metricsKey);
    if (metrics) {
      metrics.totalClassifications++;
      if (feedback.correct) {
        metrics.correctClassifications++;
      }
      metrics.accuracy =
        metrics.correctClassifications / metrics.totalClassifications;

      // Update per-intent/topic metrics
      const itemMetrics = metrics.intentMetrics.get(feedback.classified) ?? {
        total: 0,
        correct: 0,
      };
      itemMetrics.total++;
      if (feedback.correct) {
        itemMetrics.correct++;
      }
      metrics.intentMetrics.set(feedback.classified, itemMetrics);
    }

    this.emit('feedback:received', feedback);
  }

  /**
   * Get metrics for a taxonomy
   */
  getMetrics(
    taxonomyId: string,
    type: 'intent' | 'topic',
  ): ClassificationMetrics | undefined {
    return this.metrics.get(`${type}:${taxonomyId}`);
  }

  /**
   * Get all feedback
   */
  getFeedback(filter?: {
    taxonomyId?: string;
    type?: 'intent' | 'topic';
    correct?: boolean;
    since?: number;
  }): ClassificationFeedback[] {
    let result = [...this.feedback];

    if (filter?.taxonomyId) {
      result = result.filter((f) => f.taxonomyId === filter.taxonomyId);
    }
    if (filter?.type) {
      result = result.filter((f) => f.type === filter.type);
    }
    if (filter?.correct !== undefined) {
      result = result.filter((f) => f.correct === filter.correct);
    }
    if (filter?.since) {
      result = result.filter((f) => (f.timestamp ?? 0) >= filter.since!);
    }

    return result;
  }

  /**
   * Get misclassifications for improvement
   */
  getMisclassifications(
    taxonomyId: string,
    type: 'intent' | 'topic',
  ): ClassificationFeedback[] {
    return this.feedback.filter(
      (f) =>
        f.taxonomyId === taxonomyId &&
        f.type === type &&
        !f.correct &&
        f.expected !== undefined,
    );
  }

  /**
   * Clear feedback
   */
  clearFeedback(): void {
    this.feedback = [];
  }

  /**
   * Export taxonomy
   */
  exportTaxonomy(taxonomyId: string, type: 'intent' | 'topic'): string {
    const taxonomy =
      type === 'intent'
        ? this.intentTaxonomies.get(taxonomyId)
        : this.topicTaxonomies.get(taxonomyId);

    if (!taxonomy) {
      throw new Error(`Taxonomy not found: ${taxonomyId}`);
    }

    return JSON.stringify(taxonomy, null, 2);
  }

  /**
   * Import taxonomy
   */
  importIntentTaxonomy(json: string): IntentTaxonomy {
    const taxonomy = JSON.parse(json) as IntentTaxonomy;
    taxonomy.id = nanoid(); // Generate new ID
    taxonomy.createdAt = Date.now();
    taxonomy.updatedAt = Date.now();

    this.intentTaxonomies.set(taxonomy.id, taxonomy);
    return taxonomy;
  }
}

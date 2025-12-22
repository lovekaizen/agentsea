/**
 * Topic Clusterer
 *
 * Clusters conversations by topic using various algorithms.
 */

import { EventEmitter } from 'eventemitter3';
import { nanoid } from 'nanoid';
import type {
  Conversation,
  Cluster,
  TopicClustererConfig,
  ClusteringOptions,
  ClusteringResult,
  AnalyticsStorageAdapter,
} from '../types/index.js';

/**
 * Topic clusterer events
 */
export interface TopicClustererEvents {
  'clustering:complete': (result: ClusteringResult) => void;
  'cluster:found': (cluster: Cluster) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TopicClustererConfig = {
  method: 'kmeans',
  minClusterSize: 3,
  numClusters: 5,
  cacheEmbeddings: true,
};

/**
 * TopicClusterer - Clusters conversations by topic
 */
export class TopicClusterer extends EventEmitter<TopicClustererEvents> {
  private readonly storage: AnalyticsStorageAdapter;
  private readonly config: TopicClustererConfig;
  private readonly embeddingCache = new Map<string, number[]>();

  constructor(
    storage: AnalyticsStorageAdapter,
    config: Partial<TopicClustererConfig> = {},
  ) {
    super();
    this.storage = storage;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Cluster conversations
   */
  async cluster(options: ClusteringOptions = {}): Promise<ClusteringResult> {
    const startTime = Date.now();

    // Get conversations
    let conversations: Conversation[];
    if (options.conversations) {
      conversations = options.conversations;
    } else {
      const result = await this.storage.queryConversations({
        timeRange: options.period
          ? typeof options.period === 'object'
            ? options.period
            : this.periodToTimeRange(options.period as string)
          : undefined,
      });
      conversations = result.conversations;
    }

    if (conversations.length === 0) {
      return {
        clusters: [],
        totalItems: 0,
        metadata: {
          method: this.config.method!,
          params: {},
          executedAt: startTime,
          durationMs: Date.now() - startTime,
        },
      };
    }

    // Extract text features from conversations
    const features = conversations.map((c) =>
      this.extractFeatures(c, options.fields),
    );

    // Perform clustering based on method
    const clusterAssignments = this.performClustering(features, options);

    // Build clusters
    const clusters = this.buildClusters(
      conversations,
      clusterAssignments,
      features,
    );

    // Find noise (unassigned)
    const noise = conversations
      .filter((_, i) => clusterAssignments[i] === -1)
      .map((c) => c.id);

    // Calculate silhouette score
    const silhouetteScore = this.calculateSilhouetteScore(
      features,
      clusterAssignments,
    );

    const result: ClusteringResult = {
      clusters,
      noise: noise.length > 0 ? noise : undefined,
      silhouetteScore,
      totalItems: conversations.length,
      metadata: {
        method: this.config.method!,
        params: {
          numClusters: options.maxClusters ?? this.config.numClusters,
          minClusterSize: this.config.minClusterSize,
        },
        executedAt: startTime,
        durationMs: Date.now() - startTime,
      },
    };

    // Emit events
    for (const cluster of clusters) {
      this.emit('cluster:found', cluster);
    }
    this.emit('clustering:complete', result);

    return result;
  }

  /**
   * Extract features from a conversation
   */
  private extractFeatures(
    conversation: Conversation,
    _fields?: string[],
  ): number[] {
    // Simple TF-IDF-like feature extraction
    const text = this.getConversationText(conversation);
    const words = this.tokenize(text);
    const wordCounts = new Map<string, number>();

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
    }

    // Create feature vector from top words
    const topWords = this.getVocabulary();
    const features: number[] = [];

    for (const word of topWords) {
      features.push(wordCounts.get(word) ?? 0);
    }

    // Normalize
    const norm = Math.sqrt(features.reduce((sum, v) => sum + v * v, 0));
    return norm > 0 ? features.map((v) => v / norm) : features;
  }

  /**
   * Get vocabulary for feature extraction
   */
  private getVocabulary(): string[] {
    // Return a set of common discriminating words
    return [
      'help',
      'problem',
      'issue',
      'error',
      'how',
      'what',
      'why',
      'account',
      'password',
      'login',
      'payment',
      'order',
      'shipping',
      'return',
      'refund',
      'product',
      'feature',
      'bug',
      'support',
      'thank',
      'thanks',
      'please',
      'need',
      'want',
      'can',
      'would',
      'price',
      'cost',
      'update',
      'change',
      'cancel',
      'confirm',
    ];
  }

  /**
   * Get text content from conversation
   */
  private getConversationText(conversation: Conversation): string {
    return conversation.messages.map((m) => m.content).join(' ');
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  /**
   * Perform clustering using specified method
   */
  private performClustering(
    features: number[][],
    options: ClusteringOptions,
  ): number[] {
    const method = this.config.method ?? 'kmeans';
    const numClusters = options.maxClusters ?? this.config.numClusters ?? 5;

    switch (method) {
      case 'kmeans':
        return this.kMeansClustering(features, numClusters);
      case 'dbscan':
        return this.dbscanClustering(features);
      default:
        return this.kMeansClustering(features, numClusters);
    }
  }

  /**
   * K-means clustering implementation
   */
  private kMeansClustering(features: number[][], k: number): number[] {
    if (features.length === 0) return [];
    if (features.length <= k) {
      return features.map((_, i) => i);
    }

    const maxIterations = 100;
    const dim = features[0].length;

    // Initialize centroids randomly
    let centroids = this.initializeCentroids(features, k);
    let assignments = new Array(features.length).fill(-1);

    for (let iter = 0; iter < maxIterations; iter++) {
      // Assign points to nearest centroid
      const newAssignments = features.map((f) => {
        let minDist = Infinity;
        let minIndex = 0;
        for (let c = 0; c < centroids.length; c++) {
          const dist = this.euclideanDistance(f, centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            minIndex = c;
          }
        }
        return minIndex;
      });

      // Check for convergence
      if (this.arraysEqual(assignments, newAssignments)) {
        break;
      }
      assignments = newAssignments;

      // Update centroids
      centroids = this.updateCentroids(features, assignments, k, dim);
    }

    return assignments;
  }

  /**
   * Initialize centroids using k-means++
   */
  private initializeCentroids(features: number[][], k: number): number[][] {
    const centroids: number[][] = [];

    // Choose first centroid randomly
    centroids.push([...features[Math.floor(Math.random() * features.length)]]);

    // Choose remaining centroids with probability proportional to distance
    for (let i = 1; i < k; i++) {
      const distances = features.map((f) => {
        let minDist = Infinity;
        for (const c of centroids) {
          const dist = this.euclideanDistance(f, c);
          minDist = Math.min(minDist, dist);
        }
        return minDist * minDist;
      });

      const totalDist = distances.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalDist;

      for (let j = 0; j < features.length; j++) {
        random -= distances[j];
        if (random <= 0) {
          centroids.push([...features[j]]);
          break;
        }
      }

      if (centroids.length === i) {
        centroids.push([
          ...features[Math.floor(Math.random() * features.length)],
        ]);
      }
    }

    return centroids;
  }

  /**
   * Update centroids based on current assignments
   */
  private updateCentroids(
    features: number[][],
    assignments: number[],
    k: number,
    dim: number,
  ): number[][] {
    const centroids: number[][] = [];

    for (let c = 0; c < k; c++) {
      const clusterPoints = features.filter((_, i) => assignments[i] === c);

      if (clusterPoints.length === 0) {
        // Keep old centroid or reinitialize
        centroids.push(new Array(dim).fill(0));
      } else {
        const centroid = new Array(dim).fill(0);
        for (const point of clusterPoints) {
          for (let d = 0; d < dim; d++) {
            centroid[d] += point[d];
          }
        }
        for (let d = 0; d < dim; d++) {
          centroid[d] /= clusterPoints.length;
        }
        centroids.push(centroid);
      }
    }

    return centroids;
  }

  /**
   * DBSCAN clustering implementation
   */
  private dbscanClustering(features: number[][]): number[] {
    const epsilon = this.config.epsilon ?? 0.5;
    const minSamples = this.config.minSamples ?? 3;

    const assignments = new Array(features.length).fill(-1);
    let clusterId = 0;

    for (let i = 0; i < features.length; i++) {
      if (assignments[i] !== -1) continue;

      const neighbors = this.getNeighbors(features, i, epsilon);
      if (neighbors.length < minSamples) {
        assignments[i] = -1; // Noise
        continue;
      }

      // Expand cluster
      assignments[i] = clusterId;
      const seeds = [...neighbors];

      while (seeds.length > 0) {
        const j = seeds.pop()!;
        if (assignments[j] === -1) {
          assignments[j] = clusterId;
        }
        if (assignments[j] !== -1) continue;

        assignments[j] = clusterId;
        const jNeighbors = this.getNeighbors(features, j, epsilon);
        if (jNeighbors.length >= minSamples) {
          seeds.push(...jNeighbors);
        }
      }

      clusterId++;
    }

    return assignments;
  }

  /**
   * Get neighbors within epsilon distance
   */
  private getNeighbors(
    features: number[][],
    index: number,
    epsilon: number,
  ): number[] {
    const neighbors: number[] = [];
    for (let i = 0; i < features.length; i++) {
      if (
        i !== index &&
        this.euclideanDistance(features[index], features[i]) <= epsilon
      ) {
        neighbors.push(i);
      }
    }
    return neighbors;
  }

  /**
   * Calculate Euclidean distance
   */
  private euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] - b[i]) ** 2;
    }
    return Math.sqrt(sum);
  }

  /**
   * Check array equality
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Build cluster objects from assignments
   */
  private buildClusters(
    conversations: Conversation[],
    assignments: number[],
    _features: number[][],
  ): Cluster[] {
    const clusterMap = new Map<number, Conversation[]>();

    for (let i = 0; i < assignments.length; i++) {
      const clusterId = assignments[i];
      if (clusterId === -1) continue;

      const cluster = clusterMap.get(clusterId) ?? [];
      cluster.push(conversations[i]);
      clusterMap.set(clusterId, cluster);
    }

    const clusters: Cluster[] = [];
    for (const [id, convs] of clusterMap) {
      if (convs.length < (this.config.minClusterSize ?? 1)) {
        continue;
      }

      // Extract keywords
      const keywords = this.extractKeywords(convs);

      // Find representative
      const representative = this.findRepresentative(convs);

      // Calculate success rate
      const successCount = convs.filter((c) => c.outcome?.success).length;
      const successRate = successCount / convs.length;

      // Calculate average satisfaction
      const satisfactions = convs
        .filter((c) => c.outcome?.satisfaction !== undefined)
        .map((c) => c.outcome!.satisfaction!);
      const avgSatisfaction =
        satisfactions.length > 0
          ? satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length
          : undefined;

      clusters.push({
        id: nanoid(),
        name: `Cluster ${id + 1}: ${keywords.slice(0, 3).join(', ')}`,
        size: convs.length,
        keywords,
        representative,
        successRate,
        avgSatisfaction,
        conversationIds: convs.map((c) => c.id),
      });
    }

    // Sort by size
    clusters.sort((a, b) => b.size - a.size);
    return clusters;
  }

  /**
   * Extract keywords from conversations
   */
  private extractKeywords(conversations: Conversation[]): string[] {
    const wordCounts = new Map<string, number>();

    for (const conv of conversations) {
      const text = this.getConversationText(conv);
      const words = this.tokenize(text);

      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }

    // Get top words
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Find representative conversation
   */
  private findRepresentative(conversations: Conversation[]): string {
    // Return first user message from most typical conversation
    const conv = conversations[0];
    const userMessage = conv.messages.find((m) => m.role === 'user');
    return userMessage?.content.slice(0, 200) ?? 'No representative text';
  }

  /**
   * Calculate silhouette score
   */
  private calculateSilhouetteScore(
    features: number[][],
    assignments: number[],
  ): number {
    if (features.length <= 1) return 0;

    const uniqueClusters = new Set(assignments.filter((a) => a !== -1));
    if (uniqueClusters.size <= 1) return 0;

    let totalScore = 0;
    let count = 0;

    for (let i = 0; i < features.length; i++) {
      if (assignments[i] === -1) continue;

      // Calculate a (mean intra-cluster distance)
      const sameCluster = features.filter(
        (_, j) => j !== i && assignments[j] === assignments[i],
      );
      const a =
        sameCluster.length > 0
          ? sameCluster.reduce(
              (sum, f) => sum + this.euclideanDistance(features[i], f),
              0,
            ) / sameCluster.length
          : 0;

      // Calculate b (mean nearest-cluster distance)
      let b = Infinity;
      for (const clusterId of uniqueClusters) {
        if (clusterId === assignments[i]) continue;
        const otherCluster = features.filter(
          (_, j) => assignments[j] === clusterId,
        );
        if (otherCluster.length === 0) continue;
        const meanDist =
          otherCluster.reduce(
            (sum, f) => sum + this.euclideanDistance(features[i], f),
            0,
          ) / otherCluster.length;
        b = Math.min(b, meanDist);
      }

      if (b === Infinity) continue;

      const s = (b - a) / Math.max(a, b);
      totalScore += s;
      count++;
    }

    return count > 0 ? totalScore / count : 0;
  }

  /**
   * Convert period to time range
   */
  private periodToTimeRange(period: string): { start: number; end: number } {
    const now = Date.now();
    const periods: Record<string, number> = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };
    return {
      start: now - (periods[period] ?? periods.week),
      end: now,
    };
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}

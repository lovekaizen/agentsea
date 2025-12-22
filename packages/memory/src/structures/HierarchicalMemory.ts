/**
 * HierarchicalMemory
 *
 * Routes between working, episodic, semantic, and long-term memory.
 * Manages memory consolidation and retrieval across all layers.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  HierarchicalMemoryConfig,
  MemoryStoreInterface,
} from '../types/index.js';
import { WorkingMemory } from './WorkingMemory.js';
import { EpisodicMemory } from './EpisodicMemory.js';
import { SemanticMemory } from './SemanticMemory.js';
import { LongTermMemory } from './LongTermMemory.js';

/**
 * Memory layer type
 */
export type MemoryLayer = 'working' | 'episodic' | 'semantic' | 'longterm';

/**
 * Routing decision
 */
export interface RoutingDecision {
  layer: MemoryLayer;
  confidence: number;
  reason: string;
}

/**
 * Hierarchical memory events
 */
export interface HierarchicalMemoryEvents {
  routed: (entry: MemoryEntry, layer: MemoryLayer) => void;
  promoted: (entry: MemoryEntry, from: MemoryLayer, to: MemoryLayer) => void;
  consolidated: (from: MemoryLayer, to: MemoryLayer, count: number) => void;
  retrieved: (entries: MemoryEntry[], layers: MemoryLayer[]) => void;
}

/**
 * Search result with layer information
 */
export interface HierarchicalSearchResult {
  entry: MemoryEntry;
  score: number;
  layer: MemoryLayer;
}

/**
 * Hierarchical memory system
 */
export class HierarchicalMemory extends EventEmitter<HierarchicalMemoryEvents> {
  private workingMemory: WorkingMemory;
  private episodicMemory: EpisodicMemory;
  private semanticMemory: SemanticMemory;
  private longTermMemory: LongTermMemory;
  private config: Required<HierarchicalMemoryConfig>;
  private embedFn?: (text: string) => Promise<number[]>;

  constructor(
    stores: {
      working: MemoryStoreInterface;
      episodic: MemoryStoreInterface;
      semantic: MemoryStoreInterface;
      longterm: MemoryStoreInterface;
    },
    config: HierarchicalMemoryConfig = {},
  ) {
    super();

    this.config = {
      working: config.working ?? {},
      episodic: config.episodic ?? {},
      semantic: config.semantic ?? {},
      longTerm: config.longTerm ?? {},
      routing: config.routing ?? {},
      routingStrategy: config.routingStrategy ?? 'auto',
      consolidationInterval: config.consolidationInterval ?? 60 * 60 * 1000, // 1 hour
      workingMemorySize: config.workingMemorySize ?? 20,
      promotionThreshold: config.promotionThreshold ?? 0.7,
    };

    // Initialize memory layers
    this.workingMemory = new WorkingMemory(stores.working, {
      maxSize: this.config.workingMemorySize,
    });

    this.episodicMemory = new EpisodicMemory(stores.episodic);
    this.semanticMemory = new SemanticMemory(stores.semantic);
    this.longTermMemory = new LongTermMemory(stores.longterm);

    // Set up cross-layer events
    this.setupEventHandlers();
  }

  /**
   * Set embedding function for semantic search
   */
  setEmbeddingFunction(fn: (text: string) => Promise<number[]>): void {
    this.embedFn = fn;
  }

  /**
   * Add a memory entry with automatic routing
   */
  async add(entry: MemoryEntry): Promise<MemoryLayer> {
    const layer = this.route(entry);

    switch (layer) {
      case 'working':
        await this.workingMemory.add(entry);
        break;
      case 'episodic':
        await this.episodicMemory.recordEvent(entry);
        break;
      case 'semantic':
        await this.semanticMemory.learnFact(entry.content, entry.metadata);
        break;
      case 'longterm':
        await this.longTermMemory.store_memory(entry);
        break;
    }

    this.emit('routed', entry, layer);
    return layer;
  }

  /**
   * Add to a specific layer
   */
  async addToLayer(entry: MemoryEntry, layer: MemoryLayer): Promise<void> {
    switch (layer) {
      case 'working':
        await this.workingMemory.add(entry);
        break;
      case 'episodic':
        await this.episodicMemory.recordEvent(entry);
        break;
      case 'semantic':
        await this.semanticMemory.learnFact(entry.content, entry.metadata);
        break;
      case 'longterm':
        await this.longTermMemory.store_memory(entry);
        break;
    }

    this.emit('routed', entry, layer);
  }

  /**
   * Search across all memory layers
   */
  async search(
    query: string,
    options?: {
      layers?: MemoryLayer[];
      topK?: number;
      minScore?: number;
    },
  ): Promise<HierarchicalSearchResult[]> {
    const layers = options?.layers ?? [
      'working',
      'episodic',
      'semantic',
      'longterm',
    ];
    const topK = options?.topK ?? 10;
    const minScore = options?.minScore ?? 0.3;

    const results: HierarchicalSearchResult[] = [];

    // Get embedding for semantic search
    let embedding: number[] | undefined;
    if (this.embedFn) {
      embedding = await this.embedFn(query);
    }

    // Search each layer
    for (const layer of layers) {
      const layerResults = await this.searchLayer(layer, query, embedding, {
        topK,
        minScore,
      });
      results.push(...layerResults);
    }

    // Sort by score and deduplicate
    results.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const deduplicated = results.filter((r) => {
      if (seen.has(r.entry.id)) return false;
      seen.add(r.entry.id);
      return true;
    });

    this.emit(
      'retrieved',
      deduplicated.map((r) => r.entry),
      layers,
    );

    return deduplicated.slice(0, topK);
  }

  /**
   * Search a specific layer
   */
  private async searchLayer(
    layer: MemoryLayer,
    query: string,
    embedding?: number[],
    options?: { topK?: number; minScore?: number },
  ): Promise<HierarchicalSearchResult[]> {
    const topK = options?.topK ?? 10;

    switch (layer) {
      case 'working': {
        const context = this.workingMemory.getContextWithAttention();
        return context
          .filter((c) =>
            c.entry.content.toLowerCase().includes(query.toLowerCase()),
          )
          .map((c) => ({
            entry: c.entry,
            score: c.total,
            layer: 'working' as MemoryLayer,
          }))
          .slice(0, topK);
      }

      case 'episodic': {
        const episodes = await this.episodicMemory.recall({ limit: topK * 2 });
        return episodes
          .filter((e) => e.content.toLowerCase().includes(query.toLowerCase()))
          .map((entry) => ({
            entry,
            score: this.calculateTextScore(query, entry.content),
            layer: 'episodic' as MemoryLayer,
          }))
          .slice(0, topK);
      }

      case 'semantic': {
        const facts = await this.semanticMemory.queryFacts(query, topK);
        return facts.map((entry) => ({
          entry,
          score: this.calculateTextScore(query, entry.content),
          layer: 'semantic' as MemoryLayer,
        }));
      }

      case 'longterm': {
        if (embedding) {
          const results = await this.longTermMemory.retrieve(embedding, {
            topK,
          });
          return results.map((r) => ({
            entry: r.entry,
            score: r.score,
            layer: 'longterm' as MemoryLayer,
          }));
        }
        const entries = await this.longTermMemory.query({ query, limit: topK });
        return entries.map((entry) => ({
          entry,
          score: this.calculateTextScore(query, entry.content),
          layer: 'longterm' as MemoryLayer,
        }));
      }

      default:
        return [];
    }
  }

  /**
   * Get context from working memory
   */
  getWorkingContext(): MemoryEntry[] {
    return this.workingMemory.getContext();
  }

  /**
   * Promote a memory to a higher layer
   */
  async promote(
    entryId: string,
    from: MemoryLayer,
    to: MemoryLayer,
  ): Promise<boolean> {
    // Get entry from source layer
    let entry: MemoryEntry | null = null;

    switch (from) {
      case 'working':
        entry =
          this.workingMemory.getContext().find((e) => e.id === entryId) ?? null;
        break;
      case 'episodic': {
        const events = await this.episodicMemory.recall({ limit: 1000 });
        entry = events.find((e) => e.id === entryId) ?? null;
        break;
      }
      // semantic and longterm don't typically need promotion
    }

    if (!entry) return false;

    // Add to target layer
    await this.addToLayer(entry, to);
    this.emit('promoted', entry, from, to);

    return true;
  }

  /**
   * Consolidate memories from one layer to another
   */
  async consolidate(from: MemoryLayer, to: MemoryLayer): Promise<number> {
    let count = 0;

    switch (from) {
      case 'working':
        if (to === 'episodic' || to === 'longterm') {
          const context = this.workingMemory.getContext();
          const important = context.filter(
            (e) => e.importance >= this.config.promotionThreshold,
          );
          for (const entry of important) {
            await this.addToLayer(entry, to);
            count++;
          }
        }
        break;

      case 'episodic':
        if (to === 'longterm') {
          const episodes = this.episodicMemory.getRecentEpisodes(10);
          for (const episode of episodes) {
            if (episode.summary) {
              await this.longTermMemory.store_memory({
                id: `consolidated-${episode.id}`,
                content: episode.summary,
                type: 'summary',
                importance: 0.7,
                metadata: {
                  source: 'system' as const,
                  confidence: 0.85,
                  sourceEpisodeId: episode.id,
                  eventCount: episode.events.length,
                },
                timestamp: episode.startTime,
                accessCount: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              count++;
            }
          }
        }
        break;
    }

    if (count > 0) {
      this.emit('consolidated', from, to, count);
    }

    return count;
  }

  /**
   * Route a memory entry to the appropriate layer
   */
  route(entry: MemoryEntry): MemoryLayer {
    if (this.config.routingStrategy === 'manual') {
      return (entry.metadata.targetLayer as MemoryLayer) ?? 'working';
    }

    // Auto-routing based on entry characteristics
    const decision = this.makeRoutingDecision(entry);
    return decision.layer;
  }

  /**
   * Make routing decision
   */
  private makeRoutingDecision(entry: MemoryEntry): RoutingDecision {
    // Event type -> episodic
    if (entry.type === 'event') {
      return {
        layer: 'episodic',
        confidence: 0.9,
        reason: 'Event type maps to episodic memory',
      };
    }

    // Fact type -> semantic
    if (entry.type === 'fact') {
      return {
        layer: 'semantic',
        confidence: 0.9,
        reason: 'Fact type maps to semantic memory',
      };
    }

    // High importance -> long-term
    if (entry.importance >= 0.8) {
      return {
        layer: 'longterm',
        confidence: 0.8,
        reason: 'High importance memory',
      };
    }

    // Context type -> working
    if (entry.type === 'context') {
      return {
        layer: 'working',
        confidence: 0.9,
        reason: 'Context type maps to working memory',
      };
    }

    // Summary -> long-term
    if (entry.type === 'summary') {
      return {
        layer: 'longterm',
        confidence: 0.8,
        reason: 'Summary type maps to long-term memory',
      };
    }

    // Default to working memory for recent context
    return {
      layer: 'working',
      confidence: 0.6,
      reason: 'Default routing to working memory',
    };
  }

  /**
   * Calculate text similarity score
   */
  private calculateTextScore(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (word.length > 2 && contentLower.includes(word)) {
        matches++;
      }
    }

    return queryWords.length > 0 ? matches / queryWords.length : 0;
  }

  /**
   * Set up event handlers between layers
   */
  private setupEventHandlers(): void {
    // When working memory overflows, consider promoting to long-term
    this.workingMemory.on('overflow', (evicted) => {
      void (async () => {
        for (const entry of evicted) {
          if (entry.importance >= this.config.promotionThreshold) {
            await this.longTermMemory.store_memory(entry);
          }
        }
      })();
    });

    // When episode ends, summarize to long-term
    this.episodicMemory.on('episodeEnd', (episode) => {
      void (async () => {
        if (episode.summary && episode.events.length >= 5) {
          await this.longTermMemory.store_memory({
            id: `episode-${episode.id}`,
            content: episode.summary,
            type: 'summary',
            importance: 0.6,
            metadata: {
              source: 'system' as const,
              confidence: 0.8,
              episodeId: episode.id,
              eventCount: episode.events.length,
            },
            timestamp: episode.startTime,
            accessCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      })();
    });
  }

  /**
   * Get statistics for all layers
   */
  async getStats(): Promise<{
    working: ReturnType<WorkingMemory['getSummary']>;
    episodic: ReturnType<EpisodicMemory['getStats']>;
    semantic: ReturnType<SemanticMemory['getStats']>;
    longterm: Awaited<ReturnType<LongTermMemory['getStats']>>;
  }> {
    return {
      working: this.workingMemory.getSummary(),
      episodic: this.episodicMemory.getStats(),
      semantic: this.semanticMemory.getStats(),
      longterm: await this.longTermMemory.getStats(),
    };
  }

  /**
   * Access individual memory layers
   */
  get layers() {
    return {
      working: this.workingMemory,
      episodic: this.episodicMemory,
      semantic: this.semanticMemory,
      longterm: this.longTermMemory,
    };
  }
}

/**
 * Create hierarchical memory system
 */
export function createHierarchicalMemory(
  stores: {
    working: MemoryStoreInterface;
    episodic: MemoryStoreInterface;
    semantic: MemoryStoreInterface;
    longterm: MemoryStoreInterface;
  },
  config?: HierarchicalMemoryConfig,
): HierarchicalMemory {
  return new HierarchicalMemory(stores, config);
}

/**
 * SemanticMemory
 *
 * Stores factual knowledge, concepts, and relationships.
 * Supports knowledge graphs and concept organization.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  MemoryEntry,
  SemanticMemoryConfig,
  MemoryStoreInterface,
} from '../types/index.js';

/**
 * Concept node in the knowledge graph
 */
export interface Concept {
  id: string;
  name: string;
  description?: string;
  category?: string;
  attributes: Record<string, unknown>;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Relationship between concepts
 */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  metadata: Record<string, unknown>;
  createdAt: number;
}

/**
 * Semantic memory events
 */
export interface SemanticMemoryEvents {
  conceptAdded: (concept: Concept) => void;
  conceptUpdated: (concept: Concept) => void;
  relationshipAdded: (relationship: Relationship) => void;
  factLearned: (fact: MemoryEntry) => void;
}

/**
 * Semantic memory for factual knowledge
 */
export class SemanticMemory extends EventEmitter<SemanticMemoryEvents> {
  private store: MemoryStoreInterface;
  private config: Required<SemanticMemoryConfig>;
  private concepts: Map<string, Concept> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private conceptIndex: Map<string, Set<string>> = new Map(); // category -> concept IDs

  constructor(store: MemoryStoreInterface, config: SemanticMemoryConfig = {}) {
    super();
    this.store = store;
    this.config = {
      store: config.store ?? store,
      extractEntities: config.extractEntities ?? true,
      extractRelations: config.extractRelations ?? true,
      deduplication: config.deduplication ?? true,
      deduplicationThreshold: config.deduplicationThreshold ?? 0.9,
      maxConcepts: config.maxConcepts ?? 10000,
      enableInference: config.enableInference ?? true,
      conflictResolution: config.conflictResolution ?? 'newest',
      minConfidence: config.minConfidence ?? 0.5,
    };
  }

  /**
   * Learn a new fact
   */
  async learnFact(
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<MemoryEntry> {
    const fact: MemoryEntry = {
      id: this.generateId('fact'),
      content,
      type: 'fact',
      importance: (metadata?.importance as number) ?? 0.5,
      metadata: {
        source: 'explicit' as const,
        confidence: (metadata?.confidence as number) ?? 0.8,
        ...metadata,
        verified: metadata?.verified ?? false,
      },
      timestamp: Date.now(),
      accessCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.store.add(fact);
    this.emit('factLearned', fact);

    return fact;
  }

  /**
   * Add or update a concept
   */
  addConcept(
    concept: Omit<Concept, 'id' | 'createdAt' | 'updatedAt'>,
  ): Concept {
    // Check for existing concept with same name
    const existing = Array.from(this.concepts.values()).find(
      (c) => c.name.toLowerCase() === concept.name.toLowerCase(),
    );

    if (existing) {
      // Update existing concept
      const updated: Concept = {
        ...existing,
        ...concept,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };
      this.concepts.set(existing.id, updated);
      this.emit('conceptUpdated', updated);
      return updated;
    }

    // Create new concept
    const newConcept: Concept = {
      ...concept,
      id: this.generateId('concept'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.concepts.set(newConcept.id, newConcept);

    // Index by category
    if (newConcept.category) {
      if (!this.conceptIndex.has(newConcept.category)) {
        this.conceptIndex.set(newConcept.category, new Set());
      }
      this.conceptIndex.get(newConcept.category)!.add(newConcept.id);
    }

    this.emit('conceptAdded', newConcept);
    return newConcept;
  }

  /**
   * Create a relationship between concepts
   */
  addRelationship(
    sourceId: string,
    targetId: string,
    type: string,
    metadata?: Record<string, unknown>,
  ): Relationship | null {
    const source = this.concepts.get(sourceId);
    const target = this.concepts.get(targetId);

    if (!source || !target) {
      return null;
    }

    // Check for existing relationship
    const existing = Array.from(this.relationships.values()).find(
      (r) =>
        r.sourceId === sourceId && r.targetId === targetId && r.type === type,
    );

    if (existing) {
      // Update weight
      existing.weight = Math.min(existing.weight + 0.1, 1.0);
      return existing;
    }

    const relationship: Relationship = {
      id: this.generateId('rel'),
      sourceId,
      targetId,
      type,
      weight: (metadata?.weight as number) ?? 0.5,
      metadata: metadata ?? {},
      createdAt: Date.now(),
    };

    this.relationships.set(relationship.id, relationship);
    this.emit('relationshipAdded', relationship);

    return relationship;
  }

  /**
   * Get a concept by ID or name
   */
  getConcept(idOrName: string): Concept | undefined {
    const byId = this.concepts.get(idOrName);
    if (byId) return byId;

    return Array.from(this.concepts.values()).find(
      (c) => c.name.toLowerCase() === idOrName.toLowerCase(),
    );
  }

  /**
   * Get concepts by category
   */
  getConceptsByCategory(category: string): Concept[] {
    const ids = this.conceptIndex.get(category);
    if (!ids) return [];

    return Array.from(ids)
      .map((id) => this.concepts.get(id))
      .filter((c): c is Concept => c !== undefined);
  }

  /**
   * Get relationships for a concept
   */
  getRelationships(
    conceptId: string,
    direction: 'outgoing' | 'incoming' | 'both' = 'both',
  ): Relationship[] {
    return Array.from(this.relationships.values()).filter((r) => {
      if (direction === 'outgoing') return r.sourceId === conceptId;
      if (direction === 'incoming') return r.targetId === conceptId;
      return r.sourceId === conceptId || r.targetId === conceptId;
    });
  }

  /**
   * Get related concepts
   */
  getRelatedConcepts(
    conceptId: string,
    relationshipType?: string,
    maxDepth: number = 1,
  ): Array<{ concept: Concept; path: Relationship[]; distance: number }> {
    const results: Map<
      string,
      { concept: Concept; path: Relationship[]; distance: number }
    > = new Map();
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: Relationship[]; distance: number }> =
      [{ id: conceptId, path: [], distance: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.distance > maxDepth) continue;
      visited.add(current.id);

      const relationships = this.getRelationships(current.id);
      for (const rel of relationships) {
        if (relationshipType && rel.type !== relationshipType) continue;

        const relatedId =
          rel.sourceId === current.id ? rel.targetId : rel.sourceId;
        if (relatedId === conceptId) continue; // Skip self

        const concept = this.concepts.get(relatedId);
        if (!concept) continue;

        const newPath = [...current.path, rel];
        const existing = results.get(relatedId);

        if (!existing || newPath.length < existing.path.length) {
          results.set(relatedId, {
            concept,
            path: newPath,
            distance: current.distance + 1,
          });

          if (current.distance + 1 < maxDepth) {
            queue.push({
              id: relatedId,
              path: newPath,
              distance: current.distance + 1,
            });
          }
        }
      }
    }

    return Array.from(results.values()).sort((a, b) => a.distance - b.distance);
  }

  /**
   * Query facts
   */
  async queryFacts(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    const { entries } = await this.store.query({
      query,
      types: ['fact'],
      limit,
    });

    return entries;
  }

  /**
   * Search facts by embedding
   */
  async searchFacts(
    embedding: number[],
    options?: { topK?: number; minScore?: number },
  ): Promise<Array<{ entry: MemoryEntry; score: number }>> {
    const results = await this.store.search(embedding, {
      topK: options?.topK ?? 10,
      minScore: options?.minScore ?? this.config.minConfidence,
    });

    return results.filter((r) => r.entry.type === 'fact');
  }

  /**
   * Find path between two concepts
   */
  findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5,
  ): Relationship[] | null {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: Relationship[] }> = [
      { id: sourceId, path: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id) || current.path.length >= maxDepth) continue;
      visited.add(current.id);

      const relationships = this.getRelationships(current.id);
      for (const rel of relationships) {
        const nextId =
          rel.sourceId === current.id ? rel.targetId : rel.sourceId;
        const newPath = [...current.path, rel];

        if (nextId === targetId) {
          return newPath;
        }

        queue.push({ id: nextId, path: newPath });
      }
    }

    return null;
  }

  /**
   * Infer new relationships based on existing ones
   */
  inferRelationships(): Relationship[] {
    if (!this.config.enableInference) return [];

    const inferred: Relationship[] = [];

    // Simple transitivity inference
    // If A -> B and B -> C, then A -> C (for certain relationship types)
    const transitiveTypes = ['is_a', 'part_of', 'related_to'];

    for (const rel1 of this.relationships.values()) {
      if (!transitiveTypes.includes(rel1.type)) continue;

      for (const rel2 of this.relationships.values()) {
        if (rel1.id === rel2.id) continue;
        if (rel1.type !== rel2.type) continue;
        if (rel1.targetId !== rel2.sourceId) continue;

        // Check if relationship already exists
        const exists = Array.from(this.relationships.values()).some(
          (r) =>
            r.sourceId === rel1.sourceId &&
            r.targetId === rel2.targetId &&
            r.type === rel1.type,
        );

        if (!exists) {
          const newRel = this.addRelationship(
            rel1.sourceId,
            rel2.targetId,
            rel1.type,
            {
              inferred: true,
              weight: rel1.weight * rel2.weight * 0.8,
            },
          );
          if (newRel) {
            inferred.push(newRel);
          }
        }
      }
    }

    return inferred;
  }

  /**
   * Get conflicting facts
   */
  async findConflicts(fact: MemoryEntry): Promise<MemoryEntry[]> {
    // Search for similar facts
    const { entries } = await this.store.query({
      query: fact.content,
      types: ['fact'],
      limit: 20,
    });

    // Filter for potential conflicts (same topic, different assertion)
    // This is a simple heuristic - real conflict detection would be more sophisticated
    return entries.filter((e) => {
      if (e.id === fact.id) return false;

      // Check for negation patterns
      const contentLower = e.content.toLowerCase();
      const factLower = fact.content.toLowerCase();

      const negationPatterns = ['not ', "isn't", "aren't", 'never', 'false'];
      const hasNegation = negationPatterns.some(
        (p) =>
          (contentLower.includes(p) && !factLower.includes(p)) ||
          (!contentLower.includes(p) && factLower.includes(p)),
      );

      return hasNegation;
    });
  }

  /**
   * Resolve conflict between facts
   */
  resolveConflict(fact1: MemoryEntry, fact2: MemoryEntry): MemoryEntry {
    switch (this.config.conflictResolution) {
      case 'newest':
        return fact1.timestamp > fact2.timestamp ? fact1 : fact2;

      case 'highest-confidence': {
        const conf1 = fact1.metadata.confidence ?? 0.5;
        const conf2 = fact2.metadata.confidence ?? 0.5;
        return conf1 > conf2 ? fact1 : fact2;
      }

      case 'merge':
        // Keep both with a note
        return {
          ...fact1,
          content: `${fact1.content} (Note: conflicting fact exists: ${fact2.content})`,
          metadata: {
            ...fact1.metadata,
            hasConflict: true,
            conflictingFactId: fact2.id,
          },
        };

      default:
        return fact1;
    }
  }

  /**
   * Export knowledge graph
   */
  exportGraph(): {
    concepts: Concept[];
    relationships: Relationship[];
  } {
    return {
      concepts: Array.from(this.concepts.values()),
      relationships: Array.from(this.relationships.values()),
    };
  }

  /**
   * Import knowledge graph
   */
  importGraph(data: {
    concepts: Concept[];
    relationships: Relationship[];
  }): void {
    for (const concept of data.concepts) {
      this.concepts.set(concept.id, concept);
      if (concept.category) {
        if (!this.conceptIndex.has(concept.category)) {
          this.conceptIndex.set(concept.category, new Set());
        }
        this.conceptIndex.get(concept.category)!.add(concept.id);
      }
    }

    for (const relationship of data.relationships) {
      this.relationships.set(relationship.id, relationship);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    conceptCount: number;
    relationshipCount: number;
    categoryCount: number;
    avgRelationshipsPerConcept: number;
  } {
    return {
      conceptCount: this.concepts.size,
      relationshipCount: this.relationships.size,
      categoryCount: this.conceptIndex.size,
      avgRelationshipsPerConcept:
        this.concepts.size > 0
          ? this.relationships.size / this.concepts.size
          : 0,
    };
  }
}

/**
 * Create semantic memory instance
 */
export function createSemanticMemory(
  store: MemoryStoreInterface,
  config?: SemanticMemoryConfig,
): SemanticMemory {
  return new SemanticMemory(store, config);
}

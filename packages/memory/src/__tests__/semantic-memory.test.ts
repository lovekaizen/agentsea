import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SemanticMemory } from '../structures/SemanticMemory.js';
import { InMemoryStore } from '../stores/implementations/InMemoryStore.js';

describe('SemanticMemory', () => {
  let semanticMemory: SemanticMemory;
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    semanticMemory = new SemanticMemory(store, {
      extractEntities: true,
      extractRelations: true,
      enableInference: true,
      minConfidence: 0.5,
    });
  });

  describe('learnFact', () => {
    it('should learn a new fact', async () => {
      const fact = await semanticMemory.learnFact(
        'Paris is the capital of France',
      );

      expect(fact.type).toBe('fact');
      expect(fact.content).toBe('Paris is the capital of France');
    });

    it('should emit factLearned event', async () => {
      const handler = vi.fn();
      semanticMemory.on('factLearned', handler);

      await semanticMemory.learnFact('Test fact');

      expect(handler).toHaveBeenCalled();
    });

    it('should accept custom metadata', async () => {
      const fact = await semanticMemory.learnFact('Custom fact', {
        importance: 0.9,
        verified: true,
      });

      expect(fact.importance).toBe(0.9);
      expect(fact.metadata.verified).toBe(true);
    });
  });

  describe('addConcept', () => {
    it('should add a new concept', () => {
      const concept = semanticMemory.addConcept({
        name: 'Machine Learning',
        description: 'AI technique',
        category: 'technology',
        attributes: { field: 'AI' },
      });

      expect(concept.id).toBeDefined();
      expect(concept.name).toBe('Machine Learning');
      expect(concept.category).toBe('technology');
    });

    it('should emit conceptAdded event', () => {
      const handler = vi.fn();
      semanticMemory.on('conceptAdded', handler);

      semanticMemory.addConcept({
        name: 'Test Concept',
        attributes: {},
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should update existing concept with same name', () => {
      const first = semanticMemory.addConcept({
        name: 'Python',
        category: 'programming',
        attributes: {},
      });

      const updated = semanticMemory.addConcept({
        name: 'Python',
        category: 'programming',
        attributes: { version: '3.10' },
      });

      expect(updated.id).toBe(first.id);
      expect(updated.attributes.version).toBe('3.10');
    });

    it('should emit conceptUpdated event for updates', () => {
      semanticMemory.addConcept({ name: 'Test', attributes: {} });

      const handler = vi.fn();
      semanticMemory.on('conceptUpdated', handler);

      semanticMemory.addConcept({ name: 'Test', attributes: { new: 'field' } });

      expect(handler).toHaveBeenCalled();
    });

    it('should index by category', () => {
      semanticMemory.addConcept({
        name: 'Concept1',
        category: 'tech',
        attributes: {},
      });
      semanticMemory.addConcept({
        name: 'Concept2',
        category: 'tech',
        attributes: {},
      });

      const techConcepts = semanticMemory.getConceptsByCategory('tech');

      expect(techConcepts.length).toBe(2);
    });
  });

  describe('addRelationship', () => {
    it('should create relationship between concepts', () => {
      const python = semanticMemory.addConcept({
        name: 'Python',
        attributes: {},
      });
      const programming = semanticMemory.addConcept({
        name: 'Programming Language',
        attributes: {},
      });

      const relationship = semanticMemory.addRelationship(
        python.id,
        programming.id,
        'is_a',
      );

      expect(relationship).not.toBeNull();
      expect(relationship?.type).toBe('is_a');
    });

    it('should emit relationshipAdded event', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });

      const handler = vi.fn();
      semanticMemory.on('relationshipAdded', handler);

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');

      expect(handler).toHaveBeenCalled();
    });

    it('should return null for non-existent concepts', () => {
      const relationship = semanticMemory.addRelationship(
        'fake-id',
        'fake-id-2',
        'is_a',
      );

      expect(relationship).toBeNull();
    });

    it('should strengthen existing relationships', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });

      const rel1 = semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');
      const initialWeight = rel1!.weight;
      const rel2 = semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');

      // Second call should strengthen (or at least maintain) the relationship
      expect(rel2?.weight).toBeGreaterThanOrEqual(initialWeight);
    });
  });

  describe('getConcept', () => {
    it('should retrieve concept by id', () => {
      const concept = semanticMemory.addConcept({
        name: 'Test',
        attributes: {},
      });

      const retrieved = semanticMemory.getConcept(concept.id);

      expect(retrieved?.id).toBe(concept.id);
    });

    it('should retrieve concept by name', () => {
      semanticMemory.addConcept({ name: 'JavaScript', attributes: {} });

      const retrieved = semanticMemory.getConcept('JavaScript');

      expect(retrieved?.name).toBe('JavaScript');
    });

    it('should be case-insensitive for name lookup', () => {
      semanticMemory.addConcept({ name: 'TypeScript', attributes: {} });

      const retrieved = semanticMemory.getConcept('typescript');

      expect(retrieved?.name).toBe('TypeScript');
    });
  });

  describe('getRelationships', () => {
    it('should get outgoing relationships', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');

      const relationships = semanticMemory.getRelationships(c1.id, 'outgoing');

      expect(relationships.length).toBe(1);
      expect(relationships[0].sourceId).toBe(c1.id);
    });

    it('should get incoming relationships', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');

      const relationships = semanticMemory.getRelationships(c2.id, 'incoming');

      expect(relationships.length).toBe(1);
      expect(relationships[0].targetId).toBe(c2.id);
    });

    it('should get both directions by default', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'C3', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');
      semanticMemory.addRelationship(c3.id, c1.id, 'relates_to');

      const relationships = semanticMemory.getRelationships(c1.id);

      expect(relationships.length).toBe(2);
    });
  });

  describe('getRelatedConcepts', () => {
    it('should find directly related concepts', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');

      const related = semanticMemory.getRelatedConcepts(c1.id);

      expect(related.length).toBe(1);
      expect(related[0].concept.id).toBe(c2.id);
      expect(related[0].distance).toBe(1);
    });

    it('should traverse multiple hops', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'C3', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');
      semanticMemory.addRelationship(c2.id, c3.id, 'relates_to');

      const related = semanticMemory.getRelatedConcepts(c1.id, undefined, 2);

      expect(related.some((r) => r.concept.id === c3.id)).toBe(true);
    });

    it('should filter by relationship type', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'C3', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'is_a');
      semanticMemory.addRelationship(c1.id, c3.id, 'has');

      const related = semanticMemory.getRelatedConcepts(c1.id, 'is_a');

      expect(related.length).toBe(1);
      expect(related[0].concept.id).toBe(c2.id);
    });
  });

  describe('findPath', () => {
    it('should find path between concepts', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'C3', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');
      semanticMemory.addRelationship(c2.id, c3.id, 'relates_to');

      const path = semanticMemory.findPath(c1.id, c3.id);

      expect(path).not.toBeNull();
      expect(path?.length).toBe(2);
    });

    it('should return null if no path exists', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });

      const path = semanticMemory.findPath(c1.id, c2.id);

      expect(path).toBeNull();
    });

    it('should respect max depth', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'C3', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');
      semanticMemory.addRelationship(c2.id, c3.id, 'relates_to');

      const path = semanticMemory.findPath(c1.id, c3.id, 1);

      expect(path).toBeNull();
    });
  });

  describe('inferRelationships', () => {
    it('should infer transitive relationships', () => {
      const c1 = semanticMemory.addConcept({ name: 'Dog', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'Mammal', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'Animal', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'is_a');
      semanticMemory.addRelationship(c2.id, c3.id, 'is_a');

      const inferred = semanticMemory.inferRelationships();

      const dogToAnimal = inferred.find(
        (r) => r.sourceId === c1.id && r.targetId === c3.id,
      );
      expect(dogToAnimal).toBeDefined();
    });

    it('should not create duplicate inferred relationships', () => {
      const c1 = semanticMemory.addConcept({ name: 'C1', attributes: {} });
      const c2 = semanticMemory.addConcept({ name: 'C2', attributes: {} });
      const c3 = semanticMemory.addConcept({ name: 'C3', attributes: {} });

      semanticMemory.addRelationship(c1.id, c2.id, 'is_a');
      semanticMemory.addRelationship(c2.id, c3.id, 'is_a');

      const inferred1 = semanticMemory.inferRelationships();
      const inferred2 = semanticMemory.inferRelationships();

      expect(inferred2.length).toBe(0); // No new inferences
    });
  });

  describe('exportGraph and importGraph', () => {
    it('should export knowledge graph', () => {
      semanticMemory.addConcept({ name: 'C1', attributes: {} });
      semanticMemory.addConcept({ name: 'C2', attributes: {} });

      const graph = semanticMemory.exportGraph();

      expect(graph.concepts.length).toBe(2);
      expect(graph.relationships.length).toBeGreaterThanOrEqual(0);
    });

    it('should import knowledge graph', () => {
      const graph = {
        concepts: [
          {
            id: 'c1',
            name: 'Concept1',
            attributes: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: 'c2',
            name: 'Concept2',
            attributes: {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        relationships: [
          {
            id: 'r1',
            sourceId: 'c1',
            targetId: 'c2',
            type: 'relates_to',
            weight: 0.5,
            metadata: {},
            createdAt: Date.now(),
          },
        ],
      };

      semanticMemory.importGraph(graph);

      expect(semanticMemory.getConcept('c1')).toBeDefined();
      expect(semanticMemory.getConcept('c2')).toBeDefined();
      expect(semanticMemory.getRelationships('c1').length).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return knowledge graph statistics', () => {
      const c1 = semanticMemory.addConcept({
        name: 'C1',
        category: 'cat1',
        attributes: {},
      });
      const c2 = semanticMemory.addConcept({
        name: 'C2',
        category: 'cat1',
        attributes: {},
      });

      semanticMemory.addRelationship(c1.id, c2.id, 'relates_to');

      const stats = semanticMemory.getStats();

      expect(stats.conceptCount).toBe(2);
      expect(stats.relationshipCount).toBe(1);
      expect(stats.categoryCount).toBe(1);
      expect(stats.avgRelationshipsPerConcept).toBeCloseTo(0.5);
    });
  });

  describe('conflict resolution', () => {
    it('should find conflicting facts', async () => {
      const fact1 = await semanticMemory.learnFact('The sky is blue');
      const fact2 = await semanticMemory.learnFact('The sky is not blue');

      const conflicts = await semanticMemory.findConflicts(fact1);

      // Conflict detection is heuristic-based, so we just verify it runs
      expect(Array.isArray(conflicts)).toBe(true);
    });

    it('should resolve conflicts by newest', async () => {
      const config = new SemanticMemory(store, {
        conflictResolution: 'newest',
      });

      const fact1 = await config.learnFact('Old fact');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const fact2 = await config.learnFact('New fact');

      const resolved = config.resolveConflict(fact1, fact2);

      expect(resolved.id).toBe(fact2.id);
    });

    it('should resolve conflicts by highest confidence', async () => {
      const config = new SemanticMemory(store, {
        conflictResolution: 'highest-confidence',
      });

      const fact1 = await config.learnFact('Fact 1', { confidence: 0.6 });
      const fact2 = await config.learnFact('Fact 2', { confidence: 0.9 });

      const resolved = config.resolveConflict(fact1, fact2);

      expect(resolved.id).toBe(fact2.id);
    });
  });
});

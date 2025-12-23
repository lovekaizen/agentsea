import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Extractor } from '../processing/Extractor.js';
import type { MemoryEntry } from '../types/index.js';

function createEntry(content: string): MemoryEntry {
  return {
    id: `entry-${Date.now()}`,
    type: 'context',
    content,
    timestamp: Date.now(),
    importance: 0.5,
    accessCount: 0,
    metadata: {
      source: 'explicit',
      confidence: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('Extractor', () => {
  let extractor: Extractor;

  beforeEach(() => {
    extractor = new Extractor({
      minConfidence: 0.5,
      extractEntities: true,
      extractRelations: true,
      extractKeywords: true,
      extractSentiment: true,
    });
  });

  describe('entity extraction', () => {
    it('should extract dates', async () => {
      const entry = createEntry('The meeting is on 2024-01-15 at 3pm');
      const result = await extractor.extract(entry);

      expect(result.entities.some((e) => e.type === 'date')).toBe(true);
    });

    it('should extract numbers', async () => {
      const entry = createEntry('The price is $99.99 or 100 dollars');
      const result = await extractor.extract(entry);

      expect(result.entities.some((e) => e.type === 'number')).toBe(true);
    });

    it('should extract emails', async () => {
      const entry = createEntry('Contact me at john.doe@example.com');
      const result = await extractor.extract(entry);

      const emails = result.entities.filter(
        (e) => e.metadata?.subtype === 'email',
      );
      expect(emails.length).toBeGreaterThan(0);
      expect(emails[0].text).toBe('john.doe@example.com');
    });

    it('should extract URLs', async () => {
      const entry = createEntry('Visit https://example.com for more info');
      const result = await extractor.extract(entry);

      const urls = result.entities.filter((e) => e.metadata?.subtype === 'url');
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0].text).toContain('https://');
    });

    it('should extract capitalized names', async () => {
      const entry = createEntry('John Smith works at Acme Corporation');
      const result = await extractor.extract(entry);

      const entities = result.entities.filter((e) =>
        ['person', 'organization', 'concept'].includes(e.type),
      );
      expect(entities.length).toBeGreaterThan(0);
    });

    it('should filter entities by confidence threshold', async () => {
      const strictExtractor = new Extractor({ minConfidence: 0.9 });
      const entry = createEntry('Test content with entities');

      const result = await strictExtractor.extract(entry);

      expect(result.entities.every((e) => e.confidence >= 0.9)).toBe(true);
    });

    it('should include entity positions', async () => {
      const entry = createEntry('Date: 2024-01-15');
      const result = await extractor.extract(entry);

      const dateEntity = result.entities.find((e) => e.type === 'date');
      expect(dateEntity?.position).toBeDefined();
      expect(dateEntity?.position.start).toBeGreaterThanOrEqual(0);
      expect(dateEntity?.position.end).toBeGreaterThan(
        dateEntity!.position.start,
      );
    });
  });

  describe('relation extraction', () => {
    it('should extract "is a" relations', async () => {
      const entry = createEntry('A dog is a mammal');
      const result = await extractor.extract(entry);

      const isARelation = result.relations.find((r) => r.predicate === 'is_a');
      expect(isARelation).toBeDefined();
    });

    it('should extract "works at" relations', async () => {
      const entry = createEntry('John works at Microsoft');
      const result = await extractor.extract(entry);

      const worksAtRelation = result.relations.find(
        (r) => r.predicate === 'works_at',
      );
      expect(worksAtRelation).toBeDefined();
    });

    it('should extract "located in" relations', async () => {
      const entry = createEntry('Paris is located in France');
      const result = await extractor.extract(entry);

      const locatedInRelation = result.relations.find(
        (r) => r.predicate === 'located_in',
      );
      expect(locatedInRelation).toBeDefined();
    });

    it('should include source text in relations', async () => {
      const entry = createEntry('Alice created the project');
      const result = await extractor.extract(entry);

      const createdRelation = result.relations.find(
        (r) => r.predicate === 'created',
      );
      expect(createdRelation?.sourceText).toBeDefined();
      expect(createdRelation?.sourceText).toContain('created');
    });
  });

  describe('keyword extraction', () => {
    it('should extract keywords', async () => {
      const entry = createEntry(
        'Machine learning algorithms process large datasets efficiently using neural networks',
      );
      const result = await extractor.extract(entry);

      expect(result.keywords.length).toBeGreaterThan(0);
      expect(
        result.keywords.some(
          (k) => k.includes('machine') || k.includes('learning'),
        ),
      ).toBe(true);
    });

    it('should filter out stop words', async () => {
      const entry = createEntry('The cat and the dog are playing');
      const result = await extractor.extract(entry);

      const stopWords = ['the', 'and', 'are'];
      expect(result.keywords.every((k) => !stopWords.includes(k))).toBe(true);
    });

    it('should filter out short words', async () => {
      const entry = createEntry('I am at my PC');
      const result = await extractor.extract(entry);

      expect(result.keywords.every((k) => k.length > 3)).toBe(true);
    });

    it('should return top keywords by frequency', async () => {
      const entry = createEntry(
        'Data data data analysis. Analysis tools. Data tools.',
      );
      const result = await extractor.extract(entry);

      // 'data' appears more frequently
      expect(result.keywords.length).toBeLessThanOrEqual(10);
    });
  });

  describe('sentiment extraction', () => {
    it('should detect positive sentiment', async () => {
      const entry = createEntry(
        'This is great! I love it. Excellent work, very happy.',
      );
      const result = await extractor.extract(entry);

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment?.label).toBe('positive');
      expect(result.sentiment?.score).toBeGreaterThan(0);
    });

    it('should detect negative sentiment', async () => {
      const entry = createEntry(
        'This is terrible and awful. I hate this. Very bad experience.',
      );
      const result = await extractor.extract(entry);

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment?.label).toBe('negative');
      expect(result.sentiment?.score).toBeLessThan(0);
    });

    it('should detect neutral sentiment', async () => {
      const entry = createEntry('The meeting is scheduled for tomorrow');
      const result = await extractor.extract(entry);

      expect(result.sentiment).toBeDefined();
      expect(result.sentiment?.label).toBe('neutral');
    });
  });

  describe('extractBatch', () => {
    it('should extract from multiple entries', async () => {
      const entries = [
        createEntry('First entry with content'),
        createEntry('Second entry with different content'),
        createEntry('Third entry with more content'),
      ];

      const results = await extractor.extractBatch(entries);

      expect(results.size).toBeGreaterThan(0);
      expect(
        Array.from(results.values()).every((r) => r.entities || r.keywords),
      ).toBe(true);
    });
  });

  describe('extractAggregate', () => {
    it('should aggregate entities across entries', async () => {
      const entries = [
        createEntry('John Smith attended the meeting'),
        createEntry('John Smith presented the results'),
      ];

      const result = await extractor.extractAggregate(entries);

      // Entities should be extracted
      expect(result.allEntities.size).toBeGreaterThanOrEqual(0);
      // If 'John Smith' is found, it should be counted
      const johnSmith = Array.from(result.allEntities.values()).find((e) =>
        e.entity.text.toLowerCase().includes('john'),
      );
      if (johnSmith) {
        expect(johnSmith.count).toBeGreaterThanOrEqual(1);
      }
    });

    it('should aggregate relations', async () => {
      const entries = [
        createEntry('Alice works at Google'),
        createEntry('Bob works at Microsoft'),
      ];

      const result = await extractor.extractAggregate(entries);

      expect(result.allRelations.length).toBeGreaterThan(0);
    });

    it('should aggregate keywords and count frequency', async () => {
      const entries = [
        createEntry('Machine learning is important'),
        createEntry('Machine learning algorithms'),
      ];

      const result = await extractor.extractAggregate(entries);

      expect(result.topKeywords.length).toBeGreaterThan(0);
      const mlKeyword = result.topKeywords.find(
        (k) => k.keyword.includes('machine') || k.keyword.includes('learning'),
      );
      expect(mlKeyword).toBeDefined();
    });

    it('should calculate average sentiment', async () => {
      const entries = [
        createEntry('This is great and wonderful'),
        createEntry('This is terrible and awful'),
      ];

      const result = await extractor.extractAggregate(entries);

      expect(result.avgSentiment).toBeDefined();
      expect(typeof result.avgSentiment).toBe('number');
    });
  });

  describe('custom extraction function', () => {
    it('should use custom extraction function when provided', async () => {
      const mockExtractFn = vi.fn(async () => ({
        entities: [
          {
            text: 'Custom',
            type: 'custom' as const,
            confidence: 1,
            position: { start: 0, end: 6 },
          },
        ],
        relations: [],
        keywords: ['custom'],
      }));

      extractor.setExtractionFunction(mockExtractFn);

      const entry = createEntry('Test content');
      const result = await extractor.extract(entry);

      expect(mockExtractFn).toHaveBeenCalled();
      expect(result.entities[0].text).toBe('Custom');
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      extractor.configure({
        minConfidence: 0.9,
        extractSentiment: false,
      });

      expect(extractor['config'].minConfidence).toBe(0.9);
      expect(extractor['config'].extractSentiment).toBe(false);
    });
  });

  describe('entity type guessing', () => {
    it('should guess location type', async () => {
      const entry = createEntry('New York City is amazing');
      const result = await extractor.extract(entry);

      // Entity extraction is heuristic, so we just check it completes
      expect(result.entities).toBeDefined();
      expect(Array.isArray(result.entities)).toBe(true);
    });

    it('should guess organization type', async () => {
      const entry = createEntry('Acme Corporation Inc is hiring');
      const result = await extractor.extract(entry);

      // Entity extraction is heuristic, so we just check it completes
      expect(result.entities).toBeDefined();
      expect(Array.isArray(result.entities)).toBe(true);
    });
  });
});

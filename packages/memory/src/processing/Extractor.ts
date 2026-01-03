/**
 * Extractor
 *
 * Extracts entities, relations, and structured information from memories.
 */

import type { MemoryEntry, ExtractorConfig } from '../types/index.js';

/**
 * Extracted entity
 */
export interface ExtractedEntity {
  text: string;
  type:
    | 'person'
    | 'organization'
    | 'location'
    | 'date'
    | 'concept'
    | 'number'
    | 'other';
  confidence: number;
  position: { start: number; end: number };
  metadata?: Record<string, unknown>;
}

/**
 * Extracted relation
 */
export interface ExtractedRelation {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceText: string;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  keywords: string[];
  sentiment?: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  };
  topics?: string[];
}

/**
 * LLM extraction function type
 */
export type ExtractionFunction = (
  content: string,
  options?: { extractRelations?: boolean; extractSentiment?: boolean },
) => Promise<ExtractionResult>;

/**
 * Memory content extractor
 */
export class Extractor {
  private config: Required<ExtractorConfig>;
  private extractFn?: ExtractionFunction;

  constructor(config: ExtractorConfig = {}) {
    this.config = {
      provider:
        config.provider ??
        (undefined as unknown as Required<ExtractorConfig>['provider']),
      model: config.model ?? 'default',
      extractTypes: config.extractTypes ?? [],
      customPrompt: config.customPrompt ?? '',
      confidence: config.confidence ?? 0.5,
      extractEntities: config.extractEntities ?? true,
      extractRelations: config.extractRelations ?? true,
      extractKeywords: config.extractKeywords ?? true,
      extractSentiment: config.extractSentiment ?? false,
      minConfidence: config.minConfidence ?? 0.5,
      maxEntitiesPerEntry: config.maxEntitiesPerEntry ?? 20,
    };
  }

  /**
   * Set custom extraction function (for LLM integration)
   */
  setExtractionFunction(fn: ExtractionFunction): void {
    this.extractFn = fn;
  }

  /**
   * Extract information from a memory entry
   */
  async extract(entry: MemoryEntry): Promise<ExtractionResult> {
    if (this.extractFn) {
      return this.extractFn(entry.content, {
        extractRelations: this.config.extractRelations,
        extractSentiment: this.config.extractSentiment,
      });
    }

    // Fallback to heuristic extraction
    return Promise.resolve(this.heuristicExtract(entry.content));
  }

  /**
   * Extract from multiple entries
   */
  async extractBatch(
    entries: MemoryEntry[],
  ): Promise<Map<string, ExtractionResult>> {
    const results = new Map<string, ExtractionResult>();

    for (const entry of entries) {
      const result = await this.extract(entry);
      results.set(entry.id, result);
    }

    return results;
  }

  /**
   * Extract and aggregate across multiple entries
   */
  async extractAggregate(entries: MemoryEntry[]): Promise<{
    allEntities: Map<string, { entity: ExtractedEntity; count: number }>;
    allRelations: ExtractedRelation[];
    topKeywords: Array<{ keyword: string; count: number }>;
    avgSentiment: number | null;
  }> {
    const entityMap = new Map<
      string,
      { entity: ExtractedEntity; count: number }
    >();
    const allRelations: ExtractedRelation[] = [];
    const keywordCounts = new Map<string, number>();
    let sentimentSum = 0;
    let sentimentCount = 0;

    for (const entry of entries) {
      const result = await this.extract(entry);

      // Aggregate entities
      for (const entity of result.entities) {
        const key = `${entity.type}:${entity.text.toLowerCase()}`;
        const existing = entityMap.get(key);
        if (existing) {
          existing.count++;
          existing.entity.confidence = Math.max(
            existing.entity.confidence,
            entity.confidence,
          );
        } else {
          entityMap.set(key, { entity, count: 1 });
        }
      }

      // Collect relations
      allRelations.push(...result.relations);

      // Count keywords
      for (const keyword of result.keywords) {
        const lower = keyword.toLowerCase();
        keywordCounts.set(lower, (keywordCounts.get(lower) ?? 0) + 1);
      }

      // Track sentiment
      if (result.sentiment) {
        sentimentSum += result.sentiment.score;
        sentimentCount++;
      }
    }

    // Sort keywords by count
    const topKeywords = Array.from(keywordCounts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      allEntities: entityMap,
      allRelations,
      topKeywords,
      avgSentiment: sentimentCount > 0 ? sentimentSum / sentimentCount : null,
    };
  }

  /**
   * Heuristic-based extraction (fallback)
   */
  private heuristicExtract(content: string): ExtractionResult {
    const entities: ExtractedEntity[] = [];
    const relations: ExtractedRelation[] = [];
    const keywords: string[] = [];

    if (this.config.extractEntities) {
      entities.push(...this.extractEntities(content));
    }

    if (this.config.extractRelations) {
      relations.push(...this.extractRelations(content));
    }

    if (this.config.extractKeywords) {
      keywords.push(...this.extractKeywords(content));
    }

    const sentiment = this.config.extractSentiment
      ? this.extractSentiment(content)
      : undefined;

    return {
      entities: entities.slice(0, this.config.maxEntitiesPerEntry),
      relations,
      keywords,
      sentiment,
    };
  }

  /**
   * Extract entities using patterns
   */
  private extractEntities(content: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Date patterns
    const datePatterns = [
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
      /\b\d{4}-\d{2}-\d{2}\b/g,
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?\b/gi,
      /\b(?:today|yesterday|tomorrow|last\s+week|next\s+month)\b/gi,
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        entities.push({
          text: match[0],
          type: 'date',
          confidence: 0.9,
          position: { start: match.index, end: match.index + match[0].length },
        });
      }
    }

    // Number patterns
    const numberPattern =
      /\b\d+(?:\.\d+)?(?:\s*(?:percent|%|dollars|\$|euros|€|pounds|£))?\b/gi;
    let match;
    while ((match = numberPattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'number',
        confidence: 0.8,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    // Capitalized phrases (potential names/organizations)
    const capitalizedPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
    while ((match = capitalizedPattern.exec(content)) !== null) {
      const text = match[0];
      // Filter out common sentence starters
      if (!this.isSentenceStarter(text, content, match.index)) {
        const type = this.guessEntityType(text);
        entities.push({
          text,
          type,
          confidence: 0.6,
          position: { start: match.index, end: match.index + text.length },
        });
      }
    }

    // Email addresses
    const emailPattern = /\b[\w.-]+@[\w.-]+\.\w+\b/g;
    while ((match = emailPattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'other',
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length },
        metadata: { subtype: 'email' },
      });
    }

    // URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    while ((match = urlPattern.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'other',
        confidence: 0.95,
        position: { start: match.index, end: match.index + match[0].length },
        metadata: { subtype: 'url' },
      });
    }

    return entities.filter((e) => e.confidence >= this.config.minConfidence);
  }

  /**
   * Extract relations using patterns
   */
  private extractRelations(content: string): ExtractedRelation[] {
    const relations: ExtractedRelation[] = [];

    // Simple patterns for common relations
    const patterns = [
      // "X is a/an Y"
      {
        regex: /(\w+(?:\s+\w+)?)\s+is\s+a(?:n)?\s+(\w+(?:\s+\w+)?)/gi,
        predicate: 'is_a',
      },
      // "X works at Y"
      {
        regex: /(\w+(?:\s+\w+)?)\s+works\s+at\s+(\w+(?:\s+\w+)?)/gi,
        predicate: 'works_at',
      },
      // "X is located in Y"
      {
        regex: /(\w+(?:\s+\w+)?)\s+is\s+located\s+in\s+(\w+(?:\s+\w+)?)/gi,
        predicate: 'located_in',
      },
      // "X belongs to Y"
      {
        regex: /(\w+(?:\s+\w+)?)\s+belongs\s+to\s+(\w+(?:\s+\w+)?)/gi,
        predicate: 'belongs_to',
      },
      // "X created Y"
      {
        regex: /(\w+(?:\s+\w+)?)\s+created\s+(\w+(?:\s+\w+)?)/gi,
        predicate: 'created',
      },
      // "X contains Y"
      {
        regex: /(\w+(?:\s+\w+)?)\s+contains\s+(\w+(?:\s+\w+)?)/gi,
        predicate: 'contains',
      },
    ];

    for (const { regex, predicate } of patterns) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        relations.push({
          subject: match[1].trim(),
          predicate,
          object: match[2].trim(),
          confidence: 0.7,
          sourceText: match[0],
        });
      }
    }

    return relations.filter((r) => r.confidence >= this.config.minConfidence);
  }

  /**
   * Extract keywords
   */
  private extractKeywords(content: string): string[] {
    // Stop words to filter out
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'shall',
      'can',
      'need',
      'it',
      'its',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'we',
      'they',
      'what',
      'which',
      'who',
      'when',
      'where',
      'why',
      'how',
      'all',
      'each',
      'every',
      'both',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
    ]);

    // Extract words
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));

    // Count frequency
    const counts = new Map<string, number>();
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }

    // Sort by frequency and return top keywords
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Extract sentiment
   */
  private extractSentiment(content: string): {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
  } {
    const positiveWords = new Set([
      'good',
      'great',
      'excellent',
      'amazing',
      'wonderful',
      'fantastic',
      'happy',
      'love',
      'best',
      'awesome',
      'nice',
      'beautiful',
      'perfect',
      'success',
      'successful',
      'pleased',
      'delighted',
      'enjoy',
      'enjoyed',
      'helpful',
      'thanks',
      'thank',
    ]);

    const negativeWords = new Set([
      'bad',
      'terrible',
      'awful',
      'horrible',
      'poor',
      'worst',
      'hate',
      'sad',
      'angry',
      'disappointed',
      'frustrating',
      'annoying',
      'problem',
      'issue',
      'error',
      'fail',
      'failed',
      'failure',
      'wrong',
      'broken',
      'difficult',
      'hard',
    ]);

    const words = content.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    for (const word of words) {
      if (positiveWords.has(word)) positiveCount++;
      if (negativeWords.has(word)) negativeCount++;
    }

    const total = positiveCount + negativeCount;
    if (total === 0) {
      return { score: 0, label: 'neutral' };
    }

    const score = (positiveCount - negativeCount) / total;
    let label: 'positive' | 'negative' | 'neutral';

    if (score > 0.2) label = 'positive';
    else if (score < -0.2) label = 'negative';
    else label = 'neutral';

    return { score, label };
  }

  /**
   * Check if text is a sentence starter
   */
  private isSentenceStarter(
    _text: string,
    content: string,
    index: number,
  ): boolean {
    if (index === 0) return true;
    const prevChar = content[index - 1];
    return (
      prevChar === '.' ||
      prevChar === '!' ||
      prevChar === '?' ||
      prevChar === '\n'
    );
  }

  /**
   * Guess entity type from text
   */
  private guessEntityType(text: string): ExtractedEntity['type'] {
    const lowerText = text.toLowerCase();

    // Location indicators
    const locationIndicators = [
      'city',
      'state',
      'country',
      'street',
      'avenue',
      'road',
    ];
    if (locationIndicators.some((ind) => lowerText.includes(ind))) {
      return 'location';
    }

    // Organization indicators
    const orgIndicators = [
      'inc',
      'corp',
      'company',
      'organization',
      'foundation',
      'institute',
    ];
    if (orgIndicators.some((ind) => lowerText.includes(ind))) {
      return 'organization';
    }

    // Common person name patterns (2-3 capitalized words)
    const wordCount = text.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 3) {
      return 'person';
    }

    return 'concept';
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ExtractorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create extractor instance
 */
export function createExtractor(config?: ExtractorConfig): Extractor {
  return new Extractor(config);
}

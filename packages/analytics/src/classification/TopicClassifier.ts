/**
 * Topic Classifier
 *
 * Classifies topics from text and conversations.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  TopicClassification,
  Topic,
  TopicClassifierConfig,
  TopicDefinition,
} from '../types/index.js';

/**
 * Topic classifier events
 */
export interface TopicClassifierEvents {
  classified: (result: TopicClassification) => void;
  'topic:added': (topic: TopicDefinition) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TopicClassifierConfig = {
  model: 'keyword',
  maxTopics: 5,
  confidenceThreshold: 0.3,
  cacheResults: true,
};

/**
 * TopicClassifier - Classifies topics from text
 */
export class TopicClassifier extends EventEmitter<TopicClassifierEvents> {
  private readonly config: TopicClassifierConfig;
  private topics: TopicDefinition[];
  private readonly cache = new Map<string, TopicClassification>();

  constructor(config: Partial<TopicClassifierConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.topics = this.config.topics ?? this.getDefaultTopics();
  }

  /**
   * Get default topics
   */
  private getDefaultTopics(): TopicDefinition[] {
    return [
      {
        id: 'billing',
        name: 'Billing & Payments',
        keywords: [
          'bill',
          'billing',
          'payment',
          'pay',
          'charge',
          'invoice',
          'refund',
          'price',
          'cost',
          'fee',
          'subscription',
          'credit',
        ],
        description: 'Topics related to billing and payments',
      },
      {
        id: 'account',
        name: 'Account Management',
        keywords: [
          'account',
          'login',
          'password',
          'username',
          'profile',
          'settings',
          'email',
          'register',
          'signup',
          'sign up',
        ],
        description: 'Topics related to account management',
      },
      {
        id: 'technical',
        name: 'Technical Issues',
        keywords: [
          'error',
          'bug',
          'crash',
          'not working',
          'broken',
          'fix',
          'issue',
          'problem',
          'technical',
          'slow',
          'loading',
        ],
        description: 'Technical problems and issues',
      },
      {
        id: 'product',
        name: 'Product Information',
        keywords: [
          'product',
          'feature',
          'how to',
          'use',
          'work',
          'function',
          'capability',
          'what does',
          'can it',
          'does it',
        ],
        description: 'Questions about product features',
      },
      {
        id: 'shipping',
        name: 'Shipping & Delivery',
        keywords: [
          'ship',
          'shipping',
          'delivery',
          'deliver',
          'track',
          'tracking',
          'order',
          'arrive',
          'package',
          'courier',
        ],
        description: 'Shipping and delivery related topics',
      },
      {
        id: 'returns',
        name: 'Returns & Exchanges',
        keywords: [
          'return',
          'exchange',
          'swap',
          'warranty',
          'damaged',
          'defective',
          'wrong',
          'replace',
          'replacement',
        ],
        description: 'Returns and exchanges',
      },
      {
        id: 'general',
        name: 'General Inquiry',
        keywords: [
          'question',
          'help',
          'information',
          'info',
          'about',
          'know',
          'wondering',
          'curious',
        ],
        description: 'General inquiries',
      },
    ];
  }

  /**
   * Classify topics from text
   */
  classify(text: string): TopicClassification {
    // Check cache
    if (this.config.cacheResults) {
      const cached = this.cache.get(text);
      if (cached) {
        return cached;
      }
    }

    const topics = this.classifyWithKeywords(text);
    const result: TopicClassification = {
      topics,
      primary: topics[0] ?? { name: 'unknown', confidence: 0 },
      classifiedAt: Date.now(),
    };

    // Cache result
    if (this.config.cacheResults) {
      this.cache.set(text, result);
    }

    this.emit('classified', result);
    return result;
  }

  /**
   * Classify using keyword matching
   */
  private classifyWithKeywords(text: string): Topic[] {
    const normalizedText = text.toLowerCase();
    const words = normalizedText.split(/\s+/);
    const scores: Map<string, number> = new Map();

    for (const topicDef of this.topics) {
      let matchCount = 0;
      const keywordMatches: string[] = [];

      for (const keyword of topicDef.keywords ?? []) {
        const keywordLower = keyword.toLowerCase();
        // Check for exact word match or phrase match
        if (
          words.includes(keywordLower) ||
          normalizedText.includes(keywordLower)
        ) {
          matchCount++;
          keywordMatches.push(keyword);
        }
      }

      if (matchCount > 0) {
        // Calculate confidence based on keyword coverage
        const confidence = Math.min(
          matchCount / (topicDef.keywords?.length ?? 1) + 0.3,
          1.0,
        );
        scores.set(topicDef.id, confidence);
      }
    }

    // Sort by score and filter by threshold
    const topics: Topic[] = Array.from(scores.entries())
      .filter(([, score]) => score >= this.config.confidenceThreshold!)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxTopics)
      .map(([topicId, confidence]) => {
        const topicDef = this.topics.find((t) => t.id === topicId)!;
        return {
          name: topicDef.name,
          confidence,
          keywords: topicDef.keywords,
          category: topicDef.category,
        };
      });

    return topics;
  }

  /**
   * Classify multiple texts
   */
  classifyBatch(texts: string[]): TopicClassification[] {
    return texts.map((text) => this.classify(text));
  }

  /**
   * Classify a conversation
   */
  classifyConversation(
    messages: Array<{ role: string; content: string }>,
  ): TopicClassification {
    // Combine all messages
    const allText = messages.map((m) => m.content).join(' ');
    return this.classify(allText);
  }

  /**
   * Extract topics from conversation with message-level detail
   */
  extractTopics(messages: Array<{ role: string; content: string }>): {
    overall: TopicClassification;
    byMessage: Array<{ message: number; topics: Topic[] }>;
    evolution: string[];
  } {
    const byMessage: Array<{ message: number; topics: Topic[] }> = [];
    const topicOrder: string[] = [];
    const seenTopics = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const result = this.classify(messages[i].content);
      byMessage.push({ message: i, topics: result.topics ?? [] });

      // Track topic evolution
      if (result.topics) {
        for (const topic of result.topics) {
          if (!seenTopics.has(topic.name)) {
            seenTopics.add(topic.name);
            topicOrder.push(topic.name);
          }
        }
      }
    }

    // Get overall classification
    const overall = this.classifyConversation(messages);

    return {
      overall,
      byMessage,
      evolution: topicOrder,
    };
  }

  /**
   * Add topic definition
   */
  addTopic(topic: TopicDefinition): void {
    // Check if topic already exists
    const existing = this.topics.findIndex((t) => t.id === topic.id);
    if (existing >= 0) {
      this.topics[existing] = topic;
    } else {
      this.topics.push(topic);
    }
    this.clearCache();
    this.emit('topic:added', topic);
  }

  /**
   * Remove topic
   */
  removeTopic(topicId: string): boolean {
    const index = this.topics.findIndex((t) => t.id === topicId);
    if (index >= 0) {
      this.topics.splice(index, 1);
      this.clearCache();
      return true;
    }
    return false;
  }

  /**
   * Update topic keywords
   */
  updateTopicKeywords(topicId: string, keywords: string[]): boolean {
    const topic = this.topics.find((t) => t.id === topicId);
    if (topic) {
      topic.keywords = keywords;
      this.clearCache();
      return true;
    }
    return false;
  }

  /**
   * Add keywords to topic
   */
  addKeywordsToTopic(topicId: string, keywords: string[]): boolean {
    const topic = this.topics.find((t) => t.id === topicId);
    if (topic) {
      topic.keywords = [...new Set([...(topic.keywords ?? []), ...keywords])];
      this.clearCache();
      return true;
    }
    return false;
  }

  /**
   * Get all topics
   */
  getTopics(): TopicDefinition[] {
    return [...this.topics];
  }

  /**
   * Get topic by ID
   */
  getTopic(topicId: string): TopicDefinition | undefined {
    return this.topics.find((t) => t.id === topicId);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

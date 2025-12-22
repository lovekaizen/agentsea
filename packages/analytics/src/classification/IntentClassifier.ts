/**
 * Intent Classifier
 *
 * Classifies user intents from conversation messages.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  IntentClassification,
  Intent,
  IntentClassifierConfig,
  IntentTaxonomy,
  IntentDefinition,
  TrainingExample,
} from '../types/index.js';

/**
 * Intent classifier events
 */
export interface IntentClassifierEvents {
  classified: (result: IntentClassification) => void;
  'taxonomy:updated': (taxonomy: IntentTaxonomy) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: IntentClassifierConfig = {
  model: 'rule-based',
  confidenceThreshold: 0.5,
  maxIntents: 3,
  cacheResults: true,
};

/**
 * IntentClassifier - Classifies user intents
 */
export class IntentClassifier extends EventEmitter<IntentClassifierEvents> {
  private readonly config: IntentClassifierConfig;
  private taxonomy: IntentTaxonomy;
  private readonly cache = new Map<string, IntentClassification>();
  private readonly trainingExamples: TrainingExample[] = [];

  constructor(config: Partial<IntentClassifierConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.taxonomy = this.config.taxonomy ?? this.getDefaultTaxonomy();
  }

  /**
   * Get default taxonomy
   */
  private getDefaultTaxonomy(): IntentTaxonomy {
    return {
      id: 'default',
      name: 'Default Intent Taxonomy',
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      intents: [
        {
          id: 'question',
          name: 'Question',
          description: 'User asking a question',
          keywords: [
            'what',
            'how',
            'why',
            'when',
            'where',
            'who',
            'which',
            'can you',
            'could you',
            'would you',
            '?',
          ],
          examples: [
            'What is the weather today?',
            'How do I reset my password?',
            'Why is my order delayed?',
          ],
        },
        {
          id: 'request',
          name: 'Request',
          description: 'User making a request',
          keywords: [
            'please',
            'need',
            'want',
            'help',
            'assist',
            'support',
            'give me',
            'show me',
            'tell me',
          ],
          examples: [
            'Please help me with my account',
            'I need assistance with my order',
            'Can you show me my balance?',
          ],
        },
        {
          id: 'complaint',
          name: 'Complaint',
          description: 'User expressing dissatisfaction',
          keywords: [
            'problem',
            'issue',
            'error',
            'broken',
            'not working',
            'frustrated',
            'angry',
            'disappointed',
            'terrible',
            'awful',
          ],
          examples: [
            'This is not working',
            'I have a problem with my order',
            'Your service is terrible',
          ],
        },
        {
          id: 'feedback',
          name: 'Feedback',
          description: 'User providing feedback',
          keywords: [
            'suggest',
            'feedback',
            'opinion',
            'think',
            'improve',
            'recommendation',
            'idea',
          ],
          examples: [
            'I think you should improve the UI',
            'My suggestion is to add more features',
            'Here is my feedback',
          ],
        },
        {
          id: 'greeting',
          name: 'Greeting',
          description: 'User greeting',
          keywords: [
            'hello',
            'hi',
            'hey',
            'good morning',
            'good afternoon',
            'good evening',
          ],
          examples: ['Hello!', 'Hi there', 'Good morning'],
        },
        {
          id: 'farewell',
          name: 'Farewell',
          description: 'User saying goodbye',
          keywords: [
            'bye',
            'goodbye',
            'thanks',
            'thank you',
            'see you',
            'later',
          ],
          examples: ['Goodbye!', 'Thanks for your help', 'Bye!'],
        },
        {
          id: 'confirmation',
          name: 'Confirmation',
          description: 'User confirming something',
          keywords: [
            'yes',
            'yeah',
            'correct',
            'right',
            'ok',
            'okay',
            'sure',
            'confirm',
          ],
          examples: ["Yes, that's correct", 'Okay, proceed', 'Sure, go ahead'],
        },
        {
          id: 'denial',
          name: 'Denial',
          description: 'User denying or refusing',
          keywords: ['no', 'nope', "don't", "won't", 'not', 'never', 'cancel'],
          examples: [
            "No, that's not right",
            "I don't want that",
            'Cancel the order',
          ],
        },
      ],
    };
  }

  /**
   * Classify intent from text
   */
  classify(text: string): IntentClassification {
    // Check cache
    if (this.config.cacheResults) {
      const cached = this.cache.get(text);
      if (cached) {
        return cached;
      }
    }

    const intents = this.classifyWithRules(text);
    const result: IntentClassification = {
      primary: intents[0]?.intent ?? 'unknown',
      confidence: intents[0]?.confidence ?? 0,
      secondary: intents.slice(1).map((i) => ({
        intent: i.intent,
        confidence: i.confidence,
      })),
    };

    // Cache result
    if (this.config.cacheResults) {
      this.cache.set(text, result);
    }

    this.emit('classified', result);
    return result;
  }

  /**
   * Classify using rule-based approach
   */
  private classifyWithRules(text: string): Intent[] {
    const normalizedText = text.toLowerCase();
    const scores: Map<string, number> = new Map();

    for (const intentDef of this.taxonomy.intents) {
      let score = 0;

      // Check keywords
      for (const keyword of intentDef.keywords ?? []) {
        if (normalizedText.includes(keyword.toLowerCase())) {
          score += 0.2;
        }
      }

      // Check examples (simple similarity)
      for (const example of intentDef.examples ?? []) {
        const similarity = this.calculateSimilarity(
          normalizedText,
          example.toLowerCase(),
        );
        if (similarity > 0.3) {
          score += similarity * 0.5;
        }
      }

      // Cap score at 1.0
      scores.set(intentDef.id, Math.min(score, 1.0));
    }

    // Sort by score and filter by threshold
    const intents: Intent[] = Array.from(scores.entries())
      .filter(([, score]) => score >= this.config.confidenceThreshold!)
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.config.maxIntents)
      .map(([intent, confidence]) => ({ intent, confidence }));

    return intents;
  }

  /**
   * Calculate simple similarity between two strings
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));

    let intersection = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) {
        intersection++;
      }
    }

    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Classify multiple texts
   */
  async classifyBatch(texts: string[]): Promise<IntentClassification[]> {
    return Promise.all(texts.map((text) => this.classify(text)));
  }

  /**
   * Classify a conversation
   */
  async classifyConversation(
    messages: Array<{ role: string; content: string }>,
  ): Promise<IntentClassification> {
    // Focus on user messages
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content);

    if (userMessages.length === 0) {
      return { primary: 'unknown', confidence: 0 };
    }

    // Classify each message
    const classifications = await this.classifyBatch(userMessages);

    // Aggregate classifications (use most recent with higher weight)
    const intentScores = new Map<string, number>();
    for (let i = 0; i < classifications.length; i++) {
      const weight = (i + 1) / classifications.length; // More recent = higher weight
      const classification = classifications[i];

      const currentScore = intentScores.get(classification.primary) ?? 0;
      intentScores.set(
        classification.primary,
        currentScore + classification.confidence * weight,
      );
    }

    // Find top intent
    let topIntent = 'unknown';
    let topScore = 0;
    for (const [intent, score] of intentScores) {
      if (score > topScore) {
        topIntent = intent;
        topScore = score;
      }
    }

    // Normalize score
    const totalWeight =
      (classifications.length * (classifications.length + 1)) / 2;
    const normalizedScore = topScore / totalWeight;

    return {
      primary: topIntent,
      confidence: Math.min(normalizedScore, 1.0),
    };
  }

  /**
   * Add training example
   */
  addTrainingExample(example: TrainingExample): void {
    this.trainingExamples.push(example);

    // Optionally update taxonomy with example
    const intentDef = this.taxonomy.intents.find(
      (i) => i.id === example.intent,
    );
    if (intentDef && intentDef.examples) {
      intentDef.examples.push(example.text);
    }
  }

  /**
   * Update taxonomy
   */
  updateTaxonomy(taxonomy: IntentTaxonomy): void {
    this.taxonomy = taxonomy;
    this.clearCache();
    this.emit('taxonomy:updated', taxonomy);
  }

  /**
   * Add intent to taxonomy
   */
  addIntent(intent: IntentDefinition): void {
    // Check if intent already exists
    const existing = this.taxonomy.intents.findIndex((i) => i.id === intent.id);
    if (existing >= 0) {
      this.taxonomy.intents[existing] = intent;
    } else {
      this.taxonomy.intents.push(intent);
    }
    this.clearCache();
  }

  /**
   * Remove intent from taxonomy
   */
  removeIntent(intentId: string): boolean {
    const index = this.taxonomy.intents.findIndex((i) => i.id === intentId);
    if (index >= 0) {
      this.taxonomy.intents.splice(index, 1);
      this.clearCache();
      return true;
    }
    return false;
  }

  /**
   * Get taxonomy
   */
  getTaxonomy(): IntentTaxonomy {
    return { ...this.taxonomy };
  }

  /**
   * Get intent definition
   */
  getIntentDefinition(intentId: string): IntentDefinition | undefined {
    return this.taxonomy.intents.find((i) => i.id === intentId);
  }

  /**
   * Clear classification cache
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

  /**
   * Get training examples count
   */
  getTrainingExamplesCount(): number {
    return this.trainingExamples.length;
  }
}

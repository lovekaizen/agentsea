/**
 * Sentiment Analyzer
 *
 * Analyzes sentiment from text and conversations.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  SentimentResult,
  SentimentLabel,
  EmotionScores,
  SentimentAnalyzerConfig,
  SentimentTrend,
  SentimentDataPoint,
} from '../types/index.js';

/**
 * Sentiment analyzer events
 */
export interface SentimentAnalyzerEvents {
  analyzed: (result: SentimentResult) => void;
  'trend:detected': (trend: SentimentTrend) => void;
  error: (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: SentimentAnalyzerConfig = {
  model: 'lexicon',
  includeEmotions: true,
  granularity: 'message',
  language: 'en',
};

/**
 * Sentiment lexicon entry
 */
interface LexiconEntry {
  word: string;
  score: number; // -1 to 1
  emotions?: Partial<EmotionScores>;
}

/**
 * SentimentAnalyzer - Analyzes text sentiment
 */
export class SentimentAnalyzer extends EventEmitter<SentimentAnalyzerEvents> {
  private readonly config: SentimentAnalyzerConfig;
  private readonly lexicon: Map<string, LexiconEntry>;
  private readonly cache = new Map<string, SentimentResult>();
  private readonly sentimentHistory: SentimentDataPoint[] = [];

  constructor(config: Partial<SentimentAnalyzerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.lexicon = this.buildDefaultLexicon();
  }

  /**
   * Build default sentiment lexicon
   */
  private buildDefaultLexicon(): Map<string, LexiconEntry> {
    const lexicon = new Map<string, LexiconEntry>();

    // Positive words
    const positiveWords: Array<[string, number, Partial<EmotionScores>?]> = [
      ['good', 0.6, { joy: 0.5 }],
      ['great', 0.8, { joy: 0.7 }],
      ['excellent', 0.9, { joy: 0.8 }],
      ['amazing', 0.9, { joy: 0.9, surprise: 0.3 }],
      ['wonderful', 0.9, { joy: 0.9 }],
      ['fantastic', 0.9, { joy: 0.8 }],
      ['love', 0.8, { joy: 0.9 }],
      ['happy', 0.8, { joy: 1.0 }],
      ['perfect', 1.0, { joy: 0.9 }],
      ['thank', 0.6, { joy: 0.4 }],
      ['thanks', 0.6, { joy: 0.4 }],
      ['helpful', 0.7, { joy: 0.5, trust: 0.5 }],
      ['awesome', 0.8, { joy: 0.8 }],
      ['nice', 0.5, { joy: 0.4 }],
      ['pleased', 0.7, { joy: 0.6 }],
      ['satisfied', 0.7, { joy: 0.5, trust: 0.4 }],
      ['impressed', 0.7, { joy: 0.5, surprise: 0.4 }],
      ['appreciate', 0.6, { joy: 0.4, trust: 0.4 }],
    ];

    // Negative words
    const negativeWords: Array<[string, number, Partial<EmotionScores>?]> = [
      ['bad', -0.6, { anger: 0.3, sadness: 0.3 }],
      ['terrible', -0.9, { anger: 0.6, disgust: 0.4 }],
      ['awful', -0.9, { anger: 0.5, disgust: 0.5 }],
      ['horrible', -0.9, { anger: 0.6, fear: 0.3 }],
      ['hate', -0.8, { anger: 0.9 }],
      ['angry', -0.7, { anger: 1.0 }],
      ['frustrated', -0.6, { anger: 0.8 }],
      ['disappointed', -0.6, { sadness: 0.7 }],
      ['sad', -0.6, { sadness: 1.0 }],
      ['problem', -0.4, { anger: 0.2, fear: 0.2 }],
      ['issue', -0.3, { anger: 0.2 }],
      ['error', -0.4, { anger: 0.3, fear: 0.2 }],
      ['broken', -0.5, { anger: 0.4, sadness: 0.3 }],
      ['annoying', -0.6, { anger: 0.7 }],
      ['useless', -0.7, { anger: 0.5, disgust: 0.4 }],
      ['worst', -1.0, { anger: 0.8, disgust: 0.6 }],
      ['never', -0.2, { anger: 0.2 }],
      ['fail', -0.5, { sadness: 0.4, anger: 0.3 }],
      ['failed', -0.5, { sadness: 0.4, anger: 0.3 }],
      ['poor', -0.5, { sadness: 0.3, anger: 0.2 }],
    ];

    // Add positive words
    for (const [word, score, emotions] of positiveWords) {
      lexicon.set(word, { word, score, emotions });
    }

    // Add negative words
    for (const [word, score, emotions] of negativeWords) {
      lexicon.set(word, { word, score, emotions });
    }

    return lexicon;
  }

  /**
   * Analyze sentiment of text
   */
  analyze(text: string): SentimentResult {
    // Check cache
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    const result = this.analyzeLexicon(text);

    // Cache result
    this.cache.set(text, result);

    // Add to history
    this.sentimentHistory.push({
      timestamp: Date.now(),
      score: result.score,
      label: result.label,
    });

    this.emit('analyzed', result);
    return result;
  }

  /**
   * Analyze using lexicon-based approach
   */
  private analyzeLexicon(text: string): SentimentResult {
    const words = text.toLowerCase().split(/\s+/);
    let totalScore = 0;
    let wordCount = 0;
    const emotions: EmotionScores = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
      trust: 0,
      anticipation: 0,
    };

    // Check for negation
    const negationWords = new Set([
      'not',
      "don't",
      "doesn't",
      "didn't",
      "won't",
      "wouldn't",
      'no',
      'never',
    ]);
    let negation = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-z]/g, '');

      // Check for negation
      if (negationWords.has(word)) {
        negation = true;
        continue;
      }

      const entry = this.lexicon.get(word);
      if (entry) {
        let score = entry.score;

        // Apply negation
        if (negation) {
          score *= -0.5; // Reduce and flip
          negation = false;
        }

        totalScore += score;
        wordCount++;

        // Aggregate emotions
        if (entry.emotions) {
          for (const [emotion, value] of Object.entries(entry.emotions)) {
            const key = emotion as keyof EmotionScores;
            emotions[key] = (emotions[key] ?? 0) + value;
          }
        }
      }
    }

    // Calculate average score
    const avgScore = wordCount > 0 ? totalScore / wordCount : 0;

    // Determine label
    let label: SentimentLabel;
    if (avgScore > 0.2) {
      label = 'positive';
    } else if (avgScore < -0.2) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    // Normalize emotions
    if (wordCount > 0) {
      for (const key of Object.keys(emotions) as Array<keyof EmotionScores>) {
        emotions[key] = Math.min((emotions[key] ?? 0) / wordCount, 1);
      }
    }

    // Calculate confidence based on word matches
    const confidence = Math.min(0.5 + (wordCount / words.length) * 0.5, 1);

    return {
      score: avgScore,
      label,
      confidence,
      emotions: this.config.includeEmotions ? emotions : undefined,
      analyzedAt: Date.now(),
    };
  }

  /**
   * Analyze multiple texts
   */
  analyzeBatch(texts: string[]): SentimentResult[] {
    return texts.map((text) => this.analyze(text));
  }

  /**
   * Analyze a conversation
   */
  analyzeConversation(messages: Array<{ role: string; content: string }>): {
    overall: SentimentResult;
    progression: SentimentDataPoint[];
    trend: 'improving' | 'declining' | 'stable';
  } {
    const userMessages = messages.filter((m) => m.role === 'user');
    const progression: SentimentDataPoint[] = [];

    let totalScore = 0;
    const allEmotions: EmotionScores = {
      joy: 0,
      sadness: 0,
      anger: 0,
      fear: 0,
      surprise: 0,
      disgust: 0,
      trust: 0,
      anticipation: 0,
    };

    for (let i = 0; i < userMessages.length; i++) {
      const result = this.analyze(userMessages[i].content);
      totalScore += result.score;

      progression.push({
        timestamp: Date.now() - (userMessages.length - i) * 1000,
        score: result.score,
        label: result.label,
      });

      // Aggregate emotions
      if (result.emotions) {
        for (const [key, value] of Object.entries(result.emotions)) {
          allEmotions[key as keyof EmotionScores] += value;
        }
      }
    }

    // Calculate overall
    const avgScore =
      userMessages.length > 0 ? totalScore / userMessages.length : 0;

    // Normalize emotions
    if (userMessages.length > 0) {
      for (const key of Object.keys(allEmotions) as Array<
        keyof EmotionScores
      >) {
        allEmotions[key] = (allEmotions[key] ?? 0) / userMessages.length;
      }
    }

    // Determine trend
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (progression.length >= 2) {
      const firstHalf = progression.slice(
        0,
        Math.floor(progression.length / 2),
      );
      const secondHalf = progression.slice(Math.floor(progression.length / 2));

      const firstAvg =
        firstHalf.reduce((sum, p) => sum + p.score, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, p) => sum + p.score, 0) / secondHalf.length;

      const diff = secondAvg - firstAvg;
      if (diff > 0.1) {
        trend = 'improving';
      } else if (diff < -0.1) {
        trend = 'declining';
      }
    }

    return {
      overall: {
        score: avgScore,
        label:
          avgScore > 0.2
            ? 'positive'
            : avgScore < -0.2
              ? 'negative'
              : 'neutral',
        confidence: 0.7, // Conversation confidence
        emotions: this.config.includeEmotions ? allEmotions : undefined,
        analyzedAt: Date.now(),
      },
      progression,
      trend,
    };
  }

  /**
   * Get sentiment trend over time
   */
  getTrend(windowSize = 10): SentimentTrend {
    const recentPoints = this.sentimentHistory.slice(-windowSize);

    if (recentPoints.length < 2) {
      return {
        direction: 'stable',
        average: 0,
        points: recentPoints,
      };
    }

    const firstHalf = recentPoints.slice(
      0,
      Math.floor(recentPoints.length / 2),
    );
    const secondHalf = recentPoints.slice(Math.floor(recentPoints.length / 2));

    const firstAvg =
      firstHalf.reduce((sum, p) => sum + p.score, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((sum, p) => sum + p.score, 0) / secondHalf.length;

    const diff = secondAvg - firstAvg;
    let direction: 'improving' | 'declining' | 'stable';

    if (diff > 0.1) {
      direction = 'improving';
    } else if (diff < -0.1) {
      direction = 'declining';
    } else {
      direction = 'stable';
    }

    const totalAvg =
      recentPoints.reduce((sum, p) => sum + p.score, 0) / recentPoints.length;

    return {
      direction,
      average: totalAvg,
      changePercent: totalAvg !== 0 ? (diff / Math.abs(totalAvg)) * 100 : 0,
      points: recentPoints,
    };
  }

  /**
   * Add word to lexicon
   */
  addToLexicon(
    word: string,
    score: number,
    emotions?: Partial<EmotionScores>,
  ): void {
    this.lexicon.set(word.toLowerCase(), {
      word: word.toLowerCase(),
      score: Math.max(-1, Math.min(1, score)),
      emotions,
    });
    this.cache.clear(); // Clear cache when lexicon changes
  }

  /**
   * Remove word from lexicon
   */
  removeFromLexicon(word: string): boolean {
    const removed = this.lexicon.delete(word.toLowerCase());
    if (removed) {
      this.cache.clear();
    }
    return removed;
  }

  /**
   * Get lexicon size
   */
  getLexiconSize(): number {
    return this.lexicon.size;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear sentiment history
   */
  clearHistory(): void {
    this.sentimentHistory.length = 0;
  }

  /**
   * Get history
   */
  getHistory(): SentimentDataPoint[] {
    return [...this.sentimentHistory];
  }
}

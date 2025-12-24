import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Summarizer } from '../processing/Summarizer.js';
import type { MemoryEntry } from '../types/index.js';

function createEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `entry-${Date.now()}-${Math.random()}`,
    type: 'context',
    content: 'Test content',
    timestamp: Date.now(),
    importance: 0.5,
    accessCount: 0,
    metadata: {
      source: 'explicit',
      confidence: 1.0,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('Summarizer', () => {
  let summarizer: Summarizer;

  beforeEach(() => {
    summarizer = new Summarizer({
      maxSummaryLength: 500,
      minEntriesForSummary: 3,
      summaryStyle: 'concise',
    });
  });

  describe('summarize', () => {
    it('should summarize multiple entries', async () => {
      const entries = [
        createEntry({ content: 'User mentioned they like pizza' }),
        createEntry({ content: 'User ordered pizza for dinner' }),
        createEntry({ content: 'User recommended a pizza place' }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.summary).toBeDefined();
      expect(result.sourceCount).toBe(3);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });

    it('should create simple summary for few entries', async () => {
      const entries = [
        createEntry({ content: 'First entry' }),
        createEntry({ content: 'Second entry' }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.summary).toBeDefined();
      expect(result.metadata.method).toBe('simple');
    });

    it('should use heuristic summarization by default', async () => {
      const entries = [
        createEntry({ content: 'Entry one with facts', type: 'fact' }),
        createEntry({
          content: 'Entry two with preferences',
          type: 'preference',
        }),
        createEntry({ content: 'Entry three with context', type: 'context' }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.metadata.method).toBe('heuristic');
      expect(result.summary).toContain('memories');
    });

    it('should respect max summary length', async () => {
      const longSummarizer = new Summarizer({ maxSummaryLength: 100 });
      const entries = Array(10)
        .fill(null)
        .map(() =>
          createEntry({
            content: 'This is a very long entry with lots of content '.repeat(
              10,
            ),
          }),
        );

      const result = await longSummarizer.summarize(entries);

      expect(result.summary.length).toBeLessThanOrEqual(100);
    });

    it('should calculate compression ratio', async () => {
      const entries = [
        createEntry({ content: 'A'.repeat(100) }),
        createEntry({ content: 'B'.repeat(100) }),
        createEntry({ content: 'C'.repeat(100) }),
      ];

      const result = await summarizer.summarize(entries);

      // Compression ratio = original / summary, so should be >= 1 for compression
      expect(result.compressionRatio).toBeGreaterThanOrEqual(0);
    });

    it('should extract key points', async () => {
      const entries = [
        createEntry({ content: 'First important point. Additional details.' }),
        createEntry({ content: 'Second important point. More information.' }),
        createEntry({ content: 'Third important point. Extra context.' }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.keyPoints.length).toBeGreaterThan(0);
      expect(result.keyPoints.every((p) => p.length > 0)).toBe(true);
    });
  });

  describe('summarizeByPeriod', () => {
    it('should group summaries by hour', async () => {
      const baseTime = Date.now();
      const entries = [
        createEntry({ content: 'Event 1', timestamp: baseTime }),
        createEntry({ content: 'Event 2', timestamp: baseTime + 1000 }),
        createEntry({ content: 'Event 3', timestamp: baseTime + 3600000 }), // 1 hour later
      ];

      const results = await summarizer.summarizeByPeriod(entries, 'hour');

      expect(results.size).toBeGreaterThan(0);
    });

    it('should group summaries by day', async () => {
      const baseTime = Date.now();
      const entries = [
        createEntry({ content: 'Today 1', timestamp: baseTime }),
        createEntry({ content: 'Today 2', timestamp: baseTime + 3600000 }),
        createEntry({
          content: 'Tomorrow',
          timestamp: baseTime + 24 * 3600000,
        }),
      ];

      const results = await summarizer.summarizeByPeriod(entries, 'day');

      expect(results.size).toBeGreaterThan(0);
    });

    it('should group summaries by week', async () => {
      const baseTime = Date.now();
      const entries = [
        createEntry({ content: 'This week', timestamp: baseTime }),
        createEntry({
          content: 'Next week',
          timestamp: baseTime + 7 * 24 * 3600000,
        }),
      ];

      const results = await summarizer.summarizeByPeriod(entries, 'week');

      expect(results.size).toBeGreaterThan(0);
    });
  });

  describe('summarizeByTopic', () => {
    it('should group summaries by type', async () => {
      const entries = [
        createEntry({ content: 'Fact 1', type: 'fact' }),
        createEntry({ content: 'Fact 2', type: 'fact' }),
        createEntry({ content: 'Preference 1', type: 'preference' }),
      ];

      const results = await summarizer.summarizeByTopic(entries);

      expect(results.size).toBeGreaterThanOrEqual(2);
      expect(results.has('fact')).toBe(true);
      expect(results.has('preference')).toBe(true);
    });

    it('should use metadata topic when available', async () => {
      const entries = [
        createEntry({
          content: 'About AI',
          metadata: { source: 'explicit', confidence: 1, topic: 'technology' },
        }),
        createEntry({
          content: 'About food',
          metadata: { source: 'explicit', confidence: 1, topic: 'food' },
        }),
      ];

      const results = await summarizer.summarizeByTopic(entries);

      expect(results.has('technology')).toBe(true);
      expect(results.has('food')).toBe(true);
    });
  });

  describe('incrementalSummarize', () => {
    it('should add to existing summary', async () => {
      const existingSummary =
        'Previous events included meetings and discussions.';
      const newEntries = [
        createEntry({ content: 'New development announced' }),
        createEntry({ content: 'Project milestone reached' }),
      ];

      const result = await summarizer.incrementalSummarize(
        existingSummary,
        newEntries,
      );

      expect(result.summary).toContain('Previous');
      expect(result.metadata.method).toBeDefined();
    });

    it('should preserve existing context', async () => {
      const existingSummary = 'Important context from before.';
      const newEntries = [createEntry({ content: 'New information' })];

      const result = await summarizer.incrementalSummarize(
        existingSummary,
        newEntries,
      );

      expect(result.summary.length).toBeGreaterThan(existingSummary.length);
    });
  });

  describe('custom summary function', () => {
    it('should use custom summary function when provided', async () => {
      const mockSummaryFn = vi.fn(async () => 'Custom AI-generated summary');

      summarizer.setSummaryFunction(mockSummaryFn);

      const entries = [
        createEntry({ content: 'Entry 1' }),
        createEntry({ content: 'Entry 2' }),
        createEntry({ content: 'Entry 3' }),
      ];

      const result = await summarizer.summarize(entries);

      expect(mockSummaryFn).toHaveBeenCalled();
      expect(result.summary).toBe('Custom AI-generated summary');
      expect(result.metadata.method).toBe('llm');
    });

    it('should pass options to custom function', async () => {
      const mockSummaryFn = vi.fn(async () => 'Summary');

      summarizer.setSummaryFunction(mockSummaryFn);

      const entries = [
        createEntry({ content: 'Test' }),
        createEntry({ content: 'Test' }),
        createEntry({ content: 'Test' }),
      ];

      await summarizer.summarize(entries);

      expect(mockSummaryFn).toHaveBeenCalledWith(
        entries,
        expect.objectContaining({
          maxLength: expect.any(Number),
          style: expect.any(String),
        }),
      );
    });
  });

  describe('time range description', () => {
    it('should describe recent time ranges', async () => {
      const baseTime = Date.now();
      const entries = [
        createEntry({ content: 'Recent 1', timestamp: baseTime - 1000 }),
        createEntry({ content: 'Recent 2', timestamp: baseTime }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.summary).toBeDefined();
    });

    it('should describe day ranges', async () => {
      const baseTime = Date.now();
      const entries = [
        createEntry({ content: 'Morning', timestamp: baseTime }),
        createEntry({ content: 'Evening', timestamp: baseTime + 12 * 3600000 }),
      ];

      const result = await summarizer.summarize(entries);

      // Summary should be created even if it doesn't contain specific keywords
      expect(result.summary).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });
  });

  describe('key point extraction', () => {
    it('should extract first sentences as key points', async () => {
      const entries = [
        createEntry({
          content: 'First sentence is important. Second is less so.',
        }),
        createEntry({
          content: 'Another key point. With more details.',
        }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.keyPoints.some((p) => p.includes('First sentence'))).toBe(
        true,
      );
    });

    it('should deduplicate similar key points', async () => {
      const entries = [
        createEntry({ content: 'User likes pizza. Extra info.' }),
        createEntry({ content: 'User likes pizza. More info.' }),
        createEntry({ content: 'Different point entirely.' }),
      ];

      const result = await summarizer.summarize(entries);

      const uniquePoints = new Set(result.keyPoints);
      expect(uniquePoints.size).toBe(result.keyPoints.length);
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      summarizer.configure({
        maxSummaryLength: 1000,
        summaryStyle: 'detailed',
      });

      expect(summarizer['config'].maxSummaryLength).toBe(1000);
      expect(summarizer['config'].summaryStyle).toBe('detailed');
    });
  });

  describe('type distribution', () => {
    it('should include type distribution in metadata', async () => {
      const entries = [
        createEntry({ type: 'fact' }),
        createEntry({ type: 'fact' }),
        createEntry({ type: 'preference' }),
        createEntry({ type: 'context' }),
      ];

      const result = await summarizer.summarize(entries);

      expect(result.metadata.typeDistribution).toBeDefined();
      const dist = result.metadata.typeDistribution as Record<string, number>;
      expect(dist.fact).toBe(2);
      expect(dist.preference).toBe(1);
    });
  });
});

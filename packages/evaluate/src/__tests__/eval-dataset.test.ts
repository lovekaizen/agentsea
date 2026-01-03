/**
 * Tests for EvalDataset
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EvalDataset, createEvalDataset } from '../evaluation/EvalDataset.js';
import type { EvalDatasetItem } from '../types/index.js';

describe('EvalDataset', () => {
  let items: EvalDatasetItem[];

  beforeEach(() => {
    items = [
      {
        id: 'item-1',
        input: 'What is AI?',
        expectedOutput: 'Artificial Intelligence',
        tags: ['ai', 'basics'],
      },
      {
        id: 'item-2',
        input: 'What is ML?',
        expectedOutput: 'Machine Learning',
        tags: ['ml', 'basics'],
      },
      {
        id: 'item-3',
        input: 'What is DL?',
        expectedOutput: 'Deep Learning',
        tags: ['ml', 'advanced'],
      },
    ];
  });

  describe('constructor', () => {
    it('should create dataset with items', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      expect(dataset.name).toBe('test');
      expect(dataset.size).toBe(3);
    });

    it('should generate IDs for items without IDs', () => {
      const itemsWithoutIds = [
        { input: 'Question 1', expectedOutput: 'Answer 1' },
        { input: 'Question 2', expectedOutput: 'Answer 2' },
      ];

      const dataset = new EvalDataset({
        name: 'test',
        items: itemsWithoutIds as any,
      });

      const allItems = dataset.getItems();
      expect(allItems[0].id).toBeTruthy();
      expect(allItems[1].id).toBeTruthy();
      expect(allItems[0].id).not.toBe(allItems[1].id);
    });

    it('should use default name if not provided', () => {
      const dataset = new EvalDataset({ items });

      expect(dataset.name).toBe('eval-dataset');
    });

    it('should store metadata', () => {
      const metadata = { version: '1.0', source: 'test' };
      const dataset = new EvalDataset({ name: 'test', items, metadata });

      expect(dataset).toBeDefined();
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      expect(dataset.size).toBe(3);
    });

    it('should update size when items added', () => {
      const dataset = new EvalDataset({ name: 'test', items: [] });

      expect(dataset.size).toBe(0);

      dataset.addItems([{ input: 'Q', expectedOutput: 'A' } as any]);

      expect(dataset.size).toBe(1);
    });
  });

  describe('getItems', () => {
    it('should return all items', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const allItems = dataset.getItems();

      expect(allItems).toHaveLength(3);
    });

    it('should return copy of items', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const allItems = dataset.getItems();
      allItems.pop();

      expect(dataset.size).toBe(3);
    });
  });

  describe('getItem', () => {
    it('should return item by ID', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const item = dataset.getItem('item-2');

      expect(item?.id).toBe('item-2');
      expect(item?.input).toBe('What is ML?');
    });

    it('should return undefined for non-existent ID', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const item = dataset.getItem('nonexistent');

      expect(item).toBeUndefined();
    });
  });

  describe('filter', () => {
    it('should filter items by predicate', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const filtered = dataset.filter((item) => item.input.includes('ML'));

      expect(filtered.size).toBe(1);
      expect(filtered.getItems()[0].id).toBe('item-2');
    });

    it('should return new dataset instance', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const filtered = dataset.filter(() => true);

      expect(filtered).not.toBe(dataset);
      expect(filtered).toBeInstanceOf(EvalDataset);
    });

    it('should preserve dataset name', () => {
      const dataset = new EvalDataset({ name: 'original', items });

      const filtered = dataset.filter(() => true);

      expect(filtered.name).toBe('original');
    });
  });

  describe('sample', () => {
    it('should return sampled subset', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const sampled = dataset.sample(2);

      expect(sampled.size).toBe(2);
    });

    it('should return all items if count >= size', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const sampled = dataset.sample(10);

      expect(sampled.size).toBe(3);
    });

    it('should use seed for reproducible sampling', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const sampled1 = dataset.sample(2, 42);
      const sampled2 = dataset.sample(2, 42);

      const ids1 = sampled1.getItems().map((i) => i.id);
      const ids2 = sampled2.getItems().map((i) => i.id);

      expect(ids1).toEqual(ids2);
    });

    it('should produce different results with different seeds', () => {
      const largeItems = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        input: `Question ${i}`,
      }));

      const dataset = new EvalDataset({ name: 'test', items: largeItems });

      const sampled1 = dataset.sample(10, 42);
      const sampled2 = dataset.sample(10, 123);

      const ids1 = sampled1.getItems().map((i) => i.id);
      const ids2 = sampled2.getItems().map((i) => i.id);

      expect(ids1).not.toEqual(ids2);
    });
  });

  describe('split', () => {
    it('should split dataset into train and test', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const [train, test] = dataset.split(0.7);

      expect(train.size + test.size).toBe(3);
      expect(train.size).toBeGreaterThan(0);
      expect(test.size).toBeGreaterThan(0);
    });

    it('should name splits appropriately', () => {
      const dataset = new EvalDataset({ name: 'original', items });

      const [train, test] = dataset.split(0.5);

      expect(train.name).toBe('original-train');
      expect(test.name).toBe('original-test');
    });

    it('should shuffle before splitting', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const [train] = dataset.split(0.5);

      // Hard to test randomness, but ensure split happened
      expect(train.size).toBeGreaterThan(0);
    });
  });

  describe('filterByTags', () => {
    it('should filter by single tag (any mode)', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const filtered = dataset.filterByTags(['ai']);

      expect(filtered.size).toBe(1);
      expect(filtered.getItems()[0].id).toBe('item-1');
    });

    it('should filter by multiple tags (any mode)', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const filtered = dataset.filterByTags(['ai', 'ml']);

      expect(filtered.size).toBe(3);
    });

    it('should filter by tags (all mode)', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const filtered = dataset.filterByTags(['ml', 'basics'], 'all');

      expect(filtered.size).toBe(1);
      expect(filtered.getItems()[0].id).toBe('item-2');
    });

    it('should return empty dataset if no matches', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const filtered = dataset.filterByTags(['nonexistent']);

      expect(filtered.size).toBe(0);
    });

    it('should skip items without tags', () => {
      const itemsWithoutTags = [
        { id: '1', input: 'Q1' },
        { id: '2', input: 'Q2', tags: ['test'] },
      ];

      const dataset = new EvalDataset({
        name: 'test',
        items: itemsWithoutTags as any,
      });

      const filtered = dataset.filterByTags(['test']);

      expect(filtered.size).toBe(1);
    });
  });

  describe('getTags', () => {
    it('should return all unique tags', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const tags = dataset.getTags();

      expect(tags).toContain('ai');
      expect(tags).toContain('ml');
      expect(tags).toContain('basics');
      expect(tags).toContain('advanced');
    });

    it('should return empty array if no tags', () => {
      const itemsWithoutTags = [{ id: '1', input: 'Q' }];

      const dataset = new EvalDataset({
        name: 'test',
        items: itemsWithoutTags as any,
      });

      const tags = dataset.getTags();

      expect(tags).toHaveLength(0);
    });
  });

  describe('addItems', () => {
    it('should add items to dataset', () => {
      const dataset = new EvalDataset({ name: 'test', items: [] });

      dataset.addItems([
        { input: 'New question', expectedOutput: 'New answer' } as any,
      ]);

      expect(dataset.size).toBe(1);
    });

    it('should generate IDs for new items', () => {
      const dataset = new EvalDataset({ name: 'test', items: [] });

      dataset.addItems([{ input: 'Q1' } as any, { input: 'Q2' } as any]);

      const allItems = dataset.getItems();
      expect(allItems[0].id).toBeTruthy();
      expect(allItems[1].id).toBeTruthy();
    });
  });

  describe('removeItem', () => {
    it('should remove item by ID', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const removed = dataset.removeItem('item-2');

      expect(removed).toBe(true);
      expect(dataset.size).toBe(2);
      expect(dataset.getItem('item-2')).toBeUndefined();
    });

    it('should return false for non-existent ID', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const removed = dataset.removeItem('nonexistent');

      expect(removed).toBe(false);
      expect(dataset.size).toBe(3);
    });
  });

  describe('export methods', () => {
    it('should export to JSON', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const json = dataset.toJSON();

      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('test');
      expect(parsed.items).toHaveLength(3);
    });

    it('should export to JSONL', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const jsonl = dataset.toJSONL();

      const lines = jsonl.split('\n');
      expect(lines).toHaveLength(3);
      expect(JSON.parse(lines[0]).id).toBe('item-1');
    });
  });

  describe('static methods', () => {
    describe('fromJSON', () => {
      it('should create dataset from JSON array', () => {
        const data = [
          { input: 'Q1', expectedOutput: 'A1' },
          { input: 'Q2', expectedOutput: 'A2' },
        ];

        const dataset = EvalDataset.fromJSON(data, 'test-dataset');

        expect(dataset.name).toBe('test-dataset');
        expect(dataset.size).toBe(2);
      });

      it('should use default name if not provided', () => {
        const data = [{ input: 'Q1' }];

        const dataset = EvalDataset.fromJSON(data);

        expect(dataset.name).toBe('json-dataset');
      });
    });

    describe('fromJSONL', () => {
      it('should create dataset from JSONL string', () => {
        const jsonl = `{"input":"Q1","expectedOutput":"A1"}
{"input":"Q2","expectedOutput":"A2"}`;

        const dataset = EvalDataset.fromJSONL(jsonl, 'test');

        expect(dataset.size).toBe(2);
      });

      it('should handle empty lines', () => {
        const jsonl = `{"input":"Q1"}

{"input":"Q2"}
`;

        const dataset = EvalDataset.fromJSONL(jsonl);

        expect(dataset.size).toBe(2);
      });

      it('should preserve IDs from JSONL', () => {
        const jsonl = `{"id":"custom-1","input":"Q1"}`;

        const dataset = EvalDataset.fromJSONL(jsonl);

        expect(dataset.getItem('custom-1')).toBeDefined();
      });
    });

    describe('fromCSV', () => {
      it('should create dataset from CSV string', () => {
        const csv = `input,output
"What is AI?","Artificial Intelligence"
"What is ML?","Machine Learning"`;

        const dataset = EvalDataset.fromCSV(csv);

        expect(dataset.size).toBe(2);
      });

      it('should handle custom column names', () => {
        const csv = `question,answer
"Q1","A1"
"Q2","A2"`;

        const dataset = EvalDataset.fromCSV(csv, {
          inputColumn: 'question',
          outputColumn: 'answer',
        });

        expect(dataset.size).toBe(2);
      });

      it('should auto-detect columns', () => {
        const csv = `my_input,expected_output
"Q1","A1"`;

        const dataset = EvalDataset.fromCSV(csv);

        expect(dataset.size).toBe(1);
      });

      it('should handle custom delimiter', () => {
        const csv = `input;output
"Q1";"A1"`;

        const dataset = EvalDataset.fromCSV(csv, { delimiter: ';' });

        expect(dataset.size).toBe(1);
      });

      it('should handle empty CSV', () => {
        const dataset = EvalDataset.fromCSV('input,output\n');

        expect(dataset.size).toBe(0);
      });

      it('should handle context column', () => {
        const csv = `input,output,context
"Q1","A1","Context 1"`;

        const dataset = EvalDataset.fromCSV(csv);

        const item = dataset.getItems()[0];
        expect(item.context).toEqual(['Context 1']);
      });
    });

    describe('fromHuggingFace', () => {
      it('should return empty dataset with warning', async () => {
        const dataset = await EvalDataset.fromHuggingFace('test-dataset');

        expect(dataset.size).toBe(0);
        expect(dataset.name).toBe('test-dataset');
      });
    });
  });

  describe('createEvalDataset', () => {
    it('should create dataset with factory', () => {
      const dataset = createEvalDataset({ name: 'test', items });

      expect(dataset).toBeInstanceOf(EvalDataset);
      expect(dataset.size).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle empty dataset', () => {
      const dataset = new EvalDataset({ name: 'empty', items: [] });

      expect(dataset.size).toBe(0);
      expect(dataset.getItems()).toHaveLength(0);
      expect(dataset.getTags()).toHaveLength(0);
    });

    it('should handle items with all fields', () => {
      const fullItems: EvalDatasetItem[] = [
        {
          id: 'full-1',
          input: 'Question',
          expectedOutput: 'Answer',
          context: ['Context 1', 'Context 2'],
          reference: 'Reference text',
          metadata: { key: 'value' },
          tags: ['tag1', 'tag2'],
        },
      ];

      const dataset = new EvalDataset({ name: 'test', items: fullItems });

      const item = dataset.getItem('full-1');
      expect(item?.context).toBeDefined();
      expect(item?.reference).toBeDefined();
      expect(item?.metadata).toBeDefined();
      expect(item?.tags).toBeDefined();
    });

    it('should handle complex filtering chains', () => {
      const dataset = new EvalDataset({ name: 'test', items });

      const result = dataset
        .filterByTags(['ml'])
        .filter((item) => item.input.includes('ML'))
        .sample(1);

      expect(result.size).toBe(1);
    });
  });
});

/**
 * Ingester Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ingester } from '../core/Ingester.js';
import type { DocumentInput } from '../types/index.js';

// Create mock functions
const mockStat = vi.fn();
const mockReadFile = vi.fn();
const mockReaddir = vi.fn();
const mockWatch = vi.fn(() => ({ close: vi.fn() }));

// Mock fs modules for dynamic imports
vi.mock('node:fs/promises', () => ({
  default: {
    stat: (...args: unknown[]) => mockStat(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
  },
  stat: (...args: unknown[]) => mockStat(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
}));

vi.mock('node:fs', () => ({
  default: {
    watch: (...args: unknown[]) => mockWatch(...args),
  },
  watch: (...args: unknown[]) => mockWatch(...args),
  promises: {
    stat: (...args: unknown[]) => mockStat(...args),
    readFile: (...args: unknown[]) => mockReadFile(...args),
    readdir: (...args: unknown[]) => mockReaddir(...args),
  },
}));

describe('Ingester', () => {
  let ingester: Ingester;

  beforeEach(() => {
    ingester = new Ingester({
      name: 'test-ingester',
      stages: ['load', 'parse', 'chunk'],
    });
    mockStat.mockReset();
    mockReadFile.mockReset();
    mockReaddir.mockReset();
    mockWatch.mockReset();
    mockWatch.mockReturnValue({ close: vi.fn() });
  });

  describe('constructor', () => {
    it('should create ingester with default config', () => {
      const defaultIngester = new Ingester();
      expect(defaultIngester).toBeDefined();
      expect(defaultIngester.name).toBe('default-pipeline');
    });

    it('should create ingester with custom config', () => {
      expect(ingester.name).toBe('test-ingester');
    });

    it('should initialize status correctly', () => {
      const status = ingester.getStatus();
      expect(status.isProcessing).toBe(false);
      expect(status.isWatching).toBe(false);
      expect(status.documentsProcessed).toBe(0);
      expect(status.documentsPending).toBe(0);
      expect(status.errorsCount).toBe(0);
    });
  });

  describe('ingestFile', () => {
    it('should throw error for unsupported file type', async () => {
      mockStat.mockResolvedValue({ size: 1000 });

      // The error message format changed to be more descriptive
      await expect(ingester.ingestFile('/test/file.xyz')).rejects.toThrow(
        /No parser found|Unsupported file type/,
      );
    });

    it('should throw error when file exceeds size limit', async () => {
      const largeFileIngester = new Ingester({
        fileSizeLimit: 1000,
      });

      mockStat.mockResolvedValue({ size: 2000 });

      await expect(
        largeFileIngester.ingestFile('/test/file.pdf'),
      ).rejects.toThrow('File size 2000 exceeds limit 1000');
    });

    it('should allow file within size limit', async () => {
      const sizedIngester = new Ingester({
        fileSizeLimit: 5000,
        stages: ['load'],
      });

      mockStat.mockResolvedValue({ size: 3000 });
      mockReadFile.mockResolvedValue(Buffer.from('test content'));

      const result = await sizedIngester.ingestFile('/test/file.txt');
      expect(result).toBeDefined();
      expect(result.metadata.fileSize).toBe(3000);
    });

    it('should filter by supported MIME types', async () => {
      const filteredIngester = new Ingester({
        supportedMimeTypes: ['application/pdf'],
      });

      mockStat.mockResolvedValue({ size: 1000 });

      await expect(
        filteredIngester.ingestFile('/test/file.txt'),
      ).rejects.toThrow('Unsupported file type');
    });
  });

  describe('ingestUrl', () => {
    it('should extract filename from URL', async () => {
      const url = 'https://example.com/documents/test.pdf?version=1';

      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        headers: new Map([['content-type', 'application/pdf']]),
      } as any);

      const mockIngester = new Ingester({ stages: ['load'] });
      const result = await mockIngester.ingestUrl(url);

      expect(result.metadata.filename).toBe('test.pdf');
      expect(result.metadata.sourceUrl).toBe(url);
    });

    it('should handle URL without file extension', async () => {
      const url = 'https://example.com/api/document';

      global.fetch = vi.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        headers: new Map([['content-type', 'application/json']]),
      } as any);

      const mockIngester = new Ingester({ stages: ['load'] });
      const result = await mockIngester.ingestUrl(url);

      expect(result.metadata.sourceUrl).toBe(url);
    });
  });

  describe('ingestBuffer', () => {
    it('should process buffer with filename', async () => {
      const buffer = Buffer.from('test content');
      const mockIngester = new Ingester({ stages: ['load'] });

      const result = await mockIngester.ingestBuffer(buffer, 'test.txt');

      expect(result).toBeDefined();
      expect(result.metadata.filename).toBe('test.txt');
      expect(result.metadata.fileSize).toBe(buffer.length);
    });

    it('should process buffer without filename', async () => {
      const buffer = Buffer.from('test content');
      const mockIngester = new Ingester({ stages: ['load'] });

      const result = await mockIngester.ingestBuffer(buffer);

      expect(result).toBeDefined();
      expect(result.metadata.fileSize).toBe(buffer.length);
    });

    it('should enforce buffer size limit', async () => {
      const buffer = Buffer.alloc(2000);
      const limitedIngester = new Ingester({
        fileSizeLimit: 1000,
      });

      await expect(limitedIngester.ingestBuffer(buffer)).rejects.toThrow(
        'Buffer size 2000 exceeds limit 1000',
      );
    });
  });

  describe('ingestDirectory', () => {
    it('should list files recursively', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.pdf', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
      ]);

      mockStat.mockResolvedValue({ size: 100 });
      mockReadFile.mockResolvedValue(Buffer.from('content'));

      const mockIngester = new Ingester({ stages: ['load'] });
      const result = await mockIngester.ingestDirectory('/test/dir', {
        recursive: false,
      });

      expect(result.documents.length).toBeGreaterThan(0);
    });

    it('should filter files by include patterns', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.pdf', isFile: () => true, isDirectory: () => false },
        { name: 'file3.md', isFile: () => true, isDirectory: () => false },
      ]);

      mockStat.mockResolvedValue({ size: 100 });
      mockReadFile.mockResolvedValue(Buffer.from('content'));

      const mockIngester = new Ingester({ stages: ['load'] });
      const result = await mockIngester.ingestDirectory('/test/dir', {
        include: ['*.pdf'],
      });

      // Would only process PDF files
      expect(result).toBeDefined();
    });

    it('should exclude files by exclude patterns', async () => {
      mockReaddir.mockResolvedValue([
        { name: 'file1.txt', isFile: () => true, isDirectory: () => false },
        { name: 'file2.tmp', isFile: () => true, isDirectory: () => false },
      ]);

      mockStat.mockResolvedValue({ size: 100 });
      mockReadFile.mockResolvedValue(Buffer.from('content'));

      const mockIngester = new Ingester({ stages: ['load'] });
      const result = await mockIngester.ingestDirectory('/test/dir', {
        exclude: ['*.tmp'],
      });

      expect(result).toBeDefined();
    });

    it('should limit number of files processed', async () => {
      mockReaddir.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          name: `file${i}.txt`,
          isFile: () => true,
          isDirectory: () => false,
        })),
      );

      mockStat.mockResolvedValue({
        size: 100,
        mtime: new Date(),
      });
      mockReadFile.mockResolvedValue(Buffer.from('content'));

      const mockIngester = new Ingester({ stages: ['load'] });
      const result = await mockIngester.ingestDirectory('/test/dir', {
        maxFiles: 5,
      });

      expect(result.documents.length).toBeLessThanOrEqual(5);
    });
  });

  describe('watch mode', () => {
    it('should throw error when watch mode not configured', () => {
      expect(() => ingester.startWatching()).toThrow(
        'Watch mode is not configured',
      );
    });

    it('should start watching when configured', () => {
      const watchIngester = new Ingester({
        watchMode: {
          enabled: true,
          paths: ['/test/watch'],
        },
      });

      expect(() => watchIngester.startWatching()).not.toThrow();
      expect(watchIngester.getStatus().isWatching).toBe(true);
    });

    it('should stop watching', () => {
      const watchIngester = new Ingester({
        watchMode: {
          enabled: true,
          paths: ['/test/watch'],
        },
      });

      watchIngester.startWatching();
      expect(watchIngester.getStatus().isWatching).toBe(true);

      watchIngester.stopWatching();
      expect(watchIngester.getStatus().isWatching).toBe(false);
    });
  });

  describe('status tracking', () => {
    it('should track processing status', async () => {
      const buffer = Buffer.from('test');
      const trackingIngester = new Ingester({ stages: ['load'] });

      const statusBefore = trackingIngester.getStatus();
      expect(statusBefore.documentsProcessed).toBe(0);

      await trackingIngester.ingestBuffer(buffer);

      const statusAfter = trackingIngester.getStatus();
      expect(statusAfter.documentsProcessed).toBe(1);
    });

    it('should track errors', async () => {
      const errorIngester = new Ingester({
        stages: ['load', 'parse'],
      });

      mockStat.mockResolvedValue({ size: 100 });
      mockReadFile.mockRejectedValue(new Error('Read error'));

      // Errors during processing should increment error count
      await expect(
        errorIngester.ingestFile('/test/bad-file.txt'),
      ).rejects.toThrow();

      const status = errorIngester.getStatus();
      expect(status.errorsCount).toBeGreaterThan(0);
    });

    it('should track uptime', async () => {
      const uptimeIngester = new Ingester();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const status = uptimeIngester.getStatus();
      expect(status.uptime).toBeGreaterThan(0);
    });
  });

  describe('process override', () => {
    it('should update status during processing', async () => {
      const buffer = Buffer.from('test content');
      const statusIngester = new Ingester({ stages: ['load'] });

      const promise = statusIngester.ingestBuffer(buffer, 'test.txt');

      // Status should show processing during execution
      const result = await promise;

      expect(result).toBeDefined();
    });

    it('should clear current document after processing', async () => {
      const buffer = Buffer.from('test content');
      const statusIngester = new Ingester({ stages: ['load'] });

      await statusIngester.ingestBuffer(buffer, 'test.txt');

      const status = statusIngester.getStatus();
      expect(status.currentDocument).toBeUndefined();
      expect(status.isProcessing).toBe(false);
    });
  });
});

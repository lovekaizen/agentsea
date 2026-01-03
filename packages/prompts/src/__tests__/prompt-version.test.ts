import { describe, it, expect, beforeEach } from 'vitest';
import { PromptVersion, VersionHistory } from '../core/PromptVersion.js';
import type { VersionHistoryEntry, PromptData } from '../types/index.js';

describe('PromptVersion', () => {
  const mockPromptData: PromptData = {
    id: 'prompt-1',
    name: 'test-prompt',
    template: 'Hello {{name}}!',
    variables: {},
    metadata: {},
    status: 'draft',
    version: 'v1',
    environment: 'development',
    createdAt: new Date(),
    updatedAt: new Date(),
    hash: 'test-hash',
  };

  describe('constructor', () => {
    it('should create a version from data', () => {
      const data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(data);

      expect(version.promptId).toBe('prompt-1');
      expect(version.version).toBe('v1');
      expect(version.hash).toBe('hash-1');
    });

    it('should handle optional fields', () => {
      const data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        message: 'Initial version',
        author: 'user@example.com',
        parentVersion: 'v0',
        branch: 'feature',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(data);

      expect(version.message).toBe('Initial version');
      expect(version.author).toBe('user@example.com');
      expect(version.parentVersion).toBe('v0');
      expect(version.branch).toBe('feature');
    });
  });

  describe('getInfo', () => {
    it('should return version info without snapshot', () => {
      const data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        message: 'Test version',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(data);
      const info = version.getInfo();

      expect(info.version).toBe('v1');
      expect(info.hash).toBe('hash-1');
      expect(info.message).toBe('Test version');
      expect('snapshot' in info).toBe(false);
    });
  });

  describe('toData', () => {
    it('should convert to data object', () => {
      const originalData: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(originalData);
      const data = version.toData();

      expect(data.promptId).toBe('prompt-1');
      expect(data.version).toBe('v1');
      expect(data.snapshot).toEqual(mockPromptData);
    });
  });

  describe('isNewerThan', () => {
    it('should compare with another PromptVersion', () => {
      const v1Data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const v2Data: VersionHistoryEntry = {
        ...v1Data,
        version: 'v2',
      };

      const v1 = new PromptVersion(v1Data);
      const v2 = new PromptVersion(v2Data);

      expect(v2.isNewerThan(v1)).toBe(true);
      expect(v1.isNewerThan(v2)).toBe(false);
    });

    it('should compare with version string', () => {
      const versionData: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v2',
        hash: 'hash-1',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(versionData);

      expect(version.isNewerThan('v1')).toBe(true);
      expect(version.isNewerThan('v3')).toBe(false);
    });
  });

  describe('isOlderThan', () => {
    it('should compare with another PromptVersion', () => {
      const v1Data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const v2Data: VersionHistoryEntry = {
        ...v1Data,
        version: 'v2',
      };

      const v1 = new PromptVersion(v1Data);
      const v2 = new PromptVersion(v2Data);

      expect(v1.isOlderThan(v2)).toBe(true);
      expect(v2.isOlderThan(v1)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format version string', () => {
      const data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        message: 'Initial commit',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(data);
      const str = version.toString();

      expect(str).toContain('v1');
      expect(str).toContain('Initial commit');
    });

    it('should include branch if not main', () => {
      const data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        branch: 'feature',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(data);
      const str = version.toString();

      expect(str).toContain('(feature)');
    });

    it('should not include main branch', () => {
      const data: VersionHistoryEntry = {
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        branch: 'main',
        createdAt: new Date(),
        environment: 'development',
        snapshot: mockPromptData,
      };

      const version = new PromptVersion(data);
      const str = version.toString();

      expect(str).not.toContain('(main)');
    });
  });

  describe('fromPrompt', () => {
    it('should create version from prompt data', () => {
      const version = PromptVersion.fromPrompt(mockPromptData);

      expect(version.promptId).toBe(mockPromptData.id);
      expect(version.promptName).toBe(mockPromptData.name);
      expect(version.version).toBe(mockPromptData.version);
      expect(version.hash).toBe(mockPromptData.hash);
    });

    it('should use provided options', () => {
      const version = PromptVersion.fromPrompt(mockPromptData, {
        message: 'Custom message',
        author: 'user@example.com',
        parentVersion: 'v0',
        branch: 'feature',
      });

      expect(version.message).toBe('Custom message');
      expect(version.author).toBe('user@example.com');
      expect(version.parentVersion).toBe('v0');
      expect(version.branch).toBe('feature');
    });
  });
});

describe('VersionHistory', () => {
  const createVersion = (
    version: string,
    parentVersion?: string,
  ): PromptVersion => {
    return new PromptVersion({
      promptId: 'prompt-1',
      promptName: 'test',
      version,
      hash: `hash-${version}`,
      parentVersion,
      createdAt: new Date(),
      environment: 'development',
      snapshot: {
        id: 'prompt-1',
        name: 'test',
        template: 'Test',
        variables: {},
        metadata: {},
        status: 'draft',
        version,
        environment: 'development',
        createdAt: new Date(),
        updatedAt: new Date(),
        hash: `hash-${version}`,
      },
    });
  };

  describe('constructor', () => {
    it('should create empty history', () => {
      const history = new VersionHistory();

      expect(history.count).toBe(0);
      expect(history.getAll()).toEqual([]);
    });

    it('should create history with versions', () => {
      const versions = [createVersion('v1'), createVersion('v2')];
      const history = new VersionHistory(versions);

      expect(history.count).toBe(2);
    });

    it('should sort versions in descending order', () => {
      const versions = [
        createVersion('v1'),
        createVersion('v3'),
        createVersion('v2'),
      ];
      const history = new VersionHistory(versions);

      const all = history.getAll();
      expect(all[0].version).toBe('v3');
      expect(all[1].version).toBe('v2');
      expect(all[2].version).toBe('v1');
    });
  });

  describe('add', () => {
    it('should add a version', () => {
      const history = new VersionHistory();
      const version = createVersion('v1');

      history.add(version);

      expect(history.count).toBe(1);
      expect(history.get('v1')).toBe(version);
    });

    it('should maintain sorted order', () => {
      const history = new VersionHistory([createVersion('v3')]);

      history.add(createVersion('v1'));
      history.add(createVersion('v2'));

      const all = history.getAll();
      expect(all[0].version).toBe('v3');
      expect(all[1].version).toBe('v2');
      expect(all[2].version).toBe('v1');
    });
  });

  describe('get', () => {
    it('should get version by string', () => {
      const version = createVersion('v1');
      const history = new VersionHistory([version]);

      const retrieved = history.get('v1');

      expect(retrieved).toBe(version);
    });

    it('should return undefined for non-existent version', () => {
      const history = new VersionHistory();

      expect(history.get('v999')).toBeUndefined();
    });
  });

  describe('getLatest', () => {
    it('should return the latest version', () => {
      const versions = [
        createVersion('v1'),
        createVersion('v2'),
        createVersion('v3'),
      ];
      const history = new VersionHistory(versions);

      const latest = history.getLatest();

      expect(latest?.version).toBe('v3');
    });

    it('should return undefined for empty history', () => {
      const history = new VersionHistory();

      expect(history.getLatest()).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all versions', () => {
      const versions = [createVersion('v1'), createVersion('v2')];
      const history = new VersionHistory(versions);

      const all = history.getAll();

      expect(all).toHaveLength(2);
    });

    it('should apply limit', () => {
      const versions = [
        createVersion('v1'),
        createVersion('v2'),
        createVersion('v3'),
      ];
      const history = new VersionHistory(versions);

      const limited = history.getAll(2);

      expect(limited).toHaveLength(2);
      expect(limited[0].version).toBe('v3');
      expect(limited[1].version).toBe('v2');
    });
  });

  describe('getNextVersion', () => {
    it('should return incremented version', () => {
      const history = new VersionHistory([createVersion('v5')]);

      expect(history.getNextVersion()).toBe('v6');
    });

    it('should return v2 for v1', () => {
      const history = new VersionHistory([createVersion('v1')]);

      expect(history.getNextVersion()).toBe('v2');
    });
  });

  describe('getByBranch', () => {
    it('should filter versions by branch', () => {
      const v1 = new PromptVersion({
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        branch: 'main',
        createdAt: new Date(),
        environment: 'development',
        snapshot: {} as PromptData,
      });

      const v2 = new PromptVersion({
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v2',
        hash: 'hash-2',
        branch: 'feature',
        createdAt: new Date(),
        environment: 'development',
        snapshot: {} as PromptData,
      });

      const history = new VersionHistory([v1, v2]);

      const featureVersions = history.getByBranch('feature');
      expect(featureVersions).toHaveLength(1);
      expect(featureVersions[0].version).toBe('v2');
    });
  });

  describe('getByAuthor', () => {
    it('should filter versions by author', () => {
      const v1 = new PromptVersion({
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        author: 'alice@example.com',
        createdAt: new Date(),
        environment: 'development',
        snapshot: {} as PromptData,
      });

      const v2 = new PromptVersion({
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v2',
        hash: 'hash-2',
        author: 'bob@example.com',
        createdAt: new Date(),
        environment: 'development',
        snapshot: {} as PromptData,
      });

      const history = new VersionHistory([v1, v2]);

      const aliceVersions = history.getByAuthor('alice@example.com');
      expect(aliceVersions).toHaveLength(1);
      expect(aliceVersions[0].version).toBe('v1');
    });
  });

  describe('getByDateRange', () => {
    it('should filter versions by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const v1 = new PromptVersion({
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v1',
        hash: 'hash-1',
        createdAt: yesterday,
        environment: 'development',
        snapshot: {} as PromptData,
      });

      const v2 = new PromptVersion({
        promptId: 'prompt-1',
        promptName: 'test',
        version: 'v2',
        hash: 'hash-2',
        createdAt: now,
        environment: 'development',
        snapshot: {} as PromptData,
      });

      const history = new VersionHistory([v1, v2]);

      const todayVersions = history.getByDateRange(yesterday, tomorrow);
      expect(todayVersions).toHaveLength(2);
    });
  });

  describe('has', () => {
    it('should return true for existing version', () => {
      const history = new VersionHistory([createVersion('v1')]);

      expect(history.has('v1')).toBe(true);
    });

    it('should return false for non-existing version', () => {
      const history = new VersionHistory([createVersion('v1')]);

      expect(history.has('v999')).toBe(false);
    });
  });

  describe('getPrevious', () => {
    it('should get previous version', () => {
      const v1 = createVersion('v1');
      const v2 = createVersion('v2', 'v1');
      const history = new VersionHistory([v1, v2]);

      const previous = history.getPrevious('v2');

      expect(previous?.version).toBe('v1');
    });

    it('should return undefined if no parent', () => {
      const history = new VersionHistory([createVersion('v1')]);

      expect(history.getPrevious('v1')).toBeUndefined();
    });
  });

  describe('getLineage', () => {
    it('should get version lineage', () => {
      const v1 = createVersion('v1');
      const v2 = createVersion('v2', 'v1');
      const v3 = createVersion('v3', 'v2');
      const history = new VersionHistory([v1, v2, v3]);

      const lineage = history.getLineage('v3');

      expect(lineage).toHaveLength(3);
      expect(lineage[0].version).toBe('v3');
      expect(lineage[1].version).toBe('v2');
      expect(lineage[2].version).toBe('v1');
    });

    it('should handle version without parents', () => {
      const history = new VersionHistory([createVersion('v1')]);

      const lineage = history.getLineage('v1');

      expect(lineage).toHaveLength(1);
      expect(lineage[0].version).toBe('v1');
    });
  });
});

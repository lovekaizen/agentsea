import { describe, it, expect, beforeEach } from 'vitest';
import { BufferStorage } from '../storage/adapters/BufferStorage.js';
import type {
  PromptData,
  VersionHistoryEntry,
  BranchInfo,
} from '../types/index.js';

describe('BufferStorage', () => {
  let storage: BufferStorage;

  beforeEach(() => {
    storage = new BufferStorage();
  });

  describe('initialize and close', () => {
    it('should initialize successfully', async () => {
      await expect(storage.initialize()).resolves.toBeUndefined();
    });

    it('should close and clear data', async () => {
      const prompt: PromptData = {
        id: 'prompt-1',
        name: 'test',
        template: 'Test',
        variables: {},
        metadata: {},
        status: 'draft',
        version: 'v1',
        environment: 'development',
        createdAt: new Date(),
        updatedAt: new Date(),
        hash: 'hash-1',
      };

      await storage.savePrompt(prompt);
      await storage.close();

      const retrieved = await storage.getPrompt('prompt-1', 'development');
      expect(retrieved).toBeNull();
    });
  });

  describe('prompt operations', () => {
    const mockPrompt: PromptData = {
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
      hash: 'hash-1',
    };

    it('should save a prompt', async () => {
      await storage.savePrompt(mockPrompt);

      const retrieved = await storage.getPrompt('prompt-1', 'development');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-prompt');
    });

    it('should get prompt by ID', async () => {
      await storage.savePrompt(mockPrompt);

      const retrieved = await storage.getPrompt('prompt-1', 'development');
      expect(retrieved?.id).toBe('prompt-1');
    });

    it('should return null for non-existent prompt', async () => {
      const retrieved = await storage.getPrompt('non-existent', 'development');
      expect(retrieved).toBeNull();
    });

    it('should get prompt by name', async () => {
      await storage.savePrompt(mockPrompt);

      const retrieved = await storage.getPromptByName(
        'test-prompt',
        'development',
      );
      expect(retrieved?.id).toBe('prompt-1');
    });

    it('should update existing prompt', async () => {
      await storage.savePrompt(mockPrompt);

      const updated = { ...mockPrompt, template: 'Updated template' };
      await storage.savePrompt(updated);

      const retrieved = await storage.getPrompt('prompt-1', 'development');
      expect(retrieved?.template).toBe('Updated template');
    });

    it('should delete a prompt', async () => {
      await storage.savePrompt(mockPrompt);

      const deleted = await storage.deletePrompt('prompt-1');
      expect(deleted).toBe(true);

      const retrieved = await storage.getPrompt('prompt-1', 'development');
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent prompt', async () => {
      const deleted = await storage.deletePrompt('non-existent');
      expect(deleted).toBe(false);
    });

    it('should handle prompts in different environments', async () => {
      const devPrompt = { ...mockPrompt, environment: 'development' };
      const prodPrompt = {
        ...mockPrompt,
        id: 'prompt-2',
        environment: 'production',
      };

      await storage.savePrompt(devPrompt);
      await storage.savePrompt(prodPrompt);

      const dev = await storage.getPrompt('prompt-1', 'development');
      const prod = await storage.getPrompt('prompt-2', 'production');

      expect(dev?.environment).toBe('development');
      expect(prod?.environment).toBe('production');
    });
  });

  describe('queryPrompts', () => {
    beforeEach(async () => {
      const prompts: PromptData[] = [
        {
          id: 'p1',
          name: 'prompt-1',
          template: 'Template 1',
          variables: {},
          metadata: { tags: ['tag1'] },
          status: 'draft',
          version: 'v1',
          environment: 'development',
          createdAt: new Date(),
          updatedAt: new Date(),
          hash: 'hash-1',
        },
        {
          id: 'p2',
          name: 'prompt-2',
          template: 'Template 2',
          variables: {},
          metadata: { tags: ['tag2'] },
          status: 'active',
          version: 'v1',
          environment: 'development',
          createdAt: new Date(),
          updatedAt: new Date(),
          hash: 'hash-2',
        },
        {
          id: 'p3',
          name: 'prompt-3',
          template: 'Template 3',
          variables: {},
          metadata: {},
          status: 'active',
          version: 'v1',
          environment: 'production',
          createdAt: new Date(),
          updatedAt: new Date(),
          hash: 'hash-3',
        },
      ];

      for (const prompt of prompts) {
        await storage.savePrompt(prompt);
      }
    });

    it('should query all prompts', async () => {
      const results = await storage.queryPrompts({});
      expect(results).toHaveLength(3);
    });

    it('should filter by environment', async () => {
      const results = await storage.queryPrompts({
        environment: 'development',
      });
      expect(results).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const results = await storage.queryPrompts({ status: 'active' });
      expect(results).toHaveLength(2);
    });

    it('should filter by tags', async () => {
      const results = await storage.queryPrompts({ tags: ['tag1'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('prompt-1');
    });

    it('should search by name', async () => {
      const results = await storage.queryPrompts({ search: 'prompt-2' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('prompt-2');
    });

    it('should search by template', async () => {
      const results = await storage.queryPrompts({ search: 'Template 3' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('p3');
    });

    it('should apply pagination', async () => {
      const results = await storage.queryPrompts({ limit: 2, offset: 1 });
      expect(results).toHaveLength(2);
    });

    it('should combine filters', async () => {
      const results = await storage.queryPrompts({
        environment: 'development',
        status: 'active',
      });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('prompt-2');
    });
  });

  describe('version operations', () => {
    const mockVersion: VersionHistoryEntry = {
      promptId: 'prompt-1',
      promptName: 'test',
      version: 'v1',
      hash: 'hash-1',
      message: 'Initial version',
      createdAt: new Date(),
      environment: 'development',
      snapshot: {} as PromptData,
    };

    it('should save a version', async () => {
      await storage.saveVersion(mockVersion);

      const retrieved = await storage.getVersion('prompt-1', 'v1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.message).toBe('Initial version');
    });

    it('should get version by ID and version string', async () => {
      await storage.saveVersion(mockVersion);

      const retrieved = await storage.getVersion('prompt-1', 'v1');
      expect(retrieved?.version).toBe('v1');
    });

    it('should return null for non-existent version', async () => {
      const retrieved = await storage.getVersion('non-existent', 'v1');
      expect(retrieved).toBeNull();
    });

    it('should get version history', async () => {
      const v1 = { ...mockVersion, version: 'v1' };
      const v2 = { ...mockVersion, version: 'v2' };
      const v3 = { ...mockVersion, version: 'v3' };

      await storage.saveVersion(v1);
      await storage.saveVersion(v2);
      await storage.saveVersion(v3);

      const history = await storage.getVersionHistory('prompt-1');
      expect(history).toHaveLength(3);
    });

    it('should return versions in descending order', async () => {
      await storage.saveVersion({ ...mockVersion, version: 'v1' });
      await storage.saveVersion({ ...mockVersion, version: 'v2' });
      await storage.saveVersion({ ...mockVersion, version: 'v3' });

      const history = await storage.getVersionHistory('prompt-1');
      expect(history[0].version).toBe('v3');
      expect(history[1].version).toBe('v2');
      expect(history[2].version).toBe('v1');
    });

    it('should apply limit to version history', async () => {
      await storage.saveVersion({ ...mockVersion, version: 'v1' });
      await storage.saveVersion({ ...mockVersion, version: 'v2' });
      await storage.saveVersion({ ...mockVersion, version: 'v3' });

      const history = await storage.getVersionHistory('prompt-1', 2);
      expect(history).toHaveLength(2);
    });
  });

  describe('branch operations', () => {
    const mockBranch: BranchInfo = {
      name: 'feature-branch',
      promptId: 'prompt-1',
      baseVersion: 'v1',
      headVersion: 'v2',
      createdAt: new Date(),
      isActive: true,
    };

    it('should save a branch', async () => {
      await storage.saveBranch(mockBranch);

      const retrieved = await storage.getBranch('prompt-1', 'feature-branch');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('feature-branch');
    });

    it('should get branch by name', async () => {
      await storage.saveBranch(mockBranch);

      const retrieved = await storage.getBranch('prompt-1', 'feature-branch');
      expect(retrieved?.baseVersion).toBe('v1');
    });

    it('should return null for non-existent branch', async () => {
      const retrieved = await storage.getBranch('prompt-1', 'non-existent');
      expect(retrieved).toBeNull();
    });

    it('should get all branches for a prompt', async () => {
      await storage.saveBranch(mockBranch);
      await storage.saveBranch({ ...mockBranch, name: 'another-branch' });

      const branches = await storage.getBranches('prompt-1');
      expect(branches).toHaveLength(2);
    });

    it('should delete a branch', async () => {
      await storage.saveBranch(mockBranch);

      const deleted = await storage.deleteBranch('prompt-1', 'feature-branch');
      expect(deleted).toBe(true);

      const retrieved = await storage.getBranch('prompt-1', 'feature-branch');
      expect(retrieved).toBeNull();
    });
  });

  describe('partial operations', () => {
    it('should save a partial', async () => {
      await storage.savePartial('header', '=== Header ===');

      const retrieved = await storage.getPartial('header');
      expect(retrieved).toBe('=== Header ===');
    });

    it('should get all partials', async () => {
      await storage.savePartial('header', 'Header');
      await storage.savePartial('footer', 'Footer');

      const partials = await storage.getAllPartials();
      expect(Object.keys(partials)).toHaveLength(2);
      expect(partials.header).toBe('Header');
      expect(partials.footer).toBe('Footer');
    });

    it('should delete a partial', async () => {
      await storage.savePartial('header', 'Header');

      const deleted = await storage.deletePartial('header');
      expect(deleted).toBe(true);

      const retrieved = await storage.getPartial('header');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent partial', async () => {
      const retrieved = await storage.getPartial('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('audit log operations', () => {
    it('should save audit log entry', async () => {
      const entry = {
        id: 'audit-1',
        timestamp: new Date(),
        actor: 'user@example.com',
        action: 'create' as const,
        resourceType: 'prompt' as const,
        resourceId: 'prompt-1',
      };

      await storage.saveAuditLog(entry);

      const logs = await storage.queryAuditLog({});
      expect(logs).toHaveLength(1);
    });

    it('should query audit log by actor', async () => {
      await storage.saveAuditLog({
        id: 'audit-1',
        timestamp: new Date(),
        actor: 'alice@example.com',
        action: 'create',
        resourceType: 'prompt',
        resourceId: 'prompt-1',
      });

      await storage.saveAuditLog({
        id: 'audit-2',
        timestamp: new Date(),
        actor: 'bob@example.com',
        action: 'update',
        resourceType: 'prompt',
        resourceId: 'prompt-2',
      });

      const logs = await storage.queryAuditLog({ actor: 'alice@example.com' });
      expect(logs).toHaveLength(1);
      expect(logs[0].actor).toBe('alice@example.com');
    });

    it('should query audit log by action', async () => {
      await storage.saveAuditLog({
        id: 'audit-1',
        timestamp: new Date(),
        actor: 'user',
        action: 'create',
        resourceType: 'prompt',
        resourceId: 'prompt-1',
      });

      const logs = await storage.queryAuditLog({ action: 'create' });
      expect(logs).toHaveLength(1);
    });

    it('should query audit log by resource', async () => {
      await storage.saveAuditLog({
        id: 'audit-1',
        timestamp: new Date(),
        actor: 'user',
        action: 'update',
        resourceType: 'prompt',
        resourceId: 'prompt-1',
      });

      const logs = await storage.queryAuditLog({ resourceId: 'prompt-1' });
      expect(logs).toHaveLength(1);
    });

    it('should query audit log by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      await storage.saveAuditLog({
        id: 'audit-1',
        timestamp: now,
        actor: 'user',
        action: 'create',
        resourceType: 'prompt',
        resourceId: 'prompt-1',
      });

      const logs = await storage.queryAuditLog({
        startDate: yesterday,
        endDate: tomorrow,
      });

      expect(logs).toHaveLength(1);
    });

    it('should return logs in descending order by timestamp', async () => {
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);

      await storage.saveAuditLog({
        id: 'audit-1',
        timestamp: earlier,
        actor: 'user',
        action: 'create',
        resourceType: 'prompt',
        resourceId: 'prompt-1',
      });

      await storage.saveAuditLog({
        id: 'audit-2',
        timestamp: now,
        actor: 'user',
        action: 'update',
        resourceType: 'prompt',
        resourceId: 'prompt-1',
      });

      const logs = await storage.queryAuditLog({});
      expect(logs[0].id).toBe('audit-2');
      expect(logs[1].id).toBe('audit-1');
    });

    it('should apply pagination to audit log', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.saveAuditLog({
          id: `audit-${i}`,
          timestamp: new Date(),
          actor: 'user',
          action: 'create',
          resourceType: 'prompt',
          resourceId: `prompt-${i}`,
        });
      }

      const logs = await storage.queryAuditLog({ limit: 2, offset: 1 });
      expect(logs).toHaveLength(2);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptRegistry } from '../core/PromptRegistry.js';
import { BufferStorage } from '../storage/adapters/BufferStorage.js';
import { Prompt } from '../core/Prompt.js';
import type { CreatePromptInput } from '../types/index.js';

describe('PromptRegistry', () => {
  let registry: PromptRegistry;
  let storage: BufferStorage;

  beforeEach(async () => {
    storage = new BufferStorage();
    registry = new PromptRegistry({
      storage,
      defaultEnvironment: 'development',
    });
    await registry.initialize();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const newRegistry = new PromptRegistry({ storage });

      await expect(newRegistry.initialize()).resolves.toBeUndefined();
    });

    it('should not reinitialize', async () => {
      await expect(registry.initialize()).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('should create a new prompt', async () => {
      const input: CreatePromptInput = {
        name: 'test-prompt',
        template: 'Hello {{name}}!',
      };

      const prompt = await registry.create(input);

      expect(prompt).toBeDefined();
      expect(prompt.name).toBe('test-prompt');
      expect(prompt.version).toBe('v1');
    });

    it('should throw if prompt already exists', async () => {
      const input: CreatePromptInput = {
        name: 'test-prompt',
        template: 'Test',
      };

      await registry.create(input);

      await expect(registry.create(input)).rejects.toThrow(
        "Prompt 'test-prompt' already exists",
      );
    });

    it('should create initial version', async () => {
      const input: CreatePromptInput = {
        name: 'test-prompt',
        template: 'Test',
      };

      const prompt = await registry.create(input);
      const history = await registry.history('test-prompt');

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe('v1');
    });

    it('should emit prompt:created event', async () => {
      const handler = vi.fn();
      registry.on('prompt:created', handler);

      await registry.create({
        name: 'test-prompt',
        template: 'Test',
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should set default status to draft', async () => {
      const prompt = await registry.create({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.status).toBe('draft');
    });

    it('should use provided status', async () => {
      const prompt = await registry.create({
        name: 'test',
        template: 'Test',
        status: 'active',
      });

      expect(prompt.status).toBe('active');
    });

    it('should use default environment', async () => {
      const prompt = await registry.create({
        name: 'test',
        template: 'Test',
      });

      expect(prompt.environment).toBe('development');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'test-prompt',
        template: 'Hello {{name}}!',
      });
    });

    it('should get a prompt by name', async () => {
      const prompt = await registry.get('test-prompt');

      expect(prompt).toBeDefined();
      expect(prompt?.name).toBe('test-prompt');
    });

    it('should return null for non-existent prompt', async () => {
      const prompt = await registry.get('non-existent');

      expect(prompt).toBeNull();
    });

    it('should get from specific environment', async () => {
      await registry.create({
        name: 'prod-prompt',
        template: 'Production',
        environment: 'production',
      });

      const prompt = await registry.get('prod-prompt', {
        environment: 'production',
      });

      expect(prompt?.environment).toBe('production');
    });

    it('should cache retrieved prompts', async () => {
      await registry.get('test-prompt');
      const cached = await registry.get('test-prompt');

      expect(cached).toBeDefined();
    });

    it('should get specific version', async () => {
      await registry.update('test-prompt', { template: 'Updated' });

      const v1 = await registry.get('test-prompt', { version: 'v1' });
      const v2 = await registry.get('test-prompt', { version: 'v2' });

      expect(v1?.template).not.toBe(v2?.template);
    });
  });

  describe('getById', () => {
    it('should get prompt by ID', async () => {
      const created = await registry.create({
        name: 'test',
        template: 'Test',
      });

      const retrieved = await registry.getById(created.id);

      expect(retrieved?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const prompt = await registry.getById('non-existent');

      expect(prompt).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'test-prompt',
        template: 'Original template',
      });
    });

    it('should update a prompt', async () => {
      const updated = await registry.update('test-prompt', {
        template: 'Updated template',
      });

      expect(updated.template).toContain('Updated template');
    });

    it('should throw for non-existent prompt', async () => {
      await expect(
        registry.update('non-existent', { template: 'Test' }),
      ).rejects.toThrow('not found');
    });

    it('should increment version when template changes', async () => {
      await registry.update('test-prompt', { template: 'Updated' });

      const prompt = await registry.get('test-prompt');

      expect(prompt?.version).toBe('v2');
    });

    it('should not increment version for metadata changes', async () => {
      await registry.update('test-prompt', {
        description: 'New description',
      });

      const prompt = await registry.get('test-prompt');

      expect(prompt?.version).toBe('v1');
    });

    it('should create version entry on template change', async () => {
      await registry.update('test-prompt', { template: 'Updated' });

      const history = await registry.history('test-prompt');

      expect(history).toHaveLength(2);
    });

    it('should invalidate cache', async () => {
      await registry.get('test-prompt');
      await registry.update('test-prompt', { template: 'Updated' });

      const prompt = await registry.get('test-prompt');

      expect(prompt?.template).toContain('Updated');
    });

    it('should emit prompt:updated event', async () => {
      const handler = vi.fn();
      registry.on('prompt:updated', handler);

      await registry.update('test-prompt', { template: 'Updated' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'test-prompt',
        template: 'Test',
      });
    });

    it('should delete a prompt', async () => {
      const deleted = await registry.delete('test-prompt');

      expect(deleted).toBe(true);

      const prompt = await registry.get('test-prompt');
      expect(prompt).toBeNull();
    });

    it('should return false for non-existent prompt', async () => {
      const deleted = await registry.delete('non-existent');

      expect(deleted).toBe(false);
    });

    it('should emit prompt:deleted event', async () => {
      const handler = vi.fn();
      registry.on('prompt:deleted', handler);

      await registry.delete('test-prompt');

      expect(handler).toHaveBeenCalled();
    });

    it('should invalidate cache', async () => {
      await registry.get('test-prompt');
      await registry.delete('test-prompt');

      const prompt = await registry.get('test-prompt');

      expect(prompt).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'draft-prompt',
        template: 'Draft',
        status: 'draft',
        metadata: { tags: ['test'] },
      });

      await registry.create({
        name: 'active-prompt',
        template: 'Active',
        status: 'active',
      });
    });

    it('should query all prompts', async () => {
      const prompts = await registry.query();

      expect(prompts.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const prompts = await registry.query({ status: 'draft' });

      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('draft-prompt');
    });

    it('should filter by tags', async () => {
      const prompts = await registry.query({ tags: ['test'] });

      expect(prompts).toHaveLength(1);
    });

    it('should search prompts', async () => {
      const prompts = await registry.query({ search: 'active' });

      expect(prompts.length).toBeGreaterThan(0);
    });
  });

  describe('list', () => {
    it('should list all prompts', async () => {
      await registry.create({ name: 'prompt1', template: 'Test 1' });
      await registry.create({ name: 'prompt2', template: 'Test 2' });

      const prompts = await registry.list();

      expect(prompts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('render', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'greeting',
        template: 'Hello {{name}}!',
      });
    });

    it('should render a prompt', async () => {
      const result = await registry.render('greeting', { name: 'World' });

      expect(result.content.trim()).toBe('Hello World!');
    });

    it('should throw for non-existent prompt', async () => {
      await expect(registry.render('non-existent', {})).rejects.toThrow(
        'not found',
      );
    });

    it('should use partials', async () => {
      await registry.registerPartial({
        name: 'header',
        template: '=== HEADER ===',
      });

      await registry.create({
        name: 'with-partial',
        template: '{{> header}} Content',
      });

      const result = await registry.render('with-partial', {});

      expect(result.content).toContain('=== HEADER ===');
    });
  });

  describe('history', () => {
    it('should get version history', async () => {
      await registry.create({
        name: 'test',
        template: 'v1',
      });

      await registry.update('test', { template: 'v2' });
      await registry.update('test', { template: 'v3' });

      const history = await registry.history('test');

      expect(history).toHaveLength(3);
      expect(history[0].version).toBe('v3');
    });

    it('should limit history', async () => {
      await registry.create({ name: 'test', template: 'v1' });
      await registry.update('test', { template: 'v2' });
      await registry.update('test', { template: 'v3' });

      const history = await registry.history('test', { limit: 2 });

      expect(history).toHaveLength(2);
    });

    it('should throw for non-existent prompt', async () => {
      await expect(registry.history('non-existent')).rejects.toThrow();
    });
  });

  describe('diff', () => {
    it('should show diff between versions', async () => {
      await registry.create({
        name: 'test',
        template: 'Line 1\nLine 2\nLine 3',
      });

      await registry.update('test', {
        template: 'Line 1\nLine 2 modified\nLine 3',
      });

      const diff = await registry.diff('test', { from: 'v1', to: 'v2' });

      expect(diff.additions).toBeGreaterThan(0);
      expect(diff.deletions).toBeGreaterThan(0);
    });

    it('should throw for non-existent versions', async () => {
      await registry.create({ name: 'test', template: 'Test' });

      await expect(
        registry.diff('test', { from: 'v1', to: 'v999' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('branch', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'test',
        template: 'Main branch',
      });
    });

    it('should create a branch', async () => {
      const branch = await registry.branch('test', {
        name: 'feature-branch',
      });

      expect(branch).toBeDefined();
      expect(branch.name).toBe('feature-branch');
    });

    it('should emit branch:created event', async () => {
      const handler = vi.fn();
      registry.on('branch:created', handler);

      await registry.branch('test', { name: 'feature' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('merge', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'test',
        template: 'Main',
      });

      await registry.branch('test', {
        name: 'feature',
        from: 'v1',
      });
    });

    it('should merge a branch', async () => {
      // Create a version on the branch
      const prompt = await registry.get('test');
      if (prompt) {
        await storage.saveVersion({
          promptId: prompt.id,
          promptName: 'test',
          version: 'v2',
          hash: 'new-hash',
          branch: 'feature',
          createdAt: new Date(),
          environment: 'development',
          snapshot: {
            ...prompt.toData(),
            template: 'Feature content',
            version: 'v2',
          },
        });

        // Update branch head
        await storage.saveBranch({
          name: 'feature',
          promptId: prompt.id,
          baseVersion: 'v1',
          headVersion: 'v2',
          createdAt: new Date(),
          isActive: true,
        });
      }

      const result = await registry.merge('test', {
        from: 'feature',
      });

      expect(result.success).toBe(true);
      expect(result.newVersion).toBeDefined();
    });

    it('should emit branch:merged event', async () => {
      const handler = vi.fn();
      registry.on('branch:merged', handler);

      const prompt = await registry.get('test');
      if (prompt) {
        await storage.saveVersion({
          promptId: prompt.id,
          promptName: 'test',
          version: 'v2',
          hash: 'hash',
          createdAt: new Date(),
          environment: 'development',
          snapshot: prompt.toData(),
        });

        await storage.saveBranch({
          name: 'feature',
          promptId: prompt.id,
          baseVersion: 'v1',
          headVersion: 'v2',
          createdAt: new Date(),
          isActive: true,
        });

        await registry.merge('test', { from: 'feature' });

        expect(handler).toHaveBeenCalled();
      }
    });
  });

  describe('rollback', () => {
    beforeEach(async () => {
      await registry.create({ name: 'test', template: 'v1' });
      await registry.update('test', { template: 'v2' });
      await registry.update('test', { template: 'v3' });
    });

    it('should rollback to previous version', async () => {
      const result = await registry.rollback('test', { to: 'v1' });

      expect(result.success).toBe(true);
      expect(result.toVersion).toBe('v1');
    });

    it('should create new version on rollback', async () => {
      await registry.rollback('test', { to: 'v1' });

      const prompt = await registry.get('test');

      expect(prompt?.version).toBe('v4'); // New version after rollback
    });

    it('should emit prompt:rolledback event', async () => {
      const handler = vi.fn();
      registry.on('prompt:rolledback', handler);

      await registry.rollback('test', { to: 'v1' });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('promote', () => {
    beforeEach(async () => {
      await registry.create({
        name: 'test',
        template: 'Test',
        environment: 'development',
      });
    });

    it('should promote to another environment', async () => {
      const result = await registry.promote('test', {
        from: 'development',
        to: 'staging',
      });

      expect(result.success).toBe(true);
    });

    it('should create prompt in target environment', async () => {
      await registry.promote('test', {
        from: 'development',
        to: 'staging',
      });

      const promoted = await registry.get('test', { environment: 'staging' });

      expect(promoted).toBeDefined();
      expect(promoted?.environment).toBe('staging');
    });

    it('should require approver for protected environments', async () => {
      await expect(
        registry.promote('test', {
          from: 'development',
          to: 'production',
        }),
      ).rejects.toThrow('requires an approver');
    });

    it('should allow promotion with approver', async () => {
      const result = await registry.promote('test', {
        from: 'development',
        to: 'production',
        approver: 'admin@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should emit prompt:promoted event', async () => {
      const handler = vi.fn();
      registry.on('prompt:promoted', handler);

      await registry.promote('test', {
        from: 'development',
        to: 'staging',
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('getEnvironments', () => {
    it('should return configured environments', () => {
      const environments = registry.getEnvironments();

      expect(environments.length).toBeGreaterThan(0);
      expect(environments.some((e) => e.name === 'development')).toBe(true);
      expect(environments.some((e) => e.name === 'production')).toBe(true);
    });

    it('should return environments in order', () => {
      const environments = registry.getEnvironments();

      expect(environments[0].order).toBeLessThanOrEqual(
        environments[environments.length - 1].order || Infinity,
      );
    });
  });

  describe('partials', () => {
    it('should register a partial', async () => {
      await registry.registerPartial({
        name: 'header',
        template: 'Header content',
      });

      const partial = registry.getPartial('header');

      expect(partial).toBeDefined();
      expect(partial?.template).toContain('Header content');
    });

    it('should get all partials', async () => {
      await registry.registerPartial({
        name: 'header',
        template: 'Header',
      });
      await registry.registerPartial({
        name: 'footer',
        template: 'Footer',
      });

      const partials = registry.getPartials();

      expect(partials).toHaveLength(2);
    });

    it('should delete a partial', async () => {
      await registry.registerPartial({
        name: 'header',
        template: 'Header',
      });

      const deleted = await registry.deletePartial('header');

      expect(deleted).toBe(true);
      expect(registry.getPartial('header')).toBeUndefined();
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await registry.create({ name: 'p1', template: 'Test 1' });
      await registry.create({
        name: 'p2',
        template: 'Test 2',
        status: 'active',
      });
      await registry.create({
        name: 'p3',
        template: 'Test 3',
        environment: 'production',
      });
    });

    it('should return registry statistics', async () => {
      const stats = await registry.getStats();

      expect(stats.totalPrompts).toBeGreaterThanOrEqual(3);
      expect(stats.promptsByEnvironment).toBeDefined();
      expect(stats.promptsByStatus).toBeDefined();
    });

    it('should count prompts by environment', async () => {
      const stats = await registry.getStats();

      expect(stats.promptsByEnvironment.development).toBeGreaterThan(0);
    });

    it('should count prompts by status', async () => {
      const stats = await registry.getStats();

      expect(stats.promptsByStatus.draft).toBeGreaterThan(0);
    });
  });

  describe('close', () => {
    it('should close registry and storage', async () => {
      await registry.close();

      // Registry should be closed
    });
  });
});

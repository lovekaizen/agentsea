import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GuardrailsEngine } from '../core/guardrails-engine.js';
import { GuardRegistry } from '../core/guard-registry.js';
import type {
  Guard,
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
} from '../types/index.js';

// Mock guard implementation
class MockGuard implements Guard {
  name: string;
  config: GuardConfig;
  supportedTypes: ContentType[];
  private shouldPass: boolean;

  constructor(
    name: string,
    config: Partial<GuardConfig> = {},
    shouldPass = true,
  ) {
    this.name = name;
    this.shouldPass = shouldPass;
    this.config = {
      name,
      enabled: true,
      onFailure: 'block',
      ...config,
    };
    this.supportedTypes = ['input', 'output'];
  }

  async check(context: GuardContext): Promise<GuardResult> {
    return {
      passed: this.shouldPass,
      guardName: this.name,
      action: this.shouldPass ? 'allow' : this.config.onFailure,
      message: this.shouldPass ? 'Check passed' : 'Check failed',
      latencyMs: 10,
      timestamp: new Date(),
    };
  }
}

describe('GuardrailsEngine', () => {
  beforeEach(() => {
    GuardRegistry.clear();
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      const engine = new GuardrailsEngine();
      const config = engine.getConfig();

      expect(config.failureMode).toBe('fail-fast');
      expect(config.defaultAction).toBe('block');
      expect(config.executionMode).toBe('sequential');
    });

    it('should create engine with custom config', () => {
      const engine = new GuardrailsEngine({
        failureMode: 'fail-safe',
        defaultAction: 'warn',
        executionMode: 'parallel',
      });
      const config = engine.getConfig();

      expect(config.failureMode).toBe('fail-safe');
      expect(config.defaultAction).toBe('warn');
      expect(config.executionMode).toBe('parallel');
    });

    it('should initialize guards from config', () => {
      GuardRegistry.register({
        metadata: {
          name: 'test-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: (config) => new MockGuard('test-guard', config),
      });

      const engine = new GuardrailsEngine({
        guards: [{ name: 'test-guard', enabled: true, onFailure: 'block' }],
      });

      const guard = engine.getGuard('test-guard');
      expect(guard).toBeDefined();
      expect(guard?.name).toBe('test-guard');
    });
  });

  describe('checkInput', () => {
    it('should check input content', async () => {
      const guard = new MockGuard('input-guard', { enabled: true }, true);
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const result = await engine.checkInput('test input');

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.action).toBe('allow');
    });

    it('should return pass result when no guards configured', async () => {
      const engine = new GuardrailsEngine();
      const result = await engine.checkInput('test input');

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(0);
      expect(result.message).toContain('No guards configured');
    });

    it('should fail when guard fails', async () => {
      const guard = new MockGuard('failing-guard', { enabled: true }, false);
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const result = await engine.checkInput('test input');

      expect(result.passed).toBe(false);
      expect(result.action).toBe('block');
    });

    it('should include total latency', async () => {
      const guard = new MockGuard('test-guard');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const result = await engine.checkInput('test input');

      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.totalLatencyMs).toBe('number');
    });

    it('should pass custom context', async () => {
      const guard = new MockGuard('test-guard');
      const checkSpy = vi.spyOn(guard, 'check');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      await engine.checkInput('test input', {
        sessionId: 'session-123',
        userId: 'user-456',
      });

      expect(checkSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'test input',
          type: 'input',
          sessionId: 'session-123',
          userId: 'user-456',
        }),
      );
    });
  });

  describe('checkOutput', () => {
    it('should check output content', async () => {
      const guard = new MockGuard('output-guard', { enabled: true }, true);
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const result = await engine.checkOutput('test output');

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('should use output type in context', async () => {
      const guard = new MockGuard('test-guard');
      const checkSpy = vi.spyOn(guard, 'check');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      await engine.checkOutput('test output');

      expect(checkSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'output',
        }),
      );
    });
  });

  describe('checkBoth', () => {
    it('should check both input and output', async () => {
      const guard = new MockGuard('both-guard', { enabled: true }, true);
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const result = await engine.checkBoth('input', 'output');

      expect(result.input.passed).toBe(true);
      expect(result.output.passed).toBe(true);
      expect(result.passed).toBe(true);
    });

    it('should fail if either input or output fails', async () => {
      const guard = new MockGuard('both-guard', { enabled: true }, false);
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const result = await engine.checkBoth('input', 'output');

      expect(result.passed).toBe(false);
    });

    it('should run checks in parallel', async () => {
      const guard = new MockGuard('test-guard');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      const start = Date.now();
      await engine.checkBoth('input', 'output');
      const duration = Date.now() - start;

      // Should be faster than sequential (< 30ms for both)
      expect(duration).toBeLessThan(30);
    });
  });

  describe('registerGuard', () => {
    it('should register a guard instance', () => {
      const guard = new MockGuard('custom-guard');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      expect(engine.getGuard('custom-guard')).toBe(guard);
    });

    it('should allow multiple guards', () => {
      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('guard-1'));
      engine.registerGuard(new MockGuard('guard-2'));

      expect(engine.getGuardNames()).toContain('guard-1');
      expect(engine.getGuardNames()).toContain('guard-2');
    });
  });

  describe('removeGuard', () => {
    it('should remove a registered guard', () => {
      const guard = new MockGuard('remove-guard');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      expect(engine.getGuard('remove-guard')).toBeDefined();

      engine.removeGuard('remove-guard');

      expect(engine.getGuard('remove-guard')).toBeUndefined();
    });
  });

  describe('getGuard', () => {
    it('should return registered guard', () => {
      const guard = new MockGuard('test-guard');
      const engine = new GuardrailsEngine();
      engine.registerGuard(guard);

      expect(engine.getGuard('test-guard')).toBe(guard);
    });

    it('should return undefined for non-existent guard', () => {
      const engine = new GuardrailsEngine();
      expect(engine.getGuard('non-existent')).toBeUndefined();
    });

    it('should fallback to registry', () => {
      GuardRegistry.register({
        metadata: {
          name: 'registry-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard('registry-guard'),
      });

      const engine = new GuardrailsEngine();
      const guard = engine.getGuard('registry-guard');

      expect(guard).toBeDefined();
      expect(guard?.name).toBe('registry-guard');
    });
  });

  describe('createPipeline', () => {
    it('should create a named pipeline', () => {
      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('guard-1'));
      engine.registerGuard(new MockGuard('guard-2'));

      const pipeline = engine.createPipeline('test-pipeline', [
        'guard-1',
        'guard-2',
      ]);

      expect(pipeline).toBeDefined();
      expect(pipeline.name).toBe('test-pipeline');
    });

    it('should store pipeline for later retrieval', () => {
      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('guard-1'));

      engine.createPipeline('my-pipeline', ['guard-1']);

      const retrieved = engine.getPipeline('my-pipeline');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('my-pipeline');
    });

    it('should use engine config as defaults', () => {
      const engine = new GuardrailsEngine({
        executionMode: 'parallel',
        failureMode: 'fail-safe',
      });
      engine.registerGuard(new MockGuard('guard-1'));

      const pipeline = engine.createPipeline('test-pipeline', ['guard-1']);

      expect(pipeline.config.executionMode).toBe('parallel');
      expect(pipeline.config.failureMode).toBe('fail-safe');
    });
  });

  describe('executePipeline', () => {
    it('should execute a named pipeline', async () => {
      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('guard-1', {}, true));

      engine.createPipeline('test-pipeline', ['guard-1']);

      const result = await engine.executePipeline(
        'test-pipeline',
        'test input',
        'input',
      );

      expect(result.passed).toBe(true);
    });

    it('should throw if pipeline not found', async () => {
      const engine = new GuardrailsEngine();

      await expect(
        engine.executePipeline('non-existent', 'test', 'input'),
      ).rejects.toThrow("Pipeline 'non-existent' not found");
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const engine = new GuardrailsEngine({ failureMode: 'fail-fast' });

      engine.updateConfig({ failureMode: 'fail-safe' });

      expect(engine.getConfig().failureMode).toBe('fail-safe');
    });

    it('should reinitialize guards when guards config changes', () => {
      GuardRegistry.register({
        metadata: {
          name: 'new-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard('new-guard'),
      });

      const engine = new GuardrailsEngine();

      engine.updateConfig({
        guards: [{ name: 'new-guard', enabled: true, onFailure: 'block' }],
      });

      expect(engine.getGuard('new-guard')).toBeDefined();
    });
  });

  describe('caching', () => {
    it('should cache results when enabled', async () => {
      const guard = new MockGuard('cache-guard');
      const checkSpy = vi.spyOn(guard, 'check');

      const engine = new GuardrailsEngine({
        cache: {
          enabled: true,
          maxSize: 100,
          ttlMs: 60000,
        },
      });
      engine.registerGuard(guard);

      // First call
      await engine.checkInput('test input');
      expect(checkSpy).toHaveBeenCalledTimes(1);

      // Second call with same input should use cache
      await engine.checkInput('test input');
      expect(checkSpy).toHaveBeenCalledTimes(1);
    });

    it('should not cache when disabled', async () => {
      const guard = new MockGuard('no-cache-guard');
      const checkSpy = vi.spyOn(guard, 'check');

      const engine = new GuardrailsEngine({
        cache: {
          enabled: false,
        },
      });
      engine.registerGuard(guard);

      await engine.checkInput('test input');
      await engine.checkInput('test input');

      expect(checkSpy).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', async () => {
      const guard = new MockGuard('clear-cache-guard');
      const checkSpy = vi.spyOn(guard, 'check');

      const engine = new GuardrailsEngine({
        cache: {
          enabled: true,
          maxSize: 100,
        },
      });
      engine.registerGuard(guard);

      await engine.checkInput('test input');
      expect(checkSpy).toHaveBeenCalledTimes(1);

      engine.clearCache();

      await engine.checkInput('test input');
      expect(checkSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('execution modes', () => {
    it('should execute guards sequentially by default', async () => {
      const engine = new GuardrailsEngine({
        executionMode: 'sequential',
      });
      engine.registerGuard(new MockGuard('seq-1'));
      engine.registerGuard(new MockGuard('seq-2'));

      const result = await engine.checkInput('test');

      expect(result.results).toHaveLength(2);
    });

    it('should execute guards in parallel when configured', async () => {
      const engine = new GuardrailsEngine({
        executionMode: 'parallel',
      });
      engine.registerGuard(new MockGuard('par-1'));
      engine.registerGuard(new MockGuard('par-2'));

      const result = await engine.checkInput('test');

      expect(result.results).toHaveLength(2);
    });
  });

  describe('failure modes', () => {
    it('should fail fast by default', async () => {
      const engine = new GuardrailsEngine({
        failureMode: 'fail-fast',
      });
      engine.registerGuard(new MockGuard('fail-1', {}, false));
      engine.registerGuard(new MockGuard('fail-2', {}, true));

      const result = await engine.checkInput('test');

      expect(result.passed).toBe(false);
      // Should only execute first failing guard in sequential mode
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should continue on failure in fail-safe mode', async () => {
      const engine = new GuardrailsEngine({
        failureMode: 'fail-safe',
      });
      engine.registerGuard(new MockGuard('safe-1', {}, false));

      const result = await engine.checkInput('test');

      // Fail-safe mode should convert failures to passes
      expect(result.passed).toBe(true);
    });
  });

  describe('getGuardNames', () => {
    it('should return all guard names', () => {
      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('guard-1'));
      engine.registerGuard(new MockGuard('guard-2'));

      const names = engine.getGuardNames();

      expect(names).toContain('guard-1');
      expect(names).toContain('guard-2');
    });

    it('should include registry guards', () => {
      GuardRegistry.register({
        metadata: {
          name: 'registry-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard('registry-guard'),
      });

      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('instance-guard'));

      const names = engine.getGuardNames();

      expect(names).toContain('instance-guard');
      expect(names).toContain('registry-guard');
    });

    it('should not duplicate names', () => {
      GuardRegistry.register({
        metadata: {
          name: 'duplicate-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard('duplicate-guard'),
      });

      const engine = new GuardrailsEngine();
      engine.registerGuard(new MockGuard('duplicate-guard'));

      const names = engine.getGuardNames();

      expect(names.filter((n) => n === 'duplicate-guard')).toHaveLength(1);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GuardRegistry,
  RegisterGuard,
  defineGuard,
} from '../core/guard-registry.js';
import type {
  Guard,
  GuardConfig,
  GuardResult,
  GuardMetadata,
  ContentType,
} from '../types/index.js';

// Mock guard implementation
class MockGuard implements Guard {
  name: string;
  enabled: boolean;
  priority: number;

  constructor(config: Partial<GuardConfig>) {
    this.name = config.name || 'mock-guard';
    this.enabled = config.enabled ?? true;
    this.priority = config.priority ?? 50;
  }

  async check(): Promise<GuardResult> {
    return {
      passed: true,
      guardName: this.name,
      contentType: 'input',
      timestamp: new Date(),
    };
  }
}

describe('GuardRegistry', () => {
  beforeEach(() => {
    GuardRegistry.clear();
  });

  describe('register', () => {
    it('should register a guard with metadata and factory', () => {
      const metadata: GuardMetadata = {
        name: 'test-guard',
        description: 'Test guard',
        category: 'content',
        supportedTypes: ['input', 'output'],
        defaultConfig: { threshold: 0.5 },
      };

      GuardRegistry.register({
        metadata,
        factory: (config) => new MockGuard(config),
      });

      expect(GuardRegistry.has('test-guard')).toBe(true);
      expect(GuardRegistry.size).toBe(1);
    });

    it('should warn when overwriting existing guard', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const metadata: GuardMetadata = {
        name: 'test-guard',
        description: 'Test guard',
        category: 'content',
        supportedTypes: ['input'],
        defaultConfig: {},
      };

      GuardRegistry.register({ metadata, factory: () => new MockGuard({}) });
      GuardRegistry.register({ metadata, factory: () => new MockGuard({}) });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Guard 'test-guard' is already registered"),
      );

      warnSpy.mockRestore();
    });
  });

  describe('unregister', () => {
    it('should unregister a guard', () => {
      GuardRegistry.register({
        metadata: {
          name: 'test-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });

      expect(GuardRegistry.has('test-guard')).toBe(true);

      const result = GuardRegistry.unregister('test-guard');

      expect(result).toBe(true);
      expect(GuardRegistry.has('test-guard')).toBe(false);
    });

    it('should return false for non-existent guard', () => {
      const result = GuardRegistry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      GuardRegistry.register({
        metadata: {
          name: 'test-guard',
          description: 'Test guard',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: { threshold: 0.5 },
        },
        factory: (config) => new MockGuard(config),
      });
    });

    it('should return a guard instance', () => {
      const guard = GuardRegistry.get('test-guard');

      expect(guard).toBeDefined();
      expect(guard?.name).toBe('test-guard');
    });

    it('should return undefined for non-existent guard', () => {
      const guard = GuardRegistry.get('non-existent');
      expect(guard).toBeUndefined();
    });

    it('should return singleton instance by default', () => {
      const guard1 = GuardRegistry.get('test-guard');
      const guard2 = GuardRegistry.get('test-guard');

      expect(guard1).toBe(guard2);
    });

    it('should create new instance with custom config', () => {
      const guard1 = GuardRegistry.get('test-guard');
      const guard2 = GuardRegistry.get('test-guard', { priority: 100 });

      expect(guard1).not.toBe(guard2);
      expect(guard2?.priority).toBe(100);
    });

    it('should merge default config with custom config', () => {
      const guard = GuardRegistry.get('test-guard', { priority: 75 });

      expect(guard?.priority).toBe(75);
      expect(guard?.name).toBe('test-guard');
    });
  });

  describe('getOrThrow', () => {
    it('should throw for non-existent guard', () => {
      expect(() => GuardRegistry.getOrThrow('non-existent')).toThrow(
        "Guard 'non-existent' not found in registry",
      );
    });

    it('should return guard if exists', () => {
      GuardRegistry.register({
        metadata: {
          name: 'test-guard',
          description: 'Test',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });

      const guard = GuardRegistry.getOrThrow('test-guard');
      expect(guard).toBeDefined();
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered guard', () => {
      const metadata: GuardMetadata = {
        name: 'test-guard',
        description: 'Test guard description',
        category: 'security',
        supportedTypes: ['input', 'output'],
        defaultConfig: { strict: true },
      };

      GuardRegistry.register({
        metadata,
        factory: () => new MockGuard({}),
      });

      const result = GuardRegistry.getMetadata('test-guard');

      expect(result).toEqual(metadata);
    });

    it('should return undefined for non-existent guard', () => {
      const result = GuardRegistry.getMetadata('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getNames', () => {
    it('should return all registered guard names', () => {
      GuardRegistry.register({
        metadata: {
          name: 'guard-a',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
      GuardRegistry.register({
        metadata: {
          name: 'guard-b',
          description: '',
          category: 'security',
          supportedTypes: ['output'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });

      const names = GuardRegistry.getNames();

      expect(names).toHaveLength(2);
      expect(names).toContain('guard-a');
      expect(names).toContain('guard-b');
    });
  });

  describe('getAllMetadata', () => {
    it('should return all metadata', () => {
      GuardRegistry.register({
        metadata: {
          name: 'guard-a',
          description: 'A',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
      GuardRegistry.register({
        metadata: {
          name: 'guard-b',
          description: 'B',
          category: 'security',
          supportedTypes: ['output'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });

      const allMetadata = GuardRegistry.getAllMetadata();

      expect(allMetadata).toHaveLength(2);
      expect(allMetadata.map((m) => m.name)).toEqual(['guard-a', 'guard-b']);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      GuardRegistry.register({
        metadata: {
          name: 'content-1',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
      GuardRegistry.register({
        metadata: {
          name: 'content-2',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
      GuardRegistry.register({
        metadata: {
          name: 'security-1',
          description: '',
          category: 'security',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
    });

    it('should return guards by category', () => {
      const contentGuards = GuardRegistry.getByCategory('content');

      expect(contentGuards).toHaveLength(2);
      expect(contentGuards.map((m) => m.name)).toEqual([
        'content-1',
        'content-2',
      ]);
    });

    it('should return empty array for non-existent category', () => {
      const guards = GuardRegistry.getByCategory('validation');
      expect(guards).toHaveLength(0);
    });
  });

  describe('getBySupportedType', () => {
    beforeEach(() => {
      GuardRegistry.register({
        metadata: {
          name: 'input-only',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
      GuardRegistry.register({
        metadata: {
          name: 'output-only',
          description: '',
          category: 'content',
          supportedTypes: ['output'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
      GuardRegistry.register({
        metadata: {
          name: 'both',
          description: '',
          category: 'content',
          supportedTypes: ['both'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });
    });

    it('should return guards that support input type', () => {
      const guards = GuardRegistry.getBySupportedType('input');

      expect(guards).toHaveLength(2);
      expect(guards.map((m) => m.name)).toContain('input-only');
      expect(guards.map((m) => m.name)).toContain('both');
    });

    it('should return guards that support output type', () => {
      const guards = GuardRegistry.getBySupportedType('output');

      expect(guards).toHaveLength(2);
      expect(guards.map((m) => m.name)).toContain('output-only');
      expect(guards.map((m) => m.name)).toContain('both');
    });
  });

  describe('createGuards', () => {
    beforeEach(() => {
      GuardRegistry.register({
        metadata: {
          name: 'guard-a',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: (config) => new MockGuard({ ...config, name: 'guard-a' }),
      });
      GuardRegistry.register({
        metadata: {
          name: 'guard-b',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: (config) => new MockGuard({ ...config, name: 'guard-b' }),
      });
    });

    it('should create multiple guard instances', () => {
      const guards = GuardRegistry.createGuards(['guard-a', 'guard-b']);

      expect(guards).toHaveLength(2);
      expect(guards[0].name).toBe('guard-a');
      expect(guards[1].name).toBe('guard-b');
    });

    it('should skip non-existent guards', () => {
      const guards = GuardRegistry.createGuards([
        'guard-a',
        'non-existent',
        'guard-b',
      ]);

      expect(guards).toHaveLength(2);
    });

    it('should apply individual configs', () => {
      const guards = GuardRegistry.createGuards(['guard-a', 'guard-b'], {
        'guard-a': { priority: 100 },
        'guard-b': { priority: 50 },
      });

      expect(guards[0].priority).toBe(100);
      expect(guards[1].priority).toBe(50);
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      GuardRegistry.register({
        metadata: {
          name: 'test',
          description: '',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: () => new MockGuard({}),
      });

      expect(GuardRegistry.size).toBe(1);

      GuardRegistry.clear();

      expect(GuardRegistry.size).toBe(0);
      expect(GuardRegistry.has('test')).toBe(false);
    });
  });

  describe('defineGuard helper', () => {
    it('should register and return factory', () => {
      const factory = defineGuard({
        metadata: {
          name: 'defined-guard',
          description: 'Defined guard',
          category: 'content',
          supportedTypes: ['input'],
          defaultConfig: {},
        },
        factory: (config) => new MockGuard(config),
      });

      expect(GuardRegistry.has('defined-guard')).toBe(true);
      expect(typeof factory).toBe('function');

      const guard = factory({});
      expect(guard).toBeInstanceOf(MockGuard);
    });
  });
});

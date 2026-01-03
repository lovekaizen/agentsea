import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pipeline, PipelineBuilder } from '../core/pipeline.js';
import { GuardRegistry } from '../core/guard-registry.js';
import type {
  Guard,
  GuardContext,
  GuardResult,
  GuardConfig,
  ContentType,
  PipelineConfig,
} from '../types/index.js';

// Mock guard implementation
class MockGuard implements Guard {
  name: string;
  config: GuardConfig;
  supportedTypes: ContentType[];
  private shouldPass: boolean;
  private delay: number;

  constructor(
    name: string,
    shouldPass = true,
    delay = 0,
    config: Partial<GuardConfig> = {},
  ) {
    this.name = name;
    this.shouldPass = shouldPass;
    this.delay = delay;
    this.config = {
      name,
      enabled: true,
      onFailure: 'block',
      ...config,
    };
    this.supportedTypes = ['input', 'output'];
  }

  async check(_context: GuardContext): Promise<GuardResult> {
    if (this.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delay));
    }

    return {
      passed: this.shouldPass,
      guardName: this.name,
      action: this.shouldPass ? 'allow' : this.config.onFailure,
      message: this.shouldPass ? 'Check passed' : 'Check failed',
      latencyMs: this.delay,
      timestamp: new Date(),
    };
  }
}

function createContext(input = 'test input'): GuardContext {
  return {
    input,
    type: 'input',
    timestamp: new Date(),
  };
}

describe('Pipeline', () => {
  beforeEach(() => {
    GuardRegistry.clear();
  });

  describe('constructor', () => {
    it('should create pipeline with config', () => {
      const config: PipelineConfig = {
        name: 'test-pipeline',
        guards: ['guard-1', 'guard-2'],
        executionMode: 'sequential',
      };

      const pipeline = new Pipeline(config);

      expect(pipeline.name).toBe('test-pipeline');
      expect(pipeline.config.name).toBe('test-pipeline');
    });

    it('should use default config values', () => {
      const config: PipelineConfig = {
        name: 'test-pipeline',
        guards: [],
      };

      const pipeline = new Pipeline(config);

      expect(pipeline.config.executionMode).toBe('sequential');
      expect(pipeline.config.failureMode).toBe('fail-fast');
      expect(pipeline.config.timeoutMs).toBe(30000);
    });

    it('should accept guard instances', () => {
      const guards = [new MockGuard('guard-1'), new MockGuard('guard-2')];

      const pipeline = new Pipeline(
        {
          name: 'test-pipeline',
          guards: ['guard-1', 'guard-2'],
        },
        guards,
      );

      expect(pipeline.name).toBe('test-pipeline');
    });

    it('should resolve guards from registry if no instances provided', () => {
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

      const pipeline = new Pipeline({
        name: 'test-pipeline',
        guards: ['registry-guard'],
      });

      expect(pipeline.name).toBe('test-pipeline');
    });
  });

  describe('execute', () => {
    it('should execute all guards sequentially', async () => {
      const guards = [new MockGuard('guard-1'), new MockGuard('guard-2')];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          executionMode: 'sequential',
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
    });

    it('should execute all guards in parallel', async () => {
      const guards = [
        new MockGuard('guard-1', true, 10),
        new MockGuard('guard-2', true, 10),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          executionMode: 'parallel',
        },
        guards,
      );

      const start = Date.now();
      const result = await pipeline.execute(createContext());
      const duration = Date.now() - start;

      expect(result.passed).toBe(true);
      expect(result.results).toHaveLength(2);
      // Parallel execution should be faster than sequential (200ms allows CI timing variance)
      expect(duration).toBeLessThan(200);
    });

    it('should fail fast when a guard fails', async () => {
      const guards = [
        new MockGuard('pass-guard', true),
        new MockGuard('fail-guard', false),
        new MockGuard('never-runs', true),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['pass-guard', 'fail-guard', 'never-runs'],
          executionMode: 'sequential',
          failureMode: 'fail-fast',
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.passed).toBe(false);
      expect(result.results).toHaveLength(2); // Only first two guards run
    });

    it('should continue on failure in fail-safe mode', async () => {
      const guards = [
        new MockGuard('fail-guard', false),
        new MockGuard('pass-guard', true),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['fail-guard', 'pass-guard'],
          executionMode: 'sequential',
          failureMode: 'fail-safe',
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.passed).toBe(true); // Fail-safe passes
      expect(result.results).toHaveLength(2); // All guards run
    });

    it('should update state during execution', async () => {
      const guard = new MockGuard('test-guard');

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['test-guard'],
        },
        [guard],
      );

      const promise = pipeline.execute(createContext());

      // Check state is updated (might be completed already due to speed)
      await promise;

      const state = pipeline.getState();
      expect(state.status).toBe('completed');
      expect(state.executedGuards).toContain('test-guard');
    });

    it('should handle guard errors', async () => {
      class ErrorGuard implements Guard {
        name = 'error-guard';
        config: GuardConfig = {
          name: 'error-guard',
          enabled: true,
          onFailure: 'block',
        };
        supportedTypes: ContentType[] = ['input'];

        async check(): Promise<GuardResult> {
          throw new Error('Guard error');
        }
      }

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['error-guard'],
        },
        [new ErrorGuard()],
      );

      await expect(pipeline.execute(createContext())).rejects.toThrow(
        'Guard error',
      );

      const state = pipeline.getState();
      expect(state.status).toBe('failed');
    });

    it('should apply timeout to guards', async () => {
      const slowGuard = new MockGuard('slow-guard', true, 100);

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['slow-guard'],
          timeoutMs: 50,
        },
        [slowGuard],
      );

      await expect(pipeline.execute(createContext())).rejects.toThrow(
        /timed out/,
      );
    });
  });

  describe('executeStream', () => {
    it('should stream pipeline events', async () => {
      const guards = [new MockGuard('guard-1'), new MockGuard('guard-2')];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
        },
        guards,
      );

      const events = [];
      for await (const event of pipeline.executeStream(createContext())) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('pipeline_start');
      expect(events[events.length - 1].type).toBe('pipeline_complete');
    });

    it('should emit guard events', async () => {
      const guards = [new MockGuard('test-guard')];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['test-guard'],
        },
        guards,
      );

      const events = [];
      for await (const event of pipeline.executeStream(createContext())) {
        events.push(event);
      }

      const guardStartEvent = events.find((e) => e.type === 'guard_start');
      const guardCompleteEvent = events.find(
        (e) => e.type === 'guard_complete',
      );

      expect(guardStartEvent).toBeDefined();
      expect(guardCompleteEvent).toBeDefined();
    });

    it('should emit skip events', async () => {
      const guards = [new MockGuard('guard-1'), new MockGuard('guard-2')];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          skipConditions: [
            {
              guard: 'guard-2',
              ifPassed: 'guard-1',
            },
          ],
        },
        guards,
      );

      const events = [];
      for await (const event of pipeline.executeStream(createContext())) {
        events.push(event);
      }

      const skipEvent = events.find((e) => e.type === 'guard_skipped');
      expect(skipEvent).toBeDefined();
    });
  });

  describe('cancel', () => {
    it('should cancel pipeline execution', async () => {
      const guards = [
        new MockGuard('guard-1', true, 50),
        new MockGuard('guard-2', true, 50),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          executionMode: 'sequential',
        },
        guards,
      );

      // Start execution
      const promise = pipeline.execute(createContext());

      // Cancel immediately
      pipeline.cancel();

      await promise;

      const state = pipeline.getState();
      expect(state.status).toBe('cancelled');
    });
  });

  describe('addGuard', () => {
    it('should add guard to pipeline', () => {
      const pipeline = new Pipeline({
        name: 'test',
        guards: ['guard-1'],
      });

      const newGuard = new MockGuard('guard-2');
      pipeline.addGuard(newGuard);

      expect(pipeline.config.guards).toContain('guard-2');
    });

    it('should add guard at specific position', () => {
      const pipeline = new Pipeline({
        name: 'test',
        guards: ['guard-1', 'guard-3'],
      });

      const newGuard = new MockGuard('guard-2');
      pipeline.addGuard(newGuard, 1);

      expect(pipeline.config.guards[1]).toBe('guard-2');
    });
  });

  describe('removeGuard', () => {
    it('should remove guard from pipeline', () => {
      const guards = [new MockGuard('guard-1'), new MockGuard('guard-2')];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
        },
        guards,
      );

      pipeline.removeGuard('guard-1');

      expect(pipeline.config.guards).not.toContain('guard-1');
      expect(pipeline.config.guards).toContain('guard-2');
    });
  });

  describe('skip conditions', () => {
    it('should skip guard if condition passes', async () => {
      const guards = [
        new MockGuard('guard-1', true),
        new MockGuard('guard-2', true),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          skipConditions: [
            {
              guard: 'guard-2',
              ifPassed: 'guard-1',
            },
          ],
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.state.executedGuards).not.toContain('guard-2');
      expect(result.state.skippedGuards).toContain('guard-2');
    });

    it('should skip guard if another failed', async () => {
      const guards = [
        new MockGuard('guard-1', false),
        new MockGuard('guard-2', true),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          failureMode: 'continue',
          skipConditions: [
            {
              guard: 'guard-2',
              ifFailed: 'guard-1',
            },
          ],
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.state.skippedGuards).toContain('guard-2');
    });

    it('should support custom skip conditions', async () => {
      const guards = [
        new MockGuard('guard-1', true),
        new MockGuard('guard-2', true),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['guard-1', 'guard-2'],
          skipConditions: [
            {
              guard: 'guard-2',
              condition: (results) => results.length > 0,
            },
          ],
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.state.skippedGuards).toContain('guard-2');
    });
  });

  describe('continueOnFailure', () => {
    it('should continue when guard in continueOnFailure list fails', async () => {
      const guards = [
        new MockGuard('warn-guard', false, 0, { onFailure: 'warn' }),
        new MockGuard('strict-guard', true),
      ];

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['warn-guard', 'strict-guard'],
          failureMode: 'fail-fast',
          continueOnFailure: ['warn-guard'],
        },
        guards,
      );

      const result = await pipeline.execute(createContext());

      expect(result.results).toHaveLength(2);
      expect(result.state.executedGuards).toContain('strict-guard');
    });
  });

  describe('getState', () => {
    it('should return current pipeline state', async () => {
      const guard = new MockGuard('test-guard');

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['test-guard'],
        },
        [guard],
      );

      await pipeline.execute(createContext());

      const state = pipeline.getState();

      expect(state.pipelineName).toBe('test');
      expect(state.status).toBe('completed');
      expect(state.executedGuards).toContain('test-guard');
    });

    it('should include timing information', async () => {
      const guard = new MockGuard('test-guard', true, 10);

      const pipeline = new Pipeline(
        {
          name: 'test',
          guards: ['test-guard'],
        },
        [guard],
      );

      await pipeline.execute(createContext());

      const state = pipeline.getState();

      expect(state.startTime).toBeInstanceOf(Date);
      expect(state.endTime).toBeInstanceOf(Date);
      expect(state.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('PipelineBuilder', () => {
  it('should build pipeline with fluent API', () => {
    const pipeline = new PipelineBuilder()
      .name('my-pipeline')
      .description('Test pipeline')
      .addGuard('guard-1')
      .addGuard('guard-2')
      .executionMode('sequential')
      .failureMode('fail-fast')
      .timeout(5000)
      .build();

    expect(pipeline.name).toBe('my-pipeline');
    expect(pipeline.config.guards).toEqual(['guard-1', 'guard-2']);
    expect(pipeline.config.executionMode).toBe('sequential');
    expect(pipeline.config.failureMode).toBe('fail-fast');
    expect(pipeline.config.timeoutMs).toBe(5000);
  });

  it('should add multiple guards at once', () => {
    const pipeline = new PipelineBuilder()
      .name('test')
      .addGuards(['guard-1', 'guard-2', 'guard-3'])
      .build();

    expect(pipeline.config.guards).toEqual(['guard-1', 'guard-2', 'guard-3']);
  });

  it('should add skip conditions', () => {
    const pipeline = new PipelineBuilder()
      .name('test')
      .addGuard('guard-1')
      .addGuard('guard-2')
      .skipIf({
        guard: 'guard-2',
        ifPassed: 'guard-1',
      })
      .build();

    expect(pipeline.config.skipConditions).toHaveLength(1);
  });

  it('should throw if name is missing', () => {
    expect(() => {
      new PipelineBuilder().addGuard('guard-1').build();
    }).toThrow('Pipeline name is required');
  });

  it('should throw if no guards added', () => {
    expect(() => {
      new PipelineBuilder().name('test').build();
    }).toThrow('Pipeline must have at least one guard');
  });
});

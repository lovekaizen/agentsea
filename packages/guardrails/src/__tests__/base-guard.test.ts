import { describe, it, expect, beforeEach } from 'vitest';
import { BaseGuard } from '../core/base-guard.js';
import type {
  GuardContext,
  GuardResult,
  ContentType,
  GuardConfig,
} from '../types/index.js';

// Test implementation of BaseGuard
class TestGuard extends BaseGuard<void, { message: string }> {
  readonly name = 'test-guard';
  readonly supportedTypes: ContentType[] = ['input', 'output'];

  private shouldPass: boolean;
  private throwError: boolean;

  constructor(
    config: Partial<GuardConfig> = {},
    shouldPass = true,
    throwError = false,
  ) {
    super(config);
    this.shouldPass = shouldPass;
    this.throwError = throwError;
  }

  protected async doCheck(
    context: GuardContext,
  ): Promise<GuardResult<{ message: string }>> {
    if (this.throwError) {
      throw new Error('Test error');
    }

    if (this.shouldPass) {
      return this.pass({ message: 'Check passed' }, 'All good');
    }

    return this.fail('Check failed', { message: 'Failed check' });
  }
}

// Helper to create a guard context
function createContext(
  input = 'test input',
  type: ContentType = 'input',
): GuardContext {
  return {
    input,
    type,
    timestamp: new Date(),
  };
}

describe('BaseGuard', () => {
  describe('check', () => {
    it('should execute doCheck and return result', async () => {
      const guard = new TestGuard();
      const result = await guard.check(createContext());

      expect(result.passed).toBe(true);
      expect(result.guardName).toBe('test-guard');
      expect(result.action).toBe('allow');
      expect(result.message).toBe('All good');
      expect(result.details).toEqual({ message: 'Check passed' });
    });

    it('should include latency in result', async () => {
      const guard = new TestGuard();
      const result = await guard.check(createContext());

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.latencyMs).toBe('number');
    });

    it('should include timestamp in result', async () => {
      const guard = new TestGuard();
      const result = await guard.check(createContext());

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should fail when doCheck fails', async () => {
      const guard = new TestGuard({}, false);
      const result = await guard.check(createContext());

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Check failed');
      expect(result.action).toBe('block');
    });

    it('should skip when content type is not supported', async () => {
      class InputOnlyGuard extends BaseGuard {
        readonly name = 'input-only';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.pass();
        }
      }

      const guard = new InputOnlyGuard();
      const result = await guard.check(createContext('test', 'output'));

      expect(result.passed).toBe(true);
      expect(result.action).toBe('allow');
      expect(result.message).toContain('does not support content type');
    });

    it('should skip when guard is disabled', async () => {
      const guard = new TestGuard({ enabled: false });
      const result = await guard.check(createContext());

      expect(result.passed).toBe(true);
      expect(result.action).toBe('allow');
      expect(result.message).toBe('Guard is disabled');
    });

    it('should handle errors gracefully', async () => {
      const guard = new TestGuard({}, true, true);
      const result = await guard.check(createContext());

      expect(result.passed).toBe(false);
      expect(result.action).toBe('block');
      expect(result.message).toContain('Guard error: Test error');
    });

    it('should use warn action on error when onFailure is warn', async () => {
      const guard = new TestGuard({ onFailure: 'warn' }, true, true);
      const result = await guard.check(createContext());

      expect(result.passed).toBe(false);
      expect(result.action).toBe('warn');
    });
  });

  describe('supportsType', () => {
    it('should support specific content types', () => {
      class InputGuard extends BaseGuard {
        readonly name = 'input-guard';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.pass();
        }
      }

      const guard = new InputGuard();
      expect(guard['supportsType']('input')).toBe(true);
      expect(guard['supportsType']('output')).toBe(false);
    });

    it('should support both types when specified', () => {
      class BothGuard extends BaseGuard {
        readonly name = 'both-guard';
        readonly supportedTypes: ContentType[] = ['both'];

        protected async doCheck(): Promise<GuardResult> {
          return this.pass();
        }
      }

      const guard = new BothGuard();
      expect(guard['supportsType']('input')).toBe(true);
      expect(guard['supportsType']('output')).toBe(true);
    });
  });

  describe('pass', () => {
    it('should create a passing result', async () => {
      const guard = new TestGuard();
      const result = await guard.check(createContext());

      expect(result.passed).toBe(true);
      expect(result.action).toBe('allow');
    });

    it('should include custom message', async () => {
      class MessageGuard extends BaseGuard {
        readonly name = 'message';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.pass(undefined, 'Custom success message');
        }
      }

      const guard = new MessageGuard();
      const result = await guard.check(createContext());

      expect(result.message).toBe('Custom success message');
    });
  });

  describe('fail', () => {
    it('should create a failing result', async () => {
      const guard = new TestGuard({}, false);
      const result = await guard.check(createContext());

      expect(result.passed).toBe(false);
      expect(result.action).toBe('block');
    });

    it('should respect onFailure configuration', async () => {
      const guard = new TestGuard({ onFailure: 'warn' }, false);
      const result = await guard.check(createContext());

      expect(result.passed).toBe(false);
      expect(result.action).toBe('warn');
    });

    it('should include detections', async () => {
      class DetectionGuard extends BaseGuard {
        readonly name = 'detection';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.fail('Found issue', undefined, [
            {
              category: 'test',
              startIndex: 0,
              endIndex: 4,
              matchedText: 'test',
            },
          ]);
        }
      }

      const guard = new DetectionGuard();
      const result = await guard.check(createContext());

      expect(result.detections).toHaveLength(1);
      expect(result.detections?.[0].category).toBe('test');
    });
  });

  describe('warn', () => {
    it('should create a warning result', async () => {
      class WarnGuard extends BaseGuard {
        readonly name = 'warn';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.warn('Warning message');
        }
      }

      const guard = new WarnGuard();
      const result = await guard.check(createContext());

      expect(result.passed).toBe(true);
      expect(result.action).toBe('warn');
      expect(result.message).toBe('Warning message');
    });
  });

  describe('transformed', () => {
    it('should create a transform result', async () => {
      class TransformGuard extends BaseGuard {
        readonly name = 'transform';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.transformed('transformed content');
        }
      }

      const guard = new TransformGuard();
      const result = await guard.check(createContext());

      expect(result.passed).toBe(true);
      expect(result.action).toBe('transform');
      expect(result.transformedContent).toBe('transformed content');
    });
  });

  describe('withConfidence', () => {
    it('should add confidence score to result', async () => {
      class ConfidenceGuard extends BaseGuard {
        readonly name = 'confidence';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.withConfidence(this.fail('Failed'), 0.9);
        }
      }

      const guard = new ConfidenceGuard();
      const result = await guard.check(createContext());

      expect(result.confidence).toBe(0.9);
    });

    it('should pass when confidence is below threshold', async () => {
      class ThresholdGuard extends BaseGuard {
        readonly name = 'threshold';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.withConfidence(this.fail('Failed'), 0.3);
        }
      }

      const guard = new ThresholdGuard({ threshold: 0.5 });
      const result = await guard.check(createContext());

      expect(result.passed).toBe(true);
      expect(result.action).toBe('allow');
      expect(result.confidence).toBe(0.3);
    });

    it('should fail when confidence is above threshold', async () => {
      class ThresholdGuard extends BaseGuard {
        readonly name = 'threshold';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.withConfidence(this.fail('Failed'), 0.8);
        }
      }

      const guard = new ThresholdGuard({ threshold: 0.5 });
      const result = await guard.check(createContext());

      expect(result.passed).toBe(false);
      expect(result.action).toBe('block');
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const guard = new TestGuard();

      expect(guard.config.enabled).toBe(true);
      expect(guard.config.onFailure).toBe('block');
    });

    it('should merge custom configuration', () => {
      const guard = new TestGuard({
        enabled: false,
        onFailure: 'warn',
        threshold: 0.8,
      });

      expect(guard.config.enabled).toBe(false);
      expect(guard.config.onFailure).toBe('warn');
      expect(guard.config.threshold).toBe(0.8);
    });
  });

  describe('transform', () => {
    it('should return original content by default', async () => {
      const guard = new TestGuard();
      const transformed = await guard.transform(
        'original',
        createContext('original'),
      );

      expect(transformed).toBe('original');
    });

    it('can be overridden', async () => {
      class CustomTransformGuard extends BaseGuard {
        readonly name = 'custom-transform';
        readonly supportedTypes: ContentType[] = ['input'];

        protected async doCheck(): Promise<GuardResult> {
          return this.pass();
        }

        transform(content: string): Promise<string> {
          return Promise.resolve(content.toUpperCase());
        }
      }

      const guard = new CustomTransformGuard();
      const transformed = await guard.transform('test', createContext('test'));

      expect(transformed).toBe('TEST');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseBackend } from '../backends/base-backend.js';
import type {
  Point,
  ScreenDimensions,
  ScreenshotResult,
  ActionResult,
  ScrollDirection,
  ModifierKey,
  ScreenshotOptions,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  DragOptions,
} from '../types/index.js';

// Concrete implementation for testing
class TestBackend extends BaseBackend {
  readonly name = 'test-backend';

  async connect(): Promise<void> {
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
  }

  async getScreenDimensions(): Promise<ScreenDimensions> {
    this.ensureConnected();
    return {
      width: 1920,
      height: 1080,
      scaleFactor: 1,
    };
  }

  async screenshot(_options?: ScreenshotOptions): Promise<ScreenshotResult> {
    this.ensureConnected();
    return {
      base64: 'test-base64',
      mimeType: 'image/png',
      width: 1920,
      height: 1080,
      timestamp: new Date(),
    };
  }

  async click(point: Point, _options?: ClickOptions): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    // Simulate click
    return this.createSuccessResult('click', startTime);
  }

  async doubleClick(
    point: Point,
    _options?: ClickOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    return this.createSuccessResult('doubleClick', startTime);
  }

  async typeText(text: string, _options?: TypeOptions): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    return this.createSuccessResult('type', startTime);
  }

  async scroll(
    _direction: ScrollDirection,
    _point: Point,
    _options?: ScrollOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    return this.createSuccessResult('scroll', startTime);
  }

  async drag(
    _from: Point,
    _to: Point,
    _options?: DragOptions,
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    return this.createSuccessResult('drag', startTime);
  }

  async keyPress(
    _key: string,
    _modifiers?: ModifierKey[],
  ): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    return this.createSuccessResult('keyPress', startTime);
  }

  async moveCursor(_point: Point): Promise<ActionResult> {
    this.ensureConnected();
    const startTime = Date.now();
    return this.createSuccessResult('moveCursor', startTime);
  }
}

describe('BaseBackend', () => {
  let backend: TestBackend;

  beforeEach(() => {
    backend = new TestBackend();
  });

  describe('connection state', () => {
    it('should start disconnected', () => {
      expect(backend.isConnected).toBe(false);
    });

    it('should be connected after connect()', async () => {
      await backend.connect();
      expect(backend.isConnected).toBe(true);
    });

    it('should be disconnected after disconnect()', async () => {
      await backend.connect();
      await backend.disconnect();
      expect(backend.isConnected).toBe(false);
    });

    it('should allow multiple connect calls', async () => {
      await backend.connect();
      await backend.connect();
      expect(backend.isConnected).toBe(true);
    });

    it('should allow multiple disconnect calls', async () => {
      await backend.connect();
      await backend.disconnect();
      await backend.disconnect();
      expect(backend.isConnected).toBe(false);
    });
  });

  describe('ensureConnected', () => {
    it('should throw when not connected', () => {
      expect(() => {
        (backend as any).ensureConnected();
      }).toThrow('not connected');
    });

    it('should not throw when connected', async () => {
      await backend.connect();
      expect(() => {
        (backend as any).ensureConnected();
      }).not.toThrow();
    });

    it('should include backend name in error', () => {
      expect(() => {
        (backend as any).ensureConnected();
      }).toThrow('test-backend');
    });
  });

  describe('name property', () => {
    it('should return backend name', () => {
      expect(backend.name).toBe('test-backend');
    });

    it('should have a name property', () => {
      expect(backend.name).toBe('test-backend');
      expect(typeof backend.name).toBe('string');
    });
  });

  describe('wait', () => {
    it('should wait for specified duration', async () => {
      const startTime = Date.now();
      const result = await backend.wait(100);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some variance
      expect(result.success).toBe(true);
      expect(result.action).toBe('wait');
    });

    it('should return success result', async () => {
      const result = await backend.wait(10);

      expect(result.success).toBe(true);
      expect(result.action).toBe('wait');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track actual duration', async () => {
      const result = await backend.wait(50);

      expect(result.duration).toBeGreaterThanOrEqual(40);
      expect(result.duration).toBeLessThan(100);
    });

    it('should work with zero duration', async () => {
      const result = await backend.wait(0);

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should not require connection', async () => {
      // Don't connect - wait should still work
      const result = await backend.wait(10);
      expect(result.success).toBe(true);
    });
  });

  describe('createSuccessResult', () => {
    it('should create success result', () => {
      const startTime = Date.now();
      const result = (backend as any).createSuccessResult(
        'test-action',
        startTime,
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('test-action');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it('should calculate duration', async () => {
      const startTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const result = (backend as any).createSuccessResult('test', startTime);

      expect(result.duration).toBeGreaterThanOrEqual(40);
      expect(result.duration).toBeLessThan(100);
    });
  });

  describe('createErrorResult', () => {
    it('should create error result', () => {
      const startTime = Date.now();
      const result = (backend as any).createErrorResult(
        'test-action',
        startTime,
        'Test error message',
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('test-action');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.error).toBe('Test error message');
    });

    it('should calculate duration', async () => {
      const startTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const result = (backend as any).createErrorResult(
        'test',
        startTime,
        'Error',
      );

      expect(result.duration).toBeGreaterThanOrEqual(40);
    });
  });

  describe('abstract method implementations', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    describe('getScreenDimensions', () => {
      it('should return screen dimensions', async () => {
        const dimensions = await backend.getScreenDimensions();

        expect(dimensions).toHaveProperty('width');
        expect(dimensions).toHaveProperty('height');
        expect(dimensions).toHaveProperty('scaleFactor');
        expect(dimensions.width).toBe(1920);
        expect(dimensions.height).toBe(1080);
      });

      it('should require connection', async () => {
        await backend.disconnect();
        await expect(backend.getScreenDimensions()).rejects.toThrow(
          'not connected',
        );
      });
    });

    describe('screenshot', () => {
      it('should take screenshot', async () => {
        const result = await backend.screenshot();

        expect(result).toHaveProperty('base64');
        expect(result).toHaveProperty('mimeType');
        expect(result).toHaveProperty('width');
        expect(result).toHaveProperty('height');
        expect(result).toHaveProperty('timestamp');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        await expect(backend.screenshot()).rejects.toThrow('not connected');
      });
    });

    describe('click', () => {
      it('should perform click', async () => {
        const point: Point = { x: 100, y: 200 };
        const result = await backend.click(point);

        expect(result.success).toBe(true);
        expect(result.action).toBe('click');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        const point: Point = { x: 100, y: 200 };
        await expect(backend.click(point)).rejects.toThrow('not connected');
      });
    });

    describe('doubleClick', () => {
      it('should perform double click', async () => {
        const point: Point = { x: 100, y: 200 };
        const result = await backend.doubleClick(point);

        expect(result.success).toBe(true);
        expect(result.action).toBe('doubleClick');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        const point: Point = { x: 100, y: 200 };
        await expect(backend.doubleClick(point)).rejects.toThrow(
          'not connected',
        );
      });
    });

    describe('typeText', () => {
      it('should type text', async () => {
        const result = await backend.typeText('Hello world');

        expect(result.success).toBe(true);
        expect(result.action).toBe('type');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        await expect(backend.typeText('test')).rejects.toThrow('not connected');
      });
    });

    describe('scroll', () => {
      it('should scroll', async () => {
        const point: Point = { x: 500, y: 500 };
        const result = await backend.scroll('down', point);

        expect(result.success).toBe(true);
        expect(result.action).toBe('scroll');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        const point: Point = { x: 500, y: 500 };
        await expect(backend.scroll('up', point)).rejects.toThrow(
          'not connected',
        );
      });
    });

    describe('drag', () => {
      it('should perform drag', async () => {
        const from: Point = { x: 100, y: 100 };
        const to: Point = { x: 200, y: 200 };
        const result = await backend.drag(from, to);

        expect(result.success).toBe(true);
        expect(result.action).toBe('drag');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        const from: Point = { x: 100, y: 100 };
        const to: Point = { x: 200, y: 200 };
        await expect(backend.drag(from, to)).rejects.toThrow('not connected');
      });
    });

    describe('keyPress', () => {
      it('should press key', async () => {
        const result = await backend.keyPress('enter');

        expect(result.success).toBe(true);
        expect(result.action).toBe('keyPress');
      });

      it('should press key with modifiers', async () => {
        const result = await backend.keyPress('c', ['ctrl']);

        expect(result.success).toBe(true);
      });

      it('should require connection', async () => {
        await backend.disconnect();
        await expect(backend.keyPress('a')).rejects.toThrow('not connected');
      });
    });

    describe('moveCursor', () => {
      it('should move cursor', async () => {
        const point: Point = { x: 300, y: 400 };
        const result = await backend.moveCursor(point);

        expect(result.success).toBe(true);
        expect(result.action).toBe('moveCursor');
      });

      it('should require connection', async () => {
        await backend.disconnect();
        const point: Point = { x: 300, y: 400 };
        await expect(backend.moveCursor(point)).rejects.toThrow(
          'not connected',
        );
      });
    });
  });

  describe('result timestamps', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    it('should set timestamp on all results', async () => {
      const beforeTime = new Date();
      const result = await backend.click({ x: 100, y: 100 });
      const afterTime = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime(),
      );
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(
        afterTime.getTime(),
      );
    });
  });

  describe('result durations', () => {
    beforeEach(async () => {
      await backend.connect();
    });

    it('should track duration for all actions', async () => {
      const result = await backend.click({ x: 100, y: 100 });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeLessThan(1000); // Should be quick
    });

    it('should have consistent duration format', async () => {
      const results = await Promise.all([
        backend.click({ x: 100, y: 100 }),
        backend.typeText('test'),
        backend.scroll('down', { x: 100, y: 100 }),
      ]);

      results.forEach((result) => {
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

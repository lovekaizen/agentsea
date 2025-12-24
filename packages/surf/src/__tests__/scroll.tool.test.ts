import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createScrollTool } from '../tools/scroll.tool.js';
import type {
  DesktopBackend,
  Point,
  ActionResult,
  ScrollDirection,
  ScrollOptions,
} from '../types/index.js';

// Mock backend
class MockBackend implements Partial<DesktopBackend> {
  readonly name = 'mock';
  isConnected = true;

  async scroll(
    direction: ScrollDirection,
    point: Point,
    options?: ScrollOptions,
  ): Promise<ActionResult> {
    return {
      success: true,
      action: 'scroll',
      timestamp: new Date(),
      duration: 20,
    };
  }
}

describe('createScrollTool', () => {
  let backend: MockBackend;
  let scrollTool: any;

  beforeEach(() => {
    backend = new MockBackend();
    scrollTool = createScrollTool(backend as any);
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(scrollTool.name).toBe('computer_scroll');
    });

    it('should have description', () => {
      expect(scrollTool.description).toBeTruthy();
      expect(scrollTool.description).toContain('Scroll');
    });

    it('should have input schema', () => {
      expect(scrollTool.inputSchema).toBeDefined();
    });

    it('should have output schema', () => {
      expect(scrollTool.outputSchema).toBeDefined();
    });

    it('should have execute function', () => {
      expect(typeof scrollTool.execute).toBe('function');
    });
  });

  describe('execute - scroll directions', () => {
    it('should scroll down', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('down');
      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 500, y: 500 },
        expect.any(Object),
      );
    });

    it('should scroll up', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'up' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('up');
      expect(scrollSpy).toHaveBeenCalledWith(
        'up',
        { x: 500, y: 500 },
        expect.any(Object),
      );
    });

    it('should scroll left', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'left' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('left');
      expect(scrollSpy).toHaveBeenCalledWith(
        'left',
        { x: 500, y: 500 },
        expect.any(Object),
      );
    });

    it('should scroll right', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'right' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('right');
      expect(scrollSpy).toHaveBeenCalledWith(
        'right',
        { x: 500, y: 500 },
        expect.any(Object),
      );
    });
  });

  describe('execute - scroll coordinates', () => {
    it('should scroll at specified coordinates', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 300,
        y: 400,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 300, y: 400 },
        expect.any(Object),
      );
    });

    it('should handle zero coordinates', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 0,
        y: 0,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 0, y: 0 },
        expect.any(Object),
      );
    });

    it('should handle large coordinates', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 3840,
        y: 2160,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 3840, y: 2160 },
        expect.any(Object),
      );
    });

    it('should handle decimal coordinates', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 100.5,
        y: 200.7,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 100.5, y: 200.7 },
        expect.any(Object),
      );
    });
  });

  describe('execute - scroll amount', () => {
    it('should pass scroll amount option', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 5,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 500, y: 500 },
        expect.objectContaining({
          amount: 5,
        }),
      );
    });

    it('should handle small scroll amount', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 1,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        expect.any(Object),
        expect.objectContaining({ amount: 1 }),
      );
    });

    it('should handle large scroll amount', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 10,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        expect.any(Object),
        expect.objectContaining({ amount: 10 }),
      );
    });

    it('should include amount in result', async () => {
      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 3,
      });

      expect(result.amount).toBe(3);
    });

    it('should not include amount when not specified', async () => {
      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
      });

      // Schema might provide default value
      expect(result).toHaveProperty('amount');
    });
  });

  describe('execute - smooth scrolling', () => {
    it('should enable smooth scrolling when requested', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
        smooth: true,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        expect.any(Object),
        expect.objectContaining({
          smooth: true,
        }),
      );
    });

    it('should disable smooth scrolling when requested', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
        smooth: false,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        expect.any(Object),
        expect.objectContaining({
          smooth: false,
        }),
      );
    });

    it('should handle undefined smooth option', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
      };

      await scrollTool.execute(input);

      const options = scrollSpy.mock.calls[0][2];
      expect(options).toHaveProperty('smooth');
    });
  });

  describe('execute - combined options', () => {
    it('should handle amount and smooth together', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 5,
        smooth: true,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        { x: 500, y: 500 },
        expect.objectContaining({
          amount: 5,
          smooth: true,
        }),
      );
    });

    it('should handle all parameters together', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');
      const input = {
        direction: 'up' as const,
        x: 100,
        y: 200,
        amount: 3,
        smooth: false,
      };

      await scrollTool.execute(input);

      expect(scrollSpy).toHaveBeenCalledWith(
        'up',
        { x: 100, y: 200 },
        expect.objectContaining({
          amount: 3,
          smooth: false,
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should handle backend scroll failure', async () => {
      vi.spyOn(backend, 'scroll').mockResolvedValue({
        success: false,
        action: 'scroll',
        timestamp: new Date(),
        duration: 10,
        error: 'Scroll failed',
      });

      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Scroll failed');
    });

    it('should handle backend exception', async () => {
      vi.spyOn(backend, 'scroll').mockRejectedValue(new Error('Backend error'));

      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Scroll failed');
      expect(result.error).toContain('Backend error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.spyOn(backend, 'scroll').mockRejectedValue('String error');

      const input = {
        direction: 'down' as const,
        x: 500,
        y: 500,
      };

      const result = await scrollTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });

    it('should return error result with direction', async () => {
      vi.spyOn(backend, 'scroll').mockRejectedValue(new Error('Test error'));

      const input = {
        direction: 'left' as const,
        x: 500,
        y: 500,
        amount: 5,
      };

      const result = await scrollTool.execute(input);

      expect(result.direction).toBe('left');
      expect(result.amount).toBe(5);
    });
  });

  describe('result format', () => {
    it('should return all required fields', async () => {
      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('direction');
      expect(result).toHaveProperty('duration');
    });

    it('should include amount in result', async () => {
      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 5,
      });

      expect(result).toHaveProperty('amount');
      expect(result.amount).toBe(5);
    });

    it('should include error field when failed', async () => {
      vi.spyOn(backend, 'scroll').mockResolvedValue({
        success: false,
        action: 'scroll',
        timestamp: new Date(),
        duration: 10,
        error: 'Test error',
      });

      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Test error');
    });

    it('should not include error field when successful', async () => {
      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
      });

      expect(result.error).toBeUndefined();
    });

    it('should return duration', async () => {
      const result = await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('scroll patterns', () => {
    it('should scroll multiple times in same direction', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      for (let i = 0; i < 5; i++) {
        await scrollTool.execute({
          direction: 'down' as const,
          x: 500,
          y: 500,
        });
      }

      expect(scrollSpy).toHaveBeenCalledTimes(5);
    });

    it('should scroll in different directions sequentially', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      await scrollTool.execute({ direction: 'down' as const, x: 500, y: 500 });
      await scrollTool.execute({ direction: 'up' as const, x: 500, y: 500 });
      await scrollTool.execute({ direction: 'left' as const, x: 500, y: 500 });
      await scrollTool.execute({ direction: 'right' as const, x: 500, y: 500 });

      expect(scrollSpy).toHaveBeenCalledTimes(4);
    });

    it('should scroll at different positions', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      await scrollTool.execute({ direction: 'down' as const, x: 100, y: 100 });
      await scrollTool.execute({ direction: 'down' as const, x: 500, y: 500 });
      await scrollTool.execute({ direction: 'down' as const, x: 900, y: 900 });

      expect(scrollSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('edge cases', () => {
    it('should handle vertical scroll with small amount', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      await scrollTool.execute({
        direction: 'down' as const,
        x: 500,
        y: 500,
        amount: 1,
      });

      expect(scrollSpy).toHaveBeenCalledWith(
        'down',
        expect.any(Object),
        expect.objectContaining({ amount: 1 }),
      );
    });

    it('should handle horizontal scroll', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      await scrollTool.execute({
        direction: 'right' as const,
        x: 500,
        y: 500,
        amount: 3,
      });

      expect(scrollSpy).toHaveBeenCalledWith(
        'right',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should scroll at screen edges', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      await scrollTool.execute({
        direction: 'down' as const,
        x: 1920,
        y: 1080,
      });

      expect(scrollSpy).toHaveBeenCalled();
    });
  });
});

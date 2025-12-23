import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClickTool } from '../tools/click.tool.js';
import type { DesktopBackend, Point, ActionResult } from '../types/index.js';

// Mock backend
class MockBackend implements Partial<DesktopBackend> {
  readonly name = 'mock';
  isConnected = true;

  async click(point: Point, options?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'click',
      timestamp: new Date(),
      duration: 10,
    };
  }

  async doubleClick(point: Point, options?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'doubleClick',
      timestamp: new Date(),
      duration: 15,
    };
  }
}

describe('createClickTool', () => {
  let backend: MockBackend;
  let clickTool: any;

  beforeEach(() => {
    backend = new MockBackend();
    clickTool = createClickTool(backend as any);
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(clickTool.name).toBe('computer_click');
    });

    it('should have description', () => {
      expect(clickTool.description).toBeTruthy();
      expect(clickTool.description).toContain('Click');
    });

    it('should have input schema', () => {
      expect(clickTool.inputSchema).toBeDefined();
    });

    it('should have output schema', () => {
      expect(clickTool.outputSchema).toBeDefined();
    });

    it('should have execute function', () => {
      expect(typeof clickTool.execute).toBe('function');
    });
  });

  describe('execute - single click', () => {
    it('should execute single click successfully', async () => {
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.x).toBe(100);
      expect(result.y).toBe(200);
      expect(result.action).toBe('click');
    });

    it('should call backend click method', async () => {
      const clickSpy = vi.spyOn(backend, 'click');
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
      };

      await clickTool.execute(input);

      expect(clickSpy).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        expect.any(Object),
      );
    });

    it('should pass button option', async () => {
      const clickSpy = vi.spyOn(backend, 'click');
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
        button: 'right' as const,
      };

      await clickTool.execute(input);

      expect(clickSpy).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        expect.objectContaining({ button: 'right' }),
      );
    });

    it('should pass modifiers option', async () => {
      const clickSpy = vi.spyOn(backend, 'click');
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
        modifiers: ['ctrl', 'shift'] as any[],
      };

      await clickTool.execute(input);

      expect(clickSpy).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        expect.objectContaining({ modifiers: ['ctrl', 'shift'] }),
      );
    });

    it('should pass holdMs option', async () => {
      const clickSpy = vi.spyOn(backend, 'click');
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
        holdMs: 500,
      };

      await clickTool.execute(input);

      expect(clickSpy).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        expect.objectContaining({ holdMs: 500 }),
      );
    });

    it('should return duration', async () => {
      const result = await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should handle left button click', async () => {
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
        button: 'left' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
    });

    it('should handle middle button click', async () => {
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
        button: 'middle' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
    });
  });

  describe('execute - double click', () => {
    it('should execute double click successfully', async () => {
      const input = {
        x: 150,
        y: 250,
        clickType: 'double' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.x).toBe(150);
      expect(result.y).toBe(250);
      expect(result.action).toBe('doubleClick');
    });

    it('should call backend doubleClick method', async () => {
      const doubleClickSpy = vi.spyOn(backend, 'doubleClick');
      const input = {
        x: 100,
        y: 200,
        clickType: 'double' as const,
      };

      await clickTool.execute(input);

      expect(doubleClickSpy).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        expect.any(Object),
      );
    });

    it('should pass options to doubleClick', async () => {
      const doubleClickSpy = vi.spyOn(backend, 'doubleClick');
      const input = {
        x: 100,
        y: 200,
        clickType: 'double' as const,
        button: 'left' as const,
        modifiers: ['shift'] as any[],
      };

      await clickTool.execute(input);

      expect(doubleClickSpy).toHaveBeenCalledWith(
        { x: 100, y: 200 },
        expect.objectContaining({
          button: 'left',
          modifiers: ['shift'],
        }),
      );
    });
  });

  describe('coordinate handling', () => {
    it('should handle zero coordinates', async () => {
      const input = {
        x: 0,
        y: 0,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should handle large coordinates', async () => {
      const input = {
        x: 3840,
        y: 2160,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.x).toBe(3840);
      expect(result.y).toBe(2160);
    });

    it('should handle decimal coordinates', async () => {
      const clickSpy = vi.spyOn(backend, 'click');
      const input = {
        x: 100.5,
        y: 200.7,
        clickType: 'single' as const,
      };

      await clickTool.execute(input);

      expect(clickSpy).toHaveBeenCalledWith(
        { x: 100.5, y: 200.7 },
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should handle backend click failure', async () => {
      vi.spyOn(backend, 'click').mockResolvedValue({
        success: false,
        action: 'click',
        timestamp: new Date(),
        duration: 10,
        error: 'Click failed',
      });

      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Click failed');
    });

    it('should handle backend exception', async () => {
      vi.spyOn(backend, 'click').mockRejectedValue(new Error('Backend error'));

      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Click failed');
      expect(result.error).toContain('Backend error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.spyOn(backend, 'click').mockRejectedValue('String error');

      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });

    it('should return error result with coordinates', async () => {
      vi.spyOn(backend, 'click').mockRejectedValue(new Error('Test error'));

      const input = {
        x: 123,
        y: 456,
        clickType: 'single' as const,
      };

      const result = await clickTool.execute(input);

      expect(result.x).toBe(123);
      expect(result.y).toBe(456);
    });
  });

  describe('default values', () => {
    it('should use single click as default when clickType not specified', async () => {
      const clickSpy = vi.spyOn(backend, 'click');
      const doubleClickSpy = vi.spyOn(backend, 'doubleClick');

      const input = {
        x: 100,
        y: 200,
        // clickType not specified, should default to single
      };

      await clickTool.execute(input);

      // Based on implementation, it should call click if not 'double'
      expect(clickSpy).toHaveBeenCalled();
      expect(doubleClickSpy).not.toHaveBeenCalled();
    });

    it('should handle missing optional parameters', async () => {
      const input = {
        x: 100,
        y: 200,
        clickType: 'single' as const,
        // No button, modifiers, or holdMs
      };

      const result = await clickTool.execute(input);

      expect(result.success).toBe(true);
    });
  });

  describe('result format', () => {
    it('should return all required fields', async () => {
      const result = await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
      expect(result).toHaveProperty('action');
      expect(result).toHaveProperty('duration');
    });

    it('should include error field when failed', async () => {
      vi.spyOn(backend, 'click').mockResolvedValue({
        success: false,
        action: 'click',
        timestamp: new Date(),
        duration: 10,
        error: 'Test error',
      });

      const result = await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Test error');
    });

    it('should not include error field when successful', async () => {
      const result = await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
      });

      expect(result.error).toBeUndefined();
    });
  });

  describe('modifier combinations', () => {
    it('should handle single modifier', async () => {
      const clickSpy = vi.spyOn(backend, 'click');

      await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
        modifiers: ['ctrl'],
      });

      expect(clickSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ modifiers: ['ctrl'] }),
      );
    });

    it('should handle multiple modifiers', async () => {
      const clickSpy = vi.spyOn(backend, 'click');

      await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
        modifiers: ['ctrl', 'shift', 'alt'],
      });

      expect(clickSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ modifiers: ['ctrl', 'shift', 'alt'] }),
      );
    });

    it('should handle meta modifier', async () => {
      const clickSpy = vi.spyOn(backend, 'click');

      await clickTool.execute({
        x: 100,
        y: 200,
        clickType: 'single' as const,
        modifiers: ['meta'],
      });

      expect(clickSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ modifiers: ['meta'] }),
      );
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTypeTextTool } from '../tools/type-text.tool.js';
import type {
  DesktopBackend,
  ActionResult,
  TypeOptions,
} from '../types/index.js';

// Mock backend
class MockBackend implements Partial<DesktopBackend> {
  readonly name = 'mock';
  isConnected = true;

  async typeText(text: string, options?: TypeOptions): Promise<ActionResult> {
    return {
      success: true,
      action: 'type',
      timestamp: new Date(),
      duration: text.length * 5,
    };
  }
}

describe('createTypeTextTool', () => {
  let backend: MockBackend;
  let typeTextTool: any;

  beforeEach(() => {
    backend = new MockBackend();
    typeTextTool = createTypeTextTool(backend as any);
  });

  describe('tool metadata', () => {
    it('should have correct name', () => {
      expect(typeTextTool.name).toBe('computer_type');
    });

    it('should have description', () => {
      expect(typeTextTool.description).toBeTruthy();
      expect(typeTextTool.description).toContain('Type');
    });

    it('should have input schema', () => {
      expect(typeTextTool.inputSchema).toBeDefined();
    });

    it('should have output schema', () => {
      expect(typeTextTool.outputSchema).toBeDefined();
    });

    it('should have execute function', () => {
      expect(typeof typeTextTool.execute).toBe('function');
    });
  });

  describe('execute - basic typing', () => {
    it('should type text successfully', async () => {
      const input = {
        text: 'Hello world',
      };

      const result = await typeTextTool.execute(input);

      expect(result.success).toBe(true);
      expect(result.textLength).toBe(11);
    });

    it('should call backend typeText method', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Test text',
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith('Test text', expect.any(Object));
    });

    it('should return text length', async () => {
      const result = await typeTextTool.execute({
        text: 'Hello',
      });

      expect(result.textLength).toBe(5);
    });

    it('should return duration', async () => {
      const result = await typeTextTool.execute({
        text: 'Test',
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });
  });

  describe('execute - with coordinates', () => {
    it('should type at specified coordinates', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        x: 100,
        y: 200,
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          point: { x: 100, y: 200 },
        }),
      );
    });

    it('should not set point when coordinates not provided', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
      };

      await typeTextTool.execute(input);

      const options = typeTextSpy.mock.calls[0][1];
      expect(options?.point).toBeUndefined();
    });

    it('should handle only x coordinate provided', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        x: 100,
        // y not provided
      };

      await typeTextTool.execute(input);

      const options = typeTextSpy.mock.calls[0][1];
      expect(options?.point).toBeUndefined();
    });

    it('should handle only y coordinate provided', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        y: 200,
        // x not provided
      };

      await typeTextTool.execute(input);

      const options = typeTextSpy.mock.calls[0][1];
      expect(options?.point).toBeUndefined();
    });

    it('should handle zero coordinates', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        x: 0,
        y: 0,
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          point: { x: 0, y: 0 },
        }),
      );
    });
  });

  describe('execute - with options', () => {
    it('should pass delayMs option', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        delayMs: 100,
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          delayMs: 100,
        }),
      );
    });

    it('should pass clearFirst option', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        clearFirst: true,
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          clearFirst: true,
        }),
      );
    });

    it('should handle all options together', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        x: 100,
        y: 200,
        delayMs: 50,
        clearFirst: true,
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          point: { x: 100, y: 200 },
          delayMs: 50,
          clearFirst: true,
        }),
      );
    });

    it('should handle clearFirst as false', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Hello',
        clearFirst: false,
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          clearFirst: false,
        }),
      );
    });
  });

  describe('text content', () => {
    it('should handle empty text', async () => {
      const result = await typeTextTool.execute({
        text: '',
      });

      expect(result.success).toBe(true);
      expect(result.textLength).toBe(0);
    });

    it('should handle short text', async () => {
      const result = await typeTextTool.execute({
        text: 'Hi',
      });

      expect(result.textLength).toBe(2);
    });

    it('should handle long text', async () => {
      const longText = 'A'.repeat(1000);
      const result = await typeTextTool.execute({
        text: longText,
      });

      expect(result.textLength).toBe(1000);
    });

    it('should handle special characters', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./',
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        '!@#$%^&*()_+-={}[]|\\:";\'<>?,./',
        expect.any(Object),
      );
    });

    it('should handle unicode characters', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: '你好世界 🌍 Ñoño',
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        '你好世界 🌍 Ñoño',
        expect.any(Object),
      );
    });

    it('should handle newlines', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Line 1\nLine 2\nLine 3',
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Line 1\nLine 2\nLine 3',
        expect.any(Object),
      );
    });

    it('should handle tabs', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');
      const input = {
        text: 'Col1\tCol2\tCol3',
      };

      await typeTextTool.execute(input);

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Col1\tCol2\tCol3',
        expect.any(Object),
      );
    });
  });

  describe('error handling', () => {
    it('should handle backend type failure', async () => {
      vi.spyOn(backend, 'typeText').mockResolvedValue({
        success: false,
        action: 'type',
        timestamp: new Date(),
        duration: 10,
        error: 'Type failed',
      });

      const input = {
        text: 'Hello',
      };

      const result = await typeTextTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Type failed');
    });

    it('should handle backend exception', async () => {
      vi.spyOn(backend, 'typeText').mockRejectedValue(
        new Error('Backend error'),
      );

      const input = {
        text: 'Hello',
      };

      const result = await typeTextTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Type text failed');
      expect(result.error).toContain('Backend error');
    });

    it('should handle non-Error exceptions', async () => {
      vi.spyOn(backend, 'typeText').mockRejectedValue('String error');

      const input = {
        text: 'Hello',
      };

      const result = await typeTextTool.execute(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });

    it('should return error result with text length', async () => {
      vi.spyOn(backend, 'typeText').mockRejectedValue(new Error('Test error'));

      const input = {
        text: 'Hello world',
      };

      const result = await typeTextTool.execute(input);

      expect(result.textLength).toBe(11);
    });
  });

  describe('result format', () => {
    it('should return all required fields', async () => {
      const result = await typeTextTool.execute({
        text: 'Test',
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('textLength');
      expect(result).toHaveProperty('duration');
    });

    it('should include error field when failed', async () => {
      vi.spyOn(backend, 'typeText').mockResolvedValue({
        success: false,
        action: 'type',
        timestamp: new Date(),
        duration: 10,
        error: 'Test error',
      });

      const result = await typeTextTool.execute({
        text: 'Test',
      });

      expect(result).toHaveProperty('error');
      expect(result.error).toBe('Test error');
    });

    it('should not include error field when successful', async () => {
      const result = await typeTextTool.execute({
        text: 'Test',
      });

      expect(result.error).toBeUndefined();
    });
  });

  describe('typing delay', () => {
    it('should handle zero delay', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');

      await typeTextTool.execute({
        text: 'Test',
        delayMs: 0,
      });

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          delayMs: 0,
        }),
      );
    });

    it('should handle moderate delay', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');

      await typeTextTool.execute({
        text: 'Test',
        delayMs: 500,
      });

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          delayMs: 500,
        }),
      );
    });

    it('should handle fractional delay', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');

      await typeTextTool.execute({
        text: 'Test',
        delayMs: 10.5,
      });

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          delayMs: 10.5,
        }),
      );
    });
  });

  describe('clearFirst behavior', () => {
    it('should clear before typing when clearFirst is true', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');

      await typeTextTool.execute({
        text: 'New text',
        clearFirst: true,
      });

      expect(typeTextSpy).toHaveBeenCalledWith(
        'New text',
        expect.objectContaining({
          clearFirst: true,
        }),
      );
    });

    it('should append when clearFirst is false', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');

      await typeTextTool.execute({
        text: 'More text',
        clearFirst: false,
      });

      expect(typeTextSpy).toHaveBeenCalledWith(
        'More text',
        expect.objectContaining({
          clearFirst: false,
        }),
      );
    });

    it('should work with clearFirst and coordinates', async () => {
      const typeTextSpy = vi.spyOn(backend, 'typeText');

      await typeTextTool.execute({
        text: 'Test',
        x: 100,
        y: 200,
        clearFirst: true,
      });

      expect(typeTextSpy).toHaveBeenCalledWith(
        'Test',
        expect.objectContaining({
          point: { x: 100, y: 200 },
          clearFirst: true,
        }),
      );
    });
  });
});

import { describe, it, expect } from 'vitest';
import { calculatorTool } from '../calculator.tool';

describe('calculatorTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(calculatorTool.name).toBe('calculator');
    });

    it('should have a description', () => {
      expect(calculatorTool.description).toBeDefined();
      expect(calculatorTool.description.length).toBeGreaterThan(0);
    });

    it('should have valid parameters schema', () => {
      const validInput = {
        operation: 'add',
        a: 5,
        b: 3,
      };

      const result = calculatorTool.parameters.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject invalid operation', () => {
      const invalidInput = {
        operation: 'invalid',
        a: 5,
        b: 3,
      };

      const result = calculatorTool.parameters.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject non-number values', () => {
      const invalidInput = {
        operation: 'add',
        a: 'five',
        b: 3,
      };

      const result = calculatorTool.parameters.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('addition', () => {
    it('should add two positive numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'add', a: 5, b: 3 },
        {} as any,
      );
      expect(result).toEqual({ result: 8 });
    });

    it('should add negative numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'add', a: -5, b: -3 },
        {} as any,
      );
      expect(result).toEqual({ result: -8 });
    });

    it('should add decimals', async () => {
      const result = await calculatorTool.execute(
        { operation: 'add', a: 2.5, b: 3.7 },
        {} as any,
      );
      expect(result).toEqual({ result: 6.2 });
    });

    it('should add with zero', async () => {
      const result = await calculatorTool.execute(
        { operation: 'add', a: 5, b: 0 },
        {} as any,
      );
      expect(result).toEqual({ result: 5 });
    });
  });

  describe('subtraction', () => {
    it('should subtract two positive numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'subtract', a: 10, b: 3 },
        {} as any,
      );
      expect(result).toEqual({ result: 7 });
    });

    it('should handle negative result', async () => {
      const result = await calculatorTool.execute(
        { operation: 'subtract', a: 3, b: 10 },
        {} as any,
      );
      expect(result).toEqual({ result: -7 });
    });

    it('should subtract negative numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'subtract', a: -5, b: -3 },
        {} as any,
      );
      expect(result).toEqual({ result: -2 });
    });
  });

  describe('multiplication', () => {
    it('should multiply two positive numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'multiply', a: 4, b: 5 },
        {} as any,
      );
      expect(result).toEqual({ result: 20 });
    });

    it('should multiply with zero', async () => {
      const result = await calculatorTool.execute(
        { operation: 'multiply', a: 5, b: 0 },
        {} as any,
      );
      expect(result).toEqual({ result: 0 });
    });

    it('should multiply negative numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'multiply', a: -4, b: -5 },
        {} as any,
      );
      expect(result).toEqual({ result: 20 });
    });

    it('should multiply positive and negative', async () => {
      const result = await calculatorTool.execute(
        { operation: 'multiply', a: -4, b: 5 },
        {} as any,
      );
      expect(result).toEqual({ result: -20 });
    });
  });

  describe('division', () => {
    it('should divide two numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'divide', a: 20, b: 4 },
        {} as any,
      );
      expect(result).toEqual({ result: 5 });
    });

    it('should handle decimal results', async () => {
      const result = await calculatorTool.execute(
        { operation: 'divide', a: 7, b: 2 },
        {} as any,
      );
      expect(result).toEqual({ result: 3.5 });
    });

    it('should throw error when dividing by zero', () => {
      expect(() =>
        calculatorTool.execute({ operation: 'divide', a: 10, b: 0 }, {} as any),
      ).toThrow('Cannot divide by zero');
    });

    it('should divide negative numbers', async () => {
      const result = await calculatorTool.execute(
        { operation: 'divide', a: -20, b: -4 },
        {} as any,
      );
      expect(result).toEqual({ result: 5 });
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown operation', () => {
      expect(() =>
        calculatorTool.execute({ operation: 'modulo', a: 10, b: 3 }, {} as any),
      ).toThrow('Unknown operation: modulo');
    });
  });
});

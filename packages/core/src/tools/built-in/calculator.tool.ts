import { z } from 'zod';

import { Tool } from '../../types';

/**
 * Simple calculator tool for basic arithmetic operations
 */
export const calculatorTool: Tool = {
  name: 'calculator',
  description:
    'Perform basic arithmetic operations (add, subtract, multiply, divide)',
  parameters: z.object({
    operation: z
      .enum(['add', 'subtract', 'multiply', 'divide'])
      .describe('The arithmetic operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: (params: { operation: string; a: number; b: number }) => {
    const { operation, a, b } = params;

    switch (operation) {
      case 'add':
        return Promise.resolve({ result: a + b });
      case 'subtract':
        return Promise.resolve({ result: a - b });
      case 'multiply':
        return Promise.resolve({ result: a * b });
      case 'divide':
        if (b === 0) {
          throw new Error('Cannot divide by zero');
        }
        return Promise.resolve({ result: a / b });
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
};

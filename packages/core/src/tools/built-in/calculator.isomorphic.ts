import { z } from 'zod';

import { toolDefinition } from '../tool-definition';

/**
 * Calculator input schema
 */
const calculatorInputSchema = z.object({
  operation: z
    .enum(['add', 'subtract', 'multiply', 'divide'])
    .describe('The arithmetic operation to perform'),
  a: z.number().describe('First number'),
  b: z.number().describe('Second number'),
});

/**
 * Calculator output schema
 */
const calculatorOutputSchema = z.object({
  result: z.number().describe('The result of the calculation'),
});

/**
 * Calculator tool definition - isomorphic version
 *
 * @example
 * ```typescript
 * // Use the definition to create environment-specific implementations
 * const serverCalc = calculatorDef.server(async ({ operation, a, b }) => {
 *   // custom server logic
 * });
 *
 * // Or use the pre-built implementations
 * const tools = [calculatorServer.toTool()];
 * ```
 */
export const calculatorDef = toolDefinition({
  name: 'calculator',
  description:
    'Perform basic arithmetic operations (add, subtract, multiply, divide)',
  inputSchema: calculatorInputSchema,
  outputSchema: calculatorOutputSchema,
});

/**
 * Shared calculation logic
 */
function calculate(
  operation: string,
  a: number,
  b: number,
): { result: number } {
  switch (operation) {
    case 'add':
      return { result: a + b };
    case 'subtract':
      return { result: a - b };
    case 'multiply':
      return { result: a * b };
    case 'divide':
      if (b === 0) {
        throw new Error('Cannot divide by zero');
      }
      return { result: a / b };
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Server-side calculator implementation
 *
 * @example
 * ```typescript
 * import { calculatorServer } from '@lov3kaizen/agentsea-core';
 *
 * // Use with agent
 * const agent = new Agent({
 *   tools: [calculatorServer.toTool()],
 *   // ...
 * });
 *
 * // Or execute directly
 * const result = await calculatorServer.execute(
 *   { operation: 'add', a: 5, b: 3 },
 *   context
 * );
 * // { result: 8 }
 * ```
 */
export const calculatorServer = calculatorDef.server(
  async ({ operation, a, b }) => {
    return calculate(operation, a, b);
  },
);

/**
 * Client-side calculator implementation
 *
 * @example
 * ```typescript
 * import { calculatorClient } from '@lov3kaizen/agentsea-core';
 *
 * // Execute on the client
 * const result = await calculatorClient.execute(
 *   { operation: 'multiply', a: 4, b: 7 },
 *   context
 * );
 * // { result: 28 }
 * ```
 */
export const calculatorClient = calculatorDef.client(({ operation, a, b }) => {
  return calculate(operation, a, b);
});

/**
 * Type exports for external use
 */
export type CalculatorInput = z.infer<typeof calculatorInputSchema>;
export type CalculatorOutput = z.infer<typeof calculatorOutputSchema>;

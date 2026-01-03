/**
 * Token counting utilities using tiktoken
 */

import { get_encoding, type Tiktoken } from 'tiktoken';

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
let encoder: Tiktoken | null = null;

/**
 * Get or create the tiktoken encoder
 */
function getEncoder(): Tiktoken {
  if (!encoder) {
    // Use cl100k_base encoding (used by GPT-4, GPT-3.5-turbo, and text-embedding models)
    encoder = get_encoding('cl100k_base');
  }
  return encoder;
}

/**
 * Count tokens in a string
 */
export function countTokens(text: string): number {
  try {
    const enc = getEncoder();
    return enc.encode(text).length;
  } catch {
    // Fallback: rough estimate (4 chars per token)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in messages array
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: unknown }>,
): number {
  let total = 0;

  for (const message of messages) {
    // Add tokens for role (approximately 4 tokens per message for formatting)
    total += 4;

    // Add content tokens
    if (message.content) {
      total += countTokens(
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
      );
    }
  }

  // Add 2 tokens for the assistant reply priming
  total += 2;

  return total;
}

/**
 * Estimate tokens for a request (messages + tools)
 */
export function estimateRequestTokens(
  messages: Array<{ role: string; content: unknown }>,
  tools?: Array<{
    function: { name: string; description?: string; parameters?: unknown };
  }>,
): number {
  let total = countMessageTokens(messages);

  // Add tool definitions (rough estimate)
  if (tools && tools.length > 0) {
    for (const tool of tools) {
      total += countTokens(tool.function.name);
      if (tool.function.description) {
        total += countTokens(tool.function.description);
      }
      if (tool.function.parameters) {
        total += countTokens(JSON.stringify(tool.function.parameters));
      }
      // Add overhead per tool
      total += 10;
    }
  }

  return total;
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const enc = getEncoder();
  const tokens = enc.encode(text);

  if (tokens.length <= maxTokens) {
    return text;
  }

  const truncatedTokens = tokens.slice(0, maxTokens);
  const decoded = enc.decode(truncatedTokens);
  return new TextDecoder().decode(decoded);
}

/**
 * Free the encoder resources (call on shutdown)
 */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}

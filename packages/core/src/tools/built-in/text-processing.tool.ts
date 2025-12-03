import { z } from 'zod';

import { Tool } from '../../types';

/**
 * Text summarization tool
 */
export const textSummaryTool: Tool = {
  name: 'text_summary',
  description: 'Summarize or extract key information from text',
  parameters: z.object({
    text: z.string().describe('Text to process'),
    operation: z
      .enum([
        'word_count',
        'char_count',
        'extract_emails',
        'extract_urls',
        'extract_numbers',
      ])
      .describe('Operation to perform'),
  }),
  execute: (params: { text: string; operation: string }) => {
    switch (params.operation) {
      case 'word_count':
        return Promise.resolve({
          count: params.text.split(/\s+/).filter(Boolean).length,
          operation: 'word_count',
        });

      case 'char_count':
        return Promise.resolve({
          count: params.text.length,
          withSpaces: params.text.length,
          withoutSpaces: params.text.replace(/\s/g, '').length,
          operation: 'char_count',
        });

      case 'extract_emails': {
        const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
        return Promise.resolve({
          emails: params.text.match(emailRegex) || [],
          count: (params.text.match(emailRegex) || []).length,
          operation: 'extract_emails',
        });
      }

      case 'extract_urls': {
        const urlRegex = /https?:\/\/[^\s]+/g;
        return Promise.resolve({
          urls: params.text.match(urlRegex) || [],
          count: (params.text.match(urlRegex) || []).length,
          operation: 'extract_urls',
        });
      }

      case 'extract_numbers': {
        const numberRegex = /-?\d+\.?\d*/g;
        return Promise.resolve({
          numbers: (params.text.match(numberRegex) || []).map(Number),
          count: (params.text.match(numberRegex) || []).length,
          operation: 'extract_numbers',
        });
      }

      default:
        throw new Error(`Unknown operation: ${params.operation}`);
    }
  },
};

/**
 * String transformation tool
 */
export const stringTransformTool: Tool = {
  name: 'string_transform',
  description: 'Transform strings (uppercase, lowercase, title case, etc.)',
  parameters: z.object({
    text: z.string().describe('Text to transform'),
    operation: z
      .enum(['uppercase', 'lowercase', 'titlecase', 'reverse', 'trim', 'slug'])
      .describe('Transformation to apply'),
  }),
  execute: (params: { text: string; operation: string }) => {
    let result: string;

    switch (params.operation) {
      case 'uppercase':
        result = params.text.toUpperCase();
        break;

      case 'lowercase':
        result = params.text.toLowerCase();
        break;

      case 'titlecase':
        result = params.text
          .toLowerCase()
          .split(' ')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        break;

      case 'reverse':
        result = params.text.split('').reverse().join('');
        break;

      case 'trim':
        result = params.text.trim();
        break;

      case 'slug':
        result = params.text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
          .trim();
        break;

      default:
        throw new Error(`Unknown operation: ${params.operation}`);
    }

    return Promise.resolve({
      original: params.text,
      transformed: result,
      operation: params.operation,
    });
  },
};

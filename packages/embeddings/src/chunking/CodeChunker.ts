/**
 * CodeChunker
 *
 * Code-aware text chunking that respects programming structures.
 */

import {
  BaseChunker,
  defaultTokenCounter,
  mergeSmallChunks,
} from './BaseChunker.js';
import type {
  Chunk,
  ChunkingOptions,
  ChunkingStrategyType,
  CodeChunkingOptions,
} from '../types/index.js';

/**
 * Code block
 */
interface CodeBlock {
  type: 'function' | 'class' | 'module' | 'import' | 'comment' | 'other';
  name?: string;
  content: string;
  startPosition: number;
  language?: string;
}

/**
 * Language patterns for code splitting
 */
const LANGUAGE_PATTERNS: Record<
  string,
  {
    functionStart: RegExp;
    classStart: RegExp;
    importPattern: RegExp;
    commentPattern: RegExp;
    blockEnd: RegExp;
  }
> = {
  typescript: {
    functionStart:
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/m,
    classStart: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/m,
    importPattern: /^import\s+.*?(?:from\s+['"][^'"]+['"]|['"][^'"]+['"])/gm,
    commentPattern: /\/\*[\s\S]*?\*\/|\/\/.*/g,
    blockEnd: /^}/m,
  },
  javascript: {
    functionStart:
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/m,
    classStart: /^(?:export\s+)?class\s+(\w+)/m,
    importPattern: /^(?:import|require)\s*\(?\s*['"][^'"]+['"]\)?/gm,
    commentPattern: /\/\*[\s\S]*?\*\/|\/\/.*/g,
    blockEnd: /^}/m,
  },
  python: {
    functionStart: /^(?:async\s+)?def\s+(\w+)/m,
    classStart: /^class\s+(\w+)/m,
    importPattern: /^(?:from\s+\S+\s+)?import\s+.+$/gm,
    commentPattern: /'''[\s\S]*?'''|"""[\s\S]*?"""|#.*/g,
    blockEnd: /^(?=\S)/m, // Python uses indentation
  },
  go: {
    functionStart: /^func\s+(?:\([^)]+\)\s+)?(\w+)/m,
    classStart: /^type\s+(\w+)\s+struct/m,
    importPattern: /^import\s+(?:\([\s\S]*?\)|"[^"]+")/gm,
    commentPattern: /\/\*[\s\S]*?\*\/|\/\/.*/g,
    blockEnd: /^}/m,
  },
  rust: {
    functionStart: /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/m,
    classStart: /^(?:pub\s+)?(?:struct|impl|trait)\s+(\w+)/m,
    importPattern: /^use\s+.+;$/gm,
    commentPattern: /\/\*[\s\S]*?\*\/|\/\/.*/g,
    blockEnd: /^}/m,
  },
};

/**
 * Code-aware chunker
 */
export class CodeChunker extends BaseChunker {
  readonly strategyType: ChunkingStrategyType = 'code';

  async chunk(text: string, options?: CodeChunkingOptions): Promise<Chunk[]> {
    const opts = this.getOptions(options) as Required<CodeChunkingOptions>;
    const language = options?.language ?? this.detectLanguage(text);
    const splitBy = options?.splitBy ?? 'auto';
    const includeComments = options?.includeComments ?? true;
    const includeImports = options?.includeImports ?? true;
    const tokenCounter = opts.tokenCounter ?? defaultTokenCounter;

    // Get language patterns
    const patterns =
      LANGUAGE_PATTERNS[language] ?? LANGUAGE_PATTERNS.typescript;

    // Parse code into blocks
    const blocks = this.parseCode(text, patterns, splitBy, includeComments);

    // Extract imports
    let importBlock = '';
    if (includeImports) {
      const imports = text.match(patterns.importPattern);
      if (imports) {
        importBlock = imports.join('\n') + '\n\n';
      }
    }

    // Convert blocks to chunks
    let chunks: Chunk[] = [];

    for (const block of blocks) {
      if (block.type === 'import') continue; // Skip import blocks

      const blockContent =
        includeImports && block.type !== 'comment'
          ? importBlock + block.content
          : block.content;

      if (tokenCounter(blockContent) <= opts.chunkSize) {
        chunks.push(
          this.createChunk(
            blockContent.trim(),
            chunks.length,
            block.startPosition,
            opts,
            {
              language,
              blockType: block.type,
              blockName: block.name,
            },
          ),
        );
      } else {
        // Need to split large block
        const subChunks = this.splitLargeBlock(
          block,
          importBlock,
          opts,
          tokenCounter,
          language,
        );
        chunks.push(...subChunks);
      }
    }

    // Merge small chunks
    chunks = mergeSmallChunks(chunks, opts.minChunkSize, tokenCounter);

    // Re-index chunks
    return Promise.resolve(chunks.map((c, i) => ({ ...c, index: i })));
  }

  /**
   * Detect programming language
   */
  private detectLanguage(text: string): string {
    // Check for language hints
    if (
      text.includes('import type') ||
      text.includes(': string') ||
      text.includes('interface ')
    ) {
      return 'typescript';
    }
    if (text.includes('def ') && text.includes(':')) {
      return 'python';
    }
    if (text.includes('func ') && text.includes('package ')) {
      return 'go';
    }
    if (
      text.includes('fn ') &&
      (text.includes('let mut') || text.includes('pub fn'))
    ) {
      return 'rust';
    }
    if (
      text.includes('const ') ||
      text.includes('function ') ||
      text.includes('require(')
    ) {
      return 'javascript';
    }

    return 'typescript'; // Default
  }

  /**
   * Parse code into blocks
   */
  private parseCode(
    text: string,
    patterns: (typeof LANGUAGE_PATTERNS)[string],
    splitBy: 'function' | 'class' | 'module' | 'auto',
    includeComments: boolean,
  ): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const lines = text.split('\n');

    let currentBlock: CodeBlock | null = null;
    let braceCount = 0;
    let position = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineStart = position;
      position += line.length + 1;

      // Check for function start
      if (splitBy === 'function' || splitBy === 'auto') {
        const funcMatch = line.match(patterns.functionStart);
        if (funcMatch) {
          if (currentBlock) {
            blocks.push(currentBlock);
          }
          currentBlock = {
            type: 'function',
            name: funcMatch[1] || funcMatch[2],
            content: line + '\n',
            startPosition: lineStart,
          };
          braceCount =
            (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          continue;
        }
      }

      // Check for class start
      if (splitBy === 'class' || splitBy === 'auto') {
        const classMatch = line.match(patterns.classStart);
        if (classMatch) {
          if (currentBlock) {
            blocks.push(currentBlock);
          }
          currentBlock = {
            type: 'class',
            name: classMatch[1],
            content: line + '\n',
            startPosition: lineStart,
          };
          braceCount =
            (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          continue;
        }
      }

      // Continue current block
      if (currentBlock) {
        currentBlock.content += line + '\n';
        braceCount +=
          (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;

        // Check for block end
        if (braceCount <= 0) {
          blocks.push(currentBlock);
          currentBlock = null;
          braceCount = 0;
        }
      } else {
        // Start new "other" block
        if (line.trim()) {
          currentBlock = {
            type: 'other',
            content: line + '\n',
            startPosition: lineStart,
          };
        }
      }
    }

    // Add final block
    if (currentBlock) {
      blocks.push(currentBlock);
    }

    // Filter comments if needed
    if (!includeComments) {
      return blocks.map((block) => ({
        ...block,
        content: block.content.replace(patterns.commentPattern, ''),
      }));
    }

    return blocks;
  }

  /**
   * Split a large code block
   */
  private splitLargeBlock(
    block: CodeBlock,
    importBlock: string,
    options: Required<ChunkingOptions>,
    tokenCounter: (text: string) => number,
    language: string,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const lines = block.content.split('\n');
    let currentContent = importBlock;
    let chunkStart = block.startPosition;

    for (const line of lines) {
      const testContent = currentContent + line + '\n';

      if (
        tokenCounter(testContent) > options.chunkSize &&
        currentContent !== importBlock
      ) {
        chunks.push(
          this.createChunk(
            currentContent.trim(),
            chunks.length,
            chunkStart,
            options,
            {
              language,
              blockType: block.type,
              blockName: block.name,
              partial: true,
            },
          ),
        );

        currentContent = importBlock + line + '\n';
        chunkStart = block.startPosition + block.content.indexOf(line);
      } else {
        currentContent = testContent;
      }
    }

    // Add remaining content
    if (currentContent.trim() && currentContent !== importBlock.trim()) {
      chunks.push(
        this.createChunk(
          currentContent.trim(),
          chunks.length,
          chunkStart,
          options,
          {
            language,
            blockType: block.type,
            blockName: block.name,
            partial: chunks.length > 0,
          },
        ),
      );
    }

    return chunks;
  }
}

/**
 * Create a code chunker
 */
export function createCodeChunker(): CodeChunker {
  return new CodeChunker();
}

/**
 * MarkdownChunker
 *
 * Markdown-aware text chunking that respects document structure.
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
  MarkdownChunkingOptions,
} from '../types/index.js';

/**
 * Markdown section
 */
interface MarkdownSection {
  heading?: string;
  headingLevel: number;
  content: string;
  startPosition: number;
  path: string[];
}

/**
 * Markdown-aware chunker
 */
export class MarkdownChunker extends BaseChunker {
  readonly strategyType: ChunkingStrategyType = 'markdown';

  async chunk(
    text: string,
    options?: MarkdownChunkingOptions,
  ): Promise<Chunk[]> {
    const opts = this.getOptions(options) as Required<MarkdownChunkingOptions>;
    const preserveHeaders = options?.preserveHeaders ?? true;
    const includeHeaderHierarchy = options?.includeHeaderHierarchy ?? true;
    const headingLevels = options?.headingLevels ?? [1, 2, 3, 4, 5, 6];
    const splitCodeBlocks = options?.splitCodeBlocks ?? false;
    const tokenCounter = opts.tokenCounter ?? defaultTokenCounter;

    // Parse markdown into sections
    const sections = this.parseMarkdown(text, headingLevels);

    // Convert sections to chunks
    let chunks: Chunk[] = [];

    for (const section of sections) {
      const sectionChunks = await this.chunkSection(
        section,
        opts,
        preserveHeaders,
        includeHeaderHierarchy,
        splitCodeBlocks,
        tokenCounter,
      );
      chunks.push(...sectionChunks);
    }

    // Merge small chunks
    chunks = mergeSmallChunks(chunks, opts.minChunkSize, tokenCounter);

    // Re-index chunks
    return chunks.map((c, i) => ({ ...c, index: i }));
  }

  /**
   * Parse markdown into sections
   */
  private parseMarkdown(
    text: string,
    headingLevels: number[],
  ): MarkdownSection[] {
    const sections: MarkdownSection[] = [];
    const lines = text.split('\n');
    const headingRegex = /^(#{1,6})\s+(.+)$/;

    let currentSection: MarkdownSection = {
      headingLevel: 0,
      content: '',
      startPosition: 0,
      path: [],
    };

    const headingStack: { level: number; text: string }[] = [];
    let position = 0;

    for (const line of lines) {
      const headingMatch = line.match(headingRegex);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2];

        if (headingLevels.includes(level)) {
          // Save current section
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }

          // Update heading stack
          while (
            headingStack.length > 0 &&
            headingStack[headingStack.length - 1].level >= level
          ) {
            headingStack.pop();
          }
          headingStack.push({ level, text: headingText });

          // Start new section
          currentSection = {
            heading: headingText,
            headingLevel: level,
            content: '',
            startPosition: position,
            path: headingStack.map((h) => h.text),
          };
        } else {
          // Include heading in content
          currentSection.content += line + '\n';
        }
      } else {
        currentSection.content += line + '\n';
      }

      position += line.length + 1;
    }

    // Add final section
    if (currentSection.content.trim() || currentSection.heading) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Chunk a markdown section
   */
  private async chunkSection(
    section: MarkdownSection,
    options: Required<ChunkingOptions>,
    preserveHeaders: boolean,
    includeHeaderHierarchy: boolean,
    splitCodeBlocks: boolean,
    tokenCounter: (text: string) => number,
  ): Promise<Chunk[]> {
    const chunks: Chunk[] = [];
    let content = section.content;

    // Prepare header prefix
    let headerPrefix = '';
    if (preserveHeaders && section.heading) {
      if (includeHeaderHierarchy && section.path.length > 1) {
        headerPrefix =
          section.path.map((h, i) => '#'.repeat(i + 1) + ' ' + h).join('\n') +
          '\n\n';
      } else {
        headerPrefix =
          '#'.repeat(section.headingLevel) + ' ' + section.heading + '\n\n';
      }
    }

    // Extract code blocks if not splitting
    const codeBlocks: { placeholder: string; content: string }[] = [];
    if (!splitCodeBlocks) {
      const codeBlockRegex = /```[\s\S]*?```/g;
      let match;
      let blockIndex = 0;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        const placeholder = `__CODE_BLOCK_${blockIndex}__`;
        codeBlocks.push({ placeholder, content: match[0] });
        content = content.replace(match[0], placeholder);
        blockIndex++;
      }
    }

    // Check if section fits in one chunk
    const fullContent = headerPrefix + content;
    if (tokenCounter(fullContent) <= options.chunkSize) {
      // Restore code blocks
      let finalContent = fullContent;
      for (const block of codeBlocks) {
        finalContent = finalContent.replace(block.placeholder, block.content);
      }

      chunks.push(
        this.createChunk(
          finalContent.trim(),
          0,
          section.startPosition,
          options,
          {
            section: section.heading,
            headingLevel: section.headingLevel,
            path: section.path,
          },
        ),
      );
    } else {
      // Need to split content
      const paragraphs = content.split(/\n\n+/);
      let currentContent = headerPrefix;
      let chunkStart = section.startPosition;

      for (const paragraph of paragraphs) {
        // Restore any code blocks in paragraph
        let para = paragraph;
        for (const block of codeBlocks) {
          para = para.replace(block.placeholder, block.content);
        }

        const testContent = currentContent + para + '\n\n';

        if (
          tokenCounter(testContent) > options.chunkSize &&
          currentContent !== headerPrefix
        ) {
          // Save current chunk
          chunks.push(
            this.createChunk(
              currentContent.trim(),
              chunks.length,
              chunkStart,
              options,
              {
                section: section.heading,
                headingLevel: section.headingLevel,
                path: section.path,
              },
            ),
          );

          // Start new chunk with header
          currentContent = headerPrefix + para + '\n\n';
          chunkStart = section.startPosition + content.indexOf(paragraph);
        } else {
          currentContent = testContent;
        }
      }

      // Add remaining content
      if (currentContent.trim() && currentContent !== headerPrefix.trim()) {
        chunks.push(
          this.createChunk(
            currentContent.trim(),
            chunks.length,
            chunkStart,
            options,
            {
              section: section.heading,
              headingLevel: section.headingLevel,
              path: section.path,
            },
          ),
        );
      }
    }

    return Promise.resolve(chunks);
  }
}

/**
 * Create a markdown chunker
 */
export function createMarkdownChunker(): MarkdownChunker {
  return new MarkdownChunker();
}

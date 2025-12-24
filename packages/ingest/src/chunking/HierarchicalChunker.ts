/**
 * Hierarchical Chunker
 *
 * Heading-based hierarchical chunking strategy.
 */

import type {
  Chunk,
  HierarchicalChunkingOptions,
  Element,
} from '../types/index.js';
import { BaseChunker } from './BaseChunker.js';

/**
 * Section node for hierarchical structure
 */
interface SectionNode {
  level: number;
  heading: string;
  content: string;
  children: SectionNode[];
  path: string[];
}

/**
 * Hierarchical chunker implementation
 */
export class HierarchicalChunker extends BaseChunker {
  readonly name = 'hierarchical-chunker';
  readonly strategy = 'hierarchical' as const;

  /**
   * Chunk text based on heading hierarchy
   */
  chunk(text: string, options?: HierarchicalChunkingOptions): Chunk[] {
    const maxTokens = options?.maxTokens ?? 512;
    const headingLevels = options?.headingLevels ?? [1, 2, 3, 4, 5, 6];
    const includeParentContext = options?.includeParentContext ?? true;
    const maxDepth = options?.maxDepth ?? 6;
    const documentId = '';

    // Parse text into hierarchical sections
    const sections = this.parseHierarchy(text, headingLevels, maxDepth);

    // Flatten sections into chunks
    const chunks = this.flattenToChunks(
      sections,
      documentId,
      maxTokens,
      includeParentContext,
    );

    return chunks;
  }

  /**
   * Chunk document elements with hierarchy awareness
   */
  chunkElements(
    elements: Element[],
    options?: HierarchicalChunkingOptions,
  ): Chunk[] {
    const maxTokens = options?.maxTokens ?? 512;
    const includeParentContext = options?.includeParentContext ?? true;
    const documentId = '';

    // Build hierarchy from elements
    const sections = this.buildHierarchyFromElements(elements);

    // Flatten to chunks
    return this.flattenToChunks(
      sections,
      documentId,
      maxTokens,
      includeParentContext,
    );
  }

  /**
   * Parse text into hierarchical sections based on headings
   */
  private parseHierarchy(
    text: string,
    headingLevels: number[],
    maxDepth: number,
  ): SectionNode[] {
    const lines = text.split('\n');
    const root: SectionNode[] = [];
    const stack: SectionNode[] = [];

    // Heading patterns for markdown and common formats
    const headingPatterns = [
      {
        pattern: /^#{1,6}\s+(.+)$/,
        getLevel: (m: RegExpMatchArray) => m[0].indexOf(' '),
      },
      { pattern: /^(.+)\n={3,}$/, getLevel: () => 1 },
      { pattern: /^(.+)\n-{3,}$/, getLevel: () => 2 },
      {
        pattern: /^(\d+\.)+\s+(.+)$/,
        getLevel: (m: RegExpMatchArray) => m[0].split('.').length,
      },
    ];

    let currentContent = '';
    let lineIndex = 0;

    while (lineIndex < lines.length) {
      const line = lines[lineIndex];
      let heading: { level: number; text: string } | null = null;

      // Check for headings
      for (const { pattern, getLevel } of headingPatterns) {
        const match = line.match(pattern);
        if (match) {
          const level = getLevel(match);
          if (headingLevels.includes(level) && level <= maxDepth) {
            heading = {
              level,
              text: match[1]?.trim() || line.replace(/^#+\s*/, '').trim(),
            };
            break;
          }
        }
      }

      // Check for underlined heading (next line)
      if (!heading && lineIndex + 1 < lines.length) {
        const nextLine = lines[lineIndex + 1];
        if (/^={3,}$/.test(nextLine)) {
          heading = { level: 1, text: line.trim() };
          lineIndex++; // Skip underline
        } else if (/^-{3,}$/.test(nextLine)) {
          heading = { level: 2, text: line.trim() };
          lineIndex++;
        }
      }

      if (heading) {
        // Save current content to previous section
        if (currentContent.trim()) {
          const target = stack.length > 0 ? stack[stack.length - 1] : null;
          if (target) {
            target.content = currentContent.trim();
          }
        }

        // Create new section
        const headingLevel = heading.level;
        const path = stack
          .filter((s) => s.level < headingLevel)
          .map((s) => s.heading);
        path.push(heading.text);

        const section: SectionNode = {
          level: heading.level,
          heading: heading.text,
          content: '',
          children: [],
          path,
        };

        // Find parent in stack
        while (
          stack.length > 0 &&
          stack[stack.length - 1].level >= heading.level
        ) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].children.push(section);
        } else {
          root.push(section);
        }

        stack.push(section);
        currentContent = '';
      } else {
        currentContent += line + '\n';
      }

      lineIndex++;
    }

    // Save final content
    if (currentContent.trim() && stack.length > 0) {
      stack[stack.length - 1].content = currentContent.trim();
    } else if (currentContent.trim() && root.length === 0) {
      // No headings found - create single root section
      root.push({
        level: 0,
        heading: '',
        content: currentContent.trim(),
        children: [],
        path: [],
      });
    }

    return root;
  }

  /**
   * Build hierarchy from document elements
   */
  private buildHierarchyFromElements(elements: Element[]): SectionNode[] {
    const root: SectionNode[] = [];
    const stack: SectionNode[] = [];
    let currentContent: string[] = [];

    for (const element of elements) {
      if (element.type === 'title' || element.type === 'heading') {
        // Save current content
        if (currentContent.length > 0 && stack.length > 0) {
          stack[stack.length - 1].content = currentContent.join('\n\n');
          currentContent = [];
        }

        const level = (element.metadata?.level as number) ?? 1;
        const section: SectionNode = {
          level,
          heading: element.text,
          content: '',
          children: [],
          path: [],
        };

        // Find parent
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        // Build path
        section.path = [...stack.map((s) => s.heading), element.text];

        if (stack.length > 0) {
          stack[stack.length - 1].children.push(section);
        } else {
          root.push(section);
        }

        stack.push(section);
      } else {
        currentContent.push(element.text);
      }
    }

    // Save final content
    if (currentContent.length > 0) {
      if (stack.length > 0) {
        stack[stack.length - 1].content = currentContent.join('\n\n');
      } else if (root.length === 0) {
        root.push({
          level: 0,
          heading: '',
          content: currentContent.join('\n\n'),
          children: [],
          path: [],
        });
      }
    }

    return root;
  }

  /**
   * Flatten hierarchy into chunks
   */
  private flattenToChunks(
    sections: SectionNode[],
    documentId: string,
    maxTokens: number,
    includeParentContext: boolean,
  ): Chunk[] {
    const chunks: Chunk[] = [];

    const processSection = (
      section: SectionNode,
      parentContext: string = '',
    ) => {
      // Build chunk text
      let chunkText = '';

      if (includeParentContext && parentContext) {
        chunkText += parentContext + '\n\n';
      }

      if (section.heading) {
        chunkText += section.heading + '\n\n';
      }

      if (section.content) {
        chunkText += section.content;
      }

      // Check if chunk exceeds max tokens
      const tokens = this.tokenCounter(chunkText);

      if (tokens <= maxTokens && chunkText.trim()) {
        chunks.push(
          this.createChunk(chunkText.trim(), documentId, chunks.length, {
            sectionPath: section.path,
            custom: {
              heading: section.heading,
              level: section.level,
              hasChildren: section.children.length > 0,
            },
          }),
        );
      } else if (chunkText.trim()) {
        // Split large sections using recursive chunking
        const subChunks = this.splitLargeSection(
          chunkText,
          documentId,
          maxTokens,
          chunks.length,
          section.path,
        );
        chunks.push(...subChunks);
      }

      // Process children with context
      const contextForChildren = includeParentContext
        ? (parentContext ? parentContext + ' > ' : '') + section.heading
        : '';

      for (const child of section.children) {
        processSection(child, contextForChildren);
      }
    };

    for (const section of sections) {
      processSection(section);
    }

    // Re-index chunks
    return chunks.map((chunk, i) => ({
      ...chunk,
      metadata: { ...chunk.metadata, index: i },
    }));
  }

  /**
   * Split large sections into smaller chunks
   */
  private splitLargeSection(
    text: string,
    documentId: string,
    maxTokens: number,
    startIndex: number,
    path: string[],
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const paragraphs = text.split(/\n\n+/);
    let currentText = '';
    let index = startIndex;

    for (const paragraph of paragraphs) {
      const combined = currentText
        ? currentText + '\n\n' + paragraph
        : paragraph;
      const tokens = this.tokenCounter(combined);

      if (tokens <= maxTokens) {
        currentText = combined;
      } else {
        if (currentText.trim()) {
          chunks.push(
            this.createChunk(currentText.trim(), documentId, index++, {
              sectionPath: path,
            }),
          );
        }
        currentText = paragraph;
      }
    }

    if (currentText.trim()) {
      chunks.push(
        this.createChunk(currentText.trim(), documentId, index, {
          sectionPath: path,
        }),
      );
    }

    return chunks;
  }
}

/**
 * Create hierarchical chunker instance
 */
export function createHierarchicalChunker(): HierarchicalChunker {
  return new HierarchicalChunker();
}

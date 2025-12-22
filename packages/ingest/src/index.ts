/**
 * @lov3kaizen/agentsea-ingest
 *
 * TypeScript-native document processing pipeline for AI/RAG applications.
 *
 * Features:
 * - Multi-format parsing (PDF, DOCX, HTML, Markdown, CSV, Excel, JSON)
 * - Multiple chunking strategies (fixed, recursive, semantic, hierarchical)
 * - Table and image extraction
 * - Text cleaning and normalization
 * - Flexible pipeline architecture
 * - Streaming support
 *
 * @example
 * ```typescript
 * import { createIngester, pipelines } from '@lov3kaizen/agentsea-ingest';
 *
 * // Create an ingester with RAG-optimized settings
 * const ingester = createIngester({
 *   chunking: {
 *     strategy: 'semantic',
 *     maxTokens: 512,
 *     overlap: 50,
 *   },
 * });
 *
 * // Process a document
 * const doc = await ingester.ingestFile('./document.pdf');
 * console.log(`Created ${doc.chunks.length} chunks`);
 *
 * // Or use the pipeline builder
 * const pipeline = pipelines.rag().build();
 * const result = await pipeline.process({ path: './document.md' });
 * ```
 *
 * @packageDocumentation
 */

// Types
export * from './types/index.js';

// Core
export {
  IngestEventEmitter,
  createEventEmitter,
  ParserRegistry,
  createParserRegistry,
  ChunkerRegistry,
  createChunkerRegistry,
  Pipeline,
  createPipeline,
  PipelineBuilder,
  createPipelineBuilder,
  pipelines,
  Ingester,
  createIngester,
} from './core/index.js';

// Parsers
export {
  BaseParser,
  PDFParser,
  createPDFParser,
  DOCXParser,
  createDOCXParser,
  HTMLParser,
  createHTMLParser,
  MarkdownParser,
  createMarkdownParser,
  TextParser,
  createTextParser,
  CSVParser,
  createCSVParser,
  ExcelParser,
  createExcelParser,
  JSONParser,
  createJSONParser,
  getBuiltInParsers,
  registerBuiltInParsers,
} from './parsers/index.js';

// Chunking
export {
  BaseChunker,
  FixedChunker,
  createFixedChunker,
  RecursiveChunker,
  createRecursiveChunker,
  SentenceChunker,
  createSentenceChunker,
  ParagraphChunker,
  createParagraphChunker,
  SemanticChunker,
  createSemanticChunker,
  HierarchicalChunker,
  createHierarchicalChunker,
  getBuiltInChunkers,
  createChunker,
  registerBuiltInChunkers,
} from './chunking/index.js';

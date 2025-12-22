# @lov3kaizen/agentsea-ingest

TypeScript-native document processing pipeline for AI/RAG applications.

## Features

- **Multi-format Parsing**: PDF, DOCX, HTML, Markdown, CSV, Excel, JSON
- **Intelligent Chunking**: Fixed, recursive, sentence, paragraph, semantic, hierarchical
- **Table & Image Extraction**: Automatic extraction with metadata
- **Text Cleaning**: Normalization, deduplication, PII removal
- **Flexible Pipelines**: Configurable processing stages
- **Streaming Support**: Process large documents efficiently

## Installation

```bash
pnpm add @lov3kaizen/agentsea-ingest
```

## Quick Start

```typescript
import { createIngester, pipelines } from '@lov3kaizen/agentsea-ingest';

// Simple ingestion
const ingester = createIngester();
const doc = await ingester.ingestFile('./document.pdf');
console.log(`Extracted ${doc.chunks.length} chunks`);

// RAG-optimized pipeline
const pipeline = pipelines.rag().build();
const result = await pipeline.process({ path: './document.md' });
```

## Parsing Documents

### Supported Formats

| Format   | Parser         | MIME Types                                                              |
| -------- | -------------- | ----------------------------------------------------------------------- |
| PDF      | PDFParser      | application/pdf                                                         |
| DOCX     | DOCXParser     | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| HTML     | HTMLParser     | text/html                                                               |
| Markdown | MarkdownParser | text/markdown                                                           |
| Text     | TextParser     | text/plain                                                              |
| CSV      | CSVParser      | text/csv                                                                |
| Excel    | ExcelParser    | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet       |
| JSON     | JSONParser     | application/json                                                        |

### Direct Parser Usage

```typescript
import {
  createPDFParser,
  createMarkdownParser,
} from '@lov3kaizen/agentsea-ingest';
import { readFileSync } from 'fs';

const pdfParser = createPDFParser();
const buffer = readFileSync('./document.pdf');
const result = await pdfParser.parse(buffer);

console.log(result.text);
console.log(result.elements);
console.log(result.tables);
```

## Chunking Strategies

### Fixed Size

```typescript
import { createFixedChunker } from '@lov3kaizen/agentsea-ingest';

const chunker = createFixedChunker();
const chunks = chunker.chunk(text, {
  maxTokens: 512,
  overlap: 50,
  splitOnSentences: true,
});
```

### Recursive

```typescript
import { createRecursiveChunker } from '@lov3kaizen/agentsea-ingest';

const chunker = createRecursiveChunker();
const chunks = chunker.chunk(text, {
  maxTokens: 512,
  separators: ['\n\n', '\n', '. ', ' '],
  keepSeparator: true,
});
```

### Semantic

```typescript
import { createSemanticChunker } from '@lov3kaizen/agentsea-ingest';

const chunker = createSemanticChunker();
const chunks = await chunker.chunk(text, {
  maxTokens: 512,
  similarityThreshold: 0.5,
  embedFunction: async (text) => myEmbeddingModel(text),
});
```

### Hierarchical

```typescript
import { createHierarchicalChunker } from '@lov3kaizen/agentsea-ingest';

const chunker = createHierarchicalChunker();
const chunks = chunker.chunk(markdownText, {
  maxTokens: 512,
  headingLevels: [1, 2, 3],
  includeParentContext: true,
});
```

## Pipeline Builder

```typescript
import { createPipelineBuilder } from '@lov3kaizen/agentsea-ingest';

const pipeline = createPipelineBuilder()
  .withName('my-pipeline')
  .withStages(['load', 'parse', 'clean', 'chunk', 'embed'])
  .withChunking({
    strategy: 'semantic',
    maxTokens: 512,
    overlap: 50,
  })
  .withCleaning({
    operations: ['normalize_whitespace', 'remove_urls', 'trim'],
  })
  .withCallbacks({
    onDocumentComplete: (doc) => console.log(`Processed: ${doc.id}`),
  })
  .build();

const result = await pipeline.process({ path: './document.pdf' });
```

## Pre-built Pipelines

```typescript
import { pipelines } from '@lov3kaizen/agentsea-ingest';

// Simple text extraction
const simple = pipelines.simple().build();

// Full processing with all stages
const full = pipelines.full().build();

// RAG-optimized pipeline
const rag = pipelines.rag().build();

// Document analysis (no chunking)
const analysis = pipelines.analysis().build();

// OCR pipeline for scanned documents
const ocr = pipelines.ocr().build();
```

## Ingester

The `Ingester` class provides a high-level API for document ingestion:

```typescript
import { createIngester } from '@lov3kaizen/agentsea-ingest';

const ingester = createIngester({
  chunking: {
    strategy: 'recursive',
    maxTokens: 512,
  },
  concurrency: 4,
  fileSizeLimit: 10 * 1024 * 1024, // 10MB
});

// Ingest single file
const doc = await ingester.ingestFile('./document.pdf');

// Ingest from URL
const webDoc = await ingester.ingestUrl('https://example.com/page.html');

// Ingest from buffer
const bufferDoc = await ingester.ingestBuffer(buffer, 'document.pdf');

// Ingest directory
const results = await ingester.ingestDirectory('./documents', {
  recursive: true,
  include: ['*.pdf', '*.docx'],
  exclude: ['draft-*'],
});
```

## Watch Mode

```typescript
const ingester = createIngester({
  watchMode: {
    enabled: true,
    paths: ['./documents'],
    include: ['*.pdf', '*.md'],
    debounceDelay: 1000,
    processExisting: true,
  },
});

ingester.startWatching();
// Files added/modified in ./documents will be automatically processed
```

## Events

```typescript
const pipeline = createPipeline(config);
const emitter = pipeline.getEventEmitter();

emitter.on('document:loaded', (event) => {
  console.log(`Loaded: ${event.documentId}`);
});

emitter.on('document:chunked', (event) => {
  console.log(`Created ${event.chunkCount} chunks`);
});

emitter.on('document:completed', (event) => {
  console.log(`Completed: ${event.document.id}`);
});
```

## API Reference

### Types

- `ProcessedDocument` - Processed document with chunks and metadata
- `Chunk` - Text chunk with metadata and optional embedding
- `Element` - Document element (paragraph, heading, list, etc.)
- `TableData` - Extracted table data
- `ImageData` - Extracted image data
- `PipelineConfig` - Pipeline configuration options
- `ChunkingOptions` - Chunking configuration options

### Core Classes

- `Pipeline` - Document processing pipeline
- `PipelineBuilder` - Fluent pipeline builder
- `Ingester` - High-level document ingester
- `ParserRegistry` - Parser management
- `ChunkerRegistry` - Chunker management

### Parsers

- `PDFParser` - PDF document parsing
- `DOCXParser` - Word document parsing
- `HTMLParser` - HTML document parsing
- `MarkdownParser` - Markdown parsing
- `TextParser` - Plain text parsing
- `CSVParser` - CSV file parsing
- `ExcelParser` - Excel file parsing
- `JSONParser` - JSON file parsing

### Chunkers

- `FixedChunker` - Fixed-size chunks
- `RecursiveChunker` - Recursive splitting
- `SentenceChunker` - Sentence-based chunks
- `ParagraphChunker` - Paragraph-based chunks
- `SemanticChunker` - Semantic similarity-based
- `HierarchicalChunker` - Heading-based hierarchy

## License

MIT

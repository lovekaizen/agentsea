import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Supported file parsers
const PARSERS = {
  text: {
    name: 'Text Parser',
    extensions: ['.txt'],
    description: 'Plain text files',
  },
  markdown: {
    name: 'Markdown Parser',
    extensions: ['.md', '.mdx'],
    description: 'Markdown documents',
  },
  pdf: {
    name: 'PDF Parser',
    extensions: ['.pdf'],
    description: 'PDF documents',
  },
  html: {
    name: 'HTML Parser',
    extensions: ['.html', '.htm'],
    description: 'HTML documents',
  },
  json: {
    name: 'JSON Parser',
    extensions: ['.json'],
    description: 'JSON files',
  },
  csv: {
    name: 'CSV Parser',
    extensions: ['.csv'],
    description: 'CSV spreadsheets',
  },
  excel: {
    name: 'Excel Parser',
    extensions: ['.xlsx', '.xls'],
    description: 'Excel spreadsheets',
  },
  docx: {
    name: 'DOCX Parser',
    extensions: ['.docx'],
    description: 'Word documents',
  },
};

// Chunking strategies
const CHUNKERS = {
  fixed: {
    name: 'Fixed Size',
    description: 'Split by character count',
    config: { chunkSize: 1000, chunkOverlap: 200 },
  },
  recursive: {
    name: 'Recursive',
    description: 'Split by separators recursively',
    config: { chunkSize: 1000, separators: ['\n\n', '\n', ' '] },
  },
  paragraph: {
    name: 'Paragraph',
    description: 'Split by paragraphs',
    config: {},
  },
  sentence: {
    name: 'Sentence',
    description: 'Split by sentences',
    config: {},
  },
  semantic: {
    name: 'Semantic',
    description: 'Split by semantic boundaries',
    config: { threshold: 0.5 },
  },
  hierarchical: {
    name: 'Hierarchical',
    description: 'Create hierarchical chunks (parent-child)',
    config: { levels: ['document', 'section', 'paragraph'] },
  },
};

export interface IngestPipelineConfig {
  name: string;
  description?: string;
  parsers: string[];
  chunker: string;
  chunkConfig?: Record<string, unknown>;
  outputStore?: string;
  embeddings?: boolean;
  embeddingConfig?: string;
  metadata?: {
    extractTitles: boolean;
    extractKeywords: boolean;
    includeSource: boolean;
  };
}

/**
 * Create an ingestion pipeline
 */
export async function createPipelineCommand(): Promise<void> {
  logger.heading('Create Ingestion Pipeline');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Pipeline name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.ingestPipelines?.[input])
          return 'Pipeline with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'An ingestion pipeline',
    },
    {
      type: 'checkbox',
      name: 'parsers',
      message: 'Select file parsers:',
      choices: Object.entries(PARSERS).map(([key, parser]) => ({
        name: `${parser.name} (${parser.extensions.join(', ')}) - ${parser.description}`,
        value: key,
      })),
      validate: (input) => input.length >= 1 || 'Select at least one parser',
    },
    {
      type: 'list',
      name: 'chunker',
      message: 'Chunking strategy:',
      choices: Object.entries(CHUNKERS).map(([key, chunker]) => ({
        name: `${chunker.name} - ${chunker.description}`,
        value: key,
      })),
    },
    {
      type: 'number',
      name: 'chunkSize',
      message: 'Chunk size (characters):',
      default: 1000,
      when: (answers) => ['fixed', 'recursive'].includes(answers.chunker),
    },
    {
      type: 'number',
      name: 'chunkOverlap',
      message: 'Chunk overlap (characters):',
      default: 200,
      when: (answers) => answers.chunker === 'fixed',
    },
    {
      type: 'confirm',
      name: 'generateEmbeddings',
      message: 'Generate embeddings for chunks?',
      default: true,
    },
    {
      type: 'list',
      name: 'embeddingConfig',
      message: 'Select embedding configuration:',
      choices: () => {
        const config = configManager.getConfig();
        const configs = Object.keys(config.embeddingConfigs || {});
        if (configs.length === 0) {
          return [
            {
              name: '(No embedding configs - create one first)',
              value: undefined,
            },
          ];
        }
        return configs;
      },
      when: (answers) => answers.generateEmbeddings,
    },
    {
      type: 'confirm',
      name: 'extractTitles',
      message: 'Extract document titles?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'extractKeywords',
      message: 'Extract keywords from content?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'includeSource',
      message: 'Include source file path in metadata?',
      default: true,
    },
  ]);

  // Build chunk config
  const chunkConfig: Record<string, unknown> = {};
  if (answers.chunkSize) chunkConfig.chunkSize = answers.chunkSize;
  if (answers.chunkOverlap) chunkConfig.chunkOverlap = answers.chunkOverlap;

  const pipelineConfig: IngestPipelineConfig = {
    name: answers.name,
    description: answers.description,
    parsers: answers.parsers,
    chunker: answers.chunker,
    chunkConfig: Object.keys(chunkConfig).length > 0 ? chunkConfig : undefined,
    embeddings: answers.generateEmbeddings,
    embeddingConfig: answers.embeddingConfig,
    metadata: {
      extractTitles: answers.extractTitles,
      extractKeywords: answers.extractKeywords,
      includeSource: answers.includeSource,
    },
  };

  // Save configuration
  const config = configManager.getConfig();
  if (!config.ingestPipelines) {
    config.ingestPipelines = {};
  }
  config.ingestPipelines[answers.name] = pipelineConfig;
  configManager.setConfig(config);

  logger.success(`Ingestion pipeline "${answers.name}" created`);
}

/**
 * List ingestion pipelines
 */
export function listPipelinesCommand(): void {
  const config = configManager.getConfig();
  const pipelines = config.ingestPipelines || {};

  if (Object.keys(pipelines).length === 0) {
    logger.warn('No ingestion pipelines configured');
    logger.info('Run `sea ingest create` to create a pipeline');
    return;
  }

  logger.heading('Ingestion Pipelines');

  const data = [
    ['Name', 'Parsers', 'Chunker', 'Embeddings', 'Description'],
    ...(Object.values(pipelines) as IngestPipelineConfig[]).map((pipeline) => [
      pipeline.name,
      pipeline.parsers.length.toString(),
      pipeline.chunker,
      pipeline.embeddings ? 'Yes' : 'No',
      pipeline.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get pipeline details
 */
export function getPipelineCommand(name: string): void {
  const config = configManager.getConfig();
  const pipeline = config.ingestPipelines?.[name] as
    | IngestPipelineConfig
    | undefined;

  if (!pipeline) {
    logger.error(`Pipeline "${name}" not found`);
    return;
  }

  const chunker = CHUNKERS[pipeline.chunker as keyof typeof CHUNKERS];

  logger.heading(`Ingestion Pipeline: ${pipeline.name}`);
  logger.keyValue('Description', pipeline.description || '-');
  logger.keyValue('Chunking Strategy', chunker?.name || pipeline.chunker);
  logger.keyValue('Generate Embeddings', pipeline.embeddings ? 'Yes' : 'No');
  logger.keyValue('Embedding Config', pipeline.embeddingConfig || '-');

  logger.blank();
  logger.subheading('Parsers');
  pipeline.parsers.forEach((parserId) => {
    const parser = PARSERS[parserId as keyof typeof PARSERS];
    console.log(
      chalk.green(`  ✓ ${parser?.name || parserId}`) +
        chalk.gray(` (${parser?.extensions.join(', ') || ''})`),
    );
  });

  if (pipeline.chunkConfig && Object.keys(pipeline.chunkConfig).length > 0) {
    logger.blank();
    logger.subheading('Chunk Configuration');
    Object.entries(pipeline.chunkConfig).forEach(([key, value]) => {
      logger.keyValue(key, String(value));
    });
  }

  if (pipeline.metadata) {
    logger.blank();
    logger.subheading('Metadata Extraction');
    logger.keyValue(
      'Extract Titles',
      pipeline.metadata.extractTitles ? 'Yes' : 'No',
    );
    logger.keyValue(
      'Extract Keywords',
      pipeline.metadata.extractKeywords ? 'Yes' : 'No',
    );
    logger.keyValue(
      'Include Source',
      pipeline.metadata.includeSource ? 'Yes' : 'No',
    );
  }
}

/**
 * Delete a pipeline
 */
export async function deletePipelineCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.ingestPipelines?.[name]) {
    logger.error(`Pipeline "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete pipeline "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.ingestPipelines[name];
  configManager.setConfig(config);
  logger.success(`Pipeline "${name}" deleted`);
}

/**
 * Show available parsers
 */
export function showParsersCommand(): void {
  logger.heading('Available Parsers');

  const data = [
    ['Parser', 'Extensions', 'Description'],
    ...Object.entries(PARSERS).map(([_key, parser]) => [
      parser.name,
      parser.extensions.join(', '),
      parser.description,
    ]),
  ];

  console.log(table(data));
}

/**
 * Show chunking strategies
 */
export function showChunkersCommand(): void {
  logger.heading('Chunking Strategies');
  logger.blank();

  Object.entries(CHUNKERS).forEach(([key, chunker]) => {
    console.log(chalk.bold.cyan(`  ${chunker.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${chunker.description}`));
    logger.blank();
  });
}

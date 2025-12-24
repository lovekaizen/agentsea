import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Embedding providers
const EMBEDDING_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    description: 'OpenAI text-embedding models',
    models: [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002',
    ],
    requiresApiKey: true,
  },
  cohere: {
    name: 'Cohere',
    description: 'Cohere embed models',
    models: [
      'embed-english-v3.0',
      'embed-multilingual-v3.0',
      'embed-english-light-v3.0',
    ],
    requiresApiKey: true,
  },
  voyage: {
    name: 'Voyage AI',
    description: 'Voyage embedding models',
    models: ['voyage-large-2', 'voyage-code-2', 'voyage-2'],
    requiresApiKey: true,
  },
  huggingface: {
    name: 'HuggingFace',
    description: 'HuggingFace Inference API',
    models: [
      'sentence-transformers/all-MiniLM-L6-v2',
      'BAAI/bge-small-en-v1.5',
    ],
    requiresApiKey: true,
  },
  local: {
    name: 'Local',
    description: 'Local embedding model via ONNX',
    models: ['all-MiniLM-L6-v2', 'all-mpnet-base-v2'],
    requiresApiKey: false,
  },
};

// Vector stores
const VECTOR_STORES = {
  memory: {
    name: 'In-Memory',
    description: 'Simple in-memory vector store',
  },
  chroma: {
    name: 'Chroma',
    description: 'Open-source embedding database',
  },
  pinecone: {
    name: 'Pinecone',
    description: 'Managed vector database',
  },
  qdrant: {
    name: 'Qdrant',
    description: 'High-performance vector search engine',
  },
};

// Chunking strategies
const CHUNKING_STRATEGIES = [
  {
    name: 'Fixed Size',
    value: 'fixed',
    description: 'Split by character count',
  },
  {
    name: 'Recursive',
    value: 'recursive',
    description: 'Recursively split by separators',
  },
  {
    name: 'Semantic',
    value: 'semantic',
    description: 'Split by semantic boundaries',
  },
  { name: 'Sentence', value: 'sentence', description: 'Split by sentences' },
  {
    name: 'Code',
    value: 'code',
    description: 'Split code by functions/classes',
  },
  {
    name: 'Markdown',
    value: 'markdown',
    description: 'Split by markdown structure',
  },
];

export interface EmbeddingConfig {
  name: string;
  provider: string;
  model: string;
  store: string;
  chunking: string;
  dimensions?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  apiKey?: string;
  storeConfig?: Record<string, unknown>;
}

interface EmbeddingAnswers {
  name: string;
  provider: string;
  model: string;
  apiKey?: string;
  store: string;
  chunking: string;
  chunkSize: number;
  chunkOverlap: number;
  chromaUrl?: string;
  pineconeApiKey?: string;
  pineconeIndex?: string;
  qdrantUrl?: string;
}

/**
 * Create an embedding configuration
 */
export async function createEmbeddingConfigCommand(): Promise<void> {
  logger.heading('Create Embedding Configuration');

  const answers = await inquirer.prompt<EmbeddingAnswers>([
    {
      type: 'input',
      name: 'name',
      message: 'Configuration name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.embeddingConfigs?.[input])
          return 'Configuration with this name already exists';
        return true;
      },
    },
    {
      type: 'list',
      name: 'provider',
      message: 'Embedding provider:',
      choices: Object.entries(EMBEDDING_PROVIDERS).map(([key, provider]) => ({
        name: `${provider.name} - ${provider.description}`,
        value: key,
      })),
    },
    {
      type: 'list',
      name: 'model',
      message: 'Embedding model:',
      choices: (answers: { provider: string }) => {
        const provider =
          EMBEDDING_PROVIDERS[
            answers.provider as keyof typeof EMBEDDING_PROVIDERS
          ];
        return provider.models;
      },
    },
    {
      type: 'password',
      name: 'apiKey',
      message: (answers: { provider: string }) =>
        `Enter your ${EMBEDDING_PROVIDERS[answers.provider as keyof typeof EMBEDDING_PROVIDERS].name} API key:`,
      when: (answers) =>
        EMBEDDING_PROVIDERS[
          answers.provider as keyof typeof EMBEDDING_PROVIDERS
        ].requiresApiKey,
    },
    {
      type: 'list',
      name: 'store',
      message: 'Vector store:',
      choices: Object.entries(VECTOR_STORES).map(([key, store]) => ({
        name: `${store.name} - ${store.description}`,
        value: key,
      })),
    },
    {
      type: 'list',
      name: 'chunking',
      message: 'Chunking strategy:',
      choices: CHUNKING_STRATEGIES.map((s) => ({
        name: `${s.name} - ${s.description}`,
        value: s.value,
      })),
    },
    {
      type: 'number',
      name: 'chunkSize',
      message: 'Chunk size (characters):',
      default: 1000,
    },
    {
      type: 'number',
      name: 'chunkOverlap',
      message: 'Chunk overlap (characters):',
      default: 200,
    },
    // Store-specific config
    {
      type: 'input',
      name: 'chromaUrl',
      message: 'Chroma server URL:',
      default: 'http://localhost:8000',
      when: (answers) => answers.store === 'chroma',
    },
    {
      type: 'input',
      name: 'pineconeApiKey',
      message: 'Pinecone API key:',
      when: (answers) => answers.store === 'pinecone',
    },
    {
      type: 'input',
      name: 'pineconeIndex',
      message: 'Pinecone index name:',
      when: (answers) => answers.store === 'pinecone',
    },
    {
      type: 'input',
      name: 'qdrantUrl',
      message: 'Qdrant URL:',
      default: 'http://localhost:6333',
      when: (answers) => answers.store === 'qdrant',
    },
  ]);

  // Build store config
  let storeConfig: Record<string, unknown> = {};
  switch (answers.store) {
    case 'chroma':
      storeConfig = { url: answers.chromaUrl };
      break;
    case 'pinecone':
      storeConfig = {
        apiKey: answers.pineconeApiKey,
        indexName: answers.pineconeIndex,
      };
      break;
    case 'qdrant':
      storeConfig = { url: answers.qdrantUrl };
      break;
  }

  const embeddingConfig: EmbeddingConfig = {
    name: answers.name,
    provider: answers.provider,
    model: answers.model,
    store: answers.store,
    chunking: answers.chunking,
    chunkSize: answers.chunkSize,
    chunkOverlap: answers.chunkOverlap,
    apiKey: answers.apiKey,
    storeConfig,
  };

  // Save configuration
  const config = configManager.getConfig();
  if (!config.embeddingConfigs) {
    config.embeddingConfigs = {};
  }
  config.embeddingConfigs[answers.name] = embeddingConfig;
  configManager.setConfig(config);

  logger.success(`Embedding configuration "${answers.name}" created`);
}

/**
 * List embedding configurations
 */
export function listEmbeddingConfigsCommand(): void {
  const config = configManager.getConfig();
  const configs = config.embeddingConfigs || {};

  if (Object.keys(configs).length === 0) {
    logger.warn('No embedding configurations');
    logger.info('Run `sea embeddings create` to create a configuration');
    return;
  }

  logger.heading('Embedding Configurations');

  const data = [
    ['Name', 'Provider', 'Model', 'Store', 'Chunking'],
    ...(Object.values(configs) as EmbeddingConfig[]).map((cfg) => [
      cfg.name,
      cfg.provider,
      cfg.model,
      cfg.store,
      cfg.chunking,
    ]),
  ];

  console.log(table(data));
}

/**
 * Get embedding configuration details
 */
export function getEmbeddingConfigCommand(name: string): void {
  const config = configManager.getConfig();
  const embConfig = config.embeddingConfigs?.[name] as
    | EmbeddingConfig
    | undefined;

  if (!embConfig) {
    logger.error(`Embedding configuration "${name}" not found`);
    return;
  }

  const provider =
    EMBEDDING_PROVIDERS[embConfig.provider as keyof typeof EMBEDDING_PROVIDERS];
  const store = VECTOR_STORES[embConfig.store as keyof typeof VECTOR_STORES];

  logger.heading(`Embedding Configuration: ${embConfig.name}`);
  logger.keyValue('Provider', provider?.name || embConfig.provider);
  logger.keyValue('Model', embConfig.model);
  logger.keyValue('Vector Store', store?.name || embConfig.store);
  logger.keyValue('Chunking Strategy', embConfig.chunking);
  logger.keyValue('Chunk Size', embConfig.chunkSize?.toString() || '-');
  logger.keyValue('Chunk Overlap', embConfig.chunkOverlap?.toString() || '-');
  logger.keyValue('API Key', embConfig.apiKey ? '****' : 'Not set');

  if (embConfig.storeConfig && Object.keys(embConfig.storeConfig).length > 0) {
    logger.blank();
    logger.subheading('Store Configuration');
    Object.entries(embConfig.storeConfig).forEach(([key, value]) => {
      if (key.toLowerCase().includes('key')) {
        logger.keyValue(key, '****');
      } else {
        logger.keyValue(key, String(value));
      }
    });
  }
}

/**
 * Delete an embedding configuration
 */
export async function deleteEmbeddingConfigCommand(
  name: string,
): Promise<void> {
  const config = configManager.getConfig();

  if (!config.embeddingConfigs?.[name]) {
    logger.error(`Embedding configuration "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete embedding configuration "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.embeddingConfigs[name];
  configManager.setConfig(config);
  logger.success(`Embedding configuration "${name}" deleted`);
}

/**
 * Show available providers
 */
export function showProvidersCommand(): void {
  logger.heading('Embedding Providers');
  logger.blank();

  Object.entries(EMBEDDING_PROVIDERS).forEach(([key, provider]) => {
    console.log(chalk.bold.cyan(`  ${provider.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${provider.description}`));
    console.log(
      chalk.yellow(
        `    Requires API Key: ${provider.requiresApiKey ? 'Yes' : 'No'}`,
      ),
    );
    console.log(chalk.gray(`    Models: ${provider.models.join(', ')}`));
    logger.blank();
  });
}

/**
 * Show available vector stores
 */
export function showStoresCommand(): void {
  logger.heading('Vector Stores');
  logger.blank();

  Object.entries(VECTOR_STORES).forEach(([key, store]) => {
    console.log(chalk.bold.cyan(`  ${store.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${store.description}`));
    logger.blank();
  });
}

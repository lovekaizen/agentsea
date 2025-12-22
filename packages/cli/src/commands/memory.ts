import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Available memory store types
const STORE_TYPES = {
  'in-memory': {
    name: 'In-Memory Store',
    description: 'Fast ephemeral storage, cleared on restart',
    config: { maxEntries: 10000 },
  },
  sqlite: {
    name: 'SQLite Store',
    description: 'Persistent local storage using SQLite',
    config: { path: './memory.db' },
  },
  postgres: {
    name: 'PostgreSQL Store',
    description: 'Scalable persistent storage',
    config: { connectionString: 'postgresql://localhost:5432/agentsea' },
  },
  redis: {
    name: 'Redis Store',
    description: 'High-performance distributed storage',
    config: { url: 'redis://localhost:6379' },
  },
};

// Memory structure types
const MEMORY_STRUCTURES = [
  {
    name: 'Working Memory',
    value: 'working',
    description: 'Short-term attention-based memory',
  },
  {
    name: 'Episodic Memory',
    value: 'episodic',
    description: 'Event-based memory with temporal context',
  },
  {
    name: 'Semantic Memory',
    value: 'semantic',
    description: 'Knowledge and concept storage',
  },
  {
    name: 'Long-Term Memory',
    value: 'long-term',
    description: 'Consolidated persistent memory',
  },
  {
    name: 'Hierarchical Memory',
    value: 'hierarchical',
    description: 'Multi-level organized memory',
  },
];

// Retrieval strategies
const RETRIEVAL_STRATEGIES = [
  {
    name: 'Semantic',
    value: 'semantic',
    description: 'Similarity-based retrieval',
  },
  { name: 'Temporal', value: 'temporal', description: 'Time-based retrieval' },
  {
    name: 'Hybrid',
    value: 'hybrid',
    description: 'Combined semantic and temporal',
  },
];

export interface MemoryStoreConfig {
  name: string;
  type: string;
  description?: string;
  config: Record<string, unknown>;
  structure?: string;
  retrieval?: string;
}

/**
 * Create a new memory store
 */
export async function createMemoryStoreCommand(): Promise<void> {
  logger.heading('Create Memory Store');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Store name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.memoryStores?.[input])
          return 'Store with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Store description:',
      default: 'A memory store',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Store type:',
      choices: Object.entries(STORE_TYPES).map(([key, store]) => ({
        name: `${store.name} - ${store.description}`,
        value: key,
      })),
    },
    {
      type: 'list',
      name: 'structure',
      message: 'Memory structure:',
      choices: MEMORY_STRUCTURES.map((s) => ({
        name: `${s.name} - ${s.description}`,
        value: s.value,
      })),
    },
    {
      type: 'list',
      name: 'retrieval',
      message: 'Retrieval strategy:',
      choices: RETRIEVAL_STRATEGIES.map((s) => ({
        name: `${s.name} - ${s.description}`,
        value: s.value,
      })),
    },
    // Store-specific configuration
    {
      type: 'input',
      name: 'sqlitePath',
      message: 'SQLite database path:',
      default: './memory.db',
      when: (answers) => answers.type === 'sqlite',
    },
    {
      type: 'input',
      name: 'postgresUrl',
      message: 'PostgreSQL connection string:',
      default: 'postgresql://localhost:5432/agentsea',
      when: (answers) => answers.type === 'postgres',
    },
    {
      type: 'input',
      name: 'redisUrl',
      message: 'Redis URL:',
      default: 'redis://localhost:6379',
      when: (answers) => answers.type === 'redis',
    },
    {
      type: 'number',
      name: 'maxEntries',
      message: 'Maximum entries (in-memory):',
      default: 10000,
      when: (answers) => answers.type === 'in-memory',
    },
  ]);

  // Build store config
  let storeConfig: Record<string, unknown> = {};
  switch (answers.type) {
    case 'sqlite':
      storeConfig = { path: answers.sqlitePath };
      break;
    case 'postgres':
      storeConfig = { connectionString: answers.postgresUrl };
      break;
    case 'redis':
      storeConfig = { url: answers.redisUrl };
      break;
    case 'in-memory':
      storeConfig = { maxEntries: answers.maxEntries };
      break;
  }

  const memoryConfig: MemoryStoreConfig = {
    name: answers.name,
    type: answers.type,
    description: answers.description,
    config: storeConfig,
    structure: answers.structure,
    retrieval: answers.retrieval,
  };

  // Save store configuration
  const config = configManager.getConfig();
  if (!config.memoryStores) {
    config.memoryStores = {};
  }
  config.memoryStores[answers.name] = memoryConfig;
  configManager.setConfig(config);

  logger.success(`Memory store "${answers.name}" created`);
}

/**
 * List all memory stores
 */
export function listMemoryStoresCommand(): void {
  const config = configManager.getConfig();
  const stores = config.memoryStores || {};

  if (Object.keys(stores).length === 0) {
    logger.warn('No memory stores configured');
    logger.info('Run `sea memory create` to create a store');
    return;
  }

  logger.heading('Configured Memory Stores');

  const data = [
    ['Name', 'Type', 'Structure', 'Retrieval', 'Description'],
    ...(Object.values(stores) as MemoryStoreConfig[]).map((store) => [
      store.name,
      store.type,
      store.structure || '-',
      store.retrieval || '-',
      store.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get details of a memory store
 */
export function getMemoryStoreCommand(name: string): void {
  const config = configManager.getConfig();
  const store = config.memoryStores?.[name] as MemoryStoreConfig | undefined;

  if (!store) {
    logger.error(`Memory store "${name}" not found`);
    return;
  }

  logger.heading(`Memory Store: ${store.name}`);
  logger.keyValue(
    'Type',
    STORE_TYPES[store.type as keyof typeof STORE_TYPES]?.name || store.type,
  );
  logger.keyValue('Description', store.description || '-');
  logger.keyValue('Structure', store.structure || '-');
  logger.keyValue('Retrieval Strategy', store.retrieval || '-');

  logger.blank();
  logger.subheading('Configuration');
  Object.entries(store.config).forEach(([key, value]) => {
    logger.keyValue(key, String(value));
  });
}

/**
 * Delete a memory store
 */
export async function deleteMemoryStoreCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.memoryStores?.[name]) {
    logger.error(`Memory store "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete memory store "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.memoryStores[name];
  configManager.setConfig(config);
  logger.success(`Memory store "${name}" deleted`);
}

/**
 * Show available store types
 */
export function showStoreTypesCommand(): void {
  logger.heading('Memory Store Types');
  logger.blank();

  Object.entries(STORE_TYPES).forEach(([key, store]) => {
    console.log(chalk.bold.cyan(`  ${store.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${store.description}`));
    logger.blank();
  });
}

/**
 * Show memory structures
 */
export function showStructuresCommand(): void {
  logger.heading('Memory Structures');
  logger.blank();

  MEMORY_STRUCTURES.forEach((structure) => {
    console.log(chalk.bold.cyan(`  ${structure.name}`));
    console.log(chalk.gray(`    ID: ${structure.value}`));
    console.log(chalk.white(`    ${structure.description}`));
    logger.blank();
  });
}

/**
 * Show retrieval strategies
 */
export function showRetrievalStrategiesCommand(): void {
  logger.heading('Retrieval Strategies');
  logger.blank();

  RETRIEVAL_STRATEGIES.forEach((strategy) => {
    console.log(chalk.bold.cyan(`  ${strategy.name}`));
    console.log(chalk.gray(`    ID: ${strategy.value}`));
    console.log(chalk.white(`    ${strategy.description}`));
    logger.blank();
  });
}

import inquirer from 'inquirer';
import { table } from 'table';

import { configManager, ProviderConfig } from '../config/manager';
import { logger } from '../utils/logger';

/**
 * List all configured providers
 */
export function listProvidersCommand(): void {
  const providers = configManager.getAllProviders();
  const defaultProvider = configManager.getDefaultProvider();

  if (Object.keys(providers).length === 0) {
    logger.warn('No providers configured');
    logger.info('Run `agentsea init` to configure a provider');
    return;
  }

  logger.heading('Configured Providers');

  const data = [
    ['Name', 'Type', 'Base URL', 'Default'],
    ...Object.values(providers).map((provider) => [
      provider.name,
      provider.type,
      provider.baseUrl || '-',
      provider.name === defaultProvider ? '✓' : '',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get details of a specific provider
 */
export function getProviderCommand(name: string): void {
  const provider = configManager.getProvider(name);

  if (!provider) {
    logger.error(`Provider "${name}" not found`);
    return;
  }

  logger.heading(`Provider: ${provider.name}`);
  logger.keyValue('Type', provider.type);
  logger.keyValue('Base URL', provider.baseUrl || '-');
  logger.keyValue('Timeout', provider.timeout ? `${provider.timeout}ms` : '-');
  logger.keyValue('API Key', provider.apiKey ? '********' : '-');

  const defaultProvider = configManager.getDefaultProvider();
  if (provider.name === defaultProvider) {
    logger.blank();
    logger.info('This is the default provider');
  }
}

/**
 * Add a new provider
 */
export async function addProviderCommand(): Promise<void> {
  logger.heading('Add New Provider');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Provider name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        if (configManager.getProvider(input)) {
          return 'Provider with this name already exists';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'type',
      message: 'Provider type:',
      choices: [
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
        { name: 'Google (Gemini)', value: 'gemini' },
        { name: 'Ollama', value: 'ollama' },
        {
          name: 'OpenAI-Compatible (LM Studio, LocalAI, etc.)',
          value: 'openai-compatible',
        },
      ],
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'API Key:',
      when: (answers) =>
        ['anthropic', 'openai', 'gemini'].includes(answers.type),
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL:',
      default: (answers: any) => {
        if (answers.type === 'ollama') return 'http://localhost:11434';
        if (answers.type === 'openai-compatible')
          return 'http://localhost:1234';
        return '';
      },
      when: (answers) => ['ollama', 'openai-compatible'].includes(answers.type),
    },
    {
      type: 'number',
      name: 'timeout',
      message: 'Timeout (ms):',
      default: 60000,
    },
    {
      type: 'confirm',
      name: 'setDefault',
      message: 'Set as default provider?',
      default: false,
    },
  ]);

  const providerConfig: ProviderConfig = {
    name: answers.name,
    type: answers.type,
    apiKey: answers.apiKey,
    baseUrl: answers.baseUrl,
    timeout: answers.timeout,
  };

  configManager.setProvider(answers.name, providerConfig);
  logger.success(`Provider "${answers.name}" added`);

  if (answers.setDefault) {
    configManager.setDefaultProvider(answers.name);
    logger.success(`Set "${answers.name}" as default provider`);
  }
}

/**
 * Delete a provider
 */
export async function deleteProviderCommand(name: string): Promise<void> {
  const provider = configManager.getProvider(name);

  if (!provider) {
    logger.error(`Provider "${name}" not found`);
    return;
  }

  // Check if any agents use this provider
  const agents = configManager.getAllAgents();
  const dependentAgents = Object.values(agents).filter(
    (agent) => agent.provider === name,
  );

  if (dependentAgents.length > 0) {
    logger.warn(
      `The following agents use this provider: ${dependentAgents.map((a) => a.name).join(', ')}`,
    );
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete provider "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  configManager.deleteProvider(name);
  logger.success(`Provider "${name}" deleted`);

  // If it was the default provider, clear the default
  if (configManager.getDefaultProvider() === name) {
    configManager.setDefaultProvider('');
    logger.info('Default provider cleared');
  }
}

/**
 * Set default provider
 */
export function setDefaultProviderCommand(name: string): void {
  const provider = configManager.getProvider(name);

  if (!provider) {
    logger.error(`Provider "${name}" not found`);
    return;
  }

  configManager.setDefaultProvider(name);
  logger.success(`Set "${name}" as default provider`);
}

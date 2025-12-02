import { OllamaProvider } from '@lov3kaizen/agentsea-core';
import ora from 'ora';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

/**
 * List available models from Ollama
 */
export async function listModelsCommand(providerName?: string): Promise<void> {
  // Get provider
  const name = providerName || configManager.getDefaultProvider();

  if (!name) {
    logger.error('No provider specified and no default provider configured');
    logger.info('Specify a provider: agentsea model list --provider <name>');
    return;
  }

  const providerConfig = configManager.getProvider(name);

  if (!providerConfig) {
    logger.error(`Provider "${name}" not found`);
    return;
  }

  // Only Ollama supports listing models currently
  if (providerConfig.type !== 'ollama') {
    logger.error('Model listing is only supported for Ollama providers');
    logger.info(
      'For other providers, refer to their documentation for available models',
    );
    return;
  }

  const spinner = ora('Fetching models...').start();

  try {
    const provider = new OllamaProvider({
      baseUrl: providerConfig.baseUrl,
    });

    const models = await provider.listModels();

    spinner.stop();

    if (models.length === 0) {
      logger.warn('No models found');
      logger.info('Pull a model: agentsea model pull llama2');
      return;
    }

    logger.heading(`Available Models (${providerConfig.name})`);

    const data = [['Model Name'], ...models.map((model) => [model])];

    console.log(table(data));

    logger.blank();
    logger.info(`Total models: ${models.length}`);
  } catch (error) {
    spinner.stop();
    logger.error('Failed to list models', error as Error);
    logger.info('Make sure Ollama is running: ollama serve');
  }
}

/**
 * Pull a model from Ollama
 */
export async function pullModelCommand(
  modelName: string,
  providerName?: string,
): Promise<void> {
  // Get provider
  const name = providerName || configManager.getDefaultProvider();

  if (!name) {
    logger.error('No provider specified and no default provider configured');
    logger.info(
      'Specify a provider: agentsea model pull <model> --provider <name>',
    );
    return;
  }

  const providerConfig = configManager.getProvider(name);

  if (!providerConfig) {
    logger.error(`Provider "${name}" not found`);
    return;
  }

  // Only Ollama supports pulling models
  if (providerConfig.type !== 'ollama') {
    logger.error('Model pulling is only supported for Ollama providers');
    logger.info('For other providers, refer to their documentation');
    return;
  }

  const spinner = ora(`Pulling model "${modelName}"...`).start();

  try {
    const provider = new OllamaProvider({
      baseUrl: providerConfig.baseUrl,
    });

    await provider.pullModel(modelName);

    spinner.stop();
    logger.success(`Model "${modelName}" pulled successfully`);
    logger.info(`You can now use this model in your agents`);
  } catch (error) {
    spinner.stop();
    logger.error('Failed to pull model', error as Error);
    logger.info('Make sure Ollama is running: ollama serve');
    logger.info(
      `Check if the model exists: https://ollama.ai/library/${modelName}`,
    );
  }
}

/**
 * Show popular models
 */
export function showPopularModelsCommand(): void {
  logger.heading('Popular Ollama Models');

  logger.subheading('General Purpose');
  logger.listItem("llama2 (7B, 13B, 70B) - Meta's Llama 2");
  logger.listItem("llama3 (8B, 70B) - Meta's Llama 3 (improved)");
  logger.listItem('mistral (7B) - Excellent quality-to-size ratio');
  logger.listItem('mixtral (8x7B) - High quality, mixture of experts');

  logger.subheading('Coding');
  logger.listItem('codellama (7B, 13B, 34B) - Specialized for code');
  logger.listItem('deepseek-coder (6.7B, 33B) - Excellent coding performance');

  logger.subheading('Fast & Lightweight');
  logger.listItem("phi (2.7B) - Microsoft's compact model");
  logger.listItem("gemma (2B, 7B) - Google's efficient models");
  logger.listItem('tinyllama (1.1B) - Very fast, limited capability');

  logger.blank();
  logger.info('To pull a model: agentsea model pull <model-name>');
  logger.info('Example: agentsea model pull llama2');
}

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
  logger.listItem("llama4 (Scout, Maverick) - Meta's Llama 4 (latest)");
  logger.listItem("llama3.3 (70B) - Meta's Llama 3.3");
  logger.listItem("llama3.2 (1B, 3B) - Meta's Llama 3.2 (lightweight)");
  logger.listItem("llama3.1 (8B, 70B, 405B) - Meta's Llama 3.1");
  logger.listItem('mistral (7B) - Excellent quality-to-size ratio');
  logger.listItem('mixtral (8x7B, 8x22B) - High quality, mixture of experts');
  logger.listItem("qwen3 (0.6B-235B) - Alibaba's Qwen 3 family");
  logger.listItem("gemma3 (1B, 4B, 12B, 27B) - Google's efficient models");

  logger.subheading('Reasoning');
  logger.listItem('deepseek-r1 (1.5B-671B) - DeepSeek R1 reasoning model');
  logger.listItem("qwq (32B) - Alibaba's reasoning model");

  logger.subheading('Coding');
  logger.listItem('devstral (24B) - Mistral coding model');
  logger.listItem("qwen2.5-coder (0.5B-32B) - Alibaba's coding model");
  logger.listItem('deepseek-coder-v2 (16B, 236B) - DeepSeek coding v2');
  logger.listItem('codellama (7B, 13B, 34B, 70B) - Meta code Llama');

  logger.subheading('Fast & Lightweight');
  logger.listItem("phi4 (14B) - Microsoft's Phi-4");
  logger.listItem("gemma3 (1B) - Google's smallest Gemma");
  logger.listItem("llama3.2 (1B) - Meta's smallest Llama");
  logger.listItem("smollm2 (135M-1.7B) - HuggingFace's tiny models");

  logger.blank();
  logger.info('To pull a model: agentsea model pull <model-name>');
  logger.info('Example: agentsea model pull llama4');
}

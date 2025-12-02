import {
  Agent,
  AnthropicProvider,
  OpenAIProvider,
  GeminiProvider,
  OllamaProvider,
  LMStudioProvider,
  LocalAIProvider,
  ToolRegistry,
  AgentContext,
} from '@lov3kaizen/agentsea-core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { table } from 'table';

import { configManager, AgentConfig } from '../config/manager';
import { logger } from '../utils/logger';

/**
 * Create a new agent
 */
export async function createAgentCommand(): Promise<void> {
  logger.heading('Create New Agent');

  const providers = configManager.getAllProviders();
  if (Object.keys(providers).length === 0) {
    logger.error('No providers configured');
    logger.info('Run `agentsea init` first to configure a provider');
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Agent name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        if (configManager.getAgent(input))
          return 'Agent with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Agent description:',
      default: 'A helpful AI assistant',
    },
    {
      type: 'list',
      name: 'provider',
      message: 'Select provider:',
      choices: Object.keys(providers),
    },
    {
      type: 'input',
      name: 'model',
      message: 'Model name:',
      default: (answers: any) => {
        const provider = providers[answers.provider];
        switch (provider.type) {
          case 'anthropic':
            return 'claude-sonnet-4-20250514';
          case 'openai':
            return 'gpt-4-turbo-preview';
          case 'gemini':
            return 'gemini-pro';
          case 'ollama':
            return 'llama2';
          default:
            return 'local-model';
        }
      },
    },
    {
      type: 'input',
      name: 'systemPrompt',
      message: 'System prompt:',
      default: 'You are a helpful AI assistant.',
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Temperature (0-1):',
      default: 0.7,
      validate: (input) => {
        if (input < 0 || input > 1)
          return 'Temperature must be between 0 and 1';
        return true;
      },
    },
    {
      type: 'number',
      name: 'maxTokens',
      message: 'Max tokens:',
      default: 2048,
    },
    {
      type: 'confirm',
      name: 'setDefault',
      message: 'Set as default agent?',
      default: false,
    },
  ]);

  const agentConfig: AgentConfig = {
    name: answers.name,
    description: answers.description,
    model: answers.model,
    provider: answers.provider,
    systemPrompt: answers.systemPrompt,
    temperature: answers.temperature,
    maxTokens: answers.maxTokens,
  };

  configManager.setAgent(answers.name, agentConfig);
  logger.success(`Agent "${answers.name}" created`);

  if (answers.setDefault) {
    configManager.setDefaultAgent(answers.name);
    logger.success(`Set "${answers.name}" as default agent`);
  }
}

/**
 * List all agents
 */
export function listAgentsCommand(): void {
  const agents = configManager.getAllAgents();
  const defaultAgent = configManager.getDefaultAgent();

  if (Object.keys(agents).length === 0) {
    logger.warn('No agents configured');
    logger.info('Run `agentsea agent create` to create an agent');
    return;
  }

  logger.heading('Configured Agents');

  const data = [
    ['Name', 'Model', 'Provider', 'Description', 'Default'],
    ...Object.values(agents).map((agent) => [
      agent.name,
      agent.model,
      agent.provider,
      agent.description || '-',
      agent.name === defaultAgent ? '✓' : '',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get details of a specific agent
 */
export function getAgentCommand(name: string): void {
  const agent = configManager.getAgent(name);

  if (!agent) {
    logger.error(`Agent "${name}" not found`);
    return;
  }

  logger.heading(`Agent: ${agent.name}`);
  logger.keyValue('Description', agent.description || '-');
  logger.keyValue('Model', agent.model);
  logger.keyValue('Provider', agent.provider);
  logger.keyValue('System Prompt', agent.systemPrompt || '-');
  logger.keyValue('Temperature', agent.temperature?.toString() || '-');
  logger.keyValue('Max Tokens', agent.maxTokens?.toString() || '-');

  const defaultAgent = configManager.getDefaultAgent();
  if (agent.name === defaultAgent) {
    logger.blank();
    logger.info('This is the default agent');
  }
}

/**
 * Delete an agent
 */
export async function deleteAgentCommand(name: string): Promise<void> {
  const agent = configManager.getAgent(name);

  if (!agent) {
    logger.error(`Agent "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete agent "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  configManager.deleteAgent(name);
  logger.success(`Agent "${name}" deleted`);

  // If it was the default agent, clear the default
  if (configManager.getDefaultAgent() === name) {
    configManager.setDefaultAgent('');
    logger.info('Default agent cleared');
  }
}

/**
 * Set default agent
 */
export function setDefaultAgentCommand(name: string): void {
  const agent = configManager.getAgent(name);

  if (!agent) {
    logger.error(`Agent "${name}" not found`);
    return;
  }

  configManager.setDefaultAgent(name);
  logger.success(`Set "${name}" as default agent`);
}

/**
 * Run an agent with a message
 */
export async function runAgentCommand(
  agentName: string,
  message: string,
  options: { verbose?: boolean },
): Promise<void> {
  // Get agent configuration
  const agentConfig = configManager.getAgent(agentName);

  if (!agentConfig) {
    logger.error(`Agent "${agentName}" not found`);
    return;
  }

  // Get provider configuration
  const providerConfig = configManager.getProvider(agentConfig.provider);

  if (!providerConfig) {
    logger.error(`Provider "${agentConfig.provider}" not found`);
    return;
  }

  // Create provider instance
  let provider;
  const apiKey = configManager.getApiKey(agentConfig.provider);

  try {
    switch (providerConfig.type) {
      case 'anthropic':
        provider = new AnthropicProvider(apiKey);
        break;
      case 'openai':
        provider = new OpenAIProvider(apiKey);
        break;
      case 'gemini':
        provider = new GeminiProvider(apiKey);
        break;
      case 'ollama':
        provider = new OllamaProvider({
          baseUrl: providerConfig.baseUrl,
          timeout: providerConfig.timeout,
        });
        break;
      case 'openai-compatible':
        if (agentConfig.provider === 'lmstudio') {
          provider = new LMStudioProvider({
            baseUrl: providerConfig.baseUrl,
          });
        } else if (agentConfig.provider === 'localai') {
          provider = new LocalAIProvider({
            baseUrl: providerConfig.baseUrl,
          });
        } else {
          throw new Error(`Unsupported provider: ${agentConfig.provider}`);
        }
        break;
      default:
        throw new Error(
          `Unknown provider type: ${String(providerConfig.type)}`,
        );
    }
  } catch (error) {
    logger.error('Failed to create provider', error as Error);
    return;
  }

  // Create agent
  const toolRegistry = new ToolRegistry();
  const agent = new Agent(
    {
      name: agentConfig.name,
      description: agentConfig.description,
      model: agentConfig.model,
      provider: providerConfig.type,
      systemPrompt: agentConfig.systemPrompt,
      temperature: agentConfig.temperature,
      maxTokens: agentConfig.maxTokens,
    },
    provider,
    toolRegistry,
  );

  // Create context
  const context: AgentContext = {
    conversationId: `run-${Date.now()}`,
    sessionData: {},
    history: [],
  };

  // Show spinner while processing
  const spinner = ora('Processing...').start();

  try {
    // Execute agent
    const response = await agent.execute(message, context);

    spinner.stop();

    // Display response
    logger.blank();
    console.log(chalk.bold.green('Response:'));
    console.log(response.content);
    logger.blank();

    // Display metadata if verbose
    if (options.verbose) {
      logger.divider();
      logger.subheading('Metadata');
      logger.keyValue('Tokens Used', response.metadata.tokensUsed.toString());
      logger.keyValue('Latency', `${response.metadata.latencyMs}ms`);
      logger.keyValue('Iterations', response.metadata.iterations.toString());
      if (response.metadata.cost) {
        logger.keyValue('Cost', `$${response.metadata.cost.toFixed(4)}`);
      }
      logger.blank();
    }
  } catch (error) {
    spinner.stop();
    logger.error('Agent execution failed', error as Error);
  }
}

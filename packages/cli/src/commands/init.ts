import { writeFileSync } from 'fs';
import { join } from 'path';

import inquirer from 'inquirer';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

interface InitAnswers {
  providerType: 'cloud' | 'local';
  cloudProvider?: 'anthropic' | 'openai' | 'gemini';
  localProvider?: 'ollama' | 'lmstudio' | 'localai';
  apiKey?: string;
  baseUrl?: string;
  createAgent: boolean;
  agentName?: string;
  agentModel?: string;
  agentSystemPrompt?: string;
}

/**
 * Initialize AgentSea CLI configuration
 */
export async function initCommand(): Promise<void> {
  logger.heading('🚀 AgentSea CLI Setup');

  // Check if already initialized
  if (configManager.isInitialized()) {
    const { override } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'override',
        message: 'Configuration already exists. Do you want to override it?',
        default: false,
      },
    ]);

    if (!override) {
      logger.info('Setup cancelled');
      return;
    }
  }

  // Ask questions
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: 'list',
      name: 'providerType',
      message: 'What type of provider do you want to use?',
      choices: [
        { name: 'Cloud Provider (Anthropic, OpenAI, Gemini)', value: 'cloud' },
        { name: 'Local Provider (Ollama, LM Studio, LocalAI)', value: 'local' },
      ],
    },
    {
      type: 'list',
      name: 'cloudProvider',
      message: 'Which cloud provider?',
      choices: [
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'OpenAI (GPT)', value: 'openai' },
        { name: 'Google (Gemini)', value: 'gemini' },
      ],
      when: (answers) => answers.providerType === 'cloud',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: (answers) => `Enter your ${answers.cloudProvider} API key:`,
      when: (answers) => answers.providerType === 'cloud',
      validate: (input) => input.length > 0 || 'API key is required',
    },
    {
      type: 'list',
      name: 'localProvider',
      message: 'Which local provider?',
      choices: [
        { name: 'Ollama (Recommended)', value: 'ollama' },
        { name: 'LM Studio', value: 'lmstudio' },
        { name: 'LocalAI', value: 'localai' },
      ],
      when: (answers) => answers.providerType === 'local',
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Enter the base URL for the local provider:',
      default: (answers: any) => {
        switch (answers.localProvider) {
          case 'ollama':
            return 'http://localhost:11434';
          case 'lmstudio':
            return 'http://localhost:1234';
          case 'localai':
            return 'http://localhost:8080';
          default:
            return '';
        }
      },
      when: (answers) => answers.providerType === 'local',
    },
    {
      type: 'confirm',
      name: 'createAgent',
      message: 'Do you want to create a default agent?',
      default: true,
    },
    {
      type: 'input',
      name: 'agentName',
      message: 'Agent name:',
      default: 'default',
      when: (answers) => answers.createAgent,
    },
    {
      type: 'input',
      name: 'agentModel',
      message: 'Model name:',
      default: (answers: any) => {
        if (answers.cloudProvider === 'anthropic')
          return 'claude-sonnet-4-20250514';
        if (answers.cloudProvider === 'openai') return 'gpt-4-turbo-preview';
        if (answers.cloudProvider === 'gemini') return 'gemini-pro';
        if (answers.localProvider === 'ollama') return 'llama2';
        return 'local-model';
      },
      when: (answers) => answers.createAgent,
    },
    {
      type: 'input',
      name: 'agentSystemPrompt',
      message: 'System prompt (optional):',
      default: 'You are a helpful AI assistant.',
      when: (answers) => answers.createAgent,
    },
  ]);

  logger.blank();
  logger.subheading('Setting up configuration...');

  // Determine provider type and name
  const providerType =
    answers.providerType === 'cloud'
      ? answers.cloudProvider!
      : answers.localProvider === 'ollama'
        ? 'ollama'
        : 'openai-compatible';

  const providerName =
    answers.providerType === 'cloud'
      ? answers.cloudProvider!
      : answers.localProvider!;

  // Save provider configuration
  configManager.setProvider(providerName, {
    name: providerName,
    type: providerType as any,
    apiKey: answers.apiKey,
    baseUrl: answers.baseUrl,
    timeout: 60000,
  });

  logger.success(`Provider "${providerName}" configured`);

  // Set as default provider
  configManager.setDefaultProvider(providerName);
  logger.success(`Set "${providerName}" as default provider`);

  // Create .env file with API key if cloud provider
  if (answers.providerType === 'cloud' && answers.apiKey) {
    const envVarName = `${answers.cloudProvider!.toUpperCase()}_API_KEY`;
    const envContent = `${envVarName}=${answers.apiKey}\n`;

    try {
      writeFileSync(join(process.cwd(), '.env'), envContent);
      logger.success('Created .env file with API key');
    } catch (error) {
      logger.warn('Could not create .env file. Please create it manually.');
    }
  }

  // Create agent if requested
  if (answers.createAgent && answers.agentName) {
    configManager.setAgent(answers.agentName, {
      name: answers.agentName,
      description: 'Default agent',
      model: answers.agentModel!,
      provider: providerName,
      systemPrompt: answers.agentSystemPrompt,
      temperature: 0.7,
      maxTokens: 2048,
    });

    logger.success(`Agent "${answers.agentName}" created`);

    // Set as default agent
    configManager.setDefaultAgent(answers.agentName);
    logger.success(`Set "${answers.agentName}" as default agent`);
  }

  logger.blank();
  logger.heading('✨ Setup Complete!');

  logger.info('Configuration saved to:');
  logger.code(`  ${configManager.getConfigPath()}`);

  logger.blank();
  logger.subheading('Next steps:');

  if (answers.providerType === 'local' && answers.localProvider === 'ollama') {
    logger.listItem('Make sure Ollama is running: ollama serve');
    logger.listItem(
      `Pull a model: ollama pull ${answers.agentModel || 'llama2'}`,
    );
  }

  logger.listItem('Start chatting: agentsea chat');
  logger.listItem(
    'Run an agent: agentsea agent run <agent-name> "Your message"',
  );
  logger.listItem('List agents: agentsea agent list');
  logger.listItem('List providers: agentsea provider list');

  if (answers.providerType === 'local' && answers.localProvider === 'ollama') {
    logger.listItem('List available models: agentsea model list');
  }

  logger.blank();
}

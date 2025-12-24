import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

export interface PromptConfig {
  name: string;
  description?: string;
  template: string;
  variables: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: string;
  }>;
  version: string;
  environment: 'development' | 'staging' | 'production';
  tags?: string[];
}

/**
 * Create a new prompt
 */
export async function createPromptCommand(): Promise<void> {
  logger.heading('Create New Prompt');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Prompt name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        if (!/^[a-z0-9-]+$/.test(input))
          return 'Name must be lowercase alphanumeric with hyphens';
        const config = configManager.getConfig();
        if (config.prompts?.[input])
          return 'Prompt with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Prompt description:',
      default: 'A prompt template',
    },
    {
      type: 'editor',
      name: 'template',
      message: 'Enter prompt template (variables use {{variable}} syntax):',
      default:
        'You are a helpful assistant.\n\n{{instructions}}\n\nUser: {{user_input}}',
    },
    {
      type: 'input',
      name: 'tags',
      message: 'Tags (comma-separated):',
      default: '',
    },
    {
      type: 'list',
      name: 'environment',
      message: 'Initial environment:',
      choices: ['development', 'staging', 'production'],
      default: 'development',
    },
  ]);

  // Parse variables from template
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables: PromptConfig['variables'] = [];
  let match: RegExpExecArray | null;
  while ((match = variableRegex.exec(answers.template)) !== null) {
    if (!variables.find((v) => v.name === match![1])) {
      variables.push({
        name: match[1],
        type: 'string',
        required: true,
      });
    }
  }

  const promptConfig: PromptConfig = {
    name: answers.name,
    description: answers.description,
    template: answers.template,
    variables,
    version: '1.0.0',
    environment: answers.environment,
    tags: answers.tags
      ? answers.tags.split(',').map((t: string) => t.trim())
      : [],
  };

  // Save prompt configuration
  const config = configManager.getConfig();
  if (!config.prompts) {
    config.prompts = {};
  }
  config.prompts[answers.name] = promptConfig;
  configManager.setConfig(config);

  logger.success(`Prompt "${answers.name}" created`);
  if (variables.length > 0) {
    logger.info(
      `Detected ${variables.length} variables: ${variables.map((v) => v.name).join(', ')}`,
    );
  }
}

/**
 * List all prompts
 */
export function listPromptsCommand(): void {
  const config = configManager.getConfig();
  const prompts = config.prompts || {};

  if (Object.keys(prompts).length === 0) {
    logger.warn('No prompts configured');
    logger.info('Run `sea prompts create` to create a prompt');
    return;
  }

  logger.heading('Configured Prompts');

  const data = [
    ['Name', 'Version', 'Environment', 'Variables', 'Tags'],
    ...(Object.values(prompts) as PromptConfig[]).map((prompt) => [
      prompt.name,
      prompt.version,
      prompt.environment,
      prompt.variables?.length?.toString() || '0',
      prompt.tags?.join(', ') || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get details of a prompt
 */
export function getPromptCommand(name: string): void {
  const config = configManager.getConfig();
  const prompt = config.prompts?.[name] as PromptConfig | undefined;

  if (!prompt) {
    logger.error(`Prompt "${name}" not found`);
    return;
  }

  logger.heading(`Prompt: ${prompt.name}`);
  logger.keyValue('Description', prompt.description || '-');
  logger.keyValue('Version', prompt.version);
  logger.keyValue('Environment', prompt.environment);
  logger.keyValue('Tags', prompt.tags?.join(', ') || '-');

  if (prompt.variables && prompt.variables.length > 0) {
    logger.blank();
    logger.subheading('Variables');
    const data = [
      ['Name', 'Type', 'Required', 'Default'],
      ...prompt.variables.map((v) => [
        v.name,
        v.type,
        v.required ? 'Yes' : 'No',
        v.default || '-',
      ]),
    ];
    console.log(table(data));
  }

  logger.blank();
  logger.subheading('Template');
  console.log(chalk.gray('─'.repeat(60)));
  console.log(prompt.template);
  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Delete a prompt
 */
export async function deletePromptCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.prompts?.[name]) {
    logger.error(`Prompt "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete prompt "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.prompts[name];
  configManager.setConfig(config);
  logger.success(`Prompt "${name}" deleted`);
}

/**
 * Render a prompt with variables
 */
export async function renderPromptCommand(name: string): Promise<void> {
  const config = configManager.getConfig();
  const prompt = config.prompts?.[name] as PromptConfig | undefined;

  if (!prompt) {
    logger.error(`Prompt "${name}" not found`);
    return;
  }

  logger.heading(`Render Prompt: ${prompt.name}`);

  // Collect variable values
  const variableValues: Record<string, string> = {};
  if (prompt.variables && prompt.variables.length > 0) {
    const answers = await inquirer.prompt(
      prompt.variables.map((v) => ({
        type: 'input',
        name: v.name,
        message: `${v.name}${v.required ? '' : ' (optional)'}:`,
        default: v.default || '',
        validate: (input: string) => {
          if (v.required && !input.trim()) return `${v.name} is required`;
          return true;
        },
      })),
    );
    Object.assign(variableValues, answers);
  }

  // Render template
  let rendered = prompt.template;
  for (const [key, value] of Object.entries(variableValues)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  logger.blank();
  logger.subheading('Rendered Output');
  console.log(chalk.gray('─'.repeat(60)));
  console.log(rendered);
  console.log(chalk.gray('─'.repeat(60)));
}

/**
 * Promote a prompt to a new environment
 */
export async function promotePromptCommand(name: string): Promise<void> {
  const config = configManager.getConfig();
  const prompt = config.prompts?.[name] as PromptConfig | undefined;

  if (!prompt) {
    logger.error(`Prompt "${name}" not found`);
    return;
  }

  const environments = ['development', 'staging', 'production'];
  const currentIndex = environments.indexOf(prompt.environment);
  const availableEnvs = environments.slice(currentIndex + 1);

  if (availableEnvs.length === 0) {
    logger.warn(`Prompt "${name}" is already in production`);
    return;
  }

  const { targetEnv } = await inquirer.prompt([
    {
      type: 'list',
      name: 'targetEnv',
      message: 'Promote to:',
      choices: availableEnvs,
    },
  ]);

  prompt.environment = targetEnv;
  if (!config.prompts) config.prompts = {};
  config.prompts[name] = prompt;
  configManager.setConfig(config);

  logger.success(`Prompt "${name}" promoted to ${targetEnv}`);
}

/**
 * Version a prompt
 */
export async function versionPromptCommand(name: string): Promise<void> {
  const config = configManager.getConfig();
  const prompt = config.prompts?.[name] as PromptConfig | undefined;

  if (!prompt) {
    logger.error(`Prompt "${name}" not found`);
    return;
  }

  const [major, minor, patch] = prompt.version.split('.').map(Number);

  const { bumpType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'bumpType',
      message: `Current version: ${prompt.version}. Bump type:`,
      choices: [
        { name: `Patch (${major}.${minor}.${patch + 1})`, value: 'patch' },
        { name: `Minor (${major}.${minor + 1}.0)`, value: 'minor' },
        { name: `Major (${major + 1}.0.0)`, value: 'major' },
      ],
    },
  ]);

  let newVersion: string;
  switch (bumpType) {
    case 'patch':
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    default:
      newVersion = prompt.version;
  }

  prompt.version = newVersion;
  if (!config.prompts) config.prompts = {};
  config.prompts[name] = prompt;
  configManager.setConfig(config);

  logger.success(`Prompt "${name}" version bumped to ${newVersion}`);
}

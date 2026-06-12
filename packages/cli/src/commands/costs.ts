import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Model pricing (per 1M tokens)
const MODEL_PRICING = {
  'claude-opus-4-8': {
    input: 5.0,
    output: 25.0,
    provider: 'anthropic',
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    provider: 'anthropic',
  },
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
    provider: 'anthropic',
  },
  'gpt-5.5': { input: 5.0, output: 30.0, provider: 'openai' },
  'gpt-5.4-mini': { input: 0.75, output: 4.5, provider: 'openai' },
  'gemini-3.1-pro-preview': { input: 2.0, output: 12.0, provider: 'google' },
  'gemini-3.5-flash': { input: 1.5, output: 9.0, provider: 'google' },
  // Legacy/retired models — kept so historical usage records still resolve
  'claude-opus-4-20250514': {
    input: 15.0,
    output: 75.0,
    provider: 'anthropic',
  },
  'claude-sonnet-4-20250514': {
    input: 3.0,
    output: 15.0,
    provider: 'anthropic',
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8,
    output: 4.0,
    provider: 'anthropic',
  },
  'gpt-4o': { input: 2.5, output: 10.0, provider: 'openai' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, provider: 'openai' },
  'gemini-1.5-pro': { input: 3.5, output: 10.5, provider: 'google' },
  'gemini-1.5-flash': { input: 0.075, output: 0.3, provider: 'google' },
};

// Alert types
const ALERT_TYPES = [
  { name: 'Email', value: 'email', description: 'Send email alerts' },
  { name: 'Webhook', value: 'webhook', description: 'POST to webhook URL' },
  { name: 'Slack', value: 'slack', description: 'Send to Slack channel' },
];

export interface BudgetConfig {
  name: string;
  description?: string;
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  perRequestLimit?: number;
  alertThreshold?: number;
  alertType?: string;
  alertConfig?: Record<string, string>;
  models?: string[];
}

/**
 * Create a budget configuration
 */
export async function createBudgetCommand(): Promise<void> {
  logger.heading('Create Budget Configuration');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Budget name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.budgets?.[input])
          return 'Budget with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'A cost budget',
    },
    {
      type: 'number',
      name: 'dailyLimit',
      message: 'Daily limit ($, 0 = none):',
      default: 0,
    },
    {
      type: 'number',
      name: 'weeklyLimit',
      message: 'Weekly limit ($, 0 = none):',
      default: 0,
    },
    {
      type: 'number',
      name: 'monthlyLimit',
      message: 'Monthly limit ($, 0 = none):',
      default: 100,
    },
    {
      type: 'number',
      name: 'perRequestLimit',
      message: 'Per-request limit ($, 0 = none):',
      default: 0,
    },
    {
      type: 'number',
      name: 'alertThreshold',
      message: 'Alert when usage reaches (%, 0 = no alerts):',
      default: 80,
    },
    {
      type: 'list',
      name: 'alertType',
      message: 'Alert method:',
      choices: [
        { name: 'None', value: undefined },
        ...ALERT_TYPES.map((a) => ({
          name: `${a.name} - ${a.description}`,
          value: a.value,
        })),
      ],
      when: (answers) => answers.alertThreshold > 0,
    },
    {
      type: 'input',
      name: 'alertEmail',
      message: 'Alert email address:',
      when: (answers) => answers.alertType === 'email',
    },
    {
      type: 'input',
      name: 'alertWebhook',
      message: 'Webhook URL:',
      when: (answers) => answers.alertType === 'webhook',
    },
    {
      type: 'input',
      name: 'alertSlack',
      message: 'Slack webhook URL:',
      when: (answers) => answers.alertType === 'slack',
    },
    {
      type: 'checkbox',
      name: 'models',
      message: 'Apply to specific models (leave empty for all):',
      choices: Object.keys(MODEL_PRICING),
    },
  ]);

  // Build alert config
  let alertConfig: Record<string, string> | undefined;
  if (answers.alertType === 'email') {
    alertConfig = { email: answers.alertEmail };
  } else if (answers.alertType === 'webhook') {
    alertConfig = { url: answers.alertWebhook };
  } else if (answers.alertType === 'slack') {
    alertConfig = { webhookUrl: answers.alertSlack };
  }

  const budgetConfig: BudgetConfig = {
    name: answers.name,
    description: answers.description,
    dailyLimit: answers.dailyLimit || undefined,
    weeklyLimit: answers.weeklyLimit || undefined,
    monthlyLimit: answers.monthlyLimit || undefined,
    perRequestLimit: answers.perRequestLimit || undefined,
    alertThreshold: answers.alertThreshold || undefined,
    alertType: answers.alertType,
    alertConfig,
    models: answers.models.length > 0 ? answers.models : undefined,
  };

  // Save configuration
  const config = configManager.getConfig();
  if (!config.budgets) {
    config.budgets = {};
  }
  config.budgets[answers.name] = budgetConfig;
  configManager.setConfig(config);

  logger.success(`Budget "${answers.name}" created`);
}

/**
 * List budget configurations
 */
export function listBudgetsCommand(): void {
  const config = configManager.getConfig();
  const budgets = config.budgets || {};

  if (Object.keys(budgets).length === 0) {
    logger.warn('No budgets configured');
    logger.info('Run `sea costs budget` to create a budget');
    return;
  }

  logger.heading('Configured Budgets');

  const data = [
    ['Name', 'Daily', 'Weekly', 'Monthly', 'Alert', 'Description'],
    ...(Object.values(budgets) as BudgetConfig[]).map((budget) => [
      budget.name,
      budget.dailyLimit ? `$${budget.dailyLimit}` : '-',
      budget.weeklyLimit ? `$${budget.weeklyLimit}` : '-',
      budget.monthlyLimit ? `$${budget.monthlyLimit}` : '-',
      budget.alertThreshold ? `${budget.alertThreshold}%` : '-',
      budget.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get budget details
 */
export function getBudgetCommand(name: string): void {
  const config = configManager.getConfig();
  const budget = config.budgets?.[name] as BudgetConfig | undefined;

  if (!budget) {
    logger.error(`Budget "${name}" not found`);
    return;
  }

  logger.heading(`Budget: ${budget.name}`);
  logger.keyValue('Description', budget.description || '-');
  logger.keyValue(
    'Daily Limit',
    budget.dailyLimit ? `$${budget.dailyLimit}` : 'None',
  );
  logger.keyValue(
    'Weekly Limit',
    budget.weeklyLimit ? `$${budget.weeklyLimit}` : 'None',
  );
  logger.keyValue(
    'Monthly Limit',
    budget.monthlyLimit ? `$${budget.monthlyLimit}` : 'None',
  );
  logger.keyValue(
    'Per-Request Limit',
    budget.perRequestLimit ? `$${budget.perRequestLimit}` : 'None',
  );
  logger.keyValue(
    'Alert Threshold',
    budget.alertThreshold ? `${budget.alertThreshold}%` : 'None',
  );
  logger.keyValue('Alert Type', budget.alertType || 'None');

  if (budget.models && budget.models.length > 0) {
    logger.blank();
    logger.subheading('Applied to Models');
    budget.models.forEach((model) => logger.listItem(model));
  }
}

/**
 * Delete a budget
 */
export async function deleteBudgetCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.budgets?.[name]) {
    logger.error(`Budget "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete budget "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.budgets[name];
  configManager.setConfig(config);
  logger.success(`Budget "${name}" deleted`);
}

/**
 * Show model pricing
 */
export function showPricingCommand(): void {
  logger.heading('Model Pricing (per 1M tokens)');

  const providers = ['anthropic', 'openai', 'google'];

  providers.forEach((provider) => {
    logger.blank();
    logger.subheading(provider.charAt(0).toUpperCase() + provider.slice(1));

    const models = Object.entries(MODEL_PRICING).filter(
      ([_, pricing]) => pricing.provider === provider,
    );

    const data = [
      ['Model', 'Input', 'Output'],
      ...models.map(([model, pricing]) => [
        model,
        `$${pricing.input}`,
        `$${pricing.output}`,
      ]),
    ];

    console.log(table(data));
  });
}

/**
 * Estimate cost for a request
 */
export async function estimateCostCommand(): Promise<void> {
  logger.heading('Cost Estimator');

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: Object.keys(MODEL_PRICING),
    },
    {
      type: 'number',
      name: 'inputTokens',
      message: 'Estimated input tokens:',
      default: 1000,
    },
    {
      type: 'number',
      name: 'outputTokens',
      message: 'Estimated output tokens:',
      default: 500,
    },
    {
      type: 'number',
      name: 'requests',
      message: 'Number of requests:',
      default: 1,
    },
  ]);

  const pricing = MODEL_PRICING[answers.model as keyof typeof MODEL_PRICING];
  const inputCost =
    (answers.inputTokens / 1_000_000) * pricing.input * answers.requests;
  const outputCost =
    (answers.outputTokens / 1_000_000) * pricing.output * answers.requests;
  const totalCost = inputCost + outputCost;

  logger.blank();
  logger.subheading('Cost Estimate');
  logger.keyValue('Model', answers.model);
  logger.keyValue(
    'Input Tokens',
    `${(answers.inputTokens * answers.requests).toLocaleString()}`,
  );
  logger.keyValue(
    'Output Tokens',
    `${(answers.outputTokens * answers.requests).toLocaleString()}`,
  );
  logger.keyValue('Requests', answers.requests.toString());
  logger.blank();
  logger.keyValue('Input Cost', `$${inputCost.toFixed(4)}`);
  logger.keyValue('Output Cost', `$${outputCost.toFixed(4)}`);
  console.log(chalk.bold.green(`  Total Cost: $${totalCost.toFixed(4)}`));
}

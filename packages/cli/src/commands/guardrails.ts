import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Available guards
const AVAILABLE_GUARDS = {
  // Content guards
  toxicity: {
    name: 'Toxicity Guard',
    category: 'content',
    description: 'Detect and filter toxic content',
    config: { threshold: 0.7 },
  },
  pii: {
    name: 'PII Guard',
    category: 'content',
    description: 'Detect and mask personally identifiable information',
    config: { mask: true, entities: ['email', 'phone', 'ssn', 'credit_card'] },
  },
  topic: {
    name: 'Topic Guard',
    category: 'content',
    description: 'Filter content by topic restrictions',
    config: { blockedTopics: [], allowedTopics: [] },
  },
  bias: {
    name: 'Bias Guard',
    category: 'content',
    description: 'Detect potential bias in content',
    config: { threshold: 0.6 },
  },
  // Security guards
  'prompt-injection': {
    name: 'Prompt Injection Guard',
    category: 'security',
    description: 'Detect prompt injection attempts',
    config: { strictMode: true },
  },
  jailbreak: {
    name: 'Jailbreak Guard',
    category: 'security',
    description: 'Detect jailbreak attempts',
    config: { patterns: [] },
  },
  'data-leakage': {
    name: 'Data Leakage Guard',
    category: 'security',
    description: 'Prevent sensitive data exposure',
    config: { patterns: [] },
  },
  // Validation guards
  schema: {
    name: 'Schema Guard',
    category: 'validation',
    description: 'Validate output against JSON schema',
    config: { schema: {} },
  },
  format: {
    name: 'Format Guard',
    category: 'validation',
    description: 'Validate output format (json, xml, etc.)',
    config: { format: 'json' },
  },
  factuality: {
    name: 'Factuality Guard',
    category: 'validation',
    description: 'Check factual accuracy of claims',
    config: { sources: [] },
  },
  // Operational guards
  'token-budget': {
    name: 'Token Budget Guard',
    category: 'operational',
    description: 'Enforce token limits',
    config: { maxTokens: 4096 },
  },
  'rate-limit': {
    name: 'Rate Limit Guard',
    category: 'operational',
    description: 'Enforce rate limits',
    config: { requestsPerMinute: 60 },
  },
  cost: {
    name: 'Cost Guard',
    category: 'operational',
    description: 'Enforce cost budgets',
    config: { maxCostPerRequest: 0.1, dailyBudget: 10 },
  },
};

export interface GuardrailConfig {
  name: string;
  description?: string;
  guards: Array<{
    type: string;
    enabled: boolean;
    config: Record<string, unknown>;
  }>;
  failAction: 'block' | 'warn' | 'redact';
}

/**
 * List available guards
 */
export function listGuardsCommand(): void {
  logger.heading('Available Guards');

  const categories = ['content', 'security', 'validation', 'operational'];

  categories.forEach((category) => {
    logger.blank();
    logger.subheading(
      category.charAt(0).toUpperCase() + category.slice(1) + ' Guards',
    );

    const guards = Object.entries(AVAILABLE_GUARDS).filter(
      ([_, guard]) => guard.category === category,
    );

    const data = [
      ['ID', 'Name', 'Description'],
      ...guards.map(([id, guard]) => [id, guard.name, guard.description]),
    ];

    console.log(table(data));
  });
}

/**
 * Create a guardrail pipeline
 */
export async function createGuardrailCommand(): Promise<void> {
  logger.heading('Create Guardrail Pipeline');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Pipeline name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.guardrails?.[input])
          return 'Pipeline with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Pipeline description:',
      default: 'A guardrail pipeline',
    },
    {
      type: 'checkbox',
      name: 'guards',
      message: 'Select guards to include:',
      choices: Object.entries(AVAILABLE_GUARDS).map(([id, guard]) => ({
        name: `${guard.name} (${guard.category}) - ${guard.description}`,
        value: id,
      })),
      validate: (input) => input.length >= 1 || 'Select at least one guard',
    },
    {
      type: 'list',
      name: 'failAction',
      message: 'Action when a guard fails:',
      choices: [
        { name: 'Block - Stop processing and return error', value: 'block' },
        { name: 'Warn - Log warning and continue', value: 'warn' },
        { name: 'Redact - Redact problematic content', value: 'redact' },
      ],
    },
  ]);

  const guardrailConfig: GuardrailConfig = {
    name: answers.name,
    description: answers.description,
    guards: answers.guards.map((guardId: string) => ({
      type: guardId,
      enabled: true,
      config: AVAILABLE_GUARDS[guardId as keyof typeof AVAILABLE_GUARDS].config,
    })),
    failAction: answers.failAction,
  };

  // Save guardrail configuration
  const config = configManager.getConfig();
  if (!config.guardrails) {
    config.guardrails = {};
  }
  config.guardrails[answers.name] = guardrailConfig;
  configManager.setConfig(config);

  logger.success(
    `Guardrail pipeline "${answers.name}" created with ${answers.guards.length} guards`,
  );
}

/**
 * List configured guardrail pipelines
 */
export function listGuardrailsCommand(): void {
  const config = configManager.getConfig();
  const guardrails = config.guardrails || {};

  if (Object.keys(guardrails).length === 0) {
    logger.warn('No guardrail pipelines configured');
    logger.info('Run `sea guardrails create` to create a pipeline');
    return;
  }

  logger.heading('Configured Guardrail Pipelines');

  const data = [
    ['Name', 'Guards', 'Fail Action', 'Description'],
    ...(Object.values(guardrails) as GuardrailConfig[]).map((pipeline) => [
      pipeline.name,
      pipeline.guards.length.toString(),
      pipeline.failAction,
      pipeline.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get details of a guardrail pipeline
 */
export function getGuardrailCommand(name: string): void {
  const config = configManager.getConfig();
  const pipeline = config.guardrails?.[name] as GuardrailConfig | undefined;

  if (!pipeline) {
    logger.error(`Guardrail pipeline "${name}" not found`);
    return;
  }

  logger.heading(`Guardrail Pipeline: ${pipeline.name}`);
  logger.keyValue('Description', pipeline.description || '-');
  logger.keyValue('Fail Action', pipeline.failAction);

  logger.blank();
  logger.subheading('Guards');

  const data = [
    ['Guard', 'Enabled', 'Category'],
    ...pipeline.guards.map((guard) => {
      const guardDef =
        AVAILABLE_GUARDS[guard.type as keyof typeof AVAILABLE_GUARDS];
      return [
        guardDef?.name || guard.type,
        guard.enabled ? 'Yes' : 'No',
        guardDef?.category || '-',
      ];
    }),
  ];

  console.log(table(data));
}

/**
 * Delete a guardrail pipeline
 */
export async function deleteGuardrailCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.guardrails?.[name]) {
    logger.error(`Guardrail pipeline "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete guardrail pipeline "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.guardrails[name];
  configManager.setConfig(config);
  logger.success(`Guardrail pipeline "${name}" deleted`);
}

/**
 * Test input against a guardrail pipeline
 */
export async function testGuardrailCommand(
  pipelineName?: string,
): Promise<void> {
  const config = configManager.getConfig();
  const guardrails = config.guardrails || {};

  if (Object.keys(guardrails).length === 0) {
    logger.error('No guardrail pipelines configured');
    logger.info('Run `sea guardrails create` first');
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'pipeline',
      message: 'Select pipeline to test:',
      choices: Object.keys(guardrails),
      when: !pipelineName,
    },
    {
      type: 'input',
      name: 'input',
      message: 'Enter test input:',
      validate: (input) => input.trim().length > 0 || 'Input is required',
    },
  ]);

  const selectedPipeline = pipelineName || answers.pipeline;
  const pipeline = guardrails[selectedPipeline] as GuardrailConfig;

  logger.blank();
  logger.subheading(`Testing against "${selectedPipeline}" pipeline`);
  logger.blank();

  // Simulate guard checks
  pipeline.guards.forEach((guard) => {
    const guardDef =
      AVAILABLE_GUARDS[guard.type as keyof typeof AVAILABLE_GUARDS];
    if (guard.enabled) {
      console.log(chalk.green(`  ✓ ${guardDef?.name || guard.type}`));
    } else {
      console.log(chalk.gray(`  ○ ${guardDef?.name || guard.type} (disabled)`));
    }
  });

  logger.blank();
  logger.success('All guards passed (simulation)');
  logger.info(
    'Note: This is a dry-run test. Use the SDK for actual validation.',
  );
}

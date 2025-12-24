import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Routing strategies
const ROUTING_STRATEGIES = {
  'round-robin': {
    name: 'Round Robin',
    description: 'Distribute requests evenly across providers',
  },
  failover: {
    name: 'Failover',
    description: 'Use backup providers when primary fails',
  },
  'cost-optimized': {
    name: 'Cost Optimized',
    description: 'Route to cheapest available provider',
  },
  'latency-optimized': {
    name: 'Latency Optimized',
    description: 'Route to fastest available provider',
  },
};

// Gateway providers
const GATEWAY_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'azure',
  'ollama',
  'groq',
  'together',
];

export interface GatewayConfig {
  name: string;
  description?: string;
  port: number;
  strategy: string;
  providers: Array<{
    name: string;
    apiKey?: string;
    priority: number;
    weight?: number;
    rateLimit?: number;
  }>;
  caching?: {
    enabled: boolean;
    ttl: number;
  };
  logging?: {
    enabled: boolean;
    level: string;
  };
}

/**
 * Create a gateway configuration
 */
export async function createGatewayConfigCommand(): Promise<void> {
  logger.heading('Create Gateway Configuration');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Gateway name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.gateways?.[input])
          return 'Gateway with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'An API gateway',
    },
    {
      type: 'number',
      name: 'port',
      message: 'Gateway port:',
      default: 8080,
    },
    {
      type: 'list',
      name: 'strategy',
      message: 'Routing strategy:',
      choices: Object.entries(ROUTING_STRATEGIES).map(([key, strategy]) => ({
        name: `${strategy.name} - ${strategy.description}`,
        value: key,
      })),
    },
    {
      type: 'checkbox',
      name: 'providers',
      message: 'Select providers to include:',
      choices: GATEWAY_PROVIDERS,
      validate: (input) => input.length >= 1 || 'Select at least one provider',
    },
    {
      type: 'confirm',
      name: 'enableCaching',
      message: 'Enable response caching?',
      default: true,
    },
    {
      type: 'number',
      name: 'cacheTtl',
      message: 'Cache TTL (seconds):',
      default: 3600,
      when: (answers) => answers.enableCaching,
    },
    {
      type: 'confirm',
      name: 'enableLogging',
      message: 'Enable request logging?',
      default: true,
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Log level:',
      choices: ['debug', 'info', 'warn', 'error'],
      default: 'info',
      when: (answers) => answers.enableLogging,
    },
  ]);

  // Configure each provider
  const providers: GatewayConfig['providers'] = [];
  for (const providerName of answers.providers) {
    logger.blank();
    logger.subheading(`Configure ${providerName}`);

    const providerAnswers: {
      apiKey?: string;
      priority: number;
      weight?: number;
      rateLimit?: number;
    } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: `${providerName} API key (leave empty if using env var):`,
      },
      {
        type: 'number',
        name: 'priority',
        message: 'Priority (lower = higher priority):',
        default: providers.length + 1,
      },
      {
        type: 'number',
        name: 'weight',
        message: 'Weight for round-robin:',
        default: 1,
        when: () => answers.strategy === 'round-robin',
      },
      {
        type: 'number',
        name: 'rateLimit',
        message: 'Rate limit (requests/min, 0 = unlimited):',
        default: 0,
      },
    ]);

    providers.push({
      name: providerName,
      apiKey: providerAnswers.apiKey || undefined,
      priority: providerAnswers.priority,
      weight: providerAnswers.weight,
      rateLimit: providerAnswers.rateLimit || undefined,
    });
  }

  const gatewayConfig: GatewayConfig = {
    name: answers.name,
    description: answers.description,
    port: answers.port,
    strategy: answers.strategy,
    providers,
    caching: answers.enableCaching
      ? { enabled: true, ttl: answers.cacheTtl }
      : { enabled: false, ttl: 0 },
    logging: answers.enableLogging
      ? { enabled: true, level: answers.logLevel }
      : { enabled: false, level: 'info' },
  };

  // Save configuration
  const config = configManager.getConfig();
  if (!config.gateways) {
    config.gateways = {};
  }
  config.gateways[answers.name] = gatewayConfig;
  configManager.setConfig(config);

  logger.success(
    `Gateway "${answers.name}" configured with ${providers.length} providers`,
  );
}

/**
 * List gateway configurations
 */
export function listGatewaysCommand(): void {
  const config = configManager.getConfig();
  const gateways = config.gateways || {};

  if (Object.keys(gateways).length === 0) {
    logger.warn('No gateways configured');
    logger.info('Run `sea gateway create` to create a gateway');
    return;
  }

  logger.heading('Configured Gateways');

  const data = [
    ['Name', 'Port', 'Strategy', 'Providers', 'Caching', 'Description'],
    ...(Object.values(gateways) as GatewayConfig[]).map((gw) => [
      gw.name,
      gw.port.toString(),
      gw.strategy,
      gw.providers.length.toString(),
      gw.caching?.enabled ? 'Yes' : 'No',
      gw.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get gateway details
 */
export function getGatewayCommand(name: string): void {
  const config = configManager.getConfig();
  const gateway = config.gateways?.[name] as GatewayConfig | undefined;

  if (!gateway) {
    logger.error(`Gateway "${name}" not found`);
    return;
  }

  const strategy =
    ROUTING_STRATEGIES[gateway.strategy as keyof typeof ROUTING_STRATEGIES];

  logger.heading(`Gateway: ${gateway.name}`);
  logger.keyValue('Description', gateway.description || '-');
  logger.keyValue('Port', gateway.port.toString());
  logger.keyValue('Strategy', strategy?.name || gateway.strategy);
  logger.keyValue(
    'Caching',
    gateway.caching?.enabled ? `Yes (TTL: ${gateway.caching.ttl}s)` : 'No',
  );
  logger.keyValue(
    'Logging',
    gateway.logging?.enabled ? `Yes (${gateway.logging.level})` : 'No',
  );

  logger.blank();
  logger.subheading('Providers');

  const data = [
    ['Provider', 'Priority', 'Weight', 'Rate Limit', 'API Key'],
    ...gateway.providers.map((p) => [
      p.name,
      p.priority.toString(),
      p.weight?.toString() || '-',
      p.rateLimit ? `${p.rateLimit}/min` : 'Unlimited',
      p.apiKey ? '****' : 'Env var',
    ]),
  ];

  console.log(table(data));
}

/**
 * Delete a gateway
 */
export async function deleteGatewayCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.gateways?.[name]) {
    logger.error(`Gateway "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete gateway "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.gateways[name];
  configManager.setConfig(config);
  logger.success(`Gateway "${name}" deleted`);
}

/**
 * Show routing strategies
 */
export function showStrategiesCommand(): void {
  logger.heading('Routing Strategies');
  logger.blank();

  Object.entries(ROUTING_STRATEGIES).forEach(([key, strategy]) => {
    console.log(chalk.bold.cyan(`  ${strategy.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${strategy.description}`));
    logger.blank();
  });
}

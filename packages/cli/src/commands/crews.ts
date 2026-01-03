import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Crew templates available
const CREW_TEMPLATES = {
  research: {
    name: 'Research Crew',
    description: 'Multi-agent team for research and analysis tasks',
    roles: ['Lead Researcher', 'Data Analyst', 'Fact Checker', 'Report Writer'],
  },
  writing: {
    name: 'Writing Crew',
    description: 'Collaborative content creation team',
    roles: ['Content Strategist', 'Writer', 'Editor', 'SEO Specialist'],
  },
  'code-review': {
    name: 'Code Review Crew',
    description: 'Automated code review team',
    roles: [
      'Architecture Reviewer',
      'Security Reviewer',
      'Style Reviewer',
      'Test Reviewer',
    ],
  },
  'customer-support': {
    name: 'Customer Support Crew',
    description: 'Customer service automation team',
    roles: [
      'Triage Agent',
      'Technical Support',
      'Billing Support',
      'Escalation Handler',
    ],
  },
};

// Delegation strategies
const DELEGATION_STRATEGIES = [
  {
    name: 'Round Robin',
    value: 'round-robin',
    description: 'Distribute tasks evenly across agents',
  },
  {
    name: 'Best Match',
    value: 'best-match',
    description: 'Assign tasks to best-suited agents',
  },
  {
    name: 'Auction',
    value: 'auction',
    description: 'Agents bid on tasks they can handle',
  },
  {
    name: 'Hierarchical',
    value: 'hierarchical',
    description: 'Tasks flow through a hierarchy',
  },
  {
    name: 'Consensus',
    value: 'consensus',
    description: 'Group decision on task assignment',
  },
];

export interface CrewConfig {
  name: string;
  description: string;
  template?: string;
  strategy: string;
  agents: string[];
  maxConcurrent?: number;
  timeout?: number;
}

/**
 * Create a new crew
 */
export async function createCrewCommand(): Promise<void> {
  logger.heading('Create New Crew');

  const agents = configManager.getAllAgents();
  if (Object.keys(agents).length === 0) {
    logger.error('No agents configured');
    logger.info('Run `sea agent create` first to create agents');
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Crew name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.crews?.[input]) return 'Crew with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Crew description:',
      default: 'A multi-agent team',
    },
    {
      type: 'list',
      name: 'useTemplate',
      message: 'How do you want to create the crew?',
      choices: [
        { name: 'From a template', value: true },
        { name: 'Custom configuration', value: false },
      ],
    },
    {
      type: 'list',
      name: 'template',
      message: 'Select a template:',
      choices: Object.entries(CREW_TEMPLATES).map(([key, value]) => ({
        name: `${value.name} - ${value.description}`,
        value: key,
      })),
      when: (answers) => answers.useTemplate,
    },
    {
      type: 'checkbox',
      name: 'agents',
      message: 'Select agents to include in the crew:',
      choices: Object.keys(agents),
      validate: (input) => input.length >= 2 || 'Select at least 2 agents',
      when: (answers) => !answers.useTemplate,
    },
    {
      type: 'list',
      name: 'strategy',
      message: 'Select delegation strategy:',
      choices: DELEGATION_STRATEGIES.map((s) => ({
        name: `${s.name} - ${s.description}`,
        value: s.value,
      })),
    },
    {
      type: 'number',
      name: 'maxConcurrent',
      message: 'Maximum concurrent tasks:',
      default: 3,
    },
    {
      type: 'number',
      name: 'timeout',
      message: 'Task timeout (seconds):',
      default: 300,
    },
  ]);

  const crewConfig: CrewConfig = {
    name: answers.name,
    description: answers.description,
    template: answers.template,
    strategy: answers.strategy,
    agents: answers.agents || [],
    maxConcurrent: answers.maxConcurrent,
    timeout: answers.timeout,
  };

  // Save crew configuration
  const config = configManager.getConfig();
  if (!config.crews) {
    config.crews = {};
  }
  config.crews[answers.name] = crewConfig;
  configManager.setConfig(config);

  logger.success(`Crew "${answers.name}" created`);
  if (answers.template) {
    logger.info(
      `Using template: ${CREW_TEMPLATES[answers.template as keyof typeof CREW_TEMPLATES].name}`,
    );
  }
}

/**
 * List all crews
 */
export function listCrewsCommand(): void {
  const config = configManager.getConfig();
  const crews = config.crews || {};

  if (Object.keys(crews).length === 0) {
    logger.warn('No crews configured');
    logger.info('Run `sea crews create` to create a crew');
    return;
  }

  logger.heading('Configured Crews');

  const data = [
    ['Name', 'Strategy', 'Agents', 'Template', 'Description'],
    ...(Object.values(crews) as CrewConfig[]).map((crew) => [
      crew.name,
      crew.strategy,
      crew.agents?.length?.toString() || (crew.template ? 'template' : '0'),
      crew.template || '-',
      crew.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get details of a specific crew
 */
export function getCrewCommand(name: string): void {
  const config = configManager.getConfig();
  const crew = config.crews?.[name] as CrewConfig | undefined;

  if (!crew) {
    logger.error(`Crew "${name}" not found`);
    return;
  }

  logger.heading(`Crew: ${crew.name}`);
  logger.keyValue('Description', crew.description || '-');
  logger.keyValue('Strategy', crew.strategy);
  logger.keyValue('Template', crew.template || 'Custom');
  logger.keyValue('Max Concurrent', crew.maxConcurrent?.toString() || '-');
  logger.keyValue('Timeout', crew.timeout ? `${crew.timeout}s` : '-');

  if (crew.agents && crew.agents.length > 0) {
    logger.blank();
    logger.subheading('Agents');
    crew.agents.forEach((agent) => logger.listItem(agent));
  }

  if (crew.template) {
    const template =
      CREW_TEMPLATES[crew.template as keyof typeof CREW_TEMPLATES];
    if (template) {
      logger.blank();
      logger.subheading('Template Roles');
      template.roles.forEach((role) => logger.listItem(role));
    }
  }
}

/**
 * Delete a crew
 */
export async function deleteCrewCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.crews?.[name]) {
    logger.error(`Crew "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete crew "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.crews[name];
  configManager.setConfig(config);
  logger.success(`Crew "${name}" deleted`);
}

/**
 * Show available crew templates
 */
export function showCrewTemplatesCommand(): void {
  logger.heading('Crew Templates');
  logger.blank();

  Object.entries(CREW_TEMPLATES).forEach(([key, template]) => {
    console.log(chalk.bold.cyan(`  ${template.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${template.description}`));
    console.log(chalk.gray('    Roles:'));
    template.roles.forEach((role) =>
      console.log(chalk.gray(`      - ${role}`)),
    );
    logger.blank();
  });

  logger.info('Use `sea crews create` to create a crew from a template');
}

/**
 * Show delegation strategies
 */
export function showStrategiesCommand(): void {
  logger.heading('Delegation Strategies');
  logger.blank();

  DELEGATION_STRATEGIES.forEach((strategy) => {
    console.log(chalk.bold.cyan(`  ${strategy.name}`));
    console.log(chalk.gray(`    ID: ${strategy.value}`));
    console.log(chalk.white(`    ${strategy.description}`));
    logger.blank();
  });
}

import inquirer from 'inquirer';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

interface WorkflowConfig {
  name: string;
  description: string;
  type: 'sequential' | 'parallel' | 'supervisor';
  agents: string[];
}

/**
 * List all workflows
 */
export function listWorkflowsCommand(): void {
  logger.heading('🔄 Workflows');
  logger.blank();

  const config = configManager.getConfig();
  const workflows = config.workflows || {};

  if (Object.keys(workflows).length === 0) {
    logger.info('No workflows configured');
    logger.blank();
    logger.info('Create a workflow with: agentsea workflow create');
    return;
  }

  Object.entries(workflows).forEach(([name, workflow]) => {
    logger.subheading(name);
    logger.keyValue('  Type', (workflow as WorkflowConfig).type);
    logger.keyValue('  Agents', (workflow as WorkflowConfig).agents.join(', '));
    logger.log(`  ${(workflow as WorkflowConfig).description}`);
    logger.blank();
  });

  logger.info(`Total: ${Object.keys(workflows).length} workflows`);
}

/**
 * Get workflow details
 */
export function getWorkflowCommand(name: string): void {
  logger.heading(`🔄 Workflow: ${name}`);
  logger.blank();

  const config = configManager.getConfig();
  const workflows = config.workflows || {};
  const workflow = workflows[name] as WorkflowConfig | undefined;

  if (!workflow) {
    logger.error(`Workflow "${name}" not found`);
    logger.info('Available workflows:');
    Object.keys(workflows).forEach((workflowName) => {
      logger.listItem(workflowName);
    });
    return;
  }

  logger.keyValue('Name', name);
  logger.keyValue('Type', workflow.type);
  logger.keyValue('Description', workflow.description);
  logger.blank();

  logger.subheading('Agents');
  workflow.agents.forEach((agent) => {
    logger.listItem(agent);
  });
  logger.blank();
}

/**
 * Create a new workflow
 */
export async function createWorkflowCommand(): Promise<void> {
  logger.heading('➕ Create Workflow');
  logger.blank();

  const config = configManager.getConfig();
  const availableAgents = Object.keys(config.agents);

  if (availableAgents.length === 0) {
    logger.error('No agents configured. Create an agent first.');
    logger.info('Run: agentsea agent create');
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Workflow name:',
      validate: (input) => input.trim().length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      validate: (input) => input.trim().length > 0 || 'Description is required',
    },
    {
      type: 'list',
      name: 'type',
      message: 'Workflow type:',
      choices: [
        {
          name: 'Sequential - Agents run one after another',
          value: 'sequential',
        },
        {
          name: 'Parallel - Agents run simultaneously',
          value: 'parallel',
        },
        {
          name: 'Supervisor - One agent coordinates others',
          value: 'supervisor',
        },
      ],
    },
    {
      type: 'checkbox',
      name: 'agents',
      message: 'Select agents to include:',
      choices: availableAgents,
      validate: (input) => input.length > 0 || 'At least one agent is required',
    },
  ]);

  if (!config.workflows) {
    config.workflows = {};
  }

  const workflow: WorkflowConfig = {
    name: answers.name,
    description: answers.description,
    type: answers.type,
    agents: answers.agents,
  };

  config.workflows[answers.name] = workflow;
  configManager.saveConfig(config);

  logger.blank();
  logger.success(`Workflow "${answers.name}" created successfully`);
  logger.blank();
  logger.info(`Run with: agentsea workflow run ${answers.name}`);
}

/**
 * Delete a workflow
 */
export async function deleteWorkflowCommand(name: string): Promise<void> {
  const config = configManager.getConfig();
  const workflows = config.workflows || {};

  if (!workflows[name]) {
    logger.error(`Workflow "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete workflow "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete workflows[name];
  config.workflows = workflows;
  configManager.saveConfig(config);

  logger.success(`Workflow "${name}" deleted`);
}

/**
 * Show workflow patterns
 */
export function showWorkflowPatternsCommand(): void {
  logger.heading('📋 Workflow Patterns');
  logger.blank();

  const patterns = [
    {
      name: 'Sequential',
      description: 'Agents execute one after another, passing results forward',
      useCase: 'Research → Analysis → Report generation',
    },
    {
      name: 'Parallel',
      description: 'Multiple agents work simultaneously on different tasks',
      useCase: 'Gather data from multiple sources at once',
    },
    {
      name: 'Supervisor',
      description: 'One agent coordinates and delegates to worker agents',
      useCase: 'Complex multi-step projects requiring orchestration',
    },
  ];

  patterns.forEach((pattern) => {
    logger.subheading(pattern.name);
    logger.log(`  ${pattern.description}`);
    logger.keyValue('  Use Case', pattern.useCase);
    logger.blank();
  });
}

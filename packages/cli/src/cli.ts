#!/usr/bin/env node

import { Command } from 'commander';

import {
  createAgentCommand,
  listAgentsCommand,
  getAgentCommand,
  deleteAgentCommand,
  setDefaultAgentCommand,
  runAgentCommand,
} from './commands/agent';
import { chatCommand } from './commands/chat';
import { initCommand } from './commands/init';
import {
  listModelsCommand,
  pullModelCommand,
  showPopularModelsCommand,
} from './commands/model';
import {
  listProvidersCommand,
  getProviderCommand,
  addProviderCommand,
  deleteProviderCommand,
  setDefaultProviderCommand,
} from './commands/provider';
import {
  listToolsCommand,
  getToolCommand,
  showPopularToolsCommand,
} from './commands/tool';
import {
  listMCPServersCommand,
  getMCPServerCommand,
  addMCPServerCommand,
  deleteMCPServerCommand,
  showPopularMCPServersCommand,
} from './commands/mcp';
import {
  listWorkflowsCommand,
  getWorkflowCommand,
  createWorkflowCommand,
  deleteWorkflowCommand,
  showWorkflowPatternsCommand,
} from './commands/workflow';
import { configManager } from './config/manager';
import { logger } from './utils/logger';

const program = new Command();

program
  .name('agentsea')
  .description(
    'AgentSea CLI - Build and orchestrate AI agents with voice, formatting, MCP, and workflows',
  )
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize AgentSea CLI configuration')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      logger.error('Init failed', error as Error);
      process.exit(1);
    }
  });

// Chat command
program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-a, --agent <name>', 'Agent to use')
  .option('-p, --provider <name>', 'Provider to use')
  .option('-m, --model <name>', 'Model to use')
  .option('-s, --stream', 'Enable streaming responses')
  .option('-f, --format <type>', 'Output format (text, markdown, html)')
  .option('--memory <type>', 'Memory type (buffer, redis, summary)')
  .option('-v, --verbose', 'Show detailed metadata')
  .action(async (options) => {
    try {
      await chatCommand(options);
    } catch (error) {
      logger.error('Chat failed', error as Error);
      process.exit(1);
    }
  });

// Agent commands
const agentCommand = program.command('agent').description('Manage agents');

agentCommand
  .command('create')
  .description('Create a new agent')
  .action(async () => {
    try {
      await createAgentCommand();
    } catch (error) {
      logger.error('Create agent failed', error as Error);
      process.exit(1);
    }
  });

agentCommand
  .command('list')
  .description('List all agents')
  .action(() => {
    try {
      listAgentsCommand();
    } catch (error) {
      logger.error('List agents failed', error as Error);
      process.exit(1);
    }
  });

agentCommand
  .command('get <name>')
  .description('Get agent details')
  .action((name) => {
    try {
      getAgentCommand(name);
    } catch (error) {
      logger.error('Get agent failed', error as Error);
      process.exit(1);
    }
  });

agentCommand
  .command('delete <name>')
  .description('Delete an agent')
  .action(async (name) => {
    try {
      await deleteAgentCommand(name);
    } catch (error) {
      logger.error('Delete agent failed', error as Error);
      process.exit(1);
    }
  });

agentCommand
  .command('default <name>')
  .description('Set default agent')
  .action((name) => {
    try {
      setDefaultAgentCommand(name);
    } catch (error) {
      logger.error('Set default agent failed', error as Error);
      process.exit(1);
    }
  });

agentCommand
  .command('run <name> <message>')
  .description('Run an agent with a message')
  .option('-v, --verbose', 'Show verbose output')
  .action(async (name, message, options) => {
    try {
      await runAgentCommand(name, message, options);
    } catch (error) {
      logger.error('Run agent failed', error as Error);
      process.exit(1);
    }
  });

// Provider commands
const providerCommand = program
  .command('provider')
  .description('Manage providers');

providerCommand
  .command('list')
  .description('List all providers')
  .action(() => {
    try {
      listProvidersCommand();
    } catch (error) {
      logger.error('List providers failed', error as Error);
      process.exit(1);
    }
  });

providerCommand
  .command('get <name>')
  .description('Get provider details')
  .action((name) => {
    try {
      getProviderCommand(name);
    } catch (error) {
      logger.error('Get provider failed', error as Error);
      process.exit(1);
    }
  });

providerCommand
  .command('add')
  .description('Add a new provider')
  .action(async () => {
    try {
      await addProviderCommand();
    } catch (error) {
      logger.error('Add provider failed', error as Error);
      process.exit(1);
    }
  });

providerCommand
  .command('delete <name>')
  .description('Delete a provider')
  .action(async (name) => {
    try {
      await deleteProviderCommand(name);
    } catch (error) {
      logger.error('Delete provider failed', error as Error);
      process.exit(1);
    }
  });

providerCommand
  .command('default <name>')
  .description('Set default provider')
  .action((name) => {
    try {
      setDefaultProviderCommand(name);
    } catch (error) {
      logger.error('Set default provider failed', error as Error);
      process.exit(1);
    }
  });

// Model commands
const modelCommand = program
  .command('model')
  .description('Manage models (Ollama)');

modelCommand
  .command('list')
  .description('List available models')
  .option('-p, --provider <name>', 'Provider to use')
  .action(async (options) => {
    try {
      await listModelsCommand(options.provider);
    } catch (error) {
      logger.error('List models failed', error as Error);
      process.exit(1);
    }
  });

modelCommand
  .command('pull <name>')
  .description('Pull a model from Ollama')
  .option('-p, --provider <name>', 'Provider to use')
  .action(async (name, options) => {
    try {
      await pullModelCommand(name, options.provider);
    } catch (error) {
      logger.error('Pull model failed', error as Error);
      process.exit(1);
    }
  });

modelCommand
  .command('popular')
  .description('Show popular Ollama models')
  .action(() => {
    try {
      showPopularModelsCommand();
    } catch (error) {
      logger.error('Show popular models failed', error as Error);
      process.exit(1);
    }
  });

// Tool commands
const toolCommand = program.command('tool').description('Manage tools');

toolCommand
  .command('list')
  .description('List all available tools')
  .action(() => {
    try {
      listToolsCommand();
    } catch (error) {
      logger.error('List tools failed', error as Error);
      process.exit(1);
    }
  });

toolCommand
  .command('get <name>')
  .description('Get tool details')
  .action((name) => {
    try {
      getToolCommand(name);
    } catch (error) {
      logger.error('Get tool failed', error as Error);
      process.exit(1);
    }
  });

toolCommand
  .command('popular')
  .description('Show popular tools')
  .action(() => {
    try {
      showPopularToolsCommand();
    } catch (error) {
      logger.error('Show popular tools failed', error as Error);
      process.exit(1);
    }
  });

// MCP commands
const mcpCommand = program.command('mcp').description('Manage MCP servers');

mcpCommand
  .command('list')
  .description('List all MCP servers')
  .action(() => {
    try {
      listMCPServersCommand();
    } catch (error) {
      logger.error('List MCP servers failed', error as Error);
      process.exit(1);
    }
  });

mcpCommand
  .command('get <name>')
  .description('Get MCP server details')
  .action((name) => {
    try {
      getMCPServerCommand(name);
    } catch (error) {
      logger.error('Get MCP server failed', error as Error);
      process.exit(1);
    }
  });

mcpCommand
  .command('add')
  .description('Add a new MCP server')
  .action(async () => {
    try {
      await addMCPServerCommand();
    } catch (error) {
      logger.error('Add MCP server failed', error as Error);
      process.exit(1);
    }
  });

mcpCommand
  .command('delete <name>')
  .description('Delete an MCP server')
  .action(async (name) => {
    try {
      await deleteMCPServerCommand(name);
    } catch (error) {
      logger.error('Delete MCP server failed', error as Error);
      process.exit(1);
    }
  });

mcpCommand
  .command('popular')
  .description('Show popular MCP servers')
  .action(() => {
    try {
      showPopularMCPServersCommand();
    } catch (error) {
      logger.error('Show popular MCP servers failed', error as Error);
      process.exit(1);
    }
  });

// Workflow commands
const workflowCommand = program
  .command('workflow')
  .description('Manage workflows');

workflowCommand
  .command('list')
  .description('List all workflows')
  .action(() => {
    try {
      listWorkflowsCommand();
    } catch (error) {
      logger.error('List workflows failed', error as Error);
      process.exit(1);
    }
  });

workflowCommand
  .command('get <name>')
  .description('Get workflow details')
  .action((name) => {
    try {
      getWorkflowCommand(name);
    } catch (error) {
      logger.error('Get workflow failed', error as Error);
      process.exit(1);
    }
  });

workflowCommand
  .command('create')
  .description('Create a new workflow')
  .action(async () => {
    try {
      await createWorkflowCommand();
    } catch (error) {
      logger.error('Create workflow failed', error as Error);
      process.exit(1);
    }
  });

workflowCommand
  .command('delete <name>')
  .description('Delete a workflow')
  .action(async (name) => {
    try {
      await deleteWorkflowCommand(name);
    } catch (error) {
      logger.error('Delete workflow failed', error as Error);
      process.exit(1);
    }
  });

workflowCommand
  .command('patterns')
  .description('Show workflow patterns')
  .action(() => {
    try {
      showWorkflowPatternsCommand();
    } catch (error) {
      logger.error('Show workflow patterns failed', error as Error);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show configuration')
  .action(() => {
    logger.heading('AgentSea Configuration');

    const config = configManager.getConfig();

    logger.subheading('Configuration Path');
    logger.code(`  ${configManager.getConfigPath()}`);
    logger.blank();

    logger.subheading('Default Provider');
    logger.log(`  ${config.defaultProvider || '(not set)'}`);
    logger.blank();

    logger.subheading('Default Agent');
    logger.log(`  ${config.defaultAgent || '(not set)'}`);
    logger.blank();

    logger.subheading('Providers');
    const providers = Object.keys(config.providers);
    if (providers.length === 0) {
      logger.log('  (none)');
    } else {
      providers.forEach((name) => logger.listItem(name));
    }
    logger.blank();

    logger.subheading('Agents');
    const agents = Object.keys(config.agents);
    if (agents.length === 0) {
      logger.log('  (none)');
    } else {
      agents.forEach((name) => logger.listItem(name));
    }
    logger.blank();

    logger.subheading('MCP Servers');
    const mcpServers = Object.keys(config.mcpServers || {});
    if (mcpServers.length === 0) {
      logger.log('  (none)');
    } else {
      mcpServers.forEach((name) => logger.listItem(name));
    }
    logger.blank();

    logger.subheading('Workflows');
    const workflows = Object.keys(config.workflows || {});
    if (workflows.length === 0) {
      logger.log('  (none)');
    } else {
      workflows.forEach((name) => logger.listItem(name));
    }
    logger.blank();
  });

// Parse arguments
program.parse();

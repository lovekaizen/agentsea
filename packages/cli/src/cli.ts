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
import {
  createBudgetCommand,
  listBudgetsCommand,
  getBudgetCommand,
  deleteBudgetCommand,
  showPricingCommand,
  estimateCostCommand,
} from './commands/costs';
import {
  createCrewCommand,
  listCrewsCommand,
  getCrewCommand,
  deleteCrewCommand,
  showCrewTemplatesCommand,
  showStrategiesCommand as showCrewStrategiesCommand,
} from './commands/crews';
import {
  createEmbeddingConfigCommand,
  listEmbeddingConfigsCommand,
  getEmbeddingConfigCommand,
  deleteEmbeddingConfigCommand,
  showProvidersCommand as showEmbeddingProvidersCommand,
  showStoresCommand as showVectorStoresCommand,
} from './commands/embeddings';
import {
  createEvalConfigCommand,
  listEvalsCommand,
  getEvalCommand,
  deleteEvalCommand,
  showMetricsCommand,
  showJudgesCommand,
  showFeedbackTypesCommand,
} from './commands/evaluate';
import {
  createGatewayConfigCommand,
  listGatewaysCommand,
  getGatewayCommand,
  deleteGatewayCommand,
  showStrategiesCommand as showRoutingStrategiesCommand,
} from './commands/gateway';
import {
  listGuardsCommand,
  createGuardrailCommand,
  listGuardrailsCommand,
  getGuardrailCommand,
  deleteGuardrailCommand,
  testGuardrailCommand,
} from './commands/guardrails';
import {
  createPipelineCommand,
  listPipelinesCommand,
  getPipelineCommand,
  deletePipelineCommand,
  showParsersCommand,
  showChunkersCommand,
} from './commands/ingest';
import { initCommand } from './commands/init';
import {
  createMemoryStoreCommand,
  listMemoryStoresCommand,
  getMemoryStoreCommand,
  deleteMemoryStoreCommand,
  showStoreTypesCommand,
  showStructuresCommand,
  showRetrievalStrategiesCommand,
} from './commands/memory';
import {
  listModelsCommand,
  pullModelCommand,
  showPopularModelsCommand,
} from './commands/model';
import {
  listMCPServersCommand,
  getMCPServerCommand,
  addMCPServerCommand,
  deleteMCPServerCommand,
  showPopularMCPServersCommand,
} from './commands/mcp';
import {
  createPromptCommand,
  listPromptsCommand,
  getPromptCommand,
  deletePromptCommand,
  renderPromptCommand,
  promotePromptCommand,
  versionPromptCommand,
} from './commands/prompts';
import {
  listProvidersCommand,
  getProviderCommand,
  addProviderCommand,
  deleteProviderCommand,
  setDefaultProviderCommand,
} from './commands/provider';
import {
  createSurfConfigCommand,
  listSurfConfigsCommand,
  getSurfConfigCommand,
  deleteSurfConfigCommand,
  showBackendsCommand,
  showSurfToolsCommand,
} from './commands/surf';
import {
  listToolsCommand,
  getToolCommand,
  showPopularToolsCommand,
} from './commands/tool';
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
  .name('sea')
  .description(
    'AgentSea CLI - Build and orchestrate AI agents with crews, guardrails, memory, and more',
  )
  .version('0.4.0');

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

// =============================================================================
// NEW PACKAGE COMMANDS
// =============================================================================

// Crews commands
const crewsCommand = program
  .command('crews')
  .description('Manage multi-agent crews');

crewsCommand
  .command('create')
  .description('Create a new crew')
  .action(async () => {
    try {
      await createCrewCommand();
    } catch (error) {
      logger.error('Create crew failed', error as Error);
      process.exit(1);
    }
  });

crewsCommand
  .command('list')
  .description('List all crews')
  .action(() => {
    try {
      listCrewsCommand();
    } catch (error) {
      logger.error('List crews failed', error as Error);
      process.exit(1);
    }
  });

crewsCommand
  .command('get <name>')
  .description('Get crew details')
  .action((name) => {
    try {
      getCrewCommand(name);
    } catch (error) {
      logger.error('Get crew failed', error as Error);
      process.exit(1);
    }
  });

crewsCommand
  .command('delete <name>')
  .description('Delete a crew')
  .action(async (name) => {
    try {
      await deleteCrewCommand(name);
    } catch (error) {
      logger.error('Delete crew failed', error as Error);
      process.exit(1);
    }
  });

crewsCommand
  .command('templates')
  .description('Show available crew templates')
  .action(() => {
    try {
      showCrewTemplatesCommand();
    } catch (error) {
      logger.error('Show templates failed', error as Error);
      process.exit(1);
    }
  });

crewsCommand
  .command('strategies')
  .description('Show delegation strategies')
  .action(() => {
    try {
      showCrewStrategiesCommand();
    } catch (error) {
      logger.error('Show strategies failed', error as Error);
      process.exit(1);
    }
  });

// Guardrails commands
const guardrailsCommand = program
  .command('guardrails')
  .description('Manage safety guardrails');

guardrailsCommand
  .command('guards')
  .description('List available guards')
  .action(() => {
    try {
      listGuardsCommand();
    } catch (error) {
      logger.error('List guards failed', error as Error);
      process.exit(1);
    }
  });

guardrailsCommand
  .command('create')
  .description('Create a guardrail pipeline')
  .action(async () => {
    try {
      await createGuardrailCommand();
    } catch (error) {
      logger.error('Create guardrail failed', error as Error);
      process.exit(1);
    }
  });

guardrailsCommand
  .command('list')
  .description('List guardrail pipelines')
  .action(() => {
    try {
      listGuardrailsCommand();
    } catch (error) {
      logger.error('List guardrails failed', error as Error);
      process.exit(1);
    }
  });

guardrailsCommand
  .command('get <name>')
  .description('Get guardrail pipeline details')
  .action((name) => {
    try {
      getGuardrailCommand(name);
    } catch (error) {
      logger.error('Get guardrail failed', error as Error);
      process.exit(1);
    }
  });

guardrailsCommand
  .command('delete <name>')
  .description('Delete a guardrail pipeline')
  .action(async (name) => {
    try {
      await deleteGuardrailCommand(name);
    } catch (error) {
      logger.error('Delete guardrail failed', error as Error);
      process.exit(1);
    }
  });

guardrailsCommand
  .command('test [pipeline]')
  .description('Test input against a guardrail pipeline')
  .action(async (pipeline) => {
    try {
      await testGuardrailCommand(pipeline);
    } catch (error) {
      logger.error('Test guardrail failed', error as Error);
      process.exit(1);
    }
  });

// Memory commands
const memoryCommand = program
  .command('memory')
  .description('Manage memory stores');

memoryCommand
  .command('create')
  .description('Create a memory store')
  .action(async () => {
    try {
      await createMemoryStoreCommand();
    } catch (error) {
      logger.error('Create memory store failed', error as Error);
      process.exit(1);
    }
  });

memoryCommand
  .command('list')
  .description('List memory stores')
  .action(() => {
    try {
      listMemoryStoresCommand();
    } catch (error) {
      logger.error('List memory stores failed', error as Error);
      process.exit(1);
    }
  });

memoryCommand
  .command('get <name>')
  .description('Get memory store details')
  .action((name) => {
    try {
      getMemoryStoreCommand(name);
    } catch (error) {
      logger.error('Get memory store failed', error as Error);
      process.exit(1);
    }
  });

memoryCommand
  .command('delete <name>')
  .description('Delete a memory store')
  .action(async (name) => {
    try {
      await deleteMemoryStoreCommand(name);
    } catch (error) {
      logger.error('Delete memory store failed', error as Error);
      process.exit(1);
    }
  });

memoryCommand
  .command('stores')
  .description('Show available store types')
  .action(() => {
    try {
      showStoreTypesCommand();
    } catch (error) {
      logger.error('Show store types failed', error as Error);
      process.exit(1);
    }
  });

memoryCommand
  .command('structures')
  .description('Show memory structures')
  .action(() => {
    try {
      showStructuresCommand();
    } catch (error) {
      logger.error('Show structures failed', error as Error);
      process.exit(1);
    }
  });

memoryCommand
  .command('retrieval')
  .description('Show retrieval strategies')
  .action(() => {
    try {
      showRetrievalStrategiesCommand();
    } catch (error) {
      logger.error('Show retrieval strategies failed', error as Error);
      process.exit(1);
    }
  });

// Prompts commands
const promptsCommand = program
  .command('prompts')
  .description('Manage prompt templates');

promptsCommand
  .command('create')
  .description('Create a prompt template')
  .action(async () => {
    try {
      await createPromptCommand();
    } catch (error) {
      logger.error('Create prompt failed', error as Error);
      process.exit(1);
    }
  });

promptsCommand
  .command('list')
  .description('List prompt templates')
  .action(() => {
    try {
      listPromptsCommand();
    } catch (error) {
      logger.error('List prompts failed', error as Error);
      process.exit(1);
    }
  });

promptsCommand
  .command('get <name>')
  .description('Get prompt details')
  .action((name) => {
    try {
      getPromptCommand(name);
    } catch (error) {
      logger.error('Get prompt failed', error as Error);
      process.exit(1);
    }
  });

promptsCommand
  .command('delete <name>')
  .description('Delete a prompt template')
  .action(async (name) => {
    try {
      await deletePromptCommand(name);
    } catch (error) {
      logger.error('Delete prompt failed', error as Error);
      process.exit(1);
    }
  });

promptsCommand
  .command('render <name>')
  .description('Render a prompt with variables')
  .action(async (name) => {
    try {
      await renderPromptCommand(name);
    } catch (error) {
      logger.error('Render prompt failed', error as Error);
      process.exit(1);
    }
  });

promptsCommand
  .command('promote <name>')
  .description('Promote a prompt to a higher environment')
  .action(async (name) => {
    try {
      await promotePromptCommand(name);
    } catch (error) {
      logger.error('Promote prompt failed', error as Error);
      process.exit(1);
    }
  });

promptsCommand
  .command('version <name>')
  .description('Bump prompt version')
  .action(async (name) => {
    try {
      await versionPromptCommand(name);
    } catch (error) {
      logger.error('Version prompt failed', error as Error);
      process.exit(1);
    }
  });

// Surf commands
const surfCommand = program
  .command('surf')
  .description('Manage computer-use (surf) configurations');

surfCommand
  .command('create')
  .description('Create a surf configuration')
  .action(async () => {
    try {
      await createSurfConfigCommand();
    } catch (error) {
      logger.error('Create surf config failed', error as Error);
      process.exit(1);
    }
  });

surfCommand
  .command('list')
  .description('List surf configurations')
  .action(() => {
    try {
      listSurfConfigsCommand();
    } catch (error) {
      logger.error('List surf configs failed', error as Error);
      process.exit(1);
    }
  });

surfCommand
  .command('get <name>')
  .description('Get surf configuration details')
  .action((name) => {
    try {
      getSurfConfigCommand(name);
    } catch (error) {
      logger.error('Get surf config failed', error as Error);
      process.exit(1);
    }
  });

surfCommand
  .command('delete <name>')
  .description('Delete a surf configuration')
  .action(async (name) => {
    try {
      await deleteSurfConfigCommand(name);
    } catch (error) {
      logger.error('Delete surf config failed', error as Error);
      process.exit(1);
    }
  });

surfCommand
  .command('backends')
  .description('Show available backends')
  .action(() => {
    try {
      showBackendsCommand();
    } catch (error) {
      logger.error('Show backends failed', error as Error);
      process.exit(1);
    }
  });

surfCommand
  .command('tools')
  .description('Show surf tools')
  .action(() => {
    try {
      showSurfToolsCommand();
    } catch (error) {
      logger.error('Show surf tools failed', error as Error);
      process.exit(1);
    }
  });

// Embeddings commands
const embeddingsCommand = program
  .command('embeddings')
  .description('Manage embedding configurations');

embeddingsCommand
  .command('create')
  .description('Create an embedding configuration')
  .action(async () => {
    try {
      await createEmbeddingConfigCommand();
    } catch (error) {
      logger.error('Create embedding config failed', error as Error);
      process.exit(1);
    }
  });

embeddingsCommand
  .command('list')
  .description('List embedding configurations')
  .action(() => {
    try {
      listEmbeddingConfigsCommand();
    } catch (error) {
      logger.error('List embedding configs failed', error as Error);
      process.exit(1);
    }
  });

embeddingsCommand
  .command('get <name>')
  .description('Get embedding configuration details')
  .action((name) => {
    try {
      getEmbeddingConfigCommand(name);
    } catch (error) {
      logger.error('Get embedding config failed', error as Error);
      process.exit(1);
    }
  });

embeddingsCommand
  .command('delete <name>')
  .description('Delete an embedding configuration')
  .action(async (name) => {
    try {
      await deleteEmbeddingConfigCommand(name);
    } catch (error) {
      logger.error('Delete embedding config failed', error as Error);
      process.exit(1);
    }
  });

embeddingsCommand
  .command('providers')
  .description('Show embedding providers')
  .action(() => {
    try {
      showEmbeddingProvidersCommand();
    } catch (error) {
      logger.error('Show providers failed', error as Error);
      process.exit(1);
    }
  });

embeddingsCommand
  .command('stores')
  .description('Show vector stores')
  .action(() => {
    try {
      showVectorStoresCommand();
    } catch (error) {
      logger.error('Show stores failed', error as Error);
      process.exit(1);
    }
  });

// Gateway commands
const gatewayCommand = program
  .command('gateway')
  .description('Manage API gateway configurations');

gatewayCommand
  .command('create')
  .description('Create a gateway configuration')
  .action(async () => {
    try {
      await createGatewayConfigCommand();
    } catch (error) {
      logger.error('Create gateway failed', error as Error);
      process.exit(1);
    }
  });

gatewayCommand
  .command('list')
  .description('List gateway configurations')
  .action(() => {
    try {
      listGatewaysCommand();
    } catch (error) {
      logger.error('List gateways failed', error as Error);
      process.exit(1);
    }
  });

gatewayCommand
  .command('get <name>')
  .description('Get gateway details')
  .action((name) => {
    try {
      getGatewayCommand(name);
    } catch (error) {
      logger.error('Get gateway failed', error as Error);
      process.exit(1);
    }
  });

gatewayCommand
  .command('delete <name>')
  .description('Delete a gateway')
  .action(async (name) => {
    try {
      await deleteGatewayCommand(name);
    } catch (error) {
      logger.error('Delete gateway failed', error as Error);
      process.exit(1);
    }
  });

gatewayCommand
  .command('strategies')
  .description('Show routing strategies')
  .action(() => {
    try {
      showRoutingStrategiesCommand();
    } catch (error) {
      logger.error('Show strategies failed', error as Error);
      process.exit(1);
    }
  });

// Evaluate commands
const evaluateCommand = program
  .command('evaluate')
  .description('Manage evaluations');

evaluateCommand
  .command('create')
  .description('Create an evaluation configuration')
  .action(async () => {
    try {
      await createEvalConfigCommand();
    } catch (error) {
      logger.error('Create evaluation failed', error as Error);
      process.exit(1);
    }
  });

evaluateCommand
  .command('list')
  .description('List evaluation configurations')
  .action(() => {
    try {
      listEvalsCommand();
    } catch (error) {
      logger.error('List evaluations failed', error as Error);
      process.exit(1);
    }
  });

evaluateCommand
  .command('get <name>')
  .description('Get evaluation details')
  .action((name) => {
    try {
      getEvalCommand(name);
    } catch (error) {
      logger.error('Get evaluation failed', error as Error);
      process.exit(1);
    }
  });

evaluateCommand
  .command('delete <name>')
  .description('Delete an evaluation')
  .action(async (name) => {
    try {
      await deleteEvalCommand(name);
    } catch (error) {
      logger.error('Delete evaluation failed', error as Error);
      process.exit(1);
    }
  });

evaluateCommand
  .command('metrics')
  .description('Show available metrics')
  .action(() => {
    try {
      showMetricsCommand();
    } catch (error) {
      logger.error('Show metrics failed', error as Error);
      process.exit(1);
    }
  });

evaluateCommand
  .command('judges')
  .description('Show judge types')
  .action(() => {
    try {
      showJudgesCommand();
    } catch (error) {
      logger.error('Show judges failed', error as Error);
      process.exit(1);
    }
  });

evaluateCommand
  .command('feedback')
  .description('Show feedback collection types')
  .action(() => {
    try {
      showFeedbackTypesCommand();
    } catch (error) {
      logger.error('Show feedback types failed', error as Error);
      process.exit(1);
    }
  });

// Costs commands
const costsCommand = program
  .command('costs')
  .description('Manage cost tracking and budgets');

costsCommand
  .command('budget')
  .description('Create a budget')
  .action(async () => {
    try {
      await createBudgetCommand();
    } catch (error) {
      logger.error('Create budget failed', error as Error);
      process.exit(1);
    }
  });

costsCommand
  .command('list')
  .description('List budgets')
  .action(() => {
    try {
      listBudgetsCommand();
    } catch (error) {
      logger.error('List budgets failed', error as Error);
      process.exit(1);
    }
  });

costsCommand
  .command('get <name>')
  .description('Get budget details')
  .action((name) => {
    try {
      getBudgetCommand(name);
    } catch (error) {
      logger.error('Get budget failed', error as Error);
      process.exit(1);
    }
  });

costsCommand
  .command('delete <name>')
  .description('Delete a budget')
  .action(async (name) => {
    try {
      await deleteBudgetCommand(name);
    } catch (error) {
      logger.error('Delete budget failed', error as Error);
      process.exit(1);
    }
  });

costsCommand
  .command('pricing')
  .description('Show model pricing')
  .action(() => {
    try {
      showPricingCommand();
    } catch (error) {
      logger.error('Show pricing failed', error as Error);
      process.exit(1);
    }
  });

costsCommand
  .command('estimate')
  .description('Estimate cost for a request')
  .action(async () => {
    try {
      await estimateCostCommand();
    } catch (error) {
      logger.error('Estimate cost failed', error as Error);
      process.exit(1);
    }
  });

// Ingest commands
const ingestCommand = program
  .command('ingest')
  .description('Manage data ingestion pipelines');

ingestCommand
  .command('create')
  .description('Create an ingestion pipeline')
  .action(async () => {
    try {
      await createPipelineCommand();
    } catch (error) {
      logger.error('Create pipeline failed', error as Error);
      process.exit(1);
    }
  });

ingestCommand
  .command('list')
  .description('List ingestion pipelines')
  .action(() => {
    try {
      listPipelinesCommand();
    } catch (error) {
      logger.error('List pipelines failed', error as Error);
      process.exit(1);
    }
  });

ingestCommand
  .command('get <name>')
  .description('Get pipeline details')
  .action((name) => {
    try {
      getPipelineCommand(name);
    } catch (error) {
      logger.error('Get pipeline failed', error as Error);
      process.exit(1);
    }
  });

ingestCommand
  .command('delete <name>')
  .description('Delete an ingestion pipeline')
  .action(async (name) => {
    try {
      await deletePipelineCommand(name);
    } catch (error) {
      logger.error('Delete pipeline failed', error as Error);
      process.exit(1);
    }
  });

ingestCommand
  .command('parsers')
  .description('Show available file parsers')
  .action(() => {
    try {
      showParsersCommand();
    } catch (error) {
      logger.error('Show parsers failed', error as Error);
      process.exit(1);
    }
  });

ingestCommand
  .command('chunkers')
  .description('Show chunking strategies')
  .action(() => {
    try {
      showChunkersCommand();
    } catch (error) {
      logger.error('Show chunkers failed', error as Error);
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

    const sections = [
      { name: 'Providers', key: 'providers' },
      { name: 'Agents', key: 'agents' },
      { name: 'MCP Servers', key: 'mcpServers' },
      { name: 'Workflows', key: 'workflows' },
      { name: 'Crews', key: 'crews' },
      { name: 'Guardrails', key: 'guardrails' },
      { name: 'Memory Stores', key: 'memoryStores' },
      { name: 'Prompts', key: 'prompts' },
      { name: 'Surf Configs', key: 'surfConfigs' },
      { name: 'Embeddings', key: 'embeddingConfigs' },
      { name: 'Gateways', key: 'gateways' },
      { name: 'Evaluations', key: 'evaluations' },
      { name: 'Budgets', key: 'budgets' },
      { name: 'Ingest Pipelines', key: 'ingestPipelines' },
    ];

    sections.forEach(({ name, key }) => {
      logger.subheading(name);
      const configObj = config[key as keyof typeof config];
      const items = Object.keys((configObj as Record<string, unknown>) || {});
      if (items.length === 0) {
        logger.log('  (none)');
      } else {
        items.forEach((item) => logger.listItem(item));
      }
      logger.blank();
    });
  });

// Parse arguments
program.parse();

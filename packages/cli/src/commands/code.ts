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
  fileReadTool,
  fileWriteTool,
  fileListTool,
  shellExecuteTool,
  codeEditTool,
  globTool,
  grepTool,
  gitStatusTool,
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitLogTool,
  gitBranchTool,
} from '@lov3kaizen/agentsea-core';
import chalk from 'chalk';
import inquirer from 'inquirer';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

const CODING_TOOLS = [
  fileReadTool,
  fileWriteTool,
  fileListTool,
  shellExecuteTool,
  codeEditTool,
  globTool,
  grepTool,
  gitStatusTool,
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitLogTool,
  gitBranchTool,
];

const CODING_SYSTEM_PROMPT = `You are an expert coding assistant with access to file system and development tools.

## Available Tools
- **file_read** / **file_write** / **file_list** - Read, write, and list files
- **shell_execute** - Run shell commands (with safety checks)
- **code_edit** - Edit files using exact string search-and-replace
- **glob** - Find files matching glob patterns
- **grep** - Search file contents with regex patterns
- **git_status** / **git_diff** / **git_add** / **git_commit** / **git_log** / **git_branch** - Git operations

## Guidelines
- Read files before editing them to understand existing code
- Use code_edit for precise changes instead of rewriting entire files
- Use glob to find relevant files before making changes
- Use grep to search for patterns across the codebase
- Always verify changes with git_diff after editing
- Write clean, well-structured code following existing patterns
- Explain what you're doing before making changes
- Prefer small, focused edits over large rewrites`;

interface CodeOptions {
  agent?: string;
  provider?: string;
  model?: string;
  verbose?: boolean;
  maxIterations?: number;
}

/**
 * Start an interactive coding session with agentic tools
 */
export async function codeCommand(options: CodeOptions): Promise<void> {
  const agentName = options.agent || configManager.getDefaultAgent();

  if (!agentName) {
    logger.error('No agent specified and no default agent configured');
    logger.info('Run `sea init` to set up a default agent');
    logger.info('Or specify an agent: sea code --agent <agent-name>');
    return;
  }

  const agentConfig = configManager.getAgent(agentName);

  if (!agentConfig) {
    logger.error(`Agent "${agentName}" not found`);
    logger.info('Available agents:');
    const agents = configManager.getAllAgents();
    Object.keys(agents).forEach((name) => {
      logger.listItem(name);
    });
    return;
  }

  // Get provider configuration
  const providerName = options.provider || agentConfig.provider;
  const providerConfig = configManager.getProvider(providerName);

  if (!providerConfig) {
    logger.error(`Provider "${providerName}" not found`);
    return;
  }

  // Create provider instance
  let provider;
  const apiKey = configManager.getApiKey(providerName);

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
      if (providerName === 'lmstudio') {
        provider = new LMStudioProvider({
          baseUrl: providerConfig.baseUrl,
        });
      } else if (providerName === 'localai') {
        provider = new LocalAIProvider({
          baseUrl: providerConfig.baseUrl,
        });
      } else {
        logger.error(`Unsupported provider type: ${providerConfig.type}`);
        return;
      }
      break;
    default:
      logger.error(`Unknown provider type: ${String(providerConfig.type)}`);
      return;
  }

  // Create tool registry and register coding tools
  const toolRegistry = new ToolRegistry();
  for (const tool of CODING_TOOLS) {
    toolRegistry.register(tool);
  }

  const maxIterations = options.maxIterations || 25;

  // Create agent with coding system prompt
  const agent = new Agent(
    {
      name: agentConfig.name,
      description: agentConfig.description,
      model: options.model || agentConfig.model,
      provider: providerConfig.type,
      systemPrompt: CODING_SYSTEM_PROMPT,
      temperature: agentConfig.temperature ?? 0,
      maxTokens: agentConfig.maxTokens ?? 8192,
      maxIterations,
      outputFormat: 'text',
    },
    provider,
    toolRegistry,
  );

  // Create conversation context
  const context: AgentContext = {
    conversationId: `code-${Date.now()}`,
    sessionData: {},
    history: [],
  };

  const cwd = process.cwd();

  // Display welcome message
  logger.clear();
  logger.heading(`🔧 AgentSea Code - ${agentConfig.name}`);
  logger.keyValue('Model', options.model || agentConfig.model);
  logger.keyValue('Provider', providerName);
  logger.keyValue('Working Directory', cwd);
  logger.keyValue('Tools', `${CODING_TOOLS.length} coding tools loaded`);
  logger.keyValue('Max Iterations', String(maxIterations));
  logger.blank();
  logger.info(
    'Type your coding request and press Enter. Type "exit" or "quit" to end.',
  );
  logger.divider();
  logger.blank();

  // Chat loop - always streaming
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: chalk.bold.cyan('You:'),
        validate: (input) =>
          input.trim().length > 0 || 'Message cannot be empty',
      },
    ]);

    if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
      logger.blank();
      logger.info('Goodbye! 👋');
      break;
    }

    try {
      logger.blank();
      process.stdout.write(chalk.bold.green('Assistant: '));

      let fullResponse = '';
      for await (const chunk of agent.executeStream(message, context)) {
        switch (chunk.type) {
          case 'content':
            process.stdout.write(chunk.content);
            fullResponse += chunk.content;
            break;
          case 'tool_calls':
            if (options.verbose) {
              process.stdout.write('\n');
              for (const tc of chunk.toolCalls) {
                logger.debug(
                  `  → Tool: ${tc.tool}(${JSON.stringify(tc.parameters).slice(0, 100)}...)`,
                  true,
                );
              }
            } else {
              for (const tc of chunk.toolCalls) {
                process.stdout.write(chalk.dim(`\n  [${tc.tool}] `));
              }
            }
            break;
          case 'tool_result':
            if (options.verbose) {
              const resultStr = JSON.stringify(chunk.toolCall.result).slice(
                0,
                200,
              );
              logger.debug(`  ← Result: ${resultStr}`, true);
            }
            break;
          case 'done':
            if (options.verbose && chunk.metadata) {
              process.stdout.write('\n');
              logger.debug(
                `Tokens: ${chunk.metadata.tokensUsed}, ` +
                  `Latency: ${chunk.metadata.latencyMs}ms, ` +
                  `Iterations: ${chunk.metadata.iterations}`,
                true,
              );
            }
            break;
          case 'error':
            process.stdout.write(chalk.red(`\nError: ${chunk.error}`));
            break;
        }
      }
      process.stdout.write('\n');
      logger.blank();

      // Update history
      context.history.push(
        { role: 'user', content: message },
        { role: 'assistant', content: fullResponse },
      );
    } catch (error) {
      logger.blank();
      logger.error('Failed to get response', error as Error);
      logger.blank();
    }
  }
}

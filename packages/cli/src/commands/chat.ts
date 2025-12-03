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
} from '@lov3kaizen/agentsea-core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

interface ChatOptions {
  agent?: string;
  provider?: string;
  model?: string;
  stream?: boolean;
  format?: 'text' | 'markdown' | 'html';
  memory?: 'buffer' | 'redis' | 'summary';
  verbose?: boolean;
}

/**
 * Start an interactive chat session
 */
export async function chatCommand(options: ChatOptions): Promise<void> {
  // Get agent configuration
  const agentName = options.agent || configManager.getDefaultAgent();

  if (!agentName) {
    logger.error('No agent specified and no default agent configured');
    logger.info('Run `agentsea init` to set up a default agent');
    logger.info('Or specify an agent: agentsea chat --agent <agent-name>');
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

  // Create agent
  const toolRegistry = new ToolRegistry();
  const agent = new Agent(
    {
      name: agentConfig.name,
      description: agentConfig.description,
      model: options.model || agentConfig.model,
      provider: providerConfig.type,
      systemPrompt: agentConfig.systemPrompt,
      temperature: agentConfig.temperature,
      maxTokens: agentConfig.maxTokens,
      outputFormat: options.format || 'text',
    },
    provider,
    toolRegistry,
  );

  // Create conversation context
  const context: AgentContext = {
    conversationId: `chat-${Date.now()}`,
    sessionData: {},
    history: [],
  };

  // Display welcome message
  logger.clear();
  logger.heading(`💬 AgentSea Chat - ${agentConfig.name}`);
  logger.keyValue('Model', agentConfig.model);
  logger.keyValue('Provider', providerName);
  if (options.format && options.format !== 'text') {
    logger.keyValue('Format', options.format);
  }
  if (options.stream) {
    logger.keyValue('Streaming', 'enabled');
  }
  logger.blank();
  logger.info(
    'Type your message and press Enter. Type "exit" or "quit" to end the chat.',
  );
  logger.divider();
  logger.blank();

  // Chat loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Get user input
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: chalk.bold.cyan('You:'),
        validate: (input) =>
          input.trim().length > 0 || 'Message cannot be empty',
      },
    ]);

    // Check for exit commands
    if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
      logger.blank();
      logger.info('Goodbye! 👋');
      break;
    }

    try {
      if (options.stream) {
        // Streaming response
        logger.blank();
        process.stdout.write(chalk.bold.green('Assistant: '));

        let fullResponse = '';
        for await (const chunk of agent.executeStream(message, context)) {
          if (chunk.type === 'content') {
            process.stdout.write(chunk.content);
            fullResponse += chunk.content;
          }
        }
        process.stdout.write('\n');
        logger.blank();

        // Update history
        context.history.push(
          { role: 'user', content: message },
          { role: 'assistant', content: fullResponse },
        );
      } else {
        // Show spinner while waiting for response
        const spinner = ora('Thinking...').start();

        // Get response from agent
        const response = await agent.execute(message, context);

        // Update history
        context.history.push(
          { role: 'user', content: message },
          { role: 'assistant', content: response.content },
        );

        spinner.stop();

        // Display response
        logger.blank();
        console.log(chalk.bold.green('Assistant:'), response.content);
        logger.blank();

        // Display metadata if verbose
        if (options.verbose) {
          logger.debug(
            `Tokens: ${response.metadata.tokensUsed}, ` +
              `Latency: ${response.metadata.latencyMs}ms, ` +
              `Iterations: ${response.metadata.iterations}`,
            true,
          );
        }
      }
    } catch (error) {
      logger.blank();
      logger.error('Failed to get response', error as Error);
      logger.blank();
    }
  }
}

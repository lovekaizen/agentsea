import inquirer from 'inquirer';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * List all MCP servers
 */
export function listMCPServersCommand(): void {
  logger.heading('🔌 MCP Servers');
  logger.blank();

  const config = configManager.getConfig();
  const servers = config.mcpServers || {};

  if (Object.keys(servers).length === 0) {
    logger.info('No MCP servers configured');
    logger.blank();
    logger.info('Add a server with: agentsea mcp add');
    return;
  }

  Object.entries(servers).forEach(([name, serverConfig]) => {
    logger.subheading(name);
    logger.keyValue('  Command', (serverConfig as MCPServerConfig).command);
    if ((serverConfig as MCPServerConfig).args) {
      logger.keyValue(
        '  Args',
        (serverConfig as MCPServerConfig).args?.join(' ') || '',
      );
    }
    logger.blank();
  });

  logger.info(`Total: ${Object.keys(servers).length} servers`);
}

/**
 * Get MCP server details
 */
export function getMCPServerCommand(name: string): void {
  logger.heading(`🔌 MCP Server: ${name}`);
  logger.blank();

  const config = configManager.getConfig();
  const servers = config.mcpServers || {};
  const server = servers[name] as MCPServerConfig | undefined;

  if (!server) {
    logger.error(`MCP server "${name}" not found`);
    logger.info('Available servers:');
    Object.keys(servers).forEach((serverName) => {
      logger.listItem(serverName);
    });
    return;
  }

  logger.keyValue('Name', name);
  logger.keyValue('Command', server.command);

  if (server.args && server.args.length > 0) {
    logger.keyValue('Args', server.args.join(' '));
  }

  if (server.env && Object.keys(server.env).length > 0) {
    logger.blank();
    logger.subheading('Environment Variables');
    Object.entries(server.env).forEach(([key, value]) => {
      logger.keyValue(`  ${key}`, value);
    });
  }

  logger.blank();
}

/**
 * Add a new MCP server
 */
export async function addMCPServerCommand(): Promise<void> {
  logger.heading('➕ Add MCP Server');
  logger.blank();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Server name:',
      validate: (input) => input.trim().length > 0 || 'Name is required',
    },
    {
      type: 'input',
      name: 'command',
      message: 'Command to run:',
      validate: (input) => input.trim().length > 0 || 'Command is required',
    },
    {
      type: 'input',
      name: 'args',
      message: 'Arguments (space-separated, optional):',
    },
  ]);

  const config = configManager.getConfig();
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  const serverConfig: MCPServerConfig = {
    command: answers.command.trim(),
  };

  if (answers.args && answers.args.trim()) {
    serverConfig.args = answers.args.trim().split(' ');
  }

  config.mcpServers[answers.name] = serverConfig;
  configManager.saveConfig(config);

  logger.blank();
  logger.success(`MCP server "${answers.name}" added successfully`);
}

/**
 * Delete an MCP server
 */
export async function deleteMCPServerCommand(name: string): Promise<void> {
  const config = configManager.getConfig();
  const servers = config.mcpServers || {};

  if (!servers[name]) {
    logger.error(`MCP server "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete MCP server "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete servers[name];
  config.mcpServers = servers;
  configManager.saveConfig(config);

  logger.success(`MCP server "${name}" deleted`);
}

/**
 * Show popular MCP servers
 */
export function showPopularMCPServersCommand(): void {
  logger.heading('⭐ Popular MCP Servers');
  logger.blank();

  const popularServers = [
    {
      name: 'filesystem',
      description: 'File system operations (read, write, search)',
      command: 'npx',
      args: '@modelcontextprotocol/server-filesystem',
    },
    {
      name: 'github',
      description: 'GitHub repository operations',
      command: 'npx',
      args: '@modelcontextprotocol/server-github',
    },
    {
      name: 'brave-search',
      description: 'Web search using Brave Search API',
      command: 'npx',
      args: '@modelcontextprotocol/server-brave-search',
    },
    {
      name: 'postgres',
      description: 'PostgreSQL database operations',
      command: 'npx',
      args: '@modelcontextprotocol/server-postgres',
    },
    {
      name: 'puppeteer',
      description: 'Browser automation and web scraping',
      command: 'npx',
      args: '@modelcontextprotocol/server-puppeteer',
    },
  ];

  popularServers.forEach((server) => {
    logger.subheading(server.name);
    logger.log(`  ${server.description}`);
    logger.keyValue('  Install', `${server.command} ${server.args}`);
    logger.blank();
  });

  logger.info('Install with: agentsea mcp add');
}

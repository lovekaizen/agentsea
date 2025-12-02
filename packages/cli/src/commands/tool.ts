import { ToolRegistry } from '@lov3kaizen/agentsea-core';

import { logger } from '../utils/logger';

/**
 * List all available tools
 */
export function listToolsCommand(): void {
  logger.heading('📦 Available Tools');
  logger.blank();

  const toolRegistry = new ToolRegistry();
  const tools = toolRegistry.getAll();

  if (tools.length === 0) {
    logger.info('No tools registered');
    return;
  }

  tools.forEach((tool) => {
    logger.subheading(tool.name);
    logger.log(`  ${tool.description}`);
    logger.blank();
  });

  logger.info(`Total: ${tools.length} tools`);
}

/**
 * Get tool details
 */
export function getToolCommand(name: string): void {
  logger.heading(`📦 Tool: ${name}`);
  logger.blank();

  const toolRegistry = new ToolRegistry();
  const tool = toolRegistry.get(name);

  if (!tool) {
    logger.error(`Tool "${name}" not found`);
    logger.info('Available tools:');
    const tools = toolRegistry.getAll();
    tools.forEach((t) => logger.listItem(t.name));
    return;
  }

  logger.keyValue('Name', tool.name);
  logger.keyValue('Description', tool.description);
  logger.blank();

  logger.subheading('Parameters');
  logger.log(`  Schema type: ${tool.parameters.constructor.name}`);
  logger.blank();
}

/**
 * Show popular/recommended tools
 */
export function showPopularToolsCommand(): void {
  logger.heading('⭐ Popular Tools');
  logger.blank();

  const popularTools = [
    {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      category: 'Built-in',
    },
    {
      name: 'http-request',
      description: 'Make HTTP requests',
      category: 'Built-in',
    },
    {
      name: 'filesystem',
      description: 'File system operations',
      category: 'MCP',
    },
    {
      name: 'database',
      description: 'Database queries',
      category: 'MCP',
    },
    {
      name: 'web-search',
      description: 'Search the web',
      category: 'MCP',
    },
  ];

  popularTools.forEach((tool) => {
    logger.subheading(tool.name);
    logger.log(`  ${tool.description}`);
    logger.keyValue('  Category', tool.category);
    logger.blank();
  });
}

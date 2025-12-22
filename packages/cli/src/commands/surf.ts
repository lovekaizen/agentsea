import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';

import { configManager } from '../config/manager';
import { logger } from '../utils/logger';

// Available backends
const BACKENDS = {
  macos: {
    name: 'macOS Native',
    description: 'Native macOS screen capture and input control',
    requirements: 'macOS with Accessibility permissions',
  },
  linux: {
    name: 'Linux Native',
    description: 'X11/Wayland screen capture and input',
    requirements: 'Linux with X11 or Wayland',
  },
  windows: {
    name: 'Windows Native',
    description: 'Native Windows screen capture and input',
    requirements: 'Windows 10+',
  },
  puppeteer: {
    name: 'Puppeteer Browser',
    description: 'Browser automation via Puppeteer',
    requirements: 'Node.js and Chrome/Chromium',
  },
  docker: {
    name: 'Docker Container',
    description: 'Isolated desktop environment in Docker',
    requirements: 'Docker with VNC support',
  },
};

// Available tools
const SURF_TOOLS = [
  { name: 'screenshot', description: 'Capture screen or region' },
  { name: 'click', description: 'Click at coordinates or element' },
  { name: 'type-text', description: 'Type text string' },
  { name: 'scroll', description: 'Scroll in direction' },
  { name: 'drag', description: 'Drag from point to point' },
  { name: 'key-press', description: 'Press keyboard keys/combos' },
  { name: 'cursor-move', description: 'Move cursor to position' },
  { name: 'wait', description: 'Wait for duration or element' },
];

export interface SurfConfig {
  name: string;
  backend: string;
  description?: string;
  config: Record<string, unknown>;
  enabledTools?: string[];
  safeMode?: boolean;
  screenshotDir?: string;
}

/**
 * Create a surf configuration
 */
export async function createSurfConfigCommand(): Promise<void> {
  logger.heading('Create Surf Configuration');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Configuration name:',
      validate: (input) => {
        if (!input.trim()) return 'Name is required';
        const config = configManager.getConfig();
        if (config.surfConfigs?.[input])
          return 'Configuration with this name already exists';
        return true;
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'A surf configuration',
    },
    {
      type: 'list',
      name: 'backend',
      message: 'Select backend:',
      choices: Object.entries(BACKENDS).map(([key, backend]) => ({
        name: `${backend.name} - ${backend.description}`,
        value: key,
      })),
    },
    {
      type: 'checkbox',
      name: 'enabledTools',
      message: 'Select enabled tools:',
      choices: SURF_TOOLS.map((tool) => ({
        name: `${tool.name} - ${tool.description}`,
        value: tool.name,
        checked: true,
      })),
    },
    {
      type: 'confirm',
      name: 'safeMode',
      message: 'Enable safe mode (confirm dangerous actions)?',
      default: true,
    },
    {
      type: 'input',
      name: 'screenshotDir',
      message: 'Screenshot output directory:',
      default: './screenshots',
    },
    // Docker-specific config
    {
      type: 'input',
      name: 'dockerImage',
      message: 'Docker image:',
      default: 'agentsea/surf-desktop:latest',
      when: (answers) => answers.backend === 'docker',
    },
    {
      type: 'input',
      name: 'vncPort',
      message: 'VNC port:',
      default: '5900',
      when: (answers) => answers.backend === 'docker',
    },
    // Puppeteer-specific config
    {
      type: 'confirm',
      name: 'headless',
      message: 'Run browser in headless mode?',
      default: false,
      when: (answers) => answers.backend === 'puppeteer',
    },
    {
      type: 'input',
      name: 'browserPath',
      message: 'Custom browser path (leave empty for default):',
      when: (answers) => answers.backend === 'puppeteer',
    },
  ]);

  // Build backend config
  let backendConfig: Record<string, unknown> = {};
  switch (answers.backend) {
    case 'docker':
      backendConfig = {
        image: answers.dockerImage,
        vncPort: parseInt(answers.vncPort, 10),
      };
      break;
    case 'puppeteer':
      backendConfig = {
        headless: answers.headless,
        browserPath: answers.browserPath || undefined,
      };
      break;
  }

  const surfConfig: SurfConfig = {
    name: answers.name,
    backend: answers.backend,
    description: answers.description,
    config: backendConfig,
    enabledTools: answers.enabledTools,
    safeMode: answers.safeMode,
    screenshotDir: answers.screenshotDir,
  };

  // Save surf configuration
  const config = configManager.getConfig();
  if (!config.surfConfigs) {
    config.surfConfigs = {};
  }
  config.surfConfigs[answers.name] = surfConfig;
  configManager.setConfig(config);

  logger.success(`Surf configuration "${answers.name}" created`);
}

/**
 * List surf configurations
 */
export function listSurfConfigsCommand(): void {
  const config = configManager.getConfig();
  const surfConfigs = config.surfConfigs || {};

  if (Object.keys(surfConfigs).length === 0) {
    logger.warn('No surf configurations');
    logger.info('Run `sea surf create` to create a configuration');
    return;
  }

  logger.heading('Surf Configurations');

  const data = [
    ['Name', 'Backend', 'Tools', 'Safe Mode', 'Description'],
    ...(Object.values(surfConfigs) as SurfConfig[]).map((cfg) => [
      cfg.name,
      cfg.backend,
      cfg.enabledTools?.length?.toString() || 'all',
      cfg.safeMode ? 'Yes' : 'No',
      cfg.description || '-',
    ]),
  ];

  console.log(table(data));
}

/**
 * Get surf configuration details
 */
export function getSurfConfigCommand(name: string): void {
  const config = configManager.getConfig();
  const surfConfig = config.surfConfigs?.[name] as SurfConfig | undefined;

  if (!surfConfig) {
    logger.error(`Surf configuration "${name}" not found`);
    return;
  }

  const backend = BACKENDS[surfConfig.backend as keyof typeof BACKENDS];

  logger.heading(`Surf Configuration: ${surfConfig.name}`);
  logger.keyValue('Description', surfConfig.description || '-');
  logger.keyValue('Backend', backend?.name || surfConfig.backend);
  logger.keyValue('Safe Mode', surfConfig.safeMode ? 'Enabled' : 'Disabled');
  logger.keyValue(
    'Screenshot Dir',
    surfConfig.screenshotDir || './screenshots',
  );

  logger.blank();
  logger.subheading('Enabled Tools');
  (surfConfig.enabledTools || SURF_TOOLS.map((t) => t.name)).forEach((tool) => {
    const toolDef = SURF_TOOLS.find((t) => t.name === tool);
    console.log(
      chalk.green(`  ✓ ${tool}`) +
        chalk.gray(` - ${toolDef?.description || ''}`),
    );
  });

  if (Object.keys(surfConfig.config).length > 0) {
    logger.blank();
    logger.subheading('Backend Configuration');
    Object.entries(surfConfig.config).forEach(([key, value]) => {
      if (value !== undefined) {
        logger.keyValue(key, String(value));
      }
    });
  }
}

/**
 * Delete a surf configuration
 */
export async function deleteSurfConfigCommand(name: string): Promise<void> {
  const config = configManager.getConfig();

  if (!config.surfConfigs?.[name]) {
    logger.error(`Surf configuration "${name}" not found`);
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to delete surf configuration "${name}"?`,
      default: false,
    },
  ]);

  if (!confirm) {
    logger.info('Cancelled');
    return;
  }

  delete config.surfConfigs[name];
  configManager.setConfig(config);
  logger.success(`Surf configuration "${name}" deleted`);
}

/**
 * Show available backends
 */
export function showBackendsCommand(): void {
  logger.heading('Available Backends');
  logger.blank();

  Object.entries(BACKENDS).forEach(([key, backend]) => {
    console.log(chalk.bold.cyan(`  ${backend.name}`));
    console.log(chalk.gray(`    ID: ${key}`));
    console.log(chalk.white(`    ${backend.description}`));
    console.log(chalk.yellow(`    Requirements: ${backend.requirements}`));
    logger.blank();
  });
}

/**
 * Show available tools
 */
export function showSurfToolsCommand(): void {
  logger.heading('Surf Tools');

  const data = [
    ['Tool', 'Description'],
    ...SURF_TOOLS.map((tool) => [tool.name, tool.description]),
  ];

  console.log(table(data));
}

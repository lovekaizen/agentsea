import { existsSync } from 'fs';
import { join } from 'path';

import Conf from 'conf';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

export interface AgentConfig {
  name: string;
  description: string;
  model: string;
  provider: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderConfig {
  name: string;
  type: 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'openai-compatible';
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface WorkflowConfig {
  name: string;
  description: string;
  type: 'sequential' | 'parallel' | 'supervisor';
  agents: string[];
}

export interface AigenticConfig {
  defaultProvider?: string;
  defaultAgent?: string;
  providers: Record<string, ProviderConfig>;
  agents: Record<string, AgentConfig>;
  mcpServers?: Record<string, MCPServerConfig>;
  workflows?: Record<string, WorkflowConfig>;
}

/**
 * Configuration manager for AgentSea CLI
 */
export class ConfigManager {
  private conf: Conf<AigenticConfig>;

  constructor() {
    this.conf = new Conf<AigenticConfig>({
      projectName: 'agentsea-cli',
      defaults: {
        providers: {},
        agents: {},
        mcpServers: {},
        workflows: {},
      },
    });
  }

  /**
   * Get the full configuration
   */
  getConfig(): AigenticConfig {
    return this.conf.store;
  }

  /**
   * Save the full configuration
   */
  saveConfig(config: AigenticConfig): void {
    this.conf.store = config;
  }

  /**
   * Set a configuration value
   */
  set<K extends keyof AigenticConfig>(key: K, value: AigenticConfig[K]): void {
    this.conf.set(key, value);
  }

  /**
   * Get a configuration value
   */
  get<K extends keyof AigenticConfig>(key: K): AigenticConfig[K] {
    return this.conf.get(key);
  }

  /**
   * Add or update a provider
   */
  setProvider(name: string, config: ProviderConfig): void {
    const providers = this.conf.get('providers') || {};
    providers[name] = config;
    this.conf.set('providers', providers);
  }

  /**
   * Get a provider configuration
   */
  getProvider(name: string): ProviderConfig | undefined {
    const providers = this.conf.get('providers') || {};
    return providers[name];
  }

  /**
   * Get all providers
   */
  getAllProviders(): Record<string, ProviderConfig> {
    return this.conf.get('providers') || {};
  }

  /**
   * Delete a provider
   */
  deleteProvider(name: string): void {
    const providers = this.conf.get('providers') || {};
    delete providers[name];
    this.conf.set('providers', providers);
  }

  /**
   * Add or update an agent
   */
  setAgent(name: string, config: AgentConfig): void {
    const agents = this.conf.get('agents') || {};
    agents[name] = config;
    this.conf.set('agents', agents);
  }

  /**
   * Get an agent configuration
   */
  getAgent(name: string): AgentConfig | undefined {
    const agents = this.conf.get('agents') || {};
    return agents[name];
  }

  /**
   * Get all agents
   */
  getAllAgents(): Record<string, AgentConfig> {
    return this.conf.get('agents') || {};
  }

  /**
   * Delete an agent
   */
  deleteAgent(name: string): void {
    const agents = this.conf.get('agents') || {};
    delete agents[name];
    this.conf.set('agents', agents);
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: string): void {
    this.conf.set('defaultProvider', provider);
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): string | undefined {
    return this.conf.get('defaultProvider');
  }

  /**
   * Set the default agent
   */
  setDefaultAgent(agent: string): void {
    this.conf.set('defaultAgent', agent);
  }

  /**
   * Get the default agent
   */
  getDefaultAgent(): string | undefined {
    return this.conf.get('defaultAgent');
  }

  /**
   * Get API key from config or environment
   */
  getApiKey(provider: string): string | undefined {
    const providerConfig = this.getProvider(provider);

    // First try config
    if (providerConfig?.apiKey) {
      return providerConfig.apiKey;
    }

    // Then try environment variables
    switch (providerConfig?.type) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY;
      case 'openai':
        return process.env.OPENAI_API_KEY;
      case 'gemini':
        return process.env.GEMINI_API_KEY;
      default:
        return undefined;
    }
  }

  /**
   * Get the configuration file path
   */
  getConfigPath(): string {
    return this.conf.path;
  }

  /**
   * Clear all configuration
   */
  clear(): void {
    this.conf.clear();
  }

  /**
   * Check if configuration is initialized
   */
  isInitialized(): boolean {
    const providers = this.conf.get('providers') || {};
    return Object.keys(providers).length > 0;
  }

  /**
   * Check if .env file exists
   */
  hasEnvFile(): boolean {
    return existsSync(join(process.cwd(), '.env'));
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

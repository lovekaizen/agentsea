import {
  AgentConfig,
  LLMProvider,
  AnthropicProvider,
  OpenAIProvider,
  ToolRegistry,
  MemoryStore,
  BufferMemory,
} from '@lov3kaizen/agentsea-core';
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AgentController } from '../controllers/agent.controller';
import { AgentGateway } from '../gateways/agent.gateway';
import { AgentService } from '../services/agent.service';

export interface AgenticModuleOptions {
  provider: 'anthropic' | 'openai' | LLMProvider;
  apiKey?: string;
  memory?: MemoryStore;
  defaultAgentConfig?: Partial<AgentConfig>;
  enableRestApi?: boolean;
  enableWebSocket?: boolean;
}

@Module({})
export class AgenticModule {
  static forRoot(options: AgenticModuleOptions): DynamicModule {
    const providers: Provider[] = [AgentService];
    const controllers = [];
    const gateways = [];

    // Provider
    const providerInstance =
      typeof options.provider === 'string'
        ? options.provider === 'anthropic'
          ? new AnthropicProvider(options.apiKey)
          : new OpenAIProvider(options.apiKey)
        : options.provider;

    providers.push({
      provide: 'LLM_PROVIDER',
      useValue: providerInstance,
    });

    // Tool Registry
    providers.push({
      provide: ToolRegistry,
      useValue: new ToolRegistry(),
    });

    // Memory Store
    const memoryInstance = options.memory || new BufferMemory();
    providers.push({
      provide: 'MEMORY_STORE',
      useValue: memoryInstance,
    });

    // Module options
    providers.push({
      provide: 'AGENTIC_MODULE_OPTIONS',
      useValue: options,
    });

    // Conditionally enable REST API
    if (options.enableRestApi !== false) {
      controllers.push(AgentController);
    }

    // Conditionally enable WebSocket
    if (options.enableWebSocket !== false) {
      gateways.push(AgentGateway);
    }

    return {
      module: AgenticModule,
      controllers,
      providers: [...providers, ...gateways],
      exports: providers,
      global: true,
    };
  }

  static forRootAsync(options: {
    imports?: any[];
    useFactory: (
      ...args: any[]
    ) => Promise<AgenticModuleOptions> | AgenticModuleOptions;
    inject?: any[];
  }): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'AGENTIC_MODULE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];

    return {
      module: AgenticModule,
      imports: options.imports || [],
      providers,
      exports: providers,
      global: true,
    };
  }
}

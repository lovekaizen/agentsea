import {
  AnthropicProvider,
  OpenAIProvider,
  ToolRegistry,
  BufferMemory,
  type LLMProvider,
  type MemoryStore,
} from '@lov3kaizen/agentsea-core';
import { describe, it, expect } from 'vitest';

import {
  AgenticModule,
  type AgenticModuleOptions,
} from '../modules/agentic.module';
import { AgentService } from '../services/agent.service';
import { AgentController } from '../controllers/agent.controller';
import { AgentGateway } from '../gateways/agent.gateway';

function findProvider(providers: any[], token: unknown) {
  return providers.find(
    (p) => p && typeof p === 'object' && p.provide === token,
  );
}

describe('AgenticModule.forRoot', () => {
  it('returns a global dynamic module wired to AgenticModule', () => {
    const mod = AgenticModule.forRoot({ provider: 'anthropic' });
    expect(mod.module).toBe(AgenticModule);
    expect(mod.global).toBe(true);
  });

  it('instantiates an AnthropicProvider when provider is "anthropic"', () => {
    const mod = AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: 'test-key',
    });
    const llm = findProvider(mod.providers as any[], 'LLM_PROVIDER');
    expect(llm).toBeDefined();
    expect(llm.useValue).toBeInstanceOf(AnthropicProvider);
  });

  it('instantiates an OpenAIProvider when provider is "openai"', () => {
    const mod = AgenticModule.forRoot({
      provider: 'openai',
      apiKey: 'test-key',
    });
    const llm = findProvider(mod.providers as any[], 'LLM_PROVIDER');
    expect(llm.useValue).toBeInstanceOf(OpenAIProvider);
  });

  it('uses a custom LLMProvider instance as-is', () => {
    const custom: LLMProvider = {
      generateResponse: async () => ({
        content: '',
        stopReason: 'stop',
        usage: { inputTokens: 0, outputTokens: 0 },
        rawResponse: null,
      }),
      parseToolCalls: () => [],
    };
    const mod = AgenticModule.forRoot({ provider: custom });
    const llm = findProvider(mod.providers as any[], 'LLM_PROVIDER');
    expect(llm.useValue).toBe(custom);
  });

  it('registers a ToolRegistry provider', () => {
    const mod = AgenticModule.forRoot({ provider: 'anthropic' });
    const reg = findProvider(mod.providers as any[], ToolRegistry);
    expect(reg).toBeDefined();
    expect(reg.useValue).toBeInstanceOf(ToolRegistry);
  });

  it('defaults the memory store to BufferMemory', () => {
    const mod = AgenticModule.forRoot({ provider: 'anthropic' });
    const mem = findProvider(mod.providers as any[], 'MEMORY_STORE');
    expect(mem.useValue).toBeInstanceOf(BufferMemory);
  });

  it('uses the supplied memory store when provided', () => {
    const memory: MemoryStore = {
      save: async () => {},
      load: async () => [],
      clear: async () => {},
    };
    const mod = AgenticModule.forRoot({ provider: 'anthropic', memory });
    const mem = findProvider(mod.providers as any[], 'MEMORY_STORE');
    expect(mem.useValue).toBe(memory);
  });

  it('exposes the module options through the AGENTIC_MODULE_OPTIONS token', () => {
    const options: AgenticModuleOptions = {
      provider: 'anthropic',
      apiKey: 'k',
    };
    const mod = AgenticModule.forRoot(options);
    const opt = findProvider(mod.providers as any[], 'AGENTIC_MODULE_OPTIONS');
    expect(opt.useValue).toBe(options);
  });

  it('includes the AgentService provider', () => {
    const mod = AgenticModule.forRoot({ provider: 'anthropic' });
    expect((mod.providers as any[]).includes(AgentService)).toBe(true);
  });

  it('registers the REST controller and WebSocket gateway by default', () => {
    const mod = AgenticModule.forRoot({ provider: 'anthropic' });
    expect((mod.controllers as any[]).includes(AgentController)).toBe(true);
    expect((mod.providers as any[]).includes(AgentGateway)).toBe(true);
  });

  it('omits the controller when enableRestApi is false', () => {
    const mod = AgenticModule.forRoot({
      provider: 'anthropic',
      enableRestApi: false,
    });
    expect((mod.controllers as any[]).includes(AgentController)).toBe(false);
  });

  it('omits the gateway when enableWebSocket is false', () => {
    const mod = AgenticModule.forRoot({
      provider: 'anthropic',
      enableWebSocket: false,
    });
    expect((mod.providers as any[]).includes(AgentGateway)).toBe(false);
  });
});

describe('AgenticModule.forRootAsync', () => {
  it('returns a global dynamic module with a useFactory options provider', () => {
    const useFactory = () => ({ provider: 'anthropic' as const });
    const mod = AgenticModule.forRootAsync({ useFactory });
    expect(mod.module).toBe(AgenticModule);
    expect(mod.global).toBe(true);
    const opt = findProvider(mod.providers as any[], 'AGENTIC_MODULE_OPTIONS');
    expect(opt.useFactory).toBe(useFactory);
    expect(opt.inject).toEqual([]);
  });

  it('passes through imports and inject arrays', () => {
    const imports = [class Foo {}];
    const inject = ['SOME_TOKEN'];
    const mod = AgenticModule.forRootAsync({
      imports,
      inject,
      useFactory: () => ({ provider: 'anthropic' }),
    });
    expect(mod.imports).toBe(imports);
    const opt = findProvider(mod.providers as any[], 'AGENTIC_MODULE_OPTIONS');
    expect(opt.inject).toBe(inject);
  });
});

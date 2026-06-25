import {
  Agent,
  ToolRegistry,
  type AgentConfig,
  type LLMProvider,
} from '@lov3kaizen/agentsea-core';
import { describe, it, expect, beforeEach } from 'vitest';

import { AgentService } from '../services/agent.service';

const provider: LLMProvider = {
  generateResponse: async () => ({
    content: '',
    stopReason: 'stop',
    usage: { inputTokens: 0, outputTokens: 0 },
    rawResponse: null,
  }),
  parseToolCalls: () => [],
};

function makeAgent(name: string): Agent {
  const config: AgentConfig = {
    name,
    description: `${name} agent`,
    model: 'claude-opus-4-8',
    provider: 'anthropic',
  };
  return new Agent(config, provider, new ToolRegistry());
}

describe('AgentService', () => {
  let service: AgentService;

  beforeEach(() => {
    service = new AgentService();
  });

  it('registers and retrieves an agent by name', () => {
    const agent = makeAgent('alpha');
    service.registerAgent(agent);
    expect(service.getAgent('alpha')).toBe(agent);
  });

  it('returns undefined for an unknown agent', () => {
    expect(service.getAgent('missing')).toBeUndefined();
  });

  it('reports whether an agent exists', () => {
    expect(service.hasAgent('alpha')).toBe(false);
    service.registerAgent(makeAgent('alpha'));
    expect(service.hasAgent('alpha')).toBe(true);
  });

  it('returns all registered agents', () => {
    const a = makeAgent('a');
    const b = makeAgent('b');
    service.registerAgent(a);
    service.registerAgent(b);
    expect(service.getAllAgents()).toEqual(expect.arrayContaining([a, b]));
    expect(service.getAllAgents()).toHaveLength(2);
  });

  it('overwrites an agent registered under the same name', () => {
    const first = makeAgent('dup');
    const second = makeAgent('dup');
    service.registerAgent(first);
    service.registerAgent(second);
    expect(service.getAgent('dup')).toBe(second);
    expect(service.getAllAgents()).toHaveLength(1);
  });

  it('unregisters an existing agent and returns true', () => {
    service.registerAgent(makeAgent('alpha'));
    expect(service.unregisterAgent('alpha')).toBe(true);
    expect(service.hasAgent('alpha')).toBe(false);
  });

  it('returns false when unregistering a missing agent', () => {
    expect(service.unregisterAgent('nope')).toBe(false);
  });
});

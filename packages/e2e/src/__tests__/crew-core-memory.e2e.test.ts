/**
 * Cross-package end-to-end test.
 *
 * Wires three packages together the way a real application would:
 *   - @lov3kaizen/agentsea-crews   — multi-agent orchestration
 *   - @lov3kaizen/agentsea-core    — the LLMProvider contract + BufferMemory
 *   - @lov3kaizen/agentsea-types   — shared Message/Provider types
 *
 * A mock provider stands in for a real LLM (no network), so the test verifies
 * the *integration contract*: a crew delegates tasks to agents, each agent's
 * execution flows through the core provider interface, and the results are
 * persisted to and reloaded from core memory.
 */

import { describe, it, expect } from 'vitest';
import { createCrew } from '@lov3kaizen/agentsea-crews';
import { BufferMemory } from '@lov3kaizen/agentsea-core';
import type {
  LLMProvider,
  Message,
  ProviderConfig,
  LLMResponse,
} from '@lov3kaizen/agentsea-types';

/** A deterministic in-memory provider implementing the core LLMProvider contract. */
const mockProvider: LLMProvider = {
  async generateResponse(
    messages: Message[],
    config: ProviderConfig,
  ): Promise<LLMResponse> {
    const last = messages[messages.length - 1]?.content ?? '';
    const input = typeof last === 'string' ? last : JSON.stringify(last);
    return {
      content: `[${config.model}] handled: ${input}`,
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
      rawResponse: null,
    };
  },
  parseToolCalls() {
    return [];
  },
};

/** Adapt the core provider into the execute fn crews expects. */
async function execute(input: string, systemPrompt: string) {
  const res = await mockProvider.generateResponse(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
    { model: 'mock-model' },
  );
  return {
    output: res.content,
    tokensUsed: res.usage.inputTokens + res.usage.outputTokens,
    latencyMs: 1,
    iterations: 1,
  };
}

describe('e2e: crews + core provider + core memory', () => {
  it('runs a crew through the core provider contract and persists to memory', async () => {
    const crew = createCrew({
      name: 'e2e-crew',
      delegationStrategy: 'best-match',
      // Inject the core-provider-backed executor for every agent.
      execute,
      agents: [
        {
          name: 'worker',
          role: {
            name: 'Worker',
            description: 'Performs assigned tasks',
            capabilities: [
              {
                name: 'coding',
                description: 'writes code',
                proficiency: 'expert',
              },
            ],
            systemPrompt: 'You are a diligent worker.',
          },
          model: 'mock-model',
          provider: 'mock',
        },
      ],
    });

    crew.addTask({
      description: 'Implement the feature',
      expectedOutput: 'a result',
      requiredCapabilities: ['coding'],
    });

    const result = await crew.kickoff();

    // The crew completed and the output came from the core provider (not a mock
    // stub inside crews) — proving the crews→core execution path is wired.
    expect(result.success).toBe(true);
    expect(result.taskResults).toHaveLength(1);
    const output = result.taskResults[0].output;
    expect(output).toContain('[mock-model] handled:');
    expect(output).toContain('Implement the feature');

    // Persist the crew output to core memory and read it back.
    const memory = new BufferMemory();
    await memory.save('e2e-crew', [{ role: 'assistant', content: output }]);
    const loaded = await memory.load('e2e-crew');

    expect(loaded).toHaveLength(1);
    expect(loaded[0].content).toBe(output);
    expect(memory.size()).toBe(1);
  });

  it('mock mode short-circuits execution without touching the provider', async () => {
    const crew = createCrew({
      name: 'e2e-crew-mock',
      delegationStrategy: 'best-match',
      mock: true,
      agents: [
        {
          name: 'worker',
          role: {
            name: 'Worker',
            description: 'Performs assigned tasks',
            capabilities: [
              {
                name: 'coding',
                description: 'writes code',
                proficiency: 'expert',
              },
            ],
            systemPrompt: 'You are a diligent worker.',
          },
          model: 'mock-model',
          provider: 'mock',
        },
      ],
    });

    crew.addTask({
      description: 'Offline task',
      expectedOutput: 'a result',
      requiredCapabilities: ['coding'],
    });

    const result = await crew.kickoff();
    expect(result.success).toBe(true);
    expect(result.taskResults[0].output).toContain(
      '[Mock response from worker]',
    );
  });
});

/**
 * Cross-package end-to-end test for the DEFAULT crew execution path.
 *
 * Unlike `crew-core-memory.e2e.test.ts`, this test does NOT inject a custom
 * `execute` function. It exercises the path a real application hits out of the
 * box: `createCrew` → `createCrewAgent` → `CoreExecutor` → a core LLM provider.
 *
 * To keep the test deterministic and network-free, a fake provider satisfying
 * the core `generateResponse` contract is injected via the new `provider`
 * seam. This proves the default executor is wired end-to-end (the agent's
 * output flows through `CoreExecutor.generateResponse`, not the crews-internal
 * mock fallback) without requiring API keys or live HTTP.
 */

import { describe, it, expect, vi } from 'vitest';
import { createCrew } from '@lov3kaizen/agentsea-crews';
import type { CoreLLMProvider } from '@lov3kaizen/agentsea-crews';

function makeProvider(): CoreLLMProvider {
  return {
    generateResponse: vi.fn(
      async (
        messages: Array<{ role: string; content: string }>,
        config: { model: string; systemPrompt?: string },
      ) => {
        const userMsg =
          [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
        return {
          content: `[${config.model}] ${config.systemPrompt ? 'sys-aware ' : ''}=> ${userMsg.slice(0, 40)}`,
          usage: { inputTokens: 12, outputTokens: 8 },
        };
      },
    ),
  };
}

function workerAgent() {
  return {
    name: 'worker',
    role: {
      name: 'Worker',
      description: 'Performs assigned tasks',
      capabilities: [
        {
          name: 'coding',
          description: 'writes code',
          proficiency: 'expert' as const,
        },
      ],
      systemPrompt: 'You are a diligent worker.',
    },
    model: 'claude-test-model',
    provider: 'anthropic',
  };
}

describe('e2e: crews default executor (CoreExecutor) via injected provider', () => {
  it('runs the default executor end-to-end without a custom execute fn', async () => {
    const provider = makeProvider();

    // No `execute`, no `mock` → the default CoreExecutor path is used. The
    // injected `provider` stands in for a real core provider (no network).
    const crew = createCrew({
      name: 'e2e-default-crew',
      delegationStrategy: 'best-match',
      provider,
      agents: [workerAgent()],
    });

    crew.addTask({
      description: 'Implement the feature',
      expectedOutput: 'a result',
      requiredCapabilities: ['coding'],
    });

    const result = await crew.kickoff();

    expect(result.success).toBe(true);
    expect(result.taskResults).toHaveLength(1);

    // The output proves it flowed through CoreExecutor → provider.generateResponse
    // (model name + system-prompt awareness), not the crews mock fallback
    // (which would emit "[Mock response from worker]").
    const output = result.taskResults[0].output;
    expect(output).toContain('[claude-test-model]');
    expect(output).toContain('sys-aware');
    expect(output).not.toContain('[Mock response');

    // The injected provider was actually invoked.
    expect(provider.generateResponse).toHaveBeenCalledTimes(1);

    // Token accounting from the provider usage propagated to the task result.
    expect(result.taskResults[0].tokensUsed).toBe(20);
  });

  it('still honors mock: true as an explicit opt-out (no provider call)', async () => {
    const provider = makeProvider();

    const crew = createCrew({
      name: 'e2e-default-crew-mock',
      delegationStrategy: 'best-match',
      mock: true,
      provider, // present but ignored because mock wins
      agents: [workerAgent()],
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
    expect(provider.generateResponse).not.toHaveBeenCalled();
  });
});

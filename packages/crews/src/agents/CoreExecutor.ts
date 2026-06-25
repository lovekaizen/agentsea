/**
 * CoreExecutor
 *
 * Builds a real LLM execute function backed by @lov3kaizen/agentsea-core
 * providers. This is what lets a CrewAgent actually call an LLM instead of
 * returning a mock response.
 *
 * `@lov3kaizen/agentsea-core` is a required peer dependency. It is imported
 * lazily (on first execution) so that:
 *   - consumers who inject their own `execute` never load it, and
 *   - building/using crews purely for orchestration scaffolding (or in tests
 *     with `mock: true`) does not require provider SDKs or API keys.
 */

import type { CrewAgentConfig } from '../types';
import type { AgentExecutionResult } from './CrewAgent';

/** Minimal shape of a core LLM provider that this module relies on. */
interface CoreLLMProvider {
  generateResponse(
    messages: Array<{ role: string; content: string }>,
    config: {
      model: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
  }>;
}

/** Lazily import core and instantiate the provider for a given provider name. */
async function loadProvider(providerName: string): Promise<CoreLLMProvider> {
  let core: Record<string, unknown>;
  try {
    core = (await import('@lov3kaizen/agentsea-core')) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error(
      'CrewAgent requires "@lov3kaizen/agentsea-core" to execute against a real ' +
        'LLM. Install it, or pass a custom `execute` function (or `mock: true`) ' +
        'to createCrewAgent / createCrew.',
    );
  }

  const Ctor = resolveProviderCtor(core, providerName);
  return new (Ctor as new () => CoreLLMProvider)();
}

function resolveProviderCtor(
  core: Record<string, unknown>,
  providerName: string,
): unknown {
  switch ((providerName ?? '').toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return core.AnthropicProvider;
    case 'openai':
    case 'gpt':
      return core.OpenAIProvider;
    case 'gemini':
    case 'google':
      return core.GeminiProvider;
    case 'ollama':
      return core.OllamaProvider;
    default:
      throw new Error(
        `CrewAgent: unsupported provider "${providerName}". Supported providers ` +
          'are: anthropic, openai, gemini, ollama. Pass a custom `execute` ' +
          'function to createCrewAgent for any other provider.',
      );
  }
}

/**
 * Create a default execute function for a crew agent that calls a real LLM
 * via core providers. The provider is constructed once on first use.
 */
export function createCoreExecutor(
  config: CrewAgentConfig,
): (input: string, systemPrompt: string) => Promise<AgentExecutionResult> {
  let providerPromise: Promise<CoreLLMProvider> | undefined;

  const getProvider = (): Promise<CoreLLMProvider> => {
    if (!providerPromise) {
      providerPromise = loadProvider(config.provider);
    }
    return providerPromise;
  };

  return async (
    input: string,
    systemPrompt: string,
  ): Promise<AgentExecutionResult> => {
    const provider = await getProvider();
    const start = Date.now();

    const response = await provider.generateResponse(
      [{ role: 'user', content: input }],
      {
        model: config.model,
        systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      },
    );

    return {
      output: response.content,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      latencyMs: Date.now() - start,
      iterations: 1,
    };
  };
}

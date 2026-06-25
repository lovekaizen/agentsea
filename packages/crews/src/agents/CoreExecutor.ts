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

import type { CrewAgentConfig, CoreLLMProvider } from '../types';
import type { AgentExecutionResult } from './CrewAgent';

export type { CoreLLMProvider };

/** Lazily import core and instantiate the provider for a given provider name. */
async function loadProvider(providerName: string): Promise<CoreLLMProvider> {
  // Validate the provider name BEFORE importing core. Unsupported providers
  // reject immediately and never pay the (potentially multi-second, cold)
  // cost of loading core's full provider module graph.
  const ctorName = resolveProviderCtorName(providerName);

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

  const Ctor = core[ctorName];
  return new (Ctor as new () => CoreLLMProvider)();
}

/** Map a provider name to the core export that constructs it. Pure; no import. */
function resolveProviderCtorName(providerName: string): string {
  switch ((providerName ?? '').toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return 'AnthropicProvider';
    case 'openai':
    case 'gpt':
      return 'OpenAIProvider';
    case 'gemini':
    case 'google':
      return 'GeminiProvider';
    case 'ollama':
      return 'OllamaProvider';
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
  options: { provider?: CoreLLMProvider } = {},
): (input: string, systemPrompt: string) => Promise<AgentExecutionResult> {
  let providerPromise: Promise<CoreLLMProvider> | undefined;

  const getProvider = (): Promise<CoreLLMProvider> => {
    if (!providerPromise) {
      // An injected provider takes precedence over lazily loading one from core
      // by name. This enables DI and deterministic, network-free e2e tests
      // while keeping the default (load-by-name) behavior unchanged.
      providerPromise = options.provider
        ? Promise.resolve(options.provider)
        : loadProvider(config.provider);
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

/**
 * Per-Model Type Safety Example
 *
 * This example demonstrates how the AgentSea SDK provides compile-time
 * type safety for model-specific configurations, inspired by TanStack AI.
 *
 * Key benefits:
 * - TypeScript errors for invalid model options at compile time
 * - IDE autocomplete shows only valid options per model
 * - Zero runtime overhead - all validation happens during TypeScript compilation
 *
 * @see https://tanstack.com/ai/latest/docs/guides/per-model-type-safety
 */

import { z } from 'zod';
import {
  // Config builders (type-safe)
  anthropic,
  openai,
  gemini,
  ollama,

  // Type-safe provider factories
  createProvider,
  createAnthropicProvider,
  createOpenAIProvider,

  // Model registry utilities
  getModelInfo,
  getModelsForProvider,
  getModelsWithCapability,
  modelSupportsCapability,

  // Types
  type Tool,
  type AnthropicModel,
  type OpenAIModel,
} from '@lov3kaizen/agentsea-core';

// ============================================================================
// Example Tool
// ============================================================================

const calculatorTool: Tool = {
  name: 'calculator',
  description: 'Perform basic arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async (params) => {
    switch (params.operation) {
      case 'add':
        return params.a + params.b;
      case 'subtract':
        return params.a - params.b;
      case 'multiply':
        return params.a * params.b;
      case 'divide':
        return params.a / params.b;
    }
  },
};

// ============================================================================
// Valid Configuration Examples
// ============================================================================

console.log('=== Per-Model Type Safety Examples ===\n');

// ✅ Claude 3.5 Sonnet: Supports tools, system prompts, and extended thinking
const claude35Config = anthropic('claude-3-5-sonnet-20241022', {
  tools: [calculatorTool],
  systemPrompt: 'You are a helpful math assistant',
  thinking: { type: 'enabled', budgetTokens: 10000 },
  temperature: 0.7,
  maxTokens: 4096,
});
console.log('Claude 3.5 Sonnet config:', claude35Config);

// ✅ Claude 3 Haiku: Supports tools and system prompts but NOT extended thinking
const claude3HaikuConfig = anthropic('claude-3-haiku-20240307', {
  tools: [calculatorTool],
  systemPrompt: 'You are a fast assistant',
  temperature: 0.5,
  // thinking: { ... } // ❌ Would be a TypeScript error - Haiku doesn't support extended thinking
});
console.log('Claude 3 Haiku config:', claude3HaikuConfig);

// ✅ GPT-4o: Supports tools, system prompts, structured output
const gpt4oConfig = openai('gpt-4o', {
  tools: [calculatorTool],
  systemPrompt: 'You are a helpful assistant',
  temperature: 0.8,
});
console.log('GPT-4o config:', gpt4oConfig);

// ✅ o1: Supports tools and reasoning, but NOT system prompts
const o1Config = openai('o1', {
  tools: [calculatorTool],
  reasoningEffort: 'high',
  // systemPrompt: '...' // ❌ Would be a TypeScript error - o1 doesn't support system prompts
});
console.log('o1 config:', o1Config);

// ✅ o1-mini: NO tools, NO system prompts, just reasoning
const o1MiniConfig = openai('o1-mini', {
  reasoningEffort: 'medium',
  // tools: [...] // ❌ Would be a TypeScript error - o1-mini doesn't support tools
  // systemPrompt: '...' // ❌ Would be a TypeScript error
});
console.log('o1-mini config:', o1MiniConfig);

// ✅ Gemini 1.5 Pro: Supports everything
const geminiConfig = gemini('gemini-1.5-pro', {
  tools: [calculatorTool],
  systemPrompt: 'You are helpful',
  topK: 40,
  temperature: 0.9,
});
console.log('Gemini 1.5 Pro config:', geminiConfig);

// ✅ Ollama: Dynamic models (less strict typing)
const ollamaConfig = ollama('llama3.2', {
  systemPrompt: 'You are a local assistant',
  temperature: 0.7,
});
console.log('Ollama config:', ollamaConfig);

// ============================================================================
// Type-Safe Provider Creation
// ============================================================================

console.log('\n=== Type-Safe Provider Creation ===\n');

// Create providers with full type safety
const claudeProvider = createProvider(claude35Config);
console.log('Claude provider created for model:', claudeProvider.config.model);
console.log('Supports tools:', claudeProvider.supportsCapability('tools'));
console.log('Supports vision:', claudeProvider.supportsCapability('vision'));
console.log(
  'Supports extended thinking:',
  claudeProvider.supportsCapability('extendedThinking'),
);

const o1Provider = createProvider(o1Config);
console.log('\no1 provider created for model:', o1Provider.config.model);
console.log('Supports tools:', o1Provider.supportsCapability('tools'));
console.log(
  'Supports system message:',
  o1Provider.supportsCapability('systemMessage'),
);

// ============================================================================
// Model Registry Utilities
// ============================================================================

console.log('\n=== Model Registry Utilities ===\n');

// Get model info
const modelInfo = getModelInfo('claude-3-5-sonnet-20241022');
console.log('Claude 3.5 Sonnet info:', modelInfo);

// Get all models for a provider
const anthropicModels = getModelsForProvider('anthropic');
console.log(
  '\nAll Anthropic models:',
  anthropicModels.map((m) => m.displayName),
);

// Get models with specific capability
const visionModels = getModelsWithCapability('vision', true);
console.log(
  '\nModels with vision support:',
  visionModels.map((m) => m.displayName),
);

const thinkingModels = getModelsWithCapability('extendedThinking', true);
console.log(
  'Models with extended thinking:',
  thinkingModels.map((m) => m.displayName),
);

// Runtime capability check
console.log('\nRuntime capability checks:');
console.log(
  'gpt-4o supports tools:',
  modelSupportsCapability('gpt-4o', 'tools'),
);
console.log(
  'o1-mini supports tools:',
  modelSupportsCapability('o1-mini', 'tools'),
);
console.log(
  'claude-3-5-sonnet-20241022 context window:',
  getModelInfo('claude-3-5-sonnet-20241022')?.capabilities.contextWindow,
);

// ============================================================================
// Type-Safe Function Signatures
// ============================================================================

/**
 * Example: A function that only accepts models with tool support
 */
function runAgentWithTools<T extends OpenAIModel | AnthropicModel>(
  model: T,
  tools: Tool[],
): void {
  // This function signature ensures the model supports tools
  console.log(`\nRunning agent with model: ${model} and ${tools.length} tools`);
}

// ✅ Works - these models support tools
runAgentWithTools('gpt-4o', [calculatorTool]);
runAgentWithTools('claude-3-5-sonnet-20241022', [calculatorTool]);

console.log('\n=== Type Safety Demo Complete ===');

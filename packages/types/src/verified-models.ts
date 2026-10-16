/**
 * Verified model specifications
 *
 * Only fields that were re-checked against the provider's own pages are
 * recorded here. A field that was not re-checked is left out, not guessed.
 * `source` names the page the row came from; `accessed` is the date it was
 * read. Prices are USD per 1M tokens, as printed on the pricing page.
 *
 * This table is not yet read by MODEL_REGISTRY. Wiring it in is a separate
 * decision, because MODEL_REGISTRY requires fields (streaming,
 * structuredOutput, systemMessage, parallelToolCalls) that have not been
 * verified for these models yet.
 */

export interface VerifiedModelPrice {
  input: number;
  output: number;
  /** Cached-input price, when the pricing page lists one. */
  cachedInput?: number;
}

export interface VerifiedModelSpec {
  provider: 'anthropic' | 'openai';
  /** API model ID, exactly as the provider documents it. */
  model: string;
  contextWindow: number;
  maxOutputTokens: number;
  tools: boolean;
  vision: boolean;
  /** Reasoning behaviour as the provider describes it, quoted in short form. */
  reasoning: string;
  /** Default effort level, when the provider documents one. */
  defaultReasoningEffort?: string;
  price: VerifiedModelPrice;
  /** Price for prompts above the tier threshold, when the pricing page tiers by prompt size. */
  priceAboveTier?: { threshold: number; price: VerifiedModelPrice };
  source: string;
  accessed: string;
}

const ANTHROPIC_SOURCE = 'Anthropic models overview and pricing pages';
const OPENAI_SOURCE = 'OpenAI models and pricing pages';
const ACCESSED = '2026-10-16';

export const VERIFIED_MODELS: readonly VerifiedModelSpec[] = [
  {
    provider: 'anthropic',
    model: 'claude-fable-5-1',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'adaptive, always on',
    defaultReasoningEffort: 'high',
    price: { input: 10, output: 50, cachedInput: 0.25 },
    source: ANTHROPIC_SOURCE,
    accessed: ACCESSED,
  },
  {
    provider: 'anthropic',
    model: 'claude-opus-5-5',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'adaptive, always on',
    defaultReasoningEffort: 'medium',
    price: { input: 4, output: 20, cachedInput: 0.2 },
    source: ANTHROPIC_SOURCE,
    accessed: ACCESSED,
  },
  {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'adaptive',
    defaultReasoningEffort: 'high',
    price: { input: 2, output: 10, cachedInput: 0.1 },
    source: ANTHROPIC_SOURCE,
    accessed: ACCESSED,
  },
  {
    provider: 'anthropic',
    model: 'claude-haiku-5-5',
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'adaptive',
    defaultReasoningEffort: 'medium',
    price: { input: 0.1, output: 0.5 },
    priceAboveTier: { threshold: 100_000, price: { input: 0.5, output: 2.5 } },
    source: ANTHROPIC_SOURCE,
    accessed: ACCESSED,
  },
  {
    provider: 'openai',
    model: 'gpt-6-astra',
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'reasoning.effort low..max',
    price: { input: 10, output: 50, cachedInput: 1 },
    source: OPENAI_SOURCE,
    accessed: ACCESSED,
  },
  {
    provider: 'openai',
    model: 'gpt-6.1-sol',
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'reasoning.effort low..max',
    defaultReasoningEffort: 'medium',
    price: { input: 2, output: 10, cachedInput: 0.1 },
    source: OPENAI_SOURCE,
    accessed: ACCESSED,
  },
  {
    provider: 'openai',
    model: 'gpt-6-luna',
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    tools: true,
    vision: true,
    reasoning: 'reasoning.effort none..max',
    price: { input: 0.1, output: 0.5, cachedInput: 0.01 },
    source: OPENAI_SOURCE,
    accessed: ACCESSED,
  },
];

export function getVerifiedModel(model: string): VerifiedModelSpec | undefined {
  return VERIFIED_MODELS.find((spec) => spec.model === model);
}

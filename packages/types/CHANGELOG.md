# @lov3kaizen/agentsea-types

## 2.0.0

### Major Changes

- **Breaking:** the OpenAI model IDs that OpenAI has retired or is retiring are removed from the model registries, pricing tables, context-window and capability maps, and the OpenAI provider's default list. Lookups for these IDs now return `undefined`, and they are no longer members of the `OpenAIModel` union.

  Removed: `o1`, `o1-2024-12-17`, `o1-pro`, `o1-pro-2025-03-19`, `o3-mini`, `o3-mini-2025-01-31`, `o4-mini`, `o4-mini-2025-04-16`, `gpt-4-turbo`, `gpt-4-turbo-2024-04-09`, `gpt-3.5-turbo`, `gpt-3.5-turbo-0125`, `gpt-image-1`, `gpt-4o-2024-05-13`, `gpt-5`, `gpt-5-2025-08-07`, `gpt-5-mini`, `gpt-5-mini-2025-08-07`, `gpt-5-nano`, `gpt-5-nano-2025-08-07`, `gpt-5-pro`, `gpt-5-pro-2025-10-06`, `o3`, `o3-2025-04-16`, `o3-pro`, `o3-pro-2025-06-10`, `gpt-4o-2024-08-06`, `gpt-4o-2024-11-20`, `gpt-4o-mini-2024-07-18`.

  OpenAI's shutdown dates, from its deprecations page: the first group (`o1`, `o3-mini`, `o4-mini`, `gpt-4-turbo`, `gpt-3.5-turbo`, `gpt-image-1`) shut down on 2026-10-23. `gpt-5`, `gpt-5-mini`, `gpt-5-nano`, `gpt-5-pro`, `o3` and `o3-pro` shut down on 2026-12-11. The `gpt-4o` snapshots and `gpt-4o-mini-2024-07-18` shut down on 2027-01-14.

  Migrate to the replacements OpenAI names: `gpt-6.1-sol` for `gpt-5`, `gpt-5-pro`, `o3` and `o3-pro`; `gpt-6.1-terra` for `gpt-5-mini`; `gpt-6-luna` for `gpt-5-nano` and the `gpt-4o` snapshots; and `gpt-5.6-sol` or `gpt-5.6-terra` for the 2026-10-23 group. The `gpt-5.5` and `gpt-5.4-mini` IDs are unchanged.

### Minor Changes

- Default Anthropic model is now `claude-opus-5-5` (was `claude-opus-4-8`). Adds `claude-opus-5-5` to `AnthropicModel` and `MODEL_REGISTRY`: 1M context, 128K output, adaptive thinking, with structured outputs, system prompts, streaming and parallel tool calls. Pin `claude-opus-4-8` explicitly to keep the old default.

## 1.2.1

- Bump for monorepo version consistency.

## 1.2.0

- Bump for monorepo version consistency.

## 1.1.1

## 0.6.0

### Minor Changes

- feat: enable cli coding with commercial coding agents and local models

### Patch Changes

- 95777d7: release v0.5.1 packages

## 0.4.0

### Minor Changes

- b1a6ea1: Add model type safety, and new hooks useChat + useAgent

## 0.3.1

### Patch Changes

- Adds LemonFox STT/TTS Support. Also extends OpenAI provider to support custom baseUrl.

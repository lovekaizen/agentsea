---
'@lov3kaizen/agentsea-types': minor
---

Default Anthropic model is now `claude-opus-5-5` (was `claude-opus-4-8`). Adds `claude-opus-5-5` to `AnthropicModel` and `MODEL_REGISTRY`: 1M context, 128K output, adaptive thinking, with structured outputs, system prompts, streaming and parallel tool calls. Pin `claude-opus-4-8` explicitly to keep the old default.

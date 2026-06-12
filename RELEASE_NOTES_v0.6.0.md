# AgentSea ADK v0.6.0 Release Notes

**Release Date:** February 9, 2026

v0.6.0 is a major feature release introducing agentic coding capabilities, comprehensive model support expansion across 6 providers, and 3 new provider integrations.

---

## Highlights

### Agentic Coding (`sea code`)

A new interactive AI coding assistant built into the CLI. Launch a coding session with `sea code` and get an AI agent with full access to your development environment.

**13 built-in coding tools:**

| Tool            | Description                           |
| --------------- | ------------------------------------- |
| `file_read`     | Read file contents                    |
| `file_write`    | Write content to files                |
| `file_list`     | List directory contents               |
| `code_edit`     | Precise search-and-replace editing    |
| `glob`          | Find files matching glob patterns     |
| `grep`          | Search file contents with regex       |
| `shell_execute` | Run shell commands with safety checks |
| `git_status`    | Show working tree status              |
| `git_diff`      | Show changes between commits          |
| `git_add`       | Stage files for commit                |
| `git_commit`    | Create a commit                       |
| `git_log`       | Show commit history                   |
| `git_branch`    | List or create branches               |

```bash
sea code                                        # Use default agent
sea code --provider anthropic --model claude-sonnet-4-20250514  # Specific model
sea code --verbose                              # Show tool calls & token usage
sea code --maxIterations 50                     # Custom iteration limit
```

Works with all providers: Anthropic, OpenAI, Gemini, Ollama, LM Studio, and LocalAI.

### Expanded Model Support (60+ Models)

Comprehensive type-safe support and pricing for the latest models across all major providers.

**New Anthropic Models:**

- Claude Opus 4.6 (`claude-opus-4-6`) - 200K context, 32K output
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) - 200K context, 16K output
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) - 200K context, 8K output
- Claude Opus 4.5 (`claude-opus-4-5-20251101`) - 200K context, 32K output
- Claude Opus 4.0, Sonnet 4.0 - updated capabilities
- Claude 3.7 Sonnet (`claude-3-7-sonnet-20250219`) - 200K context, 128K output

**New OpenAI Models:**

- GPT-5 family: `gpt-5`, `gpt-5-pro`, `gpt-5-mini`, `gpt-5-nano`
- GPT-5.1 family: `gpt-5.1`, `gpt-5.1-codex`, `gpt-5.1-codex-mini`, `gpt-5.1-codex-max`
- GPT-5.2 family: `gpt-5.2`, `gpt-5.2-pro`, `gpt-5.2-codex`
- GPT-4.1 family: `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`
- o-series reasoning: `o3`, `o3-pro`, `o3-deep-research`, `o3-mini`, `o4-mini`, `o4-mini-deep-research`

**New Google Models:**

- Gemini 2.5 Pro (`gemini-2.5-pro`, `gemini-2.5-pro-latest`)
- Gemini 2.5 Flash (`gemini-2.5-flash`, `gemini-2.5-flash-latest`)
- Gemini 2.0 Flash (`gemini-2.0-flash`)

### 3 New Provider Integrations

Type-safe config builders and `createProvider()` support for:

- **Mistral AI** - `mistral-large`, `mistral-small`, `codestral`, `devstral`, `mixtral-8x22b`, and more
- **DeepSeek** - `deepseek-chat`, `deepseek-reasoner`
- **xAI** - `grok-3`, `grok-3-fast`

```typescript
import { mistral, deepseek, xai } from '@lov3kaizen/agentsea-types';

const mistralConfig = mistral('mistral-large-latest', { tools: [myTool] });
const deepseekConfig = deepseek('deepseek-reasoner', {
  reasoningEffort: 'high',
});
const xaiConfig = xai('grok-3', { tools: [myTool], systemPrompt: '...' });

const provider = createProvider(mistralConfig);
```

---

## Breaking Changes

None. This release is fully backward-compatible with v0.5.x.

---

## Detailed Changes

### `@lov3kaizen/agentsea-core` (0.5.1 → 0.6.0)

**New Features:**

- 13 built-in coding tools: `fileReadTool`, `fileWriteTool`, `fileListTool`, `shellExecuteTool`, `codeEditTool`, `globTool`, `grepTool`, `gitStatusTool`, `gitDiffTool`, `gitAddTool`, `gitCommitTool`, `gitLogTool`, `gitBranchTool`
- All coding tools exported from `@lov3kaizen/agentsea-core`
- Comprehensive test suites for all new tools (775+ lines of tests)

**Changes:**

- Type-safe provider now supports Mistral, DeepSeek, and xAI via `OpenAICompatibleProvider`

### `@lov3kaizen/agentsea-types` (0.5.1 → 0.6.0)

**New Features:**

- Added 14 new Anthropic model definitions (Claude 4.x family, 3.7 Sonnet)
- Added 35+ new OpenAI model definitions (GPT-5.x, GPT-4.1, o3/o4 series)
- Added Gemini 2.5 and 2.0 model definitions
- Added `MistralModel` type with 11 model variants and full capability mapping
- Added `DeepSeekModel` type with `deepseek-chat` and `deepseek-reasoner`
- Added `XAIModel` type with `grok-3` and `grok-3-fast`
- Added type-safe config builders: `mistral()`, `deepseek()`, `xai()`

**Changes:**

- Reorganized Anthropic models into family groupings (4.x, 3.7, 3.5, 3.0 legacy)
- Updated context windows and max output tokens to match current model capabilities
- Updated capability flags (extended thinking support for Claude 4.x+ models)

### `@lov3kaizen/agentsea-cli` (0.5.1 → 0.6.0)

**New Features:**

- `sea code` command for interactive agentic coding sessions
- Options: `--agent`, `--provider`, `--model`, `--verbose`, `--maxIterations`
- Streaming output with real-time display of tool calls and results
- Conversation history maintained across the session

### `@lov3kaizen/agentsea-costs` (0.5.1 → 0.6.0)

**New Features:**

- Pricing data for 60+ models across all providers
- Added cache read/write pricing for all supported models
- Added Mistral, DeepSeek, and xAI model pricing
- Added GPT-5.x, GPT-4.1, o3/o4 series pricing
- Added Claude 4.x family pricing (Opus 4.6, Sonnet 4.5, Haiku 4.5)
- Added Gemini 2.5 pricing

**Changes:**

- `ModelPricing` type now includes `cacheReadPricePerMillion` and `cacheWritePricePerMillion`
- `ModelCapabilities` type now includes `extendedThinking` flag

### Other Package Updates

All packages have been bumped to v0.6.0 with updated dependencies:

- `@lov3kaizen/agentsea-cache` - Updated dependencies
- `@lov3kaizen/agentsea-crews` - Updated dependencies
- `@lov3kaizen/agentsea-nestjs` - Updated dependencies
- `@lov3kaizen/agentsea-memory` - Updated dependencies
- `@lov3kaizen/agentsea-embeddings` - Updated dependencies
- `@lov3kaizen/agentsea-evaluate` - Updated dependencies
- `@lov3kaizen/agentsea-guardrails` - Updated dependencies
- `@lov3kaizen/agentsea-gateway` - Updated dependencies
- `@lov3kaizen/agentsea-structured` - Updated dependencies
- `@lov3kaizen/agentsea-ingest` - Updated dependencies
- `@lov3kaizen/agentsea-prompts` - Updated dependencies
- `@lov3kaizen/agentsea-debugger` - Updated dependencies
- `@lov3kaizen/agentsea-redteam` - Updated dependencies
- `@lov3kaizen/agentsea-analytics` - Updated dependencies
- `@lov3kaizen/agentsea-surf` - Updated dependencies
- `@lov3kaizen/agentsea-react` - Updated dependencies
- `@lov3kaizen/agentsea-admin-ui` - Updated dependencies

---

## Infrastructure

- Sequential npm publishing with delays to avoid registry conflicts
- Removed pnpm resolution warnings
- Fixed flaky stream-replayer timing test (CI tolerance increased)

---

## Stats

- **71 files changed**, 4,784 insertions, 361 deletions
- **803 lines** of new coding tool implementations
- **775 lines** of new tool tests
- **1,636+ lines** of model type definitions updated
- **21 packages** published

---

## Upgrade Guide

```bash
# Update all AgentSea packages
pnpm update @lov3kaizen/agentsea-core@0.6.0
pnpm update @lov3kaizen/agentsea-cli@0.6.0
pnpm update @lov3kaizen/agentsea-types@0.6.0
pnpm update @lov3kaizen/agentsea-costs@0.6.0

# Or update everything at once
pnpm update @lov3kaizen/agentsea-*@0.6.0
```

No code changes required - this release is fully backward-compatible.

---

## What's Next

- Admin UI dashboard improvements
- Additional MCP tools and servers
- Enhanced computer-use agent capabilities

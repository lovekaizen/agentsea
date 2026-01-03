---
'@lov3kaizen/agentsea-structured': minor
'@lov3kaizen/agentsea-guardrails': minor
'@lov3kaizen/agentsea-gateway': minor
---

## v0.5.0 Release - Structured, Guardrails & Gateway Packages

### @lov3kaizen/agentsea-structured

TypeScript-native structured output framework with Zod schema enforcement for LLM responses.

- Multiple extraction modes: JSON mode, tool/function calling, prompt engineering
- Provider adapters for OpenAI, Anthropic, and Google
- Streaming support with partial results
- Automatic retries with fix hints on validation failures
- Schema-aware prompting in multiple formats

### @lov3kaizen/agentsea-guardrails

TypeScript-native guardrails engine for AI applications.

- Content safety guards: toxicity, PII detection/masking, topic filtering
- Security guards: prompt injection, jailbreak detection, data leakage prevention
- Validation guards: schema validation (Zod), format validation
- Operational guards: token budgets, rate limiting, cost tracking
- NestJS integration with decorators and guards
- Framework support for AgentSea, LangChain.js, and Vercel AI SDK

### @lov3kaizen/agentsea-gateway

High-performance LLM gateway with unified API access.

- Intelligent routing across multiple providers
- Semantic caching for reduced latency and costs
- Rate limiting and retry strategies
- Cost optimization and tracking
- NestJS integration module
- Support for OpenAI, Anthropic, and Gemini providers

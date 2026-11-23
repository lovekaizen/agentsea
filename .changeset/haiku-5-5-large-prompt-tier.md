---
'@lov3kaizen/agentsea-costs': minor
'@lov3kaizen/agentsea-gateway': minor
'@lov3kaizen/agentsea-cache': minor
---

Adds prices and context windows for `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5`, and flags retired models with `deprecated: true` and their retirement dates.

**Known gap:** Haiku 5.5 has a prompt-size tier above 100,000 tokens. That tier is recorded in the pricing table, but the cost calculator does not read it yet. Prompts over 100,000 tokens are priced at the base tier, so their cost is understated. Treat cost figures for those prompts as estimates until the calculator applies the tier.

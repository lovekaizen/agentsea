---
'@lov3kaizen/agentsea-gateway': major
---

**Breaking:** `AnthropicProvider` no longer forwards `temperature` or `top_p` to the Anthropic Messages API. They are dropped from the request. Anthropic API version `2026-10-21` removes these parameters and returns a 400 error when they are sent. The provider still pins API version `2023-06-01`, so this change applies now and does not wait for that version.

If your code sets these fields, remove them and guide the model's behaviour through the prompt instead. `top_k` was never forwarded and is unchanged.

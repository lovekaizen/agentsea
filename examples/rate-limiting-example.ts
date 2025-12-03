import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  AgentContext,
  RateLimiter,
  Cache,
  calculatorTool,
} from '@lov3kaizen/agentsea-core';

/**
 * Example demonstrating rate limiting and caching
 */
async function main() {
  // Create a rate limiter: 5 requests per minute
  const rateLimiter = new RateLimiter(5, 5 / 60); // 5 tokens, refill at 5 tokens/60 seconds

  // Create a cache with 5-minute TTL
  const cache = new Cache<string>(5 * 60 * 1000);

  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(calculatorTool);
  const memory = new BufferMemory(50);

  const agent = new Agent(
    {
      name: 'rate-limited-agent',
      description: 'Agent with rate limiting and caching',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a helpful calculator assistant.',
      tools: [calculatorTool],
      temperature: 0.3,
      maxTokens: 512,
    },
    provider,
    toolRegistry,
    memory,
  );

  const context: AgentContext = {
    conversationId: 'rate-limit-example-1',
    userId: 'user-123',
    sessionData: {},
    history: [],
  };

  async function executeWithRateLimitAndCache(query: string): Promise<string> {
    // Check cache first
    const cacheKey = `query:${query}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log('  ✓ Cache hit!');
      return cached;
    }

    // Wait for rate limit
    console.log('  - Waiting for rate limit...');
    await rateLimiter.waitForTokens(1);
    console.log('  ✓ Rate limit passed');

    // Execute agent
    const response = await agent.execute(query, context);

    // Cache the result
    cache.set(cacheKey, response.content);

    return response.content;
  }

  try {
    console.log('=== Rate Limiting and Caching Example ===\n');

    // Make multiple requests
    const queries = [
      'What is 10 + 20?',
      'What is 15 * 3?',
      'What is 10 + 20?', // This will hit cache
      'What is 100 / 5?',
      'What is 15 * 3?', // This will hit cache
    ];

    for (let i = 0; i < queries.length; i++) {
      console.log(`\nRequest ${i + 1}: ${queries[i]}`);
      const start = Date.now();
      const result = await executeWithRateLimitAndCache(queries[i]);
      const duration = Date.now() - start;
      console.log(`  Result: ${result}`);
      console.log(`  Duration: ${duration}ms`);
    }

    // Display cache stats
    console.log('\n=== Cache Statistics ===');
    console.log(cache.getStats());

    // Display rate limiter state
    console.log('\n=== Rate Limiter State ===');
    console.log(`Remaining tokens: ${rateLimiter.getTokens().toFixed(2)}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);

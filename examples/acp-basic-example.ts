import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  AgentContext,
  ACPClient,
  createACPTools,
} from '@lov3kaizen/agentsea-core';

/**
 * Basic example demonstrating ACP (Agentic Commerce Protocol) integration
 *
 * This example shows how to:
 * 1. Set up ACP client with commerce API
 * 2. Create commerce-enabled agent with ACP tools
 * 3. Execute product searches and shopping flows
 */
async function main() {
  console.log('=== ACP Basic Integration Example ===\n');

  // Create ACP client
  // Replace with your actual ACP-compliant commerce API endpoint
  const acpClient = new ACPClient({
    baseUrl: process.env.ACP_API_URL || 'https://api.example.com/v1',
    apiKey: process.env.ACP_API_KEY,
    merchantId: process.env.ACP_MERCHANT_ID,
    timeout: 30000,
  });

  // Create ACP tools for the agent
  const acpTools = createACPTools(acpClient);

  console.log(`Loaded ${acpTools.length} ACP commerce tools:`);
  acpTools.forEach((tool) => {
    console.log(`  - ${tool.name}: ${tool.description}`);
  });
  console.log();

  // Create agent with ACP tools
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || '');
  const toolRegistry = new ToolRegistry();

  // Register ACP tools
  toolRegistry.registerMany(acpTools);

  const memory = new BufferMemory(50);

  const agent = new Agent(
    {
      name: 'commerce-agent',
      description: 'AI shopping assistant with commerce capabilities',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: `You are a helpful shopping assistant with access to a commerce platform.
You can help customers:
- Search for products
- Add items to their shopping cart
- Complete purchases
- Track orders

Always be helpful and guide customers through the shopping process step by step.
When showing prices, always include the currency.
Confirm important actions like completing checkout before proceeding.`,
      tools: acpTools,
      temperature: 0.7,
      maxTokens: 2048,
    },
    provider,
    toolRegistry,
    memory,
  );

  const context: AgentContext = {
    conversationId: 'acp-example-1',
    userId: 'user-123',
    sessionData: {
      cartId: null, // Will be created during conversation
    },
    history: [],
  };

  // Example 1: Product search
  console.log('=== Example 1: Product Search ===\n');
  let response = await agent.execute(
    'I am looking for wireless headphones under $100. Can you show me some options?',
    context,
  );

  console.log('Agent Response:');
  console.log(response.content);
  console.log();

  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log('Tools used:');
    response.toolCalls.forEach((call) => {
      console.log(`  - ${call.tool}`);
    });
    console.log();
  }

  // Example 2: Add to cart and checkout
  console.log('=== Example 2: Add to Cart ===\n');
  response = await agent.execute(
    'I like the first one. Please add it to my cart.',
    context,
  );

  console.log('Agent Response:');
  console.log(response.content);
  console.log();

  // Example 3: View cart
  console.log('=== Example 3: View Cart ===\n');
  response = await agent.execute('What is in my cart right now?', context);

  console.log('Agent Response:');
  console.log(response.content);
  console.log();

  // Example 4: Begin checkout (would require real payment info in production)
  console.log('=== Example 4: Begin Checkout ===\n');
  response = await agent.execute(
    'I want to checkout. My email is customer@example.com',
    context,
  );

  console.log('Agent Response:');
  console.log(response.content);
  console.log();

  console.log('\n=== Session Metrics ===');
  console.log({
    totalTokensUsed: response.metadata.tokensUsed,
    averageLatency: response.metadata.latencyMs,
  });
}

// Run with error handling
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

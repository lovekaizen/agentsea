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
 * Complete commerce flow example with ACP
 *
 * This example demonstrates a full e-commerce flow:
 * 1. Product discovery and search
 * 2. Adding items to cart
 * 3. Cart management (update quantities, remove items)
 * 4. Checkout with shipping address
 * 5. Payment method setup
 * 6. Order completion
 * 7. Order tracking
 */
async function main() {
  console.log('=== ACP Complete Commerce Flow Example ===\n');

  // Initialize ACP client
  const acpClient = new ACPClient({
    baseUrl: process.env.ACP_API_URL || 'https://api.example.com/v1',
    apiKey: process.env.ACP_API_KEY,
    merchantId: process.env.ACP_MERCHANT_ID,
  });

  // Create commerce-enabled agent
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || '');
  const toolRegistry = new ToolRegistry();
  const acpTools = createACPTools(acpClient);

  toolRegistry.registerMany(acpTools);

  const agent = new Agent(
    {
      name: 'commerce-concierge',
      description: 'Premium shopping concierge with full commerce capabilities',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: `You are an expert shopping concierge assistant.

Your capabilities:
- Product discovery and recommendations
- Shopping cart management
- Secure checkout processing
- Order tracking and support

Guidelines:
- Always confirm prices and availability before adding to cart
- Ask for confirmation before completing purchases
- Provide clear shipping and payment information
- Be proactive about suggesting related products
- Handle errors gracefully and provide alternatives`,
      tools: acpTools,
      temperature: 0.8,
      maxTokens: 3000,
    },
    provider,
    toolRegistry,
    new BufferMemory(100),
  );

  const context: AgentContext = {
    conversationId: 'complete-flow-example',
    userId: 'premium-customer-456',
    sessionData: {
      cartId: null,
      checkoutSessionId: null,
      preferredCategories: ['electronics', 'tech-accessories'],
    },
    history: [],
  };

  // Step 1: Product Discovery
  console.log('📱 Step 1: Product Discovery\n');
  await executeStep(
    agent,
    context,
    'I need a new laptop for programming and a wireless mouse. Budget is around $1500 total.',
  );

  // Step 2: Add items to cart
  console.log('\n🛒 Step 2: Adding Items to Cart\n');
  await executeStep(
    agent,
    context,
    'Great! Add the MacBook and the Logitech mouse to my cart.',
  );

  // Step 3: View and modify cart
  console.log('\n✏️  Step 3: Cart Review and Modification\n');
  await executeStep(
    agent,
    context,
    "Show me what's in my cart. Actually, I want 2 mice instead of 1.",
  );

  // Step 4: Begin checkout
  console.log('\n💳 Step 4: Checkout Process\n');
  await executeStep(
    agent,
    context,
    `I'm ready to checkout. My details:
    Email: john.doe@example.com
    Name: John Doe
    Shipping: 123 Main St, San Francisco, CA 94102, USA`,
  );

  // Step 5: Payment setup
  console.log('\n🔐 Step 5: Payment Method\n');
  await executeStep(
    agent,
    context,
    'I want to use my card ending in 4242. Use delegated payment through Stripe.',
  );

  // Step 6: Complete purchase
  console.log('\n✅ Step 6: Complete Purchase\n');
  await executeStep(agent, context, 'Please complete my order.');

  // Step 7: Order tracking
  console.log('\n📦 Step 7: Order Tracking\n');
  await executeStep(agent, context, 'Can you check the status of my order?');

  console.log('\n=== Commerce Flow Completed ===\n');
}

/**
 * Helper function to execute a step and display results
 */
async function executeStep(
  agent: Agent,
  context: AgentContext,
  userMessage: string,
): Promise<void> {
  console.log(`👤 User: ${userMessage}\n`);

  const response = await agent.execute(userMessage, context);

  console.log(`🤖 Agent: ${response.content}\n`);

  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log('🔧 Tools used:');
    response.toolCalls.forEach((call) => {
      console.log(`   • ${call.tool}`);
    });
    console.log();
  }

  console.log(`⏱️  Response time: ${response.metadata.latencyMs}ms`);
  console.log(`🎯 Tokens: ${response.metadata.tokensUsed}`);
  console.log('─'.repeat(80));
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

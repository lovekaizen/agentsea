import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  AgentContext,
  ACPClient,
  createACPTools,
  ACPDelegatedPaymentConfig,
} from '@lov3kaizen/agentsea-core';

/**
 * Delegated Payment Example with ACP
 *
 * This example demonstrates the delegated payment flow where
 * payment processing is handled by a third-party provider (e.g., Stripe, PayPal)
 * while the agent orchestrates the commerce flow.
 *
 * Key features:
 * - Product selection
 * - Cart management
 * - Delegated payment setup
 * - Payment confirmation
 * - Order completion
 */
async function main() {
  console.log('=== ACP Delegated Payment Example ===\n');

  // Initialize ACP client with payment provider configuration
  const acpClient = new ACPClient({
    baseUrl: process.env.ACP_API_URL || 'https://api.example.com/v1',
    apiKey: process.env.ACP_API_KEY,
    merchantId: process.env.ACP_MERCHANT_ID,
  });

  // Setup delegated payment configuration
  const paymentConfig: ACPDelegatedPaymentConfig = {
    provider: 'stripe', // or 'paypal', 'square', etc.
    merchantAccountId: process.env.STRIPE_MERCHANT_ID || 'acct_xxx',
    returnUrl: 'https://example.com/payment/success',
    cancelUrl: 'https://example.com/payment/cancel',
    metadata: {
      integration: 'agentic-commerce',
      version: '1.0',
    },
  };

  // Create agent with payment capabilities
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || '');
  const toolRegistry = new ToolRegistry();
  const acpTools = createACPTools(acpClient);

  toolRegistry.registerMany(acpTools);

  const agent = new Agent(
    {
      name: 'payment-agent',
      description: 'Commerce agent with delegated payment processing',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: `You are a secure payment processing assistant.

Your responsibilities:
- Guide users through secure payment setup
- Explain payment options clearly
- Handle delegated payment flows with providers like Stripe
- Ensure PCI compliance by never storing card details
- Confirm transactions and provide receipts

Security guidelines:
- Never ask for or store raw credit card numbers
- Use payment tokens and delegated providers
- Always confirm payment amounts before processing
- Provide clear transaction receipts`,
      tools: acpTools,
      temperature: 0.5, // Lower temperature for payment accuracy
      maxTokens: 2048,
    },
    provider,
    toolRegistry,
    new BufferMemory(50),
  );

  const context: AgentContext = {
    conversationId: 'delegated-payment-session',
    userId: 'user-789',
    sessionData: {
      cartId: null,
      checkoutSessionId: null,
      paymentConfig,
    },
    history: [],
  };

  console.log('=== Scenario: Premium Headphones Purchase ===\n');

  // Step 1: Product selection
  console.log('Step 1: Finding Products\n');
  let response = await agent.execute(
    'I want to buy premium noise-canceling headphones, preferably Sony or Bose.',
    context,
  );
  displayResponse(response);

  // Step 2: Add to cart
  console.log('\nStep 2: Adding to Cart\n');
  response = await agent.execute(
    'Add the Sony WH-1000XM5 to my cart.',
    context,
  );
  displayResponse(response);

  // Step 3: Checkout initiation
  console.log('\nStep 3: Starting Checkout\n');
  response = await agent.execute(
    `Start checkout for me.
    Email: alice@example.com
    Name: Alice Johnson
    Ship to: 456 Oak Avenue, Austin, TX 78701, USA`,
    context,
  );
  displayResponse(response);

  // Step 4: Delegated payment setup
  console.log('\nStep 4: Setting Up Delegated Payment\n');
  response = await agent.execute(
    `I want to pay with Stripe. Set up the payment with delegated processing.`,
    context,
  );
  displayResponse(response);

  // Simulate payment confirmation
  // In a real scenario, this would happen after user completes payment on Stripe
  console.log('\n[Simulating user completing payment on Stripe...]\n');

  // Step 5: Payment confirmation
  console.log('Step 5: Confirming Payment\n');
  response = await agent.execute(
    'Payment was successful with token tok_visa_4242. Please confirm and complete my order.',
    context,
  );
  displayResponse(response);

  console.log('\n=== Payment Flow Summary ===\n');
  console.log('✅ Payment Provider: Stripe (Delegated)');
  console.log('✅ Payment Status: Completed');
  console.log('✅ Order Status: Confirmed');
  console.log('✅ Security: PCI Compliant (no card data stored)');
}

/**
 * Display formatted response
 */
function displayResponse(response: any): void {
  console.log(`Agent: ${response.content}\n`);

  if (response.toolCalls && response.toolCalls.length > 0) {
    console.log('Tools executed:');
    response.toolCalls.forEach((call: any) => {
      console.log(`  • ${call.tool}`);
    });
    console.log();
  }

  console.log(
    `Metrics: ${response.metadata.tokensUsed} tokens, ${response.metadata.latencyMs}ms`,
  );
  console.log('─'.repeat(80));
}

main().catch((error) => {
  console.error('Error in delegated payment flow:', error);
  process.exit(1);
});

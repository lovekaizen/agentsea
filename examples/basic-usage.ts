import {
  Agent,
  AnthropicProvider,
  BufferMemory,
  ToolRegistry,
  AgentContext,
  calculatorTool,
} from '@lov3kaizen/agentsea-core';

/**
 * Basic example demonstrating AgentSea usage
 */
async function main() {
  // Set up provider
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);

  // Set up tool registry
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(calculatorTool);

  // Set up memory
  const memory = new BufferMemory(50); // Keep last 50 messages

  // Create agent
  const agent = new Agent(
    {
      name: 'math-assistant',
      description: 'A helpful assistant that can perform calculations',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt:
        'You are a helpful math assistant. When users ask you to perform calculations, use the calculator tool.',
      tools: [calculatorTool],
      temperature: 0.7,
      maxTokens: 1024,
      maxIterations: 5,
    },
    provider,
    toolRegistry,
    memory,
  );

  // Create context
  const context: AgentContext = {
    conversationId: 'example-conversation-1',
    userId: 'user-123',
    sessionData: {},
    history: [],
  };

  // Execute agent
  try {
    console.log('User: What is 25 * 4 + 10?');

    const response = await agent.execute('What is 25 * 4 + 10?', context);

    console.log('\nAgent:', response.content);
    console.log('\nMetadata:', {
      tokensUsed: response.metadata.tokensUsed,
      latencyMs: response.metadata.latencyMs,
      iterations: response.metadata.iterations,
    });

    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('\nTool Calls:', response.toolCalls);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error);

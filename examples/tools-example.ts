import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  AgentContext,
  httpRequestTool,
  fileReadTool,
  textSummaryTool,
  stringTransformTool,
} from '@lov3kaizen/agentsea-core';

/**
 * Example demonstrating various built-in tools
 */
async function main() {
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();

  // Register multiple tools
  toolRegistry.registerMany([
    httpRequestTool,
    fileReadTool,
    textSummaryTool,
    stringTransformTool,
  ]);

  const memory = new BufferMemory(50);

  const agent = new Agent(
    {
      name: 'multi-tool-agent',
      description: 'Agent with access to multiple tools',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: `You are a helpful assistant with access to various tools:
- http_request: Make HTTP requests to APIs
- file_read: Read files from the filesystem
- text_summary: Analyze and extract information from text
- string_transform: Transform strings (uppercase, lowercase, etc.)

Use these tools to help users with their requests.`,
      tools: [
        httpRequestTool,
        fileReadTool,
        textSummaryTool,
        stringTransformTool,
      ],
      temperature: 0.7,
      maxTokens: 1024,
      maxIterations: 5,
    },
    provider,
    toolRegistry,
    memory,
  );

  const context: AgentContext = {
    conversationId: 'tools-example-1',
    userId: 'user-123',
    sessionData: {},
    history: [],
  };

  try {
    console.log('=== Built-in Tools Example ===\n');

    // Example 1: String transformation
    console.log('--- Example 1: String Transformation ---');
    const response1 = await agent.execute(
      'Convert the text "hello world" to uppercase and then to a slug format',
      context,
    );
    console.log('Response:', response1.content);
    console.log('Tool calls:', response1.toolCalls?.length || 0);

    // Example 2: Text analysis
    console.log('\n--- Example 2: Text Analysis ---');
    const response2 = await agent.execute(
      'Count the words in this sentence: "The quick brown fox jumps over the lazy dog"',
      context,
    );
    console.log('Response:', response2.content);

    // Example 3: HTTP Request (to a public API)
    console.log('\n--- Example 3: HTTP Request ---');
    const response3 = await agent.execute(
      'Make a GET request to https://api.github.com/users/github and tell me the username',
      context,
    );
    console.log('Response:', response3.content);

    // Display overall metrics
    console.log('\n=== Overall Metrics ===');
    console.log({
      totalTokens:
        response1.metadata.tokensUsed +
        response2.metadata.tokensUsed +
        response3.metadata.tokensUsed,
      totalLatency:
        response1.metadata.latencyMs +
        response2.metadata.latencyMs +
        response3.metadata.latencyMs,
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);

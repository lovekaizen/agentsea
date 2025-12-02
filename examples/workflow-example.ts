import {
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  WorkflowFactory,
  AgentContext,
  calculatorTool,
  textSummaryTool,
} from '@lov3kaizen/agentsea-core';

/**
 * Example demonstrating workflow orchestration
 */
async function main() {
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();
  toolRegistry.registerMany([calculatorTool, textSummaryTool]);
  const memory = new BufferMemory(50);

  // Create a sequential workflow
  const workflow = WorkflowFactory.create(
    {
      name: 'data-processing-workflow',
      type: 'sequential',
      agents: [
        {
          name: 'calculator-agent',
          description: 'Agent that performs calculations',
          model: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          systemPrompt:
            'You are a calculator agent. Perform calculations as requested.',
          tools: [calculatorTool],
          temperature: 0.3,
          maxTokens: 512,
        },
        {
          name: 'summarizer-agent',
          description: 'Agent that summarizes text',
          model: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          systemPrompt:
            'You are a text analysis agent. Analyze and summarize text.',
          tools: [textSummaryTool],
          temperature: 0.5,
          maxTokens: 512,
        },
      ],
      errorHandling: 'continue',
    },
    provider,
    toolRegistry,
    memory,
  );

  const context: AgentContext = {
    conversationId: 'workflow-example-1',
    userId: 'user-123',
    sessionData: {},
    history: [],
  };

  try {
    console.log('=== Sequential Workflow Example ===\n');
    console.log(
      'Input: Calculate 15 * 7, then count the number of words in the result\n',
    );

    const response = await workflow.execute(
      'Calculate 15 * 7, then count the number of words in the result',
      context,
    );

    console.log('Final Response:', response.content);
    console.log('\nMetrics:', {
      tokensUsed: response.metadata.tokensUsed,
      latencyMs: response.metadata.latencyMs,
      iterations: response.metadata.iterations,
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main().catch(console.error);

import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  BufferMemory,
  AgentContext,
  calculatorTool,
  Logger,
  globalMetrics,
  globalTracer,
} from '@lov3kaizen/agentsea-core';

/**
 * Example demonstrating observability features (logging, metrics, tracing)
 */
async function main() {
  // Set up custom logger
  const logger = new Logger({
    level: 'debug',
    format: 'json',
    console: true,
  });

  logger.info('Starting observability example');

  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(calculatorTool);
  const memory = new BufferMemory(50);

  const agent = new Agent(
    {
      name: 'observable-agent',
      description: 'Agent with full observability',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt: 'You are a helpful assistant with observability features.',
      tools: [calculatorTool],
      temperature: 0.7,
      maxTokens: 1024,
    },
    provider,
    toolRegistry,
    memory,
  );

  const context: AgentContext = {
    conversationId: 'observability-example-1',
    userId: 'user-123',
    sessionData: {},
    history: [],
  };

  try {
    logger.info('Starting agent execution', {
      conversationId: context.conversationId,
    });

    // Start a trace span
    const { span, context: _traceContext } =
      globalTracer.startSpan('agent-execution');
    globalTracer.setAttributes(span.spanId, {
      agentName: agent.config.name,
      conversationId: context.conversationId,
    });

    const startTime = Date.now();
    const response = await agent.execute('What is 42 * 58?', context);
    const latency = Date.now() - startTime;

    // End trace span
    globalTracer.endSpan(span.spanId);

    // Record metrics
    globalMetrics.record({
      agentName: agent.config.name,
      latencyMs: latency,
      tokensUsed: response.metadata.tokensUsed,
      success: true,
      timestamp: new Date(),
    });

    logger.info('Agent execution completed', {
      latency,
      tokensUsed: response.metadata.tokensUsed,
      response: response.content.substring(0, 100),
    });

    // Display metrics
    console.log('\n=== Metrics ===');
    const stats = globalMetrics.getStats();
    console.log(stats);

    // Display trace
    console.log('\n=== Trace ===');
    const trace = globalTracer.getTrace(span.traceId);
    console.log(
      trace.map((s) => ({
        name: s.name,
        duration: globalTracer.getSpanDuration(s.spanId),
        status: s.status,
      })),
    );

    // Subscribe to future metrics
    console.log('\n=== Setting up metrics subscription ===');
    const unsubscribe = globalMetrics.subscribe((metric) => {
      logger.info('New metric recorded', metric);
    });

    // Clean up
    setTimeout(() => unsubscribe(), 1000);
  } catch (error) {
    logger.error('Agent execution failed', { error });

    // Record failure metric
    globalMetrics.record({
      agentName: agent.config.name,
      latencyMs: 0,
      tokensUsed: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    });
  }
}

main().catch(console.error);

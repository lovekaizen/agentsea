/**
 * Analytics Middleware Example
 *
 * Demonstrates using the analytics middleware with AgentSea agents.
 */

import {
  AnalyticsMiddleware,
  AnalyticsProvider,
  MemoryStorageAdapter,
  type AgentContext,
  type AgentMessage,
} from '@lov3kaizen/agentsea-analytics';

// Simulated agent that uses analytics middleware
class SimulatedAgent {
  private analytics: AnalyticsMiddleware;
  private conversationId: string;
  private messages: AgentMessage[] = [];

  constructor(analytics: AnalyticsMiddleware) {
    this.analytics = analytics;
    this.conversationId = `conv-${Date.now()}`;
  }

  async chat(userMessage: string): Promise<string> {
    // Create user message
    const userMsg: AgentMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.messages.push(userMsg);

    // Track user message
    const context = this.getContext();
    await this.analytics.trackMessage(context, userMsg);

    // Simulate assistant response
    const response = this.generateResponse(userMessage);
    const assistantMsg: AgentMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      tokenUsage: {
        input: userMessage.split(' ').length * 2,
        output: response.split(' ').length * 2,
        total: 0,
      },
      metadata: { latencyMs: Math.random() * 500 + 100 },
    };
    assistantMsg.tokenUsage!.total =
      assistantMsg.tokenUsage!.input + assistantMsg.tokenUsage!.output;
    this.messages.push(assistantMsg);

    // Track assistant message
    await this.analytics.trackMessage(context, assistantMsg);

    return response;
  }

  async endConversation(
    success: boolean,
    satisfaction?: number,
  ): Promise<void> {
    await this.analytics.endConversation(this.conversationId, {
      success,
      satisfaction,
    });
  }

  private getContext(): AgentContext {
    return {
      conversationId: this.conversationId,
      agentId: 'demo-agent',
      userId: 'user-123',
      model: 'gpt-4',
      messages: this.messages,
    };
  }

  private generateResponse(input: string): string {
    // Simple response generation for demo
    if (input.toLowerCase().includes('help')) {
      return 'I would be happy to help you! What do you need assistance with?';
    }
    if (input.toLowerCase().includes('password')) {
      return 'To reset your password, please visit the settings page and click on "Security".';
    }
    if (input.toLowerCase().includes('thank')) {
      return 'You are welcome! Is there anything else I can help you with?';
    }
    return 'I understand. Let me know if you have any questions.';
  }
}

async function main() {
  console.log('Analytics Middleware Example\n');

  // =================================================================
  // 1. Setup Analytics Middleware
  // =================================================================
  console.log('1. Setting up analytics middleware...');

  const storage = new MemoryStorageAdapter();
  const analytics = new AnalyticsMiddleware({
    storage,
    trackIntents: true,
    trackSentiment: true,
    onConversationStart: (conv) => {
      console.log(`   [Event] Conversation started: ${conv.id}`);
    },
    onConversationEnd: (conv) => {
      console.log(
        `   [Event] Conversation ended: ${conv.id} (success: ${conv.outcome?.success})`,
      );
    },
    onMessage: (msg) => {
      console.log(`   [Event] Message tracked: ${msg.role}`);
    },
  });
  console.log('');

  // =================================================================
  // 2. Simulate Agent Conversation
  // =================================================================
  console.log('2. Simulating agent conversation...');

  const agent = new SimulatedAgent(analytics);

  // Have a conversation
  await agent.chat('Hi, I need help with my account');
  await agent.chat('How do I reset my password?');
  await agent.chat('Thank you, that was very helpful!');
  await agent.endConversation(true, 5);
  console.log('');

  // =================================================================
  // 3. Use Analytics Provider for Insights
  // =================================================================
  console.log('3. Getting analytics insights...');

  const provider = new AnalyticsProvider({
    storage,
    enableClassification: true,
    enableAnalysis: true,
  });

  // Get dashboard summary
  const summary = await provider.getDashboardSummary('week');
  console.log(`   Total conversations: ${summary.conversations.total}`);
  console.log(
    `   Success rate: ${summary.performance.successRate.toFixed(1)}%`,
  );
  console.log(`   Total messages: ${summary.messages.total}`);
  console.log(`   Total tokens: ${summary.tokens.total}`);
  console.log('');

  // Classify some text
  console.log('4. Classification examples...');

  const intentResult = await provider.classifyIntent(
    'How do I cancel my subscription?',
  );
  console.log(
    `   Intent: "${intentResult.primary}" (confidence: ${intentResult.confidence.toFixed(2)})`,
  );

  const sentimentResult = await provider.analyzeSentiment(
    'This product is amazing and works great!',
  );
  console.log(
    `   Sentiment: ${sentimentResult.label} (score: ${sentimentResult.score.toFixed(2)})`,
  );

  const topicsResult = await provider.classifyTopics(
    'I have an issue with billing and my account',
  );
  console.log(`   Primary topic: ${topicsResult.primary.name}`);
  console.log('');

  // =================================================================
  // 5. Check Active Conversations
  // =================================================================
  console.log('5. Active conversation tracking...');
  console.log(
    `   Active conversations: ${analytics.getActiveConversationIds().length}`,
  );

  // Start a new conversation that stays active
  const agent2 = new SimulatedAgent(analytics);
  await agent2.chat('Hello, I have a question');
  console.log(
    `   Active conversations after new chat: ${analytics.getActiveConversationIds().length}`,
  );

  // Flush to end all active conversations
  await analytics.flush();
  console.log(
    `   Active conversations after flush: ${analytics.getActiveConversationIds().length}`,
  );
  console.log('');

  console.log('Done!');
}

main().catch(console.error);

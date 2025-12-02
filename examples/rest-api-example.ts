/**
 * REST API Example
 * Demonstrates using the NestJS REST API endpoints for agent execution
 */

// Example NestJS application setup
// app.module.ts

import { Module, ValidationPipe } from '@nestjs/common';
import {
  AgenticModule,
  Agent,
  ToolRegistry,
  AnthropicProvider,
  BufferMemory,
  AgentService,
} from '@lov3kaizen/agentsea-nestjs';

@Module({
  imports: [
    AgenticModule.forRoot({
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      enableRestApi: true,
      enableWebSocket: false, // Only REST API for this example
    }),
  ],
})
export class AppModule {}

// Main application file
// main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

  // Enable CORS for API access
  app.enableCors();

  // Get the agent service to register agents
  const agentService = app.get(AgentService);
  const toolRegistry = new ToolRegistry();
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const memory = new BufferMemory();

  // Register a customer support agent
  const supportAgent = new Agent(
    {
      name: 'customer-support',
      description: 'AI customer support agent',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      systemPrompt:
        'You are a helpful customer support agent. Be friendly, professional, and solve customer issues efficiently.',
      temperature: 0.7,
      maxTokens: 2048,
      tools: [],
    },
    provider,
    toolRegistry,
    memory,
  );

  agentService.registerAgent(supportAgent);

  // Register a code assistant agent
  const codeAgent = new Agent(
    {
      name: 'code-assistant',
      description: 'AI coding assistant',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      systemPrompt:
        'You are an expert programming assistant. Help with code review, debugging, and writing clean code.',
      temperature: 0.3,
      maxTokens: 4096,
      tools: [],
    },
    provider,
    toolRegistry,
    memory,
  );

  agentService.registerAgent(codeAgent);

  await app.listen(3000);
  console.log('🚀 REST API server running on http://localhost:3000');
  console.log('\nAvailable endpoints:');
  console.log('  GET    /agents - List all agents');
  console.log('  GET    /agents/:name - Get agent details');
  console.log('  POST   /agents/:name/execute - Execute agent');
  console.log('  DELETE /agents/:name/conversations/:id - Delete conversation');
}

void bootstrap();

// ============================================
// Client-side usage examples using fetch
// ============================================

// 1. List all agents
async function listAgents() {
  const response = await fetch('http://localhost:3000/agents');
  const data = await response.json();
  console.log('Available agents:', data);
}

// 2. Get specific agent details
async function getAgentDetails(agentName: string) {
  const response = await fetch(`http://localhost:3000/agents/${agentName}`);
  const data = await response.json();
  console.log(`Agent ${agentName}:`, data);
}

// 3. Execute an agent
async function executeAgent() {
  const response = await fetch(
    'http://localhost:3000/agents/customer-support/execute',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: 'I need help with my order #12345',
        conversationId: 'conv-user-123',
        userId: 'user-123',
        sessionData: {
          orderNumber: '12345',
          customerTier: 'premium',
        },
        metadata: {
          source: 'web-chat',
          timestamp: new Date().toISOString(),
        },
      }),
    },
  );

  const data = await response.json();
  console.log('Agent response:', data);
  return data;
}

// 4. Continue a conversation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _continueConversation(
  conversationId: string,
  history: unknown[],
) {
  const response = await fetch(
    'http://localhost:3000/agents/customer-support/execute',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: 'Can you check the shipping status?',
        conversationId,
        history, // Previous conversation history
      }),
    },
  );

  const data = await response.json();
  console.log('Continued conversation:', data);
  return data;
}

// 5. Use the code assistant
async function getCodeHelp() {
  const response = await fetch(
    'http://localhost:3000/agents/code-assistant/execute',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input:
          'Review this TypeScript code and suggest improvements:\n\nfunction add(a, b) { return a + b }',
        conversationId: 'code-review-session-1',
        metadata: {
          language: 'typescript',
          task: 'code-review',
        },
      }),
    },
  );

  const data = await response.json();
  console.log('Code review:', data);
  return data;
}

// Example usage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _runExamples() {
  try {
    await listAgents();
    await getAgentDetails('customer-support');
    await executeAgent();
    await getCodeHelp();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run examples:
// runExamples();

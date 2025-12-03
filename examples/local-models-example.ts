/**
 * Example: Using Local and Open Source Models
 *
 * This example demonstrates how to use local models and open source LLMs
 * with the AgentSea ADK through various providers:
 * - Ollama
 * - LM Studio
 * - LocalAI
 * - Text Generation WebUI
 * - Any OpenAI-compatible endpoint
 */

import {
  Agent,
  OllamaProvider,
  LMStudioProvider,
  LocalAIProvider,
  TextGenerationWebUIProvider,
  OpenAICompatibleProvider,
  ToolRegistry,
} from '@lov3kaizen/agentsea-core';
import { z } from 'zod';

/**
 * Example 1: Using Ollama with local models
 *
 * Prerequisites:
 * 1. Install Ollama: https://ollama.ai
 * 2. Pull a model: ollama pull llama2
 */
async function ollamaExample() {
  console.log('\n=== Ollama Example ===\n');

  // Create Ollama provider
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434', // Default Ollama URL
  });

  // List available models
  try {
    const models = await provider.listModels();
    console.log('Available models:', models);
  } catch (error) {
    console.log('Make sure Ollama is running: ollama serve');
  }

  // Set up tool registry
  const toolRegistry = new ToolRegistry();

  // Create an agent with Ollama
  const agent = new Agent(
    {
      name: 'local-assistant',
      description: 'A helpful assistant running on local hardware',
      model: 'llama2', // or llama3, mistral, codellama, etc.
      provider: 'ollama',
      systemPrompt: 'You are a helpful AI assistant running locally.',
      temperature: 0.7,
      maxTokens: 1000,
    },
    provider,
    toolRegistry,
  );

  // Execute the agent
  const response = await agent.execute(
    'What are the benefits of running AI models locally?',
    {
      conversationId: 'ollama-conv-1',
      sessionData: {},
      history: [],
    },
  );

  console.log('Response:', response.content);
  console.log('Tokens used:', response.metadata.tokensUsed);
}

/**
 * Example 2: Using LM Studio
 *
 * Prerequisites:
 * 1. Install LM Studio: https://lmstudio.ai
 * 2. Load a model in LM Studio
 * 3. Start the local server (default: http://localhost:1234)
 */
async function _lmStudioExample() {
  console.log('\n=== LM Studio Example ===\n');

  // Create LM Studio provider
  const provider = new LMStudioProvider();
  // Or with custom configuration:
  // const provider = new LMStudioProvider({
  //   baseUrl: 'http://localhost:1234/v1',
  //   timeout: 30000,
  // });

  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'lmstudio-assistant',
      description: 'Assistant powered by LM Studio',
      model: 'local-model', // LM Studio uses the loaded model
      provider: 'openai-compatible',
      systemPrompt: 'You are a coding assistant.',
    },
    provider,
    toolRegistry,
  );

  const response = await agent.execute(
    'Write a simple Python function to calculate factorial',
    {
      conversationId: 'lmstudio-conv-1',
      sessionData: {},
      history: [],
    },
  );

  console.log('Response:', response.content);
}

/**
 * Example 3: Using LocalAI
 *
 * Prerequisites:
 * 1. Install LocalAI: https://localai.io
 * 2. Start LocalAI with a model
 */
async function _localAIExample() {
  console.log('\n=== LocalAI Example ===\n');

  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080/v1',
  });

  // List available models
  const models = await provider.listModels();
  console.log('Available models:', models);

  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'localai-assistant',
      description: 'Assistant powered by LocalAI',
      model: models[0] || 'gpt-3.5-turbo', // Use first available model
      provider: 'openai-compatible',
    },
    provider,
    toolRegistry,
  );

  const response = await agent.execute('Explain what LocalAI is', {
    conversationId: 'localai-conv-1',
    sessionData: {},
    history: [],
  });

  console.log('Response:', response.content);
}

/**
 * Example 4: Using Text Generation WebUI (oobabooga)
 *
 * Prerequisites:
 * 1. Install Text Generation WebUI
 * 2. Enable the OpenAI extension
 * 3. Start the server
 */
async function _textGenWebUIExample() {
  console.log('\n=== Text Generation WebUI Example ===\n');

  const provider = new TextGenerationWebUIProvider({
    baseUrl: 'http://localhost:5000/v1',
  });

  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'textgen-assistant',
      description: 'Assistant powered by Text Generation WebUI',
      model: 'current-model', // Uses the loaded model
      provider: 'openai-compatible',
    },
    provider,
    toolRegistry,
  );

  const response = await agent.execute('Tell me about open source LLMs', {
    conversationId: 'textgen-conv-1',
    sessionData: {},
    history: [],
  });

  console.log('Response:', response.content);
}

/**
 * Example 5: Using a custom OpenAI-compatible endpoint
 *
 * Works with any service that implements the OpenAI API format
 */
async function _customEndpointExample() {
  console.log('\n=== Custom Endpoint Example ===\n');

  const provider = new OpenAICompatibleProvider({
    baseUrl: 'https://api.your-service.com/v1',
    apiKey: 'your-api-key', // If required
    defaultHeaders: {
      'X-Custom-Header': 'value',
    },
    timeout: 60000,
  });

  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'custom-assistant',
      description: 'Assistant using custom endpoint',
      model: 'custom-model',
      provider: 'openai-compatible',
    },
    provider,
    toolRegistry,
  );

  const response = await agent.execute('Hello from a custom endpoint!', {
    conversationId: 'custom-conv-1',
    sessionData: {},
    history: [],
  });

  console.log('Response:', response.content);
}

/**
 * Example 6: Using local models with tools
 */
async function _localModelsWithToolsExample() {
  console.log('\n=== Local Models with Tools Example ===\n');

  const provider = new OllamaProvider();

  // Create a tool registry
  const toolRegistry = new ToolRegistry();

  // Add a simple calculator tool
  toolRegistry.register({
    name: 'calculator',
    description: 'Perform basic arithmetic operations',
    parameters: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async (params) => {
      const { operation, a, b } = params;
      switch (operation) {
        case 'add':
          return a + b;
        case 'subtract':
          return a - b;
        case 'multiply':
          return a * b;
        case 'divide':
          return a / b;
        default:
          throw new Error('Unknown operation');
      }
    },
  });

  // Create agent with tools
  const agent = new Agent(
    {
      name: 'math-assistant',
      description: 'A math assistant with calculator tools',
      model: 'llama2', // Or any model that supports function calling
      provider: 'ollama',
      tools: toolRegistry.getAll(),
      systemPrompt:
        'You are a math assistant. Use the calculator tool for computations.',
    },
    provider,
    toolRegistry,
  );

  const response = await agent.execute('What is 42 multiplied by 17?', {
    conversationId: 'math-conv-1',
    sessionData: {},
    history: [],
  });

  console.log('Response:', response.content);
  console.log('Tool calls:', response.toolCalls);
}

/**
 * Example 7: Comparing responses from different local providers
 */
async function _compareProvidersExample() {
  console.log('\n=== Comparing Providers Example ===\n');

  const question = 'What is the capital of France?';

  // Test with Ollama
  try {
    const ollamaProvider = new OllamaProvider();
    const ollamaToolRegistry = new ToolRegistry();
    const ollamaAgent = new Agent(
      {
        name: 'ollama-test',
        description: 'Testing Ollama',
        model: 'llama2',
        provider: 'ollama',
      },
      ollamaProvider,
      ollamaToolRegistry,
    );

    const ollamaResponse = await ollamaAgent.execute(question, {
      conversationId: 'compare-1',
      sessionData: {},
      history: [],
    });

    console.log('Ollama Response:', ollamaResponse.content);
    console.log('Latency:', ollamaResponse.metadata.latencyMs, 'ms');
  } catch (error) {
    console.log('Ollama not available:', (error as Error).message);
  }

  // Test with LM Studio
  try {
    const lmstudioProvider = new LMStudioProvider();
    const lmstudioToolRegistry = new ToolRegistry();
    const lmstudioAgent = new Agent(
      {
        name: 'lmstudio-test',
        description: 'Testing LM Studio',
        model: 'local-model',
        provider: 'openai-compatible',
      },
      lmstudioProvider,
      lmstudioToolRegistry,
    );

    const lmstudioResponse = await lmstudioAgent.execute(question, {
      conversationId: 'compare-2',
      sessionData: {},
      history: [],
    });

    console.log('\nLM Studio Response:', lmstudioResponse.content);
    console.log('Latency:', lmstudioResponse.metadata.latencyMs, 'ms');
  } catch (error) {
    console.log('LM Studio not available:', (error as Error).message);
  }
}

/**
 * Example 8: Pulling and using models with Ollama
 */
async function _pullAndUseModelExample() {
  console.log('\n=== Pull and Use Model Example ===\n');

  const provider = new OllamaProvider();

  // Pull a model if not already available
  const modelName = 'mistral';

  console.log(`Pulling ${modelName}...`);
  try {
    await provider.pullModel(modelName);
    console.log('Model pulled successfully!');
  } catch (error) {
    console.log('Error pulling model:', (error as Error).message);
  }

  // Use the model
  const toolRegistry = new ToolRegistry();
  const agent = new Agent(
    {
      name: 'mistral-assistant',
      description: 'Assistant using Mistral model',
      model: modelName,
      provider: 'ollama',
    },
    provider,
    toolRegistry,
  );

  const response = await agent.execute('Introduce yourself briefly', {
    conversationId: 'mistral-conv-1',
    sessionData: {},
    history: [],
  });

  console.log('Response:', response.content);
}

// Run examples
async function main() {
  console.log('🚀 Local Models Examples\n');
  console.log('Make sure you have the necessary services running:');
  console.log('- Ollama: ollama serve');
  console.log('- LM Studio: Start the local server');
  console.log('- LocalAI: Start LocalAI server');
  console.log('- Text Generation WebUI: Start with OpenAI extension enabled\n');

  try {
    // Run one example at a time
    // Uncomment the example you want to run

    await ollamaExample();
    // await lmStudioExample();
    // await localAIExample();
    // await textGenWebUIExample();
    // await customEndpointExample();
    // await localModelsWithToolsExample();
    // await compareProvidersExample();
    // await pullAndUseModelExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  void main();
}

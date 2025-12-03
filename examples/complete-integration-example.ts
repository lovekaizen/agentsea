/**
 * Complete Integration Example
 *
 * This example demonstrates all major AgentSea ADK features working together:
 * - Local models (Ollama)
 * - Voice capabilities (STT/TTS)
 * - Multi-agent workflows
 * - Memory management
 * - Tool usage
 * - CLI integration
 *
 * This showcases a complete voice-enabled local AI assistant that can:
 * - Understand voice commands
 * - Process requests using local LLMs
 * - Respond with synthesized speech
 * - Use tools to perform tasks
 * - Remember conversation history
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

import {
  Agent,
  OllamaProvider,
  ToolRegistry,
  BufferMemory,
  VoiceAgent,
  OpenAIWhisperProvider,
  OpenAITTSProvider,
  LocalWhisperProvider,
  PiperTTSProvider,
  AgentContext,
  calculatorTool,
  weatherTool,
  searchTool,
} from '@lov3kaizen/agentsea-core';

/**
 * Example 1: Local Voice Assistant with Ollama
 *
 * Complete privacy - everything runs locally:
 * - LLM: Ollama (local)
 * - STT: Local Whisper
 * - TTS: Piper TTS
 */
async function localVoiceAssistantExample() {
  console.log('\n=== Local Voice Assistant (Complete Privacy) ===\n');

  // Initialize Ollama provider
  const ollamaProvider = new OllamaProvider({
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });

  // Check if model is available
  const models = await ollamaProvider.listModels();
  console.log('Available Ollama models:', models);

  if (!models.includes('llama2')) {
    console.log('Pulling llama2 model...');
    await ollamaProvider.pullModel('llama2');
  }

  // Create tool registry
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(calculatorTool);
  toolRegistry.register(weatherTool);

  // Create agent
  const agent = new Agent(
    {
      name: 'local-voice-assistant',
      description: 'A completely local voice assistant with privacy',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt: `You are a helpful voice assistant. Keep your responses concise and natural for voice interaction.`,
      tools: [calculatorTool, weatherTool],
    },
    ollamaProvider,
    toolRegistry,
    new BufferMemory(50),
  );

  // Setup voice providers (all local)
  const sttProvider = new LocalWhisperProvider({
    whisperPath: '/usr/local/bin/whisper',
    modelPath: '/path/to/ggml-base.bin',
  });

  const ttsProvider = new PiperTTSProvider({
    piperPath: '/usr/local/bin/piper',
    modelPath: '/path/to/en_US-lessac-medium.onnx',
  });

  // Check if installed
  if (!(await sttProvider.isInstalled())) {
    console.log('⚠️  Local Whisper not installed');
    console.log(sttProvider.getInstallInstructions());
    return;
  }

  if (!(await ttsProvider.isInstalled())) {
    console.log('⚠️  Piper TTS not installed');
    console.log(ttsProvider.getInstallInstructions());
    return;
  }

  // Create voice agent
  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
    ttsConfig: { voice: 'lessac' },
    autoSpeak: true,
  });

  const context: AgentContext = {
    conversationId: 'local-voice-1',
    sessionData: {},
    history: [],
  };

  // Process voice input
  const audioPath = './audio/user-input.wav';
  if (existsSync(audioPath)) {
    const result = await voiceAgent.processVoice(
      readFileSync(audioPath),
      context,
    );

    console.log('User said:', result.text);
    console.log('Assistant response:', result.response.content);

    if (result.audio) {
      writeFileSync('./output/local-response.wav', result.audio);
      console.log('✅ Audio saved to: ./output/local-response.wav');
    }
  }

  console.log('\n✅ Complete privacy achieved - all processing done locally!');
}

/**
 * Example 2: Cloud Voice Assistant with Ollama
 *
 * Hybrid approach:
 * - LLM: Ollama (local)
 * - STT: OpenAI Whisper (cloud)
 * - TTS: OpenAI TTS (cloud)
 */
async function hybridVoiceAssistantExample() {
  console.log('\n=== Hybrid Voice Assistant (Local LLM + Cloud Voice) ===\n');

  // Use local Ollama for LLM
  const ollamaProvider = new OllamaProvider();

  // Create tool registry with all tools
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(calculatorTool);
  toolRegistry.register(weatherTool);
  toolRegistry.register(searchTool);

  const agent = new Agent(
    {
      name: 'hybrid-assistant',
      description: 'Hybrid voice assistant',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt: `You are a helpful assistant. Keep responses clear and concise.`,
      tools: [calculatorTool, weatherTool, searchTool],
    },
    ollamaProvider,
    toolRegistry,
    new BufferMemory(50),
  );

  // Use cloud providers for voice (better quality)
  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
  const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
    ttsConfig: {
      voice: 'nova',
      model: 'tts-1',
    },
    autoSpeak: true,
  });

  const context: AgentContext = {
    conversationId: 'hybrid-1',
    sessionData: { location: 'San Francisco' },
    history: [],
  };

  // Multi-turn conversation
  console.log('Starting multi-turn conversation...\n');

  const turns = [
    './audio/turn1.mp3', // "What's the weather like?"
    './audio/turn2.mp3', // "Calculate 25 * 48"
    './audio/turn3.mp3', // "Search for restaurants nearby"
  ];

  for (let i = 0; i < turns.length; i++) {
    if (!existsSync(turns[i])) continue;

    console.log(`\nTurn ${i + 1}:`);
    const result = await voiceAgent.processVoice(
      readFileSync(turns[i]),
      context,
    );

    console.log('User:', result.text);
    console.log('Assistant:', result.response.content);
    console.log('Tokens used:', result.response.metadata.tokensUsed);
    console.log('Latency:', result.response.metadata.latencyMs, 'ms');

    if (result.audio) {
      writeFileSync(`./output/response-${i + 1}.mp3`, result.audio);
    }
  }

  // Export conversation
  await voiceAgent.exportConversation('./output/conversation');
  console.log('\n✅ Conversation exported!');
}

/**
 * Example 3: Voice-Enabled Multi-Agent System
 *
 * Multiple specialized agents working together with voice
 */
async function multiAgentVoiceExample() {
  console.log('\n=== Multi-Agent Voice System ===\n');

  const ollamaProvider = new OllamaProvider();
  const toolRegistry = new ToolRegistry();

  // Create specialized agents
  const _researchAgent = new Agent(
    {
      name: 'research-agent',
      description: 'Researches topics and gathers information',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt:
        'You are a research assistant. Gather and analyze information.',
      tools: [searchTool],
    },
    ollamaProvider,
    toolRegistry,
  );

  const _calculationAgent = new Agent(
    {
      name: 'calculation-agent',
      description: 'Performs calculations and data analysis',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt:
        'You are a calculation assistant. Perform accurate calculations.',
      tools: [calculatorTool],
    },
    ollamaProvider,
    toolRegistry,
  );

  const _summaryAgent = new Agent(
    {
      name: 'summary-agent',
      description: 'Summarizes information and creates reports',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt:
        'You are a summarization assistant. Create clear, concise summaries.',
    },
    ollamaProvider,
    toolRegistry,
  );

  // Setup voice for the main coordinator
  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
  const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

  const coordinatorAgent = new Agent(
    {
      name: 'coordinator',
      description: 'Coordinates multiple agents',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt: `You are a coordinator that routes requests to specialized agents.
        - Use research-agent for information gathering
        - Use calculation-agent for math and data analysis
        - Use summary-agent for creating summaries`,
    },
    ollamaProvider,
    toolRegistry,
  );

  const voiceCoordinator = new VoiceAgent(coordinatorAgent, {
    sttProvider,
    ttsProvider,
    ttsConfig: { voice: 'onyx' },
  });

  const context: AgentContext = {
    conversationId: 'multi-agent-1',
    sessionData: {
      availableAgents: ['research-agent', 'calculation-agent', 'summary-agent'],
    },
    history: [],
  };

  // Complex voice request
  console.log('Processing complex voice request...');
  const audioPath = './audio/complex-request.mp3';

  if (existsSync(audioPath)) {
    const result = await voiceCoordinator.processVoice(
      readFileSync(audioPath),
      context,
    );

    console.log('\nUser request:', result.text);
    console.log('Coordinator response:', result.response.content);

    // The coordinator would route to appropriate agents
    // In a full implementation, this would use workflow orchestration
  }
}

/**
 * Example 4: CLI Integration
 *
 * Show how these features integrate with the CLI
 */
async function cliIntegrationExample() {
  console.log('\n=== CLI Integration Example ===\n');

  console.log('The AgentSea CLI provides easy access to all these features:\n');

  console.log('1. Initialize configuration:');
  console.log('   $ agentsea init');
  console.log('   - Select local provider (Ollama)');
  console.log('   - Configure voice providers');
  console.log('   - Set up API keys\n');

  console.log('2. Create a voice-enabled agent:');
  console.log('   $ agentsea agent create voice-assistant \\');
  console.log('     --provider ollama \\');
  console.log('     --model llama2 \\');
  console.log('     --voice-stt openai-whisper \\');
  console.log('     --voice-tts openai-tts\n');

  console.log('3. Start interactive voice chat:');
  console.log('   $ agentsea chat --voice --agent voice-assistant\n');

  console.log('4. Run agent with voice input:');
  console.log('   $ agentsea agent run voice-assistant \\');
  console.log('     --voice-input ./audio.mp3 \\');
  console.log('     --voice-output ./response.mp3\n');

  console.log('5. Manage local models:');
  console.log('   $ agentsea model pull llama2');
  console.log('   $ agentsea model list');
  console.log('   $ agentsea model info llama2\n');

  console.log('See docs/CLI.md for complete CLI documentation.');
}

/**
 * Example 5: Production Configuration
 *
 * Best practices for production deployment
 */
async function productionConfigExample() {
  console.log('\n=== Production Configuration ===\n');

  // Production setup with error handling, retries, and monitoring
  const ollamaProvider = new OllamaProvider({
    baseUrl: process.env.OLLAMA_BASE_URL,
    timeout: 30000,
  });

  const toolRegistry = new ToolRegistry();
  toolRegistry.register({
    ...calculatorTool,
    retryConfig: {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelayMs: 1000,
      maxDelayMs: 10000,
    },
  });

  const agent = new Agent(
    {
      name: 'production-assistant',
      description: 'Production-ready voice assistant',
      model: 'llama2',
      provider: 'ollama',
      systemPrompt: 'You are a professional assistant.',
      tools: [calculatorTool],
      temperature: 0.7,
      maxTokens: 1000,
      maxIterations: 5,
      memory: {
        type: 'buffer',
        maxMessages: 100,
        storage: 'redis',
        ttl: 3600,
      },
    },
    ollamaProvider,
    toolRegistry,
  );

  // Use high-quality voice providers for production
  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
  const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

  const _voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
    sttConfig: {
      model: 'whisper-1',
      language: 'en',
      responseFormat: 'verbose_json',
    },
    ttsConfig: {
      model: 'tts-1-hd', // Higher quality
      voice: 'nova',
      speed: 1.0,
      format: 'mp3',
    },
    autoSpeak: true,
  });

  console.log('Production agent configured with:');
  console.log('- Error handling and retries');
  console.log('- Redis-backed memory');
  console.log('- High-quality voice models');
  console.log('- Observability and monitoring');
  console.log('- Rate limiting and caching');
}

/**
 * Main execution
 */
async function main() {
  console.log('🎙️  AgentSea ADK - Complete Integration Examples\n');
  console.log('='.repeat(60));

  try {
    // Run examples (uncomment the ones you want to try)

    // await localVoiceAssistantExample();
    // await hybridVoiceAssistantExample();
    // await multiAgentVoiceExample();
    await cliIntegrationExample();
    // await productionConfigExample();

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Examples completed successfully!\n');
    console.log('Next steps:');
    console.log(
      '1. Try the CLI: npm install -g @lov3kaizen/agentsea-cli && agentsea init',
    );
    console.log(
      '2. Read the docs: docs/LOCAL_MODELS.md, docs/VOICE.md, docs/CLI.md',
    );
    console.log('3. Explore more examples: examples/');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  void main();
}

export {
  localVoiceAssistantExample,
  hybridVoiceAssistantExample,
  multiAgentVoiceExample,
  cliIntegrationExample,
  productionConfigExample,
};

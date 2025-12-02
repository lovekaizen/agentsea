/**
 * Example: Voice-Enabled Agents with TTS and STT
 *
 * This example demonstrates how to use voice capabilities with AgentSea ADK:
 * - Speech-to-Text (STT) with OpenAI Whisper
 * - Text-to-Speech (TTS) with OpenAI and ElevenLabs
 * - Voice conversations
 * - Local TTS/STT providers
 */

import { readFileSync, writeFileSync } from 'fs';

import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  VoiceAgent,
  OpenAIWhisperProvider,
  OpenAITTSProvider,
  ElevenLabsTTSProvider,
  LocalWhisperProvider,
  PiperTTSProvider,
  AgentContext,
} from '@lov3kaizen/agentsea-core';

/**
 * Example 1: Basic Voice Agent with OpenAI
 */
async function _basicVoiceAgentExample() {
  console.log('\n=== Basic Voice Agent Example ===\n');

  // Create base agent
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'voice-assistant',
      description: 'A voice-enabled assistant',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt:
        'You are a helpful voice assistant. Keep responses concise.',
    },
    provider,
    toolRegistry,
  );

  // Create voice providers
  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
  const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

  // Create voice agent
  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
    ttsConfig: {
      voice: 'alloy',
      model: 'tts-1',
    },
    autoSpeak: true,
  });

  // Load audio file or use buffer
  const audioInput = readFileSync('./path/to/audio.mp3');

  // Process voice input
  const context: AgentContext = {
    conversationId: 'voice-conv-1',
    sessionData: {},
    history: [],
  };

  const result = await voiceAgent.processVoice(audioInput, context);

  console.log('Transcription:', result.text);
  console.log('Response:', result.response.content);

  // Save audio response
  if (result.audio) {
    writeFileSync('./output/response.mp3', result.audio);
    console.log('Audio saved to: ./output/response.mp3');
  }
}

/**
 * Example 2: Text-to-Speech Only
 */
async function _textToSpeechExample() {
  console.log('\n=== Text-to-Speech Example ===\n');

  // Create base agent
  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'tts-assistant',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      description: 'TTS assistant',
    },
    provider,
    toolRegistry,
  );

  // Create TTS provider only (using ElevenLabs for high quality)
  const ttsProvider = new ElevenLabsTTSProvider({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  // Note: We still need STT provider for VoiceAgent, but we won't use it
  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);

  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
    ttsConfig: {
      voice: 'EXAVITQu4vr4xnSDxMaL', // Bella voice
      model: 'eleven_multilingual_v2',
    },
  });

  const context: AgentContext = {
    conversationId: 'tts-conv-1',
    sessionData: {},
    history: [],
  };

  // Get spoken response
  const result = await voiceAgent.speak(
    'Tell me a short story about a robot',
    context,
  );

  console.log('Response:', result.text);

  // Save audio
  writeFileSync('./output/story.mp3', result.audio);
  console.log('Audio saved to: ./output/story.mp3');
}

/**
 * Example 3: Speech-to-Text Only
 */
async function _speechToTextExample() {
  console.log('\n=== Speech-to-Text Example ===\n');

  // Create STT provider
  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);

  // Load audio
  const audioInput = readFileSync('./path/to/audio.mp3');

  // Transcribe with detailed output
  const result = await sttProvider.transcribe(audioInput, {
    model: 'whisper-1',
    language: 'en',
    responseFormat: 'verbose_json',
  });

  console.log('Transcription:', result.text);
  console.log('Language:', result.language);
  console.log('Duration:', result.duration, 'seconds');

  // Show segments with timestamps
  if (result.segments) {
    console.log('\nSegments:');
    result.segments.forEach((segment) => {
      console.log(
        `[${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s]: ${segment.text}`,
      );
    });
  }

  // Show word-level timestamps
  if (result.words) {
    console.log('\nWords:');
    result.words.forEach((word) => {
      console.log(
        `[${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s]: ${word.word}`,
      );
    });
  }
}

/**
 * Example 4: Streaming TTS
 */
async function _streamingTTSExample() {
  console.log('\n=== Streaming TTS Example ===\n');

  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'streaming-assistant',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      description: 'Streaming TTS assistant',
    },
    provider,
    toolRegistry,
  );

  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
  const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
  });

  // Stream audio response
  const text =
    'This is a long text that will be streamed. ' +
    'Streaming allows for faster perceived response time. ' +
    'The audio starts playing before the entire response is generated.';

  console.log('Streaming audio...');

  const chunks: Buffer[] = [];
  for await (const chunk of voiceAgent.synthesizeStream(text)) {
    chunks.push(chunk);
    console.log(`Received chunk: ${chunk.length} bytes`);
  }

  // Combine chunks and save
  const fullAudio = Buffer.concat(chunks);
  writeFileSync('./output/streamed.mp3', fullAudio);
  console.log('Streamed audio saved to: ./output/streamed.mp3');
}

/**
 * Example 5: Voice Conversation
 */
async function _voiceConversationExample() {
  console.log('\n=== Voice Conversation Example ===\n');

  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'conversation-assistant',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      systemPrompt:
        'You are a friendly conversational assistant. Keep responses natural and concise.',
      description: 'Conversation assistant',
    },
    provider,
    toolRegistry,
  );

  const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);
  const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
    ttsConfig: {
      voice: 'nova', // Female voice
    },
  });

  const context: AgentContext = {
    conversationId: 'multi-turn-1',
    sessionData: {},
    history: [],
  };

  // Simulate multi-turn conversation
  const turns = ['./audio/turn1.mp3', './audio/turn2.mp3', './audio/turn3.mp3'];

  for (let i = 0; i < turns.length; i++) {
    console.log(`\nTurn ${i + 1}:`);

    const audioInput = readFileSync(turns[i]);
    const result = await voiceAgent.processVoice(audioInput, context);

    console.log('User:', result.text);
    console.log('Assistant:', result.response.content);

    // Save audio response
    if (result.audio) {
      writeFileSync(`./output/response-${i + 1}.mp3`, result.audio);
    }
  }

  // Export full conversation
  await voiceAgent.exportConversation('./output/conversation');
  console.log('\nFull conversation exported to: ./output/conversation');
}

/**
 * Example 6: Local Voice Providers
 */
async function _localVoiceExample() {
  console.log('\n=== Local Voice Providers Example ===\n');

  const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  const toolRegistry = new ToolRegistry();

  const agent = new Agent(
    {
      name: 'local-voice-assistant',
      model: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      description: 'Local voice assistant',
    },
    provider,
    toolRegistry,
  );

  // Use local Whisper for STT
  const sttProvider = new LocalWhisperProvider({
    whisperPath: '/path/to/whisper',
    modelPath: '/path/to/ggml-base.bin',
  });

  // Use Piper for TTS
  const ttsProvider = new PiperTTSProvider({
    piperPath: '/path/to/piper',
    modelPath: '/path/to/en_US-lessac-medium.onnx',
  });

  // Check if installed
  const whisperInstalled = await sttProvider.isInstalled();
  const piperInstalled = await ttsProvider.isInstalled();

  if (!whisperInstalled) {
    console.log(sttProvider.getInstallInstructions());
    return;
  }

  if (!piperInstalled) {
    console.log(ttsProvider.getInstallInstructions());
    return;
  }

  const voiceAgent = new VoiceAgent(agent, {
    sttProvider,
    ttsProvider,
  });

  // Use completely locally
  const audioInput = readFileSync('./path/to/audio.wav');
  const context: AgentContext = {
    conversationId: 'local-conv-1',
    sessionData: {},
    history: [],
  };

  const result = await voiceAgent.processVoice(audioInput, context);

  console.log('User:', result.text);
  console.log('Assistant:', result.response.content);

  if (result.audio) {
    writeFileSync('./output/local-response.wav', result.audio);
  }
}

/**
 * Example 7: Available Voices
 */
async function listVoicesExample() {
  console.log('\n=== Available Voices Example ===\n');

  // OpenAI TTS
  const openaiTTS = new OpenAITTSProvider(process.env.OPENAI_API_KEY);
  const openaiVoices = await openaiTTS.getVoices();

  console.log('OpenAI TTS Voices:');
  openaiVoices?.forEach((voice) => {
    console.log(`- ${voice.name} (${voice.id}): ${voice.gender}`);
  });

  // ElevenLabs
  if (process.env.ELEVENLABS_API_KEY) {
    const elevenlabsTTS = new ElevenLabsTTSProvider({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
    const elevenlabsVoices = await elevenlabsTTS.getVoices();

    console.log('\nElevenLabs Voices:');
    elevenlabsVoices?.forEach((voice) => {
      console.log(`- ${voice.name} (${voice.id}): ${voice.language}`);
    });
  }
}

// Run examples
async function main() {
  console.log('🎙️  AgentSea Voice Examples\n');

  try {
    // Uncomment the example you want to run

    // await basicVoiceAgentExample();
    // await textToSpeechExample();
    // await speechToTextExample();
    // await streamingTTSExample();
    // await voiceConversationExample();
    // await localVoiceExample();
    await listVoicesExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  void main();
}

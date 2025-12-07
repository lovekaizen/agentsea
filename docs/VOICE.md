# Voice Features (TTS/STT)

Complete guide to using Text-to-Speech (TTS) and Speech-to-Text (STT) with AgentSea ADK.

## Table of Contents

- [Overview](#overview)
- [Speech-to-Text (STT)](#speech-to-text-stt)
- [Text-to-Speech (TTS)](#text-to-speech-tts)
- [Voice Agent](#voice-agent)
- [Supported Providers](#supported-providers)
- [Examples](#examples)
- [Best Practices](#best-practices)

## Overview

AgentSea ADK includes comprehensive voice support for building voice-enabled AI agents:

- **Speech-to-Text (STT)** - Transcribe audio to text
- **Text-to-Speech (TTS)** - Synthesize speech from text
- **Voice Agent** - Wrapper that combines both for voice conversations
- **Multiple Providers** - Cloud and local options
- **Streaming** - Real-time audio streaming
- **Multiple Languages** - Support for many languages

## Speech-to-Text (STT)

### OpenAI Whisper

High-quality transcription with OpenAI's Whisper model.

```typescript
import { OpenAIWhisperProvider } from '@lov3kaizen/agentsea-core';

const sttProvider = new OpenAIWhisperProvider(process.env.OPENAI_API_KEY);

// Transcribe audio file
const result = await sttProvider.transcribe('./audio.mp3', {
  model: 'whisper-1',
  language: 'en',
  responseFormat: 'verbose_json',
});

console.log('Text:', result.text);
console.log('Language:', result.language);
console.log('Duration:', result.duration);

// Access segments with timestamps
result.segments?.forEach((segment) => {
  console.log(`[${segment.start}s - ${segment.end}s]: ${segment.text}`);
});

// Access word-level timestamps
result.words?.forEach((word) => {
  console.log(`${word.word} at ${word.start}s`);
});
```

**Features:**

- ✅ High accuracy
- ✅ 99+ languages
- ✅ Timestamps (segment and word-level)
- ✅ Speaker diarization
- ❌ No streaming

**Supported Languages:**
English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Chinese, Japanese, Korean, Arabic, Hindi, and 90+ more.

### LemonFox STT

Cost-effective OpenAI-compatible transcription using Whisper v3.

```typescript
import { LemonFoxSTTProvider } from '@lov3kaizen/agentsea-core';

const sttProvider = new LemonFoxSTTProvider(process.env.LEMONFOX_API_KEY);

// Transcribe audio file
const result = await sttProvider.transcribe('./audio.mp3', {
  model: 'whisper-1',
  language: 'en',
  responseFormat: 'verbose_json',
});

console.log('Text:', result.text);
console.log('Language:', result.language);
console.log('Duration:', result.duration);
```

**Alternative: Using OpenAI Whisper with custom baseURL:**

```typescript
import { OpenAIWhisperProvider } from '@lov3kaizen/agentsea-core';

const sttProvider = new OpenAIWhisperProvider({
  apiKey: process.env.LEMONFOX_API_KEY,
  baseURL: 'https://api.lemonfox.ai/v1',
});
```

**Features:**

- ✅ High accuracy (Whisper v3)
- ✅ 100+ languages
- ✅ Timestamps (segment and word-level)
- ✅ Speaker diarization
- ✅ OpenAI-compatible API
- ✅ Cost-effective ($0.50 per 3 hours)
- ❌ No streaming

### Local Whisper

Run Whisper locally for complete privacy.

```typescript
import { LocalWhisperProvider } from '@lov3kaizen/agentsea-core';

const sttProvider = new LocalWhisperProvider({
  whisperPath: '/path/to/whisper',
  modelPath: '/path/to/ggml-base.bin',
});

// Check if installed
if (!(await sttProvider.isInstalled())) {
  console.log(sttProvider.getInstallInstructions());
  return;
}

const result = await sttProvider.transcribe('./audio.wav', {
  model: 'base',
  language: 'en',
});
```

**Installation:**

Option 1: whisper.cpp (recommended)

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
./models/download-ggml-model.sh base
```

Option 2: Python Whisper

```bash
pip install openai-whisper
```

**Features:**

- ✅ Complete privacy
- ✅ No API costs
- ✅ Offline capability
- ❌ No streaming
- ❌ Slower than cloud

## Text-to-Speech (TTS)

### OpenAI TTS

High-quality voices with OpenAI's TTS models.

```typescript
import { OpenAITTSProvider } from '@lov3kaizen/agentsea-core';

const ttsProvider = new OpenAITTSProvider(process.env.OPENAI_API_KEY);

// Synthesize speech
const result = await ttsProvider.synthesize('Hello, world!', {
  model: 'tts-1-hd',
  voice: 'nova',
  speed: 1.0,
  format: 'mp3',
});

// Save audio
import { writeFileSync } from 'fs';
writeFileSync('./output.mp3', result.audio);

// Stream for faster response
for await (const chunk of ttsProvider.synthesizeStream('Long text...', {
  voice: 'alloy',
})) {
  // Process audio chunks
}
```

**Available Voices:**

- `alloy` - Neutral voice
- `echo` - Male voice
- `fable` - Neutral voice
- `onyx` - Male voice
- `nova` - Female voice
- `shimmer` - Female voice

**Models:**

- `tts-1` - Faster, lower latency
- `tts-1-hd` - Higher quality

**Features:**

- ✅ High quality
- ✅ Multiple voices
- ✅ Streaming support
- ✅ Speed control
- ✅ Multiple formats (mp3, opus, aac, flac, wav, pcm)

### LemonFox TTS

Cost-effective OpenAI-compatible text-to-speech with 50+ voices.

```typescript
import { LemonFoxTTSProvider } from '@lov3kaizen/agentsea-core';

const ttsProvider = new LemonFoxTTSProvider(process.env.LEMONFOX_API_KEY);

// Synthesize speech
const result = await ttsProvider.synthesize('Hello, world!', {
  model: 'tts-1',
  voice: 'sarah', // or any OpenAI-compatible voice like 'nova'
  format: 'mp3',
});

// Save audio
import { writeFileSync } from 'fs';
writeFileSync('./output.mp3', result.audio);

// Stream for faster response
for await (const chunk of ttsProvider.synthesizeStream('Long text...', {
  voice: 'alloy',
})) {
  // Process audio chunks
}
```

**Alternative: Using OpenAI TTS with custom baseURL:**

```typescript
import { OpenAITTSProvider } from '@lov3kaizen/agentsea-core';

const ttsProvider = new OpenAITTSProvider({
  apiKey: process.env.LEMONFOX_API_KEY,
  baseURL: 'https://api.lemonfox.ai/v1',
});
```

**Features:**

- ✅ 50+ voices across 8 languages
- ✅ OpenAI-compatible API
- ✅ Streaming support
- ✅ Multiple formats (mp3, opus, aac, flac, wav, pcm)
- ✅ Low latency
- ✅ Cost-effective ($2.50 per 1M characters, up to 90% savings)

### ElevenLabs

Premium voice synthesis with voice cloning.

```typescript
import { ElevenLabsTTSProvider } from '@lov3kaizen/agentsea-core';

const ttsProvider = new ElevenLabsTTSProvider({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

// List available voices
const voices = await ttsProvider.getVoices();
console.log('Available voices:', voices);

// Synthesize with specific voice
const result = await ttsProvider.synthesize('Hello!', {
  voice: 'EXAVITQu4vr4xnSDxMaL', // Bella
  model: 'eleven_multilingual_v2',
});

// Stream
for await (const chunk of ttsProvider.synthesizeStream('Text...')) {
  // Process chunks
}
```

**Features:**

- ✅ Highest quality
- ✅ Voice cloning
- ✅ Emotional range
- ✅ Multiple languages
- ✅ Streaming support
- 💰 Premium pricing

### Piper TTS (Local)

Fast, local neural TTS.

```typescript
import { PiperTTSProvider } from '@lov3kaizen/agentsea-core';

const ttsProvider = new PiperTTSProvider({
  piperPath: '/path/to/piper',
  modelPath: '/path/to/en_US-lessac-medium.onnx',
});

// Check installation
if (!(await ttsProvider.isInstalled())) {
  console.log(ttsProvider.getInstallInstructions());
  return;
}

const result = await ttsProvider.synthesize('Hello!');
writeFileSync('./output.wav', result.audio);
```

**Installation:**

```bash
# Download Piper
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_x86_64.tar.gz
tar -xzf piper_linux_x86_64.tar.gz

# Download a voice model
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
```

**Features:**

- ✅ Fast synthesis
- ✅ Complete privacy
- ✅ No API costs
- ✅ Multiple voices
- ❌ No streaming
- ❌ Lower quality than cloud

## Voice Agent

Combine STT and TTS for voice conversations.

### Basic Usage

```typescript
import {
  Agent,
  AnthropicProvider,
  ToolRegistry,
  VoiceAgent,
  OpenAIWhisperProvider,
  OpenAITTSProvider,
} from '@lov3kaizen/agentsea-core';

// Create base agent
const provider = new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
const toolRegistry = new ToolRegistry();

const agent = new Agent(
  {
    name: 'voice-assistant',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful voice assistant.',
    description: 'Voice assistant',
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
    voice: 'nova',
    model: 'tts-1',
  },
  autoSpeak: true, // Automatically synthesize responses
});

// Process voice input
const audioInput = readFileSync('./user-audio.mp3');
const result = await voiceAgent.processVoice(audioInput, context);

console.log('User said:', result.text);
console.log('Assistant response:', result.response.content);

// Save audio response
writeFileSync('./response.mp3', result.audio!);
```

### Voice Conversation

```typescript
// Multi-turn conversation
const context = {
  conversationId: 'conv-1',
  sessionData: {},
  history: [],
};

// Turn 1
let result = await voiceAgent.processVoice(
  readFileSync('./turn1.mp3'),
  context,
);
console.log('Turn 1 - User:', result.text);
console.log('Turn 1 - Assistant:', result.response.content);

// Turn 2
result = await voiceAgent.processVoice(readFileSync('./turn2.mp3'), context);
console.log('Turn 2 - User:', result.text);
console.log('Turn 2 - Assistant:', result.response.content);

// Export full conversation
await voiceAgent.exportConversation('./conversation-export');
```

### Text-to-Speech Only

```typescript
// Get spoken response from text input
const result = await voiceAgent.speak('Tell me a joke', context);

console.log('Response:', result.text);
writeFileSync('./joke.mp3', result.audio);
```

### Transcription Only

```typescript
// Transcribe without agent processing
const text = await voiceAgent.transcribe(audioBuffer);
console.log('Transcription:', text);
```

### Streaming

```typescript
// Stream long responses
for await (const chunk of voiceAgent.synthesizeStream('Long text...')) {
  // Play audio chunk immediately
}
```

### Configuration

```typescript
// Update TTS settings
voiceAgent.setTTSConfig({
  voice: 'onyx',
  speed: 1.2,
  model: 'tts-1-hd',
});

// Update STT settings
voiceAgent.setSTTConfig({
  language: 'es',
  temperature: 0,
});

// Toggle auto-speak
voiceAgent.setAutoSpeak(false);
```

## Supported Providers

### STT Providers

| Provider       | Quality   | Speed | Cost         | Privacy | Streaming | Languages |
| -------------- | --------- | ----- | ------------ | ------- | --------- | --------- |
| OpenAI Whisper | Excellent | Fast  | $$           | Cloud   | ❌        | 99+       |
| LemonFox STT   | Excellent | Fast  | $ (cheapest) | Cloud   | ❌        | 100+      |
| Local Whisper  | Excellent | Slow  | Free         | 100%    | ❌        | 99+       |

### TTS Providers

| Provider     | Quality   | Speed | Cost         | Privacy | Streaming | Voices |
| ------------ | --------- | ----- | ------------ | ------- | --------- | ------ |
| OpenAI TTS   | Excellent | Fast  | $            | Cloud   | ✅        | 6      |
| LemonFox TTS | Excellent | Fast  | $ (cheapest) | Cloud   | ✅        | 50+    |
| ElevenLabs   | Premium   | Fast  | $$$          | Cloud   | ✅        | 100+   |
| Piper TTS    | Good      | Fast  | Free         | 100%    | ❌        | 50+    |

## Examples

### Example 1: Customer Service Bot

```typescript
const agent = new Agent(
  {
    name: 'customer-service',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a helpful customer service representative.',
    description: 'Customer service bot',
  },
  provider,
  toolRegistry,
);

const voiceAgent = new VoiceAgent(agent, {
  sttProvider: new OpenAIWhisperProvider(),
  ttsProvider: new OpenAITTSProvider(),
  ttsConfig: { voice: 'nova' }, // Friendly female voice
});

// Handle customer calls
const result = await voiceAgent.processVoice(customerAudio, context);
```

### Example 2: Language Learning

```typescript
const agent = new Agent(
  {
    name: 'language-tutor',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are a Spanish language tutor.',
    description: 'Language tutor',
  },
  provider,
  toolRegistry,
);

const voiceAgent = new VoiceAgent(agent, {
  sttProvider: new OpenAIWhisperProvider(),
  ttsProvider: new OpenAITTSProvider(),
  sttConfig: { language: 'es' },
  ttsConfig: { voice: 'alloy' },
});

// Practice conversations
const result = await voiceAgent.processVoice(studentAudio, context);
```

### Example 3: Podcast Generator

```typescript
const agent = new Agent(
  {
    name: 'podcast-host',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    systemPrompt: 'You are an engaging podcast host.',
    description: 'Podcast host',
  },
  provider,
  toolRegistry,
);

const voiceAgent = new VoiceAgent(agent, {
  sttProvider: new OpenAIWhisperProvider(),
  ttsProvider: new ElevenLabsTTSProvider(),
  ttsConfig: {
    voice: 'professional-voice-id',
    model: 'eleven_multilingual_v2',
  },
});

// Generate podcast episode
const script = "Today we're discussing...";
const result = await voiceAgent.speak(script, context);
writeFileSync('./podcast-episode.mp3', result.audio);
```

## Best Practices

### 1. Choose the Right Provider

**For Production:**

- STT: OpenAI Whisper (accuracy + speed)
- TTS: OpenAI TTS or ElevenLabs (quality)

**For Cost-Effective Production:**

- STT: LemonFox ($0.50 per 3 hours - lowest on market)
- TTS: LemonFox ($2.50 per 1M chars - up to 90% savings)

**For Development:**

- STT: Local Whisper (no costs)
- TTS: Piper TTS (no costs)

**For Privacy:**

- STT: Local Whisper
- TTS: Piper TTS

### 2. Optimize for Latency

```typescript
// Use streaming for faster perceived response
for await (const chunk of voiceAgent.synthesizeStream(longText)) {
  playAudio(chunk); // Start playing immediately
}

// Use faster models

const ttsProvider = new OpenAITTSProvider();
voiceAgent.setTTSConfig({
  model: 'tts-1', // Faster than tts-1-hd
});
```

### 3. Handle Long Audio

```typescript
// Split long transcriptions
const result = await sttProvider.transcribe(longAudio, {
  responseFormat: 'verbose_json',
});

// Process segments individually
for (const segment of result.segments) {
  console.log(`[${segment.start}s]: ${segment.text}`);
}
```

### 4. Error Handling

```typescript
try {
  const result = await voiceAgent.processVoice(audio, context);
} catch (error) {
  if (error.message.includes('audio format')) {
    // Handle unsupported format
  } else if (error.message.includes('rate limit')) {
    // Handle rate limiting
  } else {
    // Handle other errors
  }
}
```

### 5. Voice Selection

```typescript
// List available voices
const voices = await ttsProvider.getVoices();

// Choose based on use case
const customerService = 'nova'; // Friendly female
const news = 'onyx'; // Professional male
const storytelling = 'fable'; // Expressive neutral
```

### 6. Cost Optimization

```typescript
// Cache common responses
const cache = new Map<string, Buffer>();

async function getCachedSpeech(text: string): Promise<Buffer> {
  if (cache.has(text)) {
    return cache.get(text)!;
  }

  const audio = await voiceAgent.synthesize(text);
  cache.set(text, audio);
  return audio;
}

// Pre-generate common phrases
const greetings = await Promise.all([
  voiceAgent.synthesize('Hello!'),
  voiceAgent.synthesize('How can I help you?'),
  voiceAgent.synthesize('Thank you!'),
]);
```

## Troubleshooting

### "API key not found"

Set environment variables:

```bash
export OPENAI_API_KEY=your_key
export ELEVENLABS_API_KEY=your_key
export LEMONFOX_API_KEY=your_key
```

### "Unsupported audio format"

Convert audio to supported format:

```bash
ffmpeg -i input.m4a -ar 16000 output.wav
```

### "Local Whisper not found"

Install whisper.cpp or Python whisper and provide path:

```typescript
const provider = new LocalWhisperProvider({
  whisperPath: '/usr/local/bin/whisper',
});
```

### Slow transcription

- Use smaller model: `base` instead of `large`
- Use OpenAI Whisper instead of local
- Reduce audio quality

### Poor audio quality

- Use higher quality model: `tts-1-hd`
- Use ElevenLabs for premium quality
- Adjust speed: `speed: 0.9` for clearer speech

## See Also

- [Examples](../examples/voice-example.ts)
- [API Reference](../packages/core/src/types/voice.ts)
- [OpenAI Whisper](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI TTS](https://platform.openai.com/docs/guides/text-to-speech)
- [LemonFox AI](https://lemonfox.ai/docs)
- [ElevenLabs](https://elevenlabs.io/docs)
- [Piper TTS](https://github.com/rhasspy/piper)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)

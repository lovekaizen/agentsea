import { writeFileSync } from 'fs';
import { join } from 'path';

import { Agent } from '../agent/agent';
import { AgentContext, AgentResponse } from '../types';
import {
  STTProvider,
  TTSProvider,
  VoiceAgentConfig,
  VoiceMessage,
  STTConfig,
  TTSConfig,
} from '../types/voice';

/**
 * Voice-enabled agent wrapper
 *
 * Wraps a regular agent with speech-to-text and text-to-speech capabilities
 */
export class VoiceAgent {
  private agent: Agent;
  private sttProvider: STTProvider;
  private ttsProvider: TTSProvider;
  private sttConfig?: STTConfig;
  private ttsConfig?: TTSConfig;
  private autoSpeak: boolean;
  private conversationHistory: VoiceMessage[] = [];

  constructor(agent: Agent, config: VoiceAgentConfig) {
    this.agent = agent;
    this.sttProvider = config.sttProvider;
    this.ttsProvider = config.ttsProvider;
    this.sttConfig = config.sttConfig;
    this.ttsConfig = config.ttsConfig;
    this.autoSpeak = config.autoSpeak !== false; // Default to true
  }

  /**
   * Process voice input and return voice response
   */
  async processVoice(
    audioInput: Buffer | string,
    context: AgentContext,
  ): Promise<{
    text: string;
    audio?: Buffer;
    response: AgentResponse;
  }> {
    try {
      // 1. Transcribe audio to text
      const sttResult = await this.sttProvider.transcribe(
        audioInput,
        this.sttConfig,
      );
      const userText = sttResult.text;

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        text: userText,
        timestamp: new Date(),
      });

      // 2. Get agent response
      const response = await this.agent.execute(userText, context);
      const assistantText = response.content;

      // 3. Synthesize response to speech (if autoSpeak is enabled)
      let audioOutput: Buffer | undefined;

      if (this.autoSpeak) {
        const ttsResult = await this.ttsProvider.synthesize(
          assistantText,
          this.ttsConfig,
        );
        audioOutput = ttsResult.audio;
      }

      // Add to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        text: assistantText,
        audio: audioOutput,
        timestamp: new Date(),
      });

      return {
        text: assistantText,
        audio: audioOutput,
        response,
      };
    } catch (error) {
      throw new Error(
        `Voice processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Process text input and return voice response
   */
  async speak(
    text: string,
    context: AgentContext,
  ): Promise<{
    text: string;
    audio: Buffer;
    response: AgentResponse;
  }> {
    try {
      // Get agent response
      const response = await this.agent.execute(text, context);
      const assistantText = response.content;

      // Synthesize response to speech
      const ttsResult = await this.ttsProvider.synthesize(
        assistantText,
        this.ttsConfig,
      );

      // Add to conversation history
      this.conversationHistory.push(
        {
          role: 'user',
          text: text,
          timestamp: new Date(),
        },
        {
          role: 'assistant',
          text: assistantText,
          audio: ttsResult.audio,
          timestamp: new Date(),
        },
      );

      return {
        text: assistantText,
        audio: ttsResult.audio,
        response,
      };
    } catch (error) {
      throw new Error(
        `Speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Transcribe audio without getting agent response
   */
  async transcribe(audioInput: Buffer | string): Promise<string> {
    try {
      const result = await this.sttProvider.transcribe(
        audioInput,
        this.sttConfig,
      );
      return result.text;
    } catch (error) {
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Synthesize text to speech without agent processing
   */
  async synthesize(text: string): Promise<Buffer> {
    try {
      const result = await this.ttsProvider.synthesize(text, this.ttsConfig);
      return result.audio;
    } catch (error) {
      throw new Error(
        `Speech synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Stream synthesis for long text
   */
  async *synthesizeStream(text: string): AsyncIterable<Buffer> {
    if (!this.ttsProvider.supportsStreaming()) {
      throw new Error('TTS provider does not support streaming');
    }

    if (!this.ttsProvider.synthesizeStream) {
      throw new Error('TTS provider does not implement streaming');
    }

    for await (const chunk of this.ttsProvider.synthesizeStream(
      text,
      this.ttsConfig,
    )) {
      yield chunk;
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): VoiceMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Save audio to file
   */
  saveAudio(audio: Buffer, outputPath: string): void {
    writeFileSync(outputPath, audio);
  }

  /**
   * Export conversation history with audio
   */
  exportConversation(outputDir: string): void {
    for (let i = 0; i < this.conversationHistory.length; i++) {
      const message = this.conversationHistory[i];

      // Save text
      const textPath = join(outputDir, `${i}-${message.role}.txt`);
      writeFileSync(textPath, message.text);

      // Save audio if available
      if (message.audio) {
        const audioPath = join(outputDir, `${i}-${message.role}.mp3`);
        writeFileSync(audioPath, message.audio);
      }
    }
  }

  /**
   * Set auto-speak mode
   */
  setAutoSpeak(enabled: boolean): void {
    this.autoSpeak = enabled;
  }

  /**
   * Update STT configuration
   */
  setSTTConfig(config: STTConfig): void {
    this.sttConfig = config;
  }

  /**
   * Update TTS configuration
   */
  setTTSConfig(config: TTSConfig): void {
    this.ttsConfig = config;
  }

  /**
   * Check if providers support streaming
   */
  supportsStreaming(): {
    stt: boolean;
    tts: boolean;
  } {
    return {
      stt: this.sttProvider.supportsStreaming(),
      tts: this.ttsProvider.supportsStreaming(),
    };
  }
}

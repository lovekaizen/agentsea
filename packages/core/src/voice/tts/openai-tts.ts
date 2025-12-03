import OpenAI from 'openai';

import {
  TTSProvider,
  TTSConfig,
  TTSResult,
  AudioFormat,
} from '../../types/voice';

/**
 * OpenAI Text-to-Speech provider
 *
 * Supports:
 * - Multiple voices (alloy, echo, fable, onyx, nova, shimmer)
 * - Multiple models (tts-1, tts-1-hd)
 * - Multiple formats (mp3, opus, aac, flac, wav, pcm)
 * - Speed control
 */
export class OpenAITTSProvider implements TTSProvider {
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, config?: TTSConfig): Promise<TTSResult> {
    try {
      const response = await this.client.audio.speech.create({
        model: config?.model || 'tts-1',
        voice: (config?.voice as any) || 'alloy',
        input: text,
        speed: config?.speed || 1.0,
        response_format: config?.format || 'mp3',
      });

      // Convert response to buffer
      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        format: config?.format || 'mp3',
        byteLength: buffer.length,
      };
    } catch (error) {
      throw new Error(
        `OpenAI TTS synthesis failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Synthesize text to speech stream
   */
  async *synthesizeStream(
    text: string,
    config?: TTSConfig,
  ): AsyncIterable<Buffer> {
    try {
      const response = await this.client.audio.speech.create({
        model: config?.model || 'tts-1',
        voice: (config?.voice as any) || 'alloy',
        input: text,
        speed: config?.speed || 1.0,
        response_format: config?.format || 'mp3',
      });

      // Stream the response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } catch (error) {
      throw new Error(
        `OpenAI TTS streaming failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming(): boolean {
    return true;
  }

  /**
   * Get available voices
   */
  getVoices(): Promise<
    Array<{
      id: string;
      name: string;
      language?: string;
      gender?: 'male' | 'female' | 'neutral';
    }>
  > {
    return Promise.resolve([
      { id: 'alloy', name: 'Alloy', gender: 'neutral' },
      { id: 'echo', name: 'Echo', gender: 'male' },
      { id: 'fable', name: 'Fable', gender: 'neutral' },
      { id: 'onyx', name: 'Onyx', gender: 'male' },
      { id: 'nova', name: 'Nova', gender: 'female' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female' },
    ]);
  }

  /**
   * Get available models
   */
  getModels(): string[] {
    return ['tts-1', 'tts-1-hd'];
  }

  /**
   * Get supported formats
   */
  getFormats(): AudioFormat[] {
    return ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
  }
}

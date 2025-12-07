import { createReadStream } from 'fs';

import OpenAI, { toFile } from 'openai';

import { STTProvider, STTConfig, STTResult } from '../../types/voice';

/**
 * Configuration for OpenAI Whisper provider
 */
export interface OpenAIWhisperConfig {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for API (allows use with OpenAI-compatible services like LemonFox) */
  baseURL?: string;
}

/**
 * OpenAI Whisper Speech-to-Text provider
 *
 * Supports:
 * - High-quality transcription
 * - Multiple languages
 * - Timestamps and word-level timing
 * - File or buffer input
 * - Custom baseURL for OpenAI-compatible services (e.g., LemonFox)
 */
export class OpenAIWhisperProvider implements STTProvider {
  private client: OpenAI;

  /**
   * Create an OpenAI Whisper provider
   * @param config - Configuration object or API key string (for backward compatibility)
   */
  constructor(config?: string | OpenAIWhisperConfig) {
    // Handle backward compatibility: string = apiKey only
    const resolvedConfig: OpenAIWhisperConfig =
      typeof config === 'string' ? { apiKey: config } : config || {};

    this.client = new OpenAI({
      apiKey: resolvedConfig.apiKey || process.env.OPENAI_API_KEY,
      baseURL: resolvedConfig.baseURL,
    });
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(
    audio: Buffer | string,
    config?: STTConfig,
  ): Promise<STTResult> {
    try {
      let audioFile: any;

      // Handle buffer vs file path
      if (Buffer.isBuffer(audio)) {
        // Use OpenAI SDK's toFile helper for Node.js compatibility
        audioFile = await toFile(audio, 'audio.mp3', { type: 'audio/mpeg' });
      } else if (typeof audio === 'string') {
        // File path
        audioFile = createReadStream(audio);
      } else {
        throw new Error(
          'Invalid audio input. Expected Buffer or file path string.',
        );
      }

      // Call OpenAI Whisper API
      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: config?.model || 'whisper-1',
        language: config?.language,
        temperature: config?.temperature,
        prompt: config?.prompt,
        response_format: config?.responseFormat || 'verbose_json',
      });

      // Parse response based on format
      if (config?.responseFormat === 'text') {
        return {
          text: response as unknown as string,
        };
      }

      // Verbose JSON response
      const verboseResponse = response as any;

      return {
        text: verboseResponse.text,
        language: verboseResponse.language,
        duration: verboseResponse.duration,
        segments: verboseResponse.segments?.map((seg: any) => ({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
        words: verboseResponse.words?.map((word: any) => ({
          word: word.word,
          start: word.start,
          end: word.end,
        })),
      };
    } catch (error) {
      throw new Error(
        `OpenAI Whisper transcription failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming(): boolean {
    return false; // OpenAI Whisper doesn't support streaming
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return [
      'en',
      'zh',
      'de',
      'es',
      'ru',
      'ko',
      'fr',
      'ja',
      'pt',
      'tr',
      'pl',
      'ca',
      'nl',
      'ar',
      'sv',
      'it',
      'id',
      'hi',
      'fi',
      'vi',
      'he',
      'uk',
      'el',
      'ms',
      'cs',
      'ro',
      'da',
      'hu',
      'ta',
      'no',
      'th',
      'ur',
      'hr',
      'bg',
      'lt',
      'la',
      'mi',
      'ml',
      'cy',
      'sk',
      'te',
      'fa',
      'lv',
      'bn',
      'sr',
      'az',
      'sl',
      'kn',
      'et',
      'mk',
      'br',
      'eu',
      'is',
      'hy',
      'ne',
      'mn',
      'bs',
      'kk',
      'sq',
      'sw',
      'gl',
      'mr',
      'pa',
      'si',
      'km',
      'sn',
      'yo',
      'so',
      'af',
      'oc',
      'ka',
      'be',
      'tg',
      'sd',
      'gu',
      'am',
      'yi',
      'lo',
      'uz',
      'fo',
      'ht',
      'ps',
      'tk',
      'nn',
      'mt',
      'sa',
      'lb',
      'my',
      'bo',
      'tl',
      'mg',
      'as',
      'tt',
      'haw',
      'ln',
      'ha',
      'ba',
      'jw',
      'su',
    ];
  }
}

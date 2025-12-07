import { AudioFormat } from '../../types/voice';
import { OpenAITTSProvider } from './openai-tts';

/**
 * LemonFox API base URL
 */
const LEMONFOX_BASE_URL = 'https://api.lemonfox.ai/v1';

/**
 * LemonFox Text-to-Speech provider
 *
 * LemonFox provides OpenAI-compatible TTS with 50+ voices across 8 languages.
 *
 * Features:
 * - OpenAI-compatible API
 * - 50+ voices across 8 languages
 * - Low-latency, high-quality synthesis
 * - Cost-effective: $2.50 per 1,000,000 characters (up to 90% savings)
 * - Supports mp3, opus, aac, flac, wav, pcm formats
 *
 * @example
 * ```typescript
 * const ttsProvider = new LemonFoxTTSProvider(process.env.LEMONFOX_API_KEY);
 *
 * const result = await ttsProvider.synthesize('Hello, world!', {
 *   voice: 'sarah',
 *   model: 'tts-1',
 *   format: 'mp3',
 * });
 *
 * await fs.promises.writeFile('./speech.mp3', result.audio);
 * ```
 *
 * @see https://lemonfox.ai/docs for more information
 */
export class LemonFoxTTSProvider extends OpenAITTSProvider {
  /**
   * Create a LemonFox TTS provider
   * @param apiKey - LemonFox API key (defaults to LEMONFOX_API_KEY env var)
   */
  constructor(apiKey?: string) {
    super({
      apiKey: apiKey || process.env.LEMONFOX_API_KEY,
      baseURL: LEMONFOX_BASE_URL,
    });
  }

  /**
   * Get available LemonFox voices
   *
   * LemonFox offers 50+ voices across 8 languages.
   * This returns a sample of common voices; the full list is available at:
   * https://lemonfox.ai/docs
   */
  override getVoices(): Promise<
    Array<{
      id: string;
      name: string;
      language?: string;
      gender?: 'male' | 'female' | 'neutral';
    }>
  > {
    // LemonFox supports OpenAI voices plus additional voices
    // This list includes OpenAI-compatible voices and some LemonFox-specific ones
    return Promise.resolve([
      // OpenAI-compatible voices
      { id: 'alloy', name: 'Alloy', gender: 'neutral' as const },
      { id: 'echo', name: 'Echo', gender: 'male' as const },
      { id: 'fable', name: 'Fable', gender: 'neutral' as const },
      { id: 'onyx', name: 'Onyx', gender: 'male' as const },
      { id: 'nova', name: 'Nova', gender: 'female' as const },
      { id: 'shimmer', name: 'Shimmer', gender: 'female' as const },
      // LemonFox-specific voices (sample)
      { id: 'sarah', name: 'Sarah', gender: 'female' as const },
    ]);
  }

  /**
   * Get available models
   */
  override getModels(): string[] {
    return ['tts-1'];
  }

  /**
   * Get supported formats
   */
  override getFormats(): AudioFormat[] {
    return ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
  }
}

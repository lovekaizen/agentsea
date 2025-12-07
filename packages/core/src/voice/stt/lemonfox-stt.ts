import { OpenAIWhisperProvider } from './openai-whisper';

/**
 * LemonFox API base URL
 */
const LEMONFOX_BASE_URL = 'https://api.lemonfox.ai/v1';

/**
 * LemonFox Speech-to-Text provider
 *
 * LemonFox provides OpenAI-compatible STT using Whisper v3.
 *
 * Features:
 * - OpenAI-compatible API
 * - 100+ language support
 * - Speaker diarization
 * - Cost-effective: $0.50 per 3 hours of speech
 *
 * @example
 * ```typescript
 * const sttProvider = new LemonFoxSTTProvider(process.env.LEMONFOX_API_KEY);
 *
 * const result = await sttProvider.transcribe('./audio.mp3', {
 *   model: 'whisper-1',
 *   language: 'en',
 * });
 *
 * console.log('Transcription:', result.text);
 * ```
 *
 * @see https://lemonfox.ai/docs for more information
 */
export class LemonFoxSTTProvider extends OpenAIWhisperProvider {
  /**
   * Create a LemonFox STT provider
   * @param apiKey - LemonFox API key (defaults to LEMONFOX_API_KEY env var)
   */
  constructor(apiKey?: string) {
    super({
      apiKey: apiKey || process.env.LEMONFOX_API_KEY,
      baseURL: LEMONFOX_BASE_URL,
    });
  }
}

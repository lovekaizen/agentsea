import { TTSProvider, TTSConfig, TTSResult } from '../../types/voice';

/**
 * ElevenLabs configuration
 */
export interface ElevenLabsConfig {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * ElevenLabs Text-to-Speech provider
 *
 * Supports:
 * - High-quality voice cloning
 * - Multiple voices
 * - Voice settings customization
 * - Streaming
 */
export class ElevenLabsTTSProvider implements TTSProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: ElevenLabsConfig) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://api.elevenlabs.io/v1';

    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, config?: TTSConfig): Promise<TTSResult> {
    try {
      const voiceId = config?.voice || 'EXAVITQu4vr4xnSDxMaL'; // Default voice (Bella)
      const modelId = config?.model || 'eleven_monolingual_v1';

      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              style: 0,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${error}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      return {
        audio: buffer,
        format: 'mp3',
        byteLength: buffer.length,
      };
    } catch (error) {
      throw new Error(
        `ElevenLabs TTS synthesis failed: ${
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
      const voiceId = config?.voice || 'EXAVITQu4vr4xnSDxMaL';
      const modelId = config?.model || 'eleven_monolingual_v1';

      const response = await fetch(
        `${this.baseUrl}/text-to-speech/${voiceId}/stream`,
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
              style: 0,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${error}`);
      }

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
        `ElevenLabs TTS streaming failed: ${
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
  async getVoices(): Promise<
    Array<{
      id: string;
      name: string;
      language?: string;
      gender?: 'male' | 'female' | 'neutral';
    }>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }

      const data: any = await response.json();

      return data.voices.map((voice: any) => ({
        id: voice.voice_id,
        name: voice.name,
        language: voice.labels?.language,
        gender: voice.labels?.gender,
      }));
    } catch (error) {
      throw new Error(
        `Failed to get ElevenLabs voices: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Get available models
   */
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data: any = await response.json();
      return data.map((model: any) => model.model_id);
    } catch (error) {
      // Return default models if API call fails
      return [
        'eleven_monolingual_v1',
        'eleven_multilingual_v1',
        'eleven_multilingual_v2',
      ];
    }
  }
}

/**
 * Audio format types
 */
export type AudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

/**
 * Voice types for TTS
 */
export type VoiceType = string;

/**
 * Speech-to-Text configuration
 */
export interface STTConfig {
  model?: string;
  language?: string;
  temperature?: number;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
}

/**
 * Text-to-Speech configuration
 */
export interface TTSConfig {
  model?: string;
  voice?: VoiceType;
  speed?: number;
  format?: AudioFormat;
}

/**
 * Speech-to-Text transcription result
 */
export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

/**
 * Text-to-Speech synthesis result
 */
export interface TTSResult {
  audio: Buffer;
  format: AudioFormat;
  duration?: number;
  byteLength: number;
}

/**
 * Speech-to-Text provider interface
 */
export interface STTProvider {
  /**
   * Transcribe audio to text
   */
  transcribe(audio: Buffer | string, config?: STTConfig): Promise<STTResult>;

  /**
   * Transcribe audio stream
   */
  transcribeStream?(
    audioStream: ReadableStream | NodeJS.ReadableStream,
    config?: STTConfig,
  ): AsyncIterable<Partial<STTResult>>;

  /**
   * Check if the provider supports streaming
   */
  supportsStreaming(): boolean;
}

/**
 * Text-to-Speech provider interface
 */
export interface TTSProvider {
  /**
   * Synthesize text to speech
   */
  synthesize(text: string, config?: TTSConfig): Promise<TTSResult>;

  /**
   * Synthesize text to speech stream
   */
  synthesizeStream?(text: string, config?: TTSConfig): AsyncIterable<Buffer>;

  /**
   * Check if the provider supports streaming
   */
  supportsStreaming(): boolean;

  /**
   * Get available voices
   */
  getVoices?(): Promise<
    Array<{
      id: string;
      name: string;
      language?: string;
      gender?: 'male' | 'female' | 'neutral';
    }>
  >;
}

/**
 * Voice conversation message
 */
export interface VoiceMessage {
  role: 'user' | 'assistant';
  text: string;
  audio?: Buffer;
  timestamp: Date;
}

/**
 * Voice agent configuration
 */
export interface VoiceAgentConfig {
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  sttConfig?: STTConfig;
  ttsConfig?: TTSConfig;
  autoSpeak?: boolean;
}

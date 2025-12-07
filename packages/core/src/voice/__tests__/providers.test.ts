import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LemonFoxSTTProvider } from '../stt/lemonfox-stt';
import { LemonFoxTTSProvider } from '../tts/lemonfox-tts';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation((config) => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Transcribed text',
            language: 'en',
            duration: 5.5,
            segments: [
              { id: 0, start: 0, end: 2.5, text: 'Transcribed' },
              { id: 1, start: 2.5, end: 5.5, text: 'text' },
            ],
          }),
        },
        speech: {
          create: vi.fn().mockResolvedValue({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
            body: {
              getReader: () => ({
                read: vi
                  .fn()
                  .mockResolvedValueOnce({
                    done: false,
                    value: new Uint8Array([1, 2, 3]),
                  })
                  .mockResolvedValueOnce({ done: true, value: undefined }),
              }),
            },
          }),
        },
      },
      _config: config, // Store config for assertions
    })),
  };
});

describe('LemonFoxSTTProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      const provider = new LemonFoxSTTProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should use LEMONFOX_API_KEY env var when no key provided', () => {
      process.env.LEMONFOX_API_KEY = 'env-api-key';
      const provider = new LemonFoxSTTProvider();
      expect(provider).toBeDefined();
      delete process.env.LEMONFOX_API_KEY;
    });
  });

  describe('transcribe', () => {
    it('should transcribe audio buffer', async () => {
      const provider = new LemonFoxSTTProvider('test-api-key');
      const audioBuffer = Buffer.from('mock audio data');

      const result = await provider.transcribe(audioBuffer, {
        model: 'whisper-1',
        language: 'en',
      });

      expect(result.text).toBe('Transcribed text');
      expect(result.language).toBe('en');
      expect(result.duration).toBe(5.5);
      expect(result.segments).toHaveLength(2);
    });

    it('should handle text response format', async () => {
      const provider = new LemonFoxSTTProvider('test-api-key');
      const audioBuffer = Buffer.from('mock audio data');

      const result = await provider.transcribe(audioBuffer, {
        responseFormat: 'text',
      });

      expect(result).toBeDefined();
    });
  });

  describe('supportsStreaming', () => {
    it('should return false', () => {
      const provider = new LemonFoxSTTProvider('test-api-key');
      expect(provider.supportsStreaming()).toBe(false);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return list of supported languages', () => {
      const provider = new LemonFoxSTTProvider('test-api-key');
      const languages = provider.getSupportedLanguages();

      expect(languages).toBeInstanceOf(Array);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('en');
      expect(languages).toContain('es');
      expect(languages).toContain('fr');
    });
  });
});

describe('LemonFoxTTSProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create provider with API key', () => {
      const provider = new LemonFoxTTSProvider('test-api-key');
      expect(provider).toBeDefined();
    });

    it('should use LEMONFOX_API_KEY env var when no key provided', () => {
      process.env.LEMONFOX_API_KEY = 'env-api-key';
      const provider = new LemonFoxTTSProvider();
      expect(provider).toBeDefined();
      delete process.env.LEMONFOX_API_KEY;
    });
  });

  describe('synthesize', () => {
    it('should synthesize text to audio', async () => {
      const provider = new LemonFoxTTSProvider('test-api-key');

      const result = await provider.synthesize('Hello, world!', {
        voice: 'sarah',
        model: 'tts-1',
        format: 'mp3',
      });

      expect(result.audio).toBeInstanceOf(Buffer);
      expect(result.format).toBe('mp3');
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it('should use default values when no config provided', async () => {
      const provider = new LemonFoxTTSProvider('test-api-key');

      const result = await provider.synthesize('Hello!');

      expect(result.audio).toBeInstanceOf(Buffer);
      expect(result.format).toBe('mp3');
    });
  });

  describe('synthesizeStream', () => {
    it('should stream audio chunks', async () => {
      const provider = new LemonFoxTTSProvider('test-api-key');
      const chunks: Buffer[] = [];

      for await (const chunk of provider.synthesizeStream('Hello!')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toBeInstanceOf(Buffer);
    });
  });

  describe('supportsStreaming', () => {
    it('should return true', () => {
      const provider = new LemonFoxTTSProvider('test-api-key');
      expect(provider.supportsStreaming()).toBe(true);
    });
  });

  describe('getVoices', () => {
    it('should return list of available voices', async () => {
      const provider = new LemonFoxTTSProvider('test-api-key');
      const voices = await provider.getVoices();

      expect(voices).toBeInstanceOf(Array);
      expect(voices.length).toBeGreaterThan(0);

      // Check for known voices
      const voiceIds = voices.map((v) => v.id);
      expect(voiceIds).toContain('alloy');
      expect(voiceIds).toContain('sarah');

      // Check voice structure
      const voice = voices[0];
      expect(voice).toHaveProperty('id');
      expect(voice).toHaveProperty('name');
    });
  });

  describe('getModels', () => {
    it('should return list of available models', () => {
      const provider = new LemonFoxTTSProvider('test-api-key');
      const models = provider.getModels();

      expect(models).toBeInstanceOf(Array);
      expect(models).toContain('tts-1');
    });
  });

  describe('getFormats', () => {
    it('should return list of supported formats', () => {
      const provider = new LemonFoxTTSProvider('test-api-key');
      const formats = provider.getFormats();

      expect(formats).toBeInstanceOf(Array);
      expect(formats).toContain('mp3');
      expect(formats).toContain('wav');
      expect(formats).toContain('opus');
    });
  });
});

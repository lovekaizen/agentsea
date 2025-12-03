import { exec } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { TTSProvider, TTSConfig, TTSResult } from '../../types/voice';

const execAsync = promisify(exec);

/**
 * Piper TTS configuration
 */
export interface PiperTTSConfig {
  piperPath?: string; // Path to piper executable
  modelPath?: string; // Path to model file
  configPath?: string; // Path to model config
}

/**
 * Piper Text-to-Speech provider
 *
 * Uses local Piper TTS (fast, neural TTS)
 * Requires Piper to be installed locally
 *
 * Installation:
 * https://github.com/rhasspy/piper
 */
export class PiperTTSProvider implements TTSProvider {
  private piperPath: string;
  private modelPath?: string;
  private configPath?: string;

  constructor(config?: PiperTTSConfig) {
    this.piperPath = config?.piperPath || 'piper';
    this.modelPath = config?.modelPath;
    this.configPath = config?.configPath;
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, config?: TTSConfig): Promise<TTSResult> {
    try {
      // Create temporary output file
      const outputPath = join(tmpdir(), `speech-${Date.now()}.wav`);

      // Build piper command
      const model = this.modelPath || config?.model;
      if (!model) {
        throw new Error('Model path is required for Piper TTS');
      }

      const modelConfig = this.configPath || model.replace('.onnx', '.json');

      // Write text to temp file (piper reads from stdin or file)
      const textPath = join(tmpdir(), `text-${Date.now()}.txt`);
      writeFileSync(textPath, text, 'utf-8');

      const command = `${this.piperPath} --model ${model} --config ${modelConfig} --output_file ${outputPath} < ${textPath}`;

      // Execute piper
      await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      // Read output file
      if (!existsSync(outputPath)) {
        throw new Error('Piper failed to generate audio file');
      }

      const audio = readFileSync(outputPath);

      // Clean up
      unlinkSync(outputPath);
      unlinkSync(textPath);

      return {
        audio,
        format: 'wav',
        byteLength: audio.length,
      };
    } catch (error) {
      throw new Error(
        `Piper TTS synthesis failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming(): boolean {
    return false; // Piper doesn't support streaming
  }

  /**
   * Check if Piper is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execAsync(`${this.piperPath} --version`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installation instructions
   */
  getInstallInstructions(): string {
    return `
Piper TTS is not installed. Please install:

1. Download Piper from:
   https://github.com/rhasspy/piper/releases

2. Download a voice model from:
   https://github.com/rhasspy/piper/blob/master/VOICES.md

3. Configure the provider with paths to piper executable and model file.

Example:
  const provider = new PiperTTSProvider({
    piperPath: '/path/to/piper',
    modelPath: '/path/to/model.onnx',
  });
    `.trim();
  }

  /**
   * Get available voices (if model directory is provided)
   */
  getVoices(): Promise<
    Array<{
      id: string;
      name: string;
      language?: string;
      gender?: 'male' | 'female' | 'neutral';
    }>
  > {
    // Return common Piper voices
    return Promise.resolve([
      {
        id: 'en_US-lessac-medium',
        name: 'Lessac (US English)',
        language: 'en-US',
        gender: 'male',
      },
      {
        id: 'en_US-amy-medium',
        name: 'Amy (US English)',
        language: 'en-US',
        gender: 'female',
      },
      {
        id: 'en_GB-alan-medium',
        name: 'Alan (British English)',
        language: 'en-GB',
        gender: 'male',
      },
      {
        id: 'de_DE-thorsten-medium',
        name: 'Thorsten (German)',
        language: 'de-DE',
        gender: 'male',
      },
      {
        id: 'es_ES-mls-medium',
        name: 'MLS (Spanish)',
        language: 'es-ES',
        gender: 'neutral',
      },
      {
        id: 'fr_FR-siwis-medium',
        name: 'Siwis (French)',
        language: 'fr-FR',
        gender: 'female',
      },
    ]);
  }
}

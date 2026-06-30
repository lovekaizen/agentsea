import { execFile, spawn } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { TTSProvider, TTSConfig, TTSResult } from '../../types/voice';

// execFile (no shell) so config/paths can't be interpreted as shell syntax.
const execFileAsync = promisify(execFile);

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
    // Create temporary output file
    const outputPath = join(tmpdir(), `speech-${Date.now()}.wav`);

    try {
      // Build piper argv (no shell interpolation)
      const model = this.modelPath || config?.model;
      if (!model) {
        throw new Error('Model path is required for Piper TTS');
      }

      const modelConfig = this.configPath || model.replace('.onnx', '.json');
      const args = [
        '--model',
        model,
        '--config',
        modelConfig,
        '--output_file',
        outputPath,
      ];

      // Execute piper, feeding the text on stdin (piper reads from stdin).
      await new Promise<void>((resolve, reject) => {
        const child = spawn(this.piperPath, args, {
          stdio: ['pipe', 'ignore', 'pipe'],
        });
        let stderr = '';
        child.stderr?.on('data', (chunk) => {
          stderr += String(chunk);
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`piper exited with code ${code}: ${stderr}`));
        });
        child.stdin?.end(text);
      });

      // Read output file
      if (!existsSync(outputPath)) {
        throw new Error('Piper failed to generate audio file');
      }

      const audio = readFileSync(outputPath);

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
    } finally {
      // Always clean up the temp output file, even on failure.
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
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
      await execFileAsync(this.piperPath, ['--version']);
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

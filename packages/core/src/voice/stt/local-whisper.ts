import { execFile } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

import { STTProvider, STTConfig, STTResult } from '../../types/voice';

// execFile (no shell) so config/paths can't be interpreted as shell syntax.
const execFileAsync = promisify(execFile);

/**
 * Local Whisper configuration
 */
export interface LocalWhisperConfig {
  whisperPath?: string; // Path to whisper executable or whisper.cpp
  modelPath?: string; // Path to model file
}

/**
 * Local Whisper Speech-to-Text provider
 *
 * Uses local Whisper installation (whisper.cpp or Python whisper)
 * Requires whisper to be installed locally
 *
 * Installation:
 * - whisper.cpp: https://github.com/ggerganov/whisper.cpp
 * - Python whisper: pip install openai-whisper
 */
export class LocalWhisperProvider implements STTProvider {
  private whisperPath: string;
  private modelPath?: string;

  constructor(config?: LocalWhisperConfig) {
    this.whisperPath = config?.whisperPath || 'whisper';
    this.modelPath = config?.modelPath;
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(
    audio: Buffer | string,
    config?: STTConfig,
  ): Promise<STTResult> {
    let audioPath = '';
    let isTemporary = false;

    try {
      // Handle buffer vs file path
      if (Buffer.isBuffer(audio)) {
        // Write buffer to temporary file
        audioPath = join(tmpdir(), `audio-${Date.now()}.wav`);
        writeFileSync(audioPath, audio);
        isTemporary = true;
      } else {
        audioPath = audio;
      }

      // Check if file exists
      if (!existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
      }

      // Build whisper argv (no shell interpolation)
      const model = config?.model || 'base';
      const languageArgs = config?.language
        ? ['--language', config.language]
        : [];
      const outputFormat = config?.responseFormat || 'txt';

      let args: string[];

      // Try whisper.cpp first (if available)
      if (this.whisperPath.includes('whisper.cpp')) {
        const modelFile = this.modelPath || `ggml-${model}.bin`;
        args = ['-m', modelFile, ...languageArgs, '-otxt', audioPath];
      } else {
        // Use Python whisper
        args = [
          audioPath,
          '--model',
          model,
          ...languageArgs,
          '--output_format',
          outputFormat,
        ];
      }

      // Execute whisper
      const { stdout } = await execFileAsync(this.whisperPath, args, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Parse output
      let text: string;

      if (outputFormat === 'txt') {
        // Read output file or parse stdout
        const outputFile = audioPath.replace(/\.[^.]+$/, '.txt');
        if (existsSync(outputFile)) {
          const { readFileSync } = await import('fs');
          text = readFileSync(outputFile, 'utf-8').trim();
          unlinkSync(outputFile); // Clean up
        } else {
          text = stdout.trim();
        }
      } else {
        text = stdout.trim();
      }

      return {
        text,
        language: config?.language,
      };
    } catch (error) {
      throw new Error(
        `Local Whisper transcription failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      // Clean up temporary file
      if (isTemporary && existsSync(audioPath)) {
        unlinkSync(audioPath);
      }
    }
  }

  /**
   * Check if streaming is supported
   */
  supportsStreaming(): boolean {
    return false; // Local whisper doesn't support streaming
  }

  /**
   * Check if Whisper is installed
   */
  async isInstalled(): Promise<boolean> {
    try {
      await execFileAsync(this.whisperPath, ['--help']);
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
Local Whisper is not installed. Please install one of:

1. whisper.cpp (recommended for performance):
   git clone https://github.com/ggerganov/whisper.cpp
   cd whisper.cpp
   make
   ./models/download-ggml-model.sh base

2. Python OpenAI Whisper:
   pip install openai-whisper

Then configure the provider with the correct path.
    `.trim();
  }
}

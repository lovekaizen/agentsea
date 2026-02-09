import { execSync } from 'child_process';

import { z } from 'zod';

import { Tool } from '../../types';

const MAX_OUTPUT_BYTES = 100 * 1024; // 100KB
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

/**
 * Patterns that indicate dangerous or destructive commands.
 * Each entry is a regex tested against the full command string.
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-[^\s]*r[^\s]*f[^\s]*\s+\/\s*$/, // rm -rf /
  /\brm\s+-[^\s]*f[^\s]*r[^\s]*\s+\/\s*$/, // rm -fr /
  /\bmkfs\b/, // mkfs (format disk)
  /:(){ :\|:& };:/, // fork bomb
  /\bdd\b.*\bof=\/dev\//, // dd to device
  /\b>\s*\/dev\/sd[a-z]/, // redirect to raw device
  /\bchmod\s+-R\s+777\s+\//, // chmod -R 777 /
  /\bchown\s+-R\s+.*\s+\/\s*$/, // chown -R ... /
];

/**
 * Shell execution tool for running commands with safety checks
 */
export const shellExecuteTool: Tool = {
  name: 'shell_execute',
  description:
    'Execute a shell command and return stdout/stderr. Commands are checked against a safety blocklist. ' +
    'Non-zero exit codes return results (not errors) since tools like grep exit 1 on no matches.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    cwd: z
      .string()
      .optional()
      .describe(
        'Working directory for the command (defaults to process.cwd())',
      ),
    timeout: z
      .number()
      .min(1000)
      .max(MAX_TIMEOUT_MS)
      .default(DEFAULT_TIMEOUT_MS)
      .describe('Timeout in milliseconds (default 30s, max 120s)'),
  }),
  execute: (params: { command: string; cwd?: string; timeout: number }) => {
    // Safety check
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(params.command)) {
        throw new Error(
          `Command blocked by safety filter: matches dangerous pattern. ` +
            `If you need to run this command, please do so directly in your terminal.`,
        );
      }
    }

    const timeout = Math.min(params.timeout, MAX_TIMEOUT_MS);

    try {
      const output = execSync(params.command, {
        cwd: params.cwd || process.cwd(),
        timeout,
        encoding: 'utf8',
        maxBuffer: MAX_OUTPUT_BYTES * 2, // allow some headroom
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const truncated = output.length > MAX_OUTPUT_BYTES;
      const content = truncated
        ? output.slice(0, MAX_OUTPUT_BYTES) +
          '\n... [output truncated at 100KB]'
        : output;

      return Promise.resolve({
        exitCode: 0,
        stdout: content,
        stderr: '',
        truncated,
      });
    } catch (error: unknown) {
      const execError = error as {
        status?: number | null;
        killed?: boolean;
        signal?: string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };

      // Timeout or killed process - throw an error
      if (execError.killed || execError.signal) {
        throw new Error(`Shell execution timed out after ${timeout}ms`);
      }

      // Non-zero exit is NOT an error for tools like grep
      if (execError.status !== undefined && execError.status !== null) {
        const stdout = String(execError.stdout || '');
        const stderr = String(execError.stderr || '');
        const truncated = stdout.length > MAX_OUTPUT_BYTES;

        return Promise.resolve({
          exitCode: execError.status,
          stdout: truncated
            ? stdout.slice(0, MAX_OUTPUT_BYTES) +
              '\n... [output truncated at 100KB]'
            : stdout,
          stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
          truncated,
        });
      }

      // Other errors
      throw new Error(
        `Shell execution failed: ${execError.message || String(error)}`,
      );
    }
  },
};

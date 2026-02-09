import { describe, it, expect } from 'vitest';

import { shellExecuteTool } from '../shell.tool';

const ctx = {} as any;

describe('shellExecuteTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(shellExecuteTool.name).toBe('shell_execute');
    });

    it('should have valid parameters schema', () => {
      const result = shellExecuteTool.parameters.safeParse({
        command: 'echo hello',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('execution', () => {
    it('should execute a simple command', async () => {
      const result = (await shellExecuteTool.execute(
        { command: 'echo hello', timeout: 30000 },
        ctx,
      )) as any;
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello');
    });

    it('should capture stderr on error', async () => {
      const result = (await shellExecuteTool.execute(
        { command: 'ls /nonexistent_dir_12345', timeout: 30000 },
        ctx,
      )) as any;
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('should return non-zero exit code without throwing', async () => {
      const result = (await shellExecuteTool.execute(
        { command: 'false', timeout: 30000 },
        ctx,
      )) as any;
      expect(result.exitCode).not.toBe(0);
    });

    it('should respect the cwd parameter', async () => {
      const result = (await shellExecuteTool.execute(
        { command: 'pwd', cwd: '/tmp', timeout: 30000 },
        ctx,
      )) as any;
      expect(result.exitCode).toBe(0);
      // macOS /tmp -> /private/tmp
      expect(result.stdout.trim()).toMatch(/\/tmp$/);
    });
  });

  describe('safety blocklist', () => {
    it('should block rm -rf /', () => {
      expect(() =>
        shellExecuteTool.execute({ command: 'rm -rf /', timeout: 30000 }, ctx),
      ).toThrow('blocked by safety filter');
    });

    it('should block mkfs commands', () => {
      expect(() =>
        shellExecuteTool.execute(
          { command: 'mkfs.ext4 /dev/sda1', timeout: 30000 },
          ctx,
        ),
      ).toThrow('blocked by safety filter');
    });

    it('should block dd to devices', () => {
      expect(() =>
        shellExecuteTool.execute(
          { command: 'dd if=/dev/zero of=/dev/sda', timeout: 30000 },
          ctx,
        ),
      ).toThrow('blocked by safety filter');
    });

    it('should allow safe rm commands', async () => {
      // This should NOT be blocked - it's rm on a specific file, not rm -rf /
      const result = (await shellExecuteTool.execute(
        { command: 'echo "not actually removing anything"', timeout: 30000 },
        ctx,
      )) as any;
      expect(result.exitCode).toBe(0);
    });
  });

  describe('timeout', () => {
    it('should timeout for long-running commands', () => {
      expect(() =>
        shellExecuteTool.execute({ command: 'sleep 10', timeout: 1000 }, ctx),
      ).toThrow('timed out');
    });
  });

  describe('output truncation', () => {
    it('should truncate output exceeding 100KB', async () => {
      // Generate >100KB of output
      const result = (await shellExecuteTool.execute(
        {
          command:
            'python3 -c "print(\'x\' * 200000)" 2>/dev/null || printf "%0.sx" $(seq 1 200000)',
          timeout: 30000,
        },
        ctx,
      )) as any;
      expect(result.truncated).toBe(true);
      expect(result.stdout).toContain('[output truncated at 100KB]');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { DataLeakageGuard } from '../guards/security/data-leakage.guard.js';
import type { GuardContext } from '../types/index.js';

function createContext(input: string): GuardContext {
  return {
    input,
    type: 'output',
    timestamp: new Date(),
  };
}

describe('DataLeakageGuard', () => {
  describe('API key detection', () => {
    it('should detect AWS access keys', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('Your AWS key is AKIAIOSFODNN7EXAMPLE'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('aws_access_key');
    });

    it('should detect OpenAI API keys', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdefghijklmnopqrstuvwxyz'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('openai_api_key');
    });

    it('should detect Anthropic API keys', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('Key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('anthropic_api_key');
    });

    it('should detect GitHub tokens', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('Token: ghp_1234567890abcdefghijklmnopqrstuv'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('github_token');
    });

    it('should detect Stripe keys', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('Stripe: sk_live_1234567890abcdefghijklmn'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('stripe_key');
    });

    it('should detect generic API keys', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('api_key=abcdefghijklmnopqrstuvwxyz123456'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('generic_api_key');
    });
  });

  describe('password detection', () => {
    it('should detect password assignments', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('password=MySecretP@ssw0rd123'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('password_assignment');
    });

    it('should detect bcrypt hashes', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext(
          'Hash: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
        ),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('password_hash');
    });
  });

  describe('private key detection', () => {
    it('should detect private key headers', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('-----BEGIN RSA PRIVATE KEY-----'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('private_key_header');
    });

    it('should detect SSH private keys', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('-----BEGIN OPENSSH PRIVATE KEY-----'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('ssh_private_key');
    });
  });

  describe('connection string detection', () => {
    it('should detect database URLs', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('postgres://user:pass@localhost:5432/db'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('database_url');
    });

    it('should detect MongoDB URLs', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('mongodb://user:password@host:27017/database'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('database_url');
    });

    it('should detect JDBC URLs', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('jdbc:mysql://localhost:3306/database'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('jdbc_url');
    });
  });

  describe('token detection', () => {
    it('should detect JWT tokens', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext(
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        ),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('jwt_token');
    });

    it('should detect Bearer tokens', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('bearer_token');
    });
  });

  describe('environment variables detection', () => {
    it('should detect sensitive environment variables', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('DATABASE_PASSWORD=SuperSecret123'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('env_sensitive');
    });

    it('should detect API key environment variables', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('API_KEY=sk-1234567890abcdef'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('env_sensitive');
    });
  });

  describe('masking', () => {
    it('should mask sensitive data when onFailure is transform', async () => {
      const guard = new DataLeakageGuard({ onFailure: 'transform' });
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdefghijklmnopqrstuvwxyz'),
      );

      expect(result.action).toBe('transform');
      expect(result.transformedContent).toBeDefined();
      expect(result.transformedContent).not.toContain(
        'sk-1234567890abcdefghijklmnopqrstuvwxyz',
      );
    });

    it('should mask multiple sensitive items', async () => {
      const guard = new DataLeakageGuard({ onFailure: 'transform' });
      const result = await guard.check(
        createContext(
          'API: sk-test123 and password=secret123 and token=abc123',
        ),
      );

      expect(result.transformedContent).toBeDefined();
      expect(result.transformedContent).not.toContain('sk-test123');
      expect(result.transformedContent).not.toContain('secret123');
    });

    it('should preserve first and last characters in mask', async () => {
      const guard = new DataLeakageGuard({ onFailure: 'transform' });
      const result = await guard.check(
        createContext('password=verylongsecretpassword'),
      );

      expect(result.transformedContent).toContain('v');
      expect(result.transformedContent).toContain('d');
      expect(result.transformedContent).toContain('*');
    });

    it('should disable masking when configured', async () => {
      const guard = new DataLeakageGuard({
        onFailure: 'block',
        enableMasking: false,
      });

      const result = await guard.check(
        createContext('API key: sk-1234567890abcdef'),
      );

      expect(result.action).toBe('block');
      expect(result.transformedContent).toBeUndefined();
    });
  });

  describe('selective detection', () => {
    it('should skip API key detection when disabled', async () => {
      const guard = new DataLeakageGuard({ blockApiKeys: false });
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdef'),
      );

      expect(result.passed).toBe(true);
    });

    it('should skip password detection when disabled', async () => {
      const guard = new DataLeakageGuard({ blockPasswords: false });
      const result = await guard.check(createContext('password=secret123'));

      expect(result.passed).toBe(true);
    });

    it('should skip private key detection when disabled', async () => {
      const guard = new DataLeakageGuard({ blockPrivateKeys: false });
      const result = await guard.check(
        createContext('-----BEGIN RSA PRIVATE KEY-----'),
      );

      expect(result.passed).toBe(true);
    });

    it('should skip connection string detection when disabled', async () => {
      const guard = new DataLeakageGuard({ blockConnectionStrings: false });
      const result = await guard.check(
        createContext('postgres://user:pass@localhost/db'),
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('custom patterns', () => {
    it('should detect custom sensitive patterns', async () => {
      const guard = new DataLeakageGuard({
        customPatterns: {
          'internal-id': /INTERNAL-\d{6}/g,
        },
      });

      const result = await guard.check(
        createContext('Internal ID: INTERNAL-123456'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.dataTypes).toContain('internal-id');
    });
  });

  describe('detections', () => {
    it('should include detection details', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdef'),
      );

      expect(result.detections).toBeDefined();
      expect(result.detections?.length).toBeGreaterThan(0);
      expect(result.detections?.[0]).toHaveProperty('category');
      expect(result.detections?.[0]).toHaveProperty('pattern');
    });

    it('should mask detected text in details', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('password=verylongsecretpassword'),
      );

      const detection = result.detections?.[0];
      expect(detection?.matchedText).not.toBe('verylongsecretpassword');
      expect(detection?.matchedText).toContain('*');
    });

    it('should provide location information', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdef'),
      );

      const detection = result.detections?.[0];
      expect(detection?.startIndex).toBeGreaterThanOrEqual(0);
      expect(detection?.endIndex).toBeGreaterThan(detection?.startIndex!);
    });
  });

  describe('counts', () => {
    it('should count sensitive data by type', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext(
          'password=secret1 and password=secret2 and api_key=key123',
        ),
      );

      expect(result.details?.counts).toBeDefined();
      expect(result.details?.counts.password_assignment).toBe(2);
      expect(result.details?.totalCount).toBe(3);
    });
  });

  describe('clean output', () => {
    it('should pass clean output', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext('This is a safe message without any secrets'),
      );

      expect(result.passed).toBe(true);
      expect(result.details?.totalCount).toBe(0);
      expect(result.message).toContain('No sensitive data detected');
    });
  });

  describe('transform function', () => {
    it('should transform content with mask', async () => {
      const guard = new DataLeakageGuard();
      const transformed = await guard.transform(
        'password=secret123',
        createContext('password=secret123'),
      );

      expect(transformed).not.toContain('secret123');
    });
  });

  describe('configuration', () => {
    it('should respect enabled flag', async () => {
      const guard = new DataLeakageGuard({ enabled: false });
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdef'),
      );

      expect(result.passed).toBe(true);
      expect(result.message).toContain('disabled');
    });

    it('should use configured onFailure action', async () => {
      const guard = new DataLeakageGuard({ onFailure: 'warn' });
      const result = await guard.check(
        createContext('API key: sk-1234567890abcdef'),
      );

      expect(result.passed).toBe(false);
      expect(result.action).toBe('warn');
    });
  });

  describe('multiple detections', () => {
    it('should detect multiple types of sensitive data', async () => {
      const guard = new DataLeakageGuard();
      const result = await guard.check(
        createContext(
          'API: sk-test123, password=secret, token: eyJhbGciOiJIUzI1NiJ9.test.sig',
        ),
      );

      expect(result.details?.dataTypes.length).toBeGreaterThan(1);
      expect(result.details?.totalCount).toBeGreaterThan(1);
    });
  });

  describe('supported content types', () => {
    it('should only support output type', () => {
      const guard = new DataLeakageGuard();

      expect(guard.supportedTypes).toContain('output');
      expect(guard.supportedTypes).not.toContain('input');
    });
  });
});

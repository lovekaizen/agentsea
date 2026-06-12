import { describe, it, expect } from 'vitest';
import {
  hashRequest,
  generateId,
  generateRequestId,
  generateCacheKey,
  hash,
  createSystemFingerprint,
} from '../utils/hashing.js';

describe('hashing utilities', () => {
  describe('hashRequest', () => {
    it('should generate consistent hashes for same requests', () => {
      const request = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      };

      const hash1 = hashRequest(request);
      const hash2 = hashRequest(request);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different messages', () => {
      const request1 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const request2 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Goodbye' }],
      };

      const hash1 = hashRequest(request1);
      const hash2 = hashRequest(request2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different models', () => {
      const request1 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const request2 = {
        model: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const hash1 = hashRequest(request1);
      const hash2 = hashRequest(request2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different temperatures', () => {
      const request1 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.5,
      };

      const request2 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      };

      const hash1 = hashRequest(request1);
      const hash2 = hashRequest(request2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle tools in the hash', () => {
      const request1 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{ type: 'function', function: { name: 'test' } }],
      };

      const request2 = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const hash1 = hashRequest(request1);
      const hash2 = hashRequest(request2);

      expect(hash1).not.toBe(hash2);
    });

    it('should return a hex string', () => {
      const request = {
        model: 'gpt-5.5',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = hashRequest(request);

      expect(result).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    it('should use default prefix', () => {
      const id = generateId();

      expect(id).toMatch(/^gw-/);
    });

    it('should use custom prefix', () => {
      const id = generateId('custom');

      expect(id).toMatch(/^custom-/);
    });
  });

  describe('generateRequestId', () => {
    it('should generate IDs in OpenAI format', () => {
      const id = generateRequestId();

      expect(id).toMatch(/^chatcmpl-/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate cache key with correct format', () => {
      const key = generateCacheKey('openai', 'gpt-5.5', 'abc123');

      expect(key).toBe('gw:cache:openai:gpt-5.5:abc123');
    });
  });

  describe('hash', () => {
    it('should generate consistent hashes', () => {
      const hash1 = hash('test string');
      const hash2 = hash('test string');

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = hash('test string 1');
      const hash2 = hash('test string 2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return hex string', () => {
      const result = hash('test');

      expect(result).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('createSystemFingerprint', () => {
    it('should create consistent fingerprints', () => {
      const config = {
        version: '1.0.0',
        providers: ['openai', 'anthropic'],
      };

      const fp1 = createSystemFingerprint(config);
      const fp2 = createSystemFingerprint(config);

      expect(fp1).toBe(fp2);
    });

    it('should create different fingerprints for different configs', () => {
      const config1 = {
        version: '1.0.0',
        providers: ['openai'],
      };

      const config2 = {
        version: '1.0.0',
        providers: ['openai', 'anthropic'],
      };

      const fp1 = createSystemFingerprint(config1);
      const fp2 = createSystemFingerprint(config2);

      expect(fp1).not.toBe(fp2);
    });

    it('should have fp_ prefix', () => {
      const config = {
        version: '1.0.0',
        providers: ['openai'],
      };

      const fp = createSystemFingerprint(config);

      expect(fp).toMatch(/^fp_/);
    });
  });
});

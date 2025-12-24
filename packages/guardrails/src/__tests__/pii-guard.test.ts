import { describe, it, expect } from 'vitest';
import { PIIGuard } from '../guards/content/pii.guard.js';
import type { GuardContext } from '../types/index.js';

function createContext(input: string): GuardContext {
  return {
    input,
    type: 'input',
    timestamp: new Date(),
  };
}

describe('PIIGuard', () => {
  describe('email detection', () => {
    it('should detect email addresses', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('Contact me at john@example.com'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('email');
      expect(result.details?.totalCount).toBeGreaterThan(0);
    });

    it('should detect multiple emails', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('Email john@test.com or jane@test.org'),
      );

      expect(result.details?.counts.email).toBe(2);
      expect(result.details?.totalCount).toBe(2);
    });
  });

  describe('phone number detection', () => {
    it('should detect phone numbers', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('Call me at 555-123-4567'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('phone');
    });

    it('should detect phone numbers in various formats', async () => {
      const guard = new PIIGuard();

      const formats = [
        '555-123-4567',
        '(555) 123-4567',
        '555.123.4567',
        '5551234567',
      ];

      for (const format of formats) {
        const result = await guard.check(createContext(`Call ${format}`));
        expect(result.passed).toBe(false);
        expect(result.details?.types).toContain('phone');
      }
    });
  });

  describe('SSN detection', () => {
    it('should detect social security numbers', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(createContext('SSN: 123-45-6789'));

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('ssn');
    });

    it('should detect SSN without dashes', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(createContext('SSN: 123456789'));

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('ssn');
    });
  });

  describe('credit card detection', () => {
    it('should detect credit card numbers', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(createContext('Card: 4532015112830366'));

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('credit-card');
    });
  });

  describe('IP address detection', () => {
    it('should detect IP addresses', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('Server IP: 192.168.1.100'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('ip-address');
    });
  });

  describe('masking', () => {
    it('should mask PII when onFailure is transform', async () => {
      const guard = new PIIGuard({ onFailure: 'transform' });
      const result = await guard.check(
        createContext('Contact me at john@example.com'),
      );

      expect(result.action).toBe('transform');
      expect(result.transformedContent).toBeDefined();
      expect(result.transformedContent).not.toContain('john@example.com');
    });

    it('should mask multiple PII instances', async () => {
      const guard = new PIIGuard({ onFailure: 'transform' });
      const result = await guard.check(
        createContext('Email: test@test.com, Phone: 555-123-4567'),
      );

      expect(result.transformedContent).toBeDefined();
      expect(result.transformedContent).not.toContain('test@test.com');
      expect(result.transformedContent).not.toContain('555-123-4567');
    });

    it('should use custom mask format', async () => {
      const guard = new PIIGuard({
        onFailure: 'transform',
        maskFormat: '[REDACTED]',
      });
      const result = await guard.check(
        createContext('Email: test@example.com'),
      );

      expect(result.transformedContent).toContain('[EMAIL_REDACTED]');
    });
  });

  describe('selective PII detection', () => {
    it('should only detect specified PII types', async () => {
      const guard = new PIIGuard({
        types: ['email'],
      });

      const result = await guard.check(
        createContext('Email: test@test.com, Phone: 555-1234'),
      );

      expect(result.details?.types).toContain('email');
      expect(result.details?.types).not.toContain('phone');
    });
  });

  describe('custom patterns', () => {
    it('should detect custom PII patterns', async () => {
      const guard = new PIIGuard({
        customPatterns: {
          'employee-id': /EMP-\d{6}/g,
        },
      });

      const result = await guard.check(
        createContext('Employee ID: EMP-123456'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.types).toContain('employee-id');
    });
  });

  describe('transform function', () => {
    it('should transform content with mask', async () => {
      const guard = new PIIGuard();
      const transformed = await guard.transform(
        'Contact: john@example.com',
        createContext('Contact: john@example.com'),
      );

      expect(transformed).not.toContain('john@example.com');
    });
  });

  describe('detections', () => {
    it('should include detection details', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('Email: test@example.com'),
      );

      expect(result.detections).toBeDefined();
      expect(result.detections?.length).toBeGreaterThan(0);
      expect(result.detections?.[0]).toHaveProperty('category');
      expect(result.detections?.[0]).toHaveProperty('startIndex');
      expect(result.detections?.[0]).toHaveProperty('endIndex');
    });

    it('should mask detected text in details', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('Email: test@example.com'),
      );

      const detection = result.detections?.[0];
      expect(detection?.matchedText).not.toBe('test@example.com');
    });
  });

  describe('no PII', () => {
    it('should pass when no PII is found', async () => {
      const guard = new PIIGuard();
      const result = await guard.check(
        createContext('This is a clean message without any PII'),
      );

      expect(result.passed).toBe(true);
      expect(result.details?.totalCount).toBe(0);
      expect(result.message).toContain('No PII detected');
    });
  });

  describe('configuration', () => {
    it('should respect enabled flag', async () => {
      const guard = new PIIGuard({ enabled: false });
      const result = await guard.check(
        createContext('Email: test@example.com'),
      );

      expect(result.passed).toBe(true);
      expect(result.message).toContain('disabled');
    });

    it('should disable masking when configured', async () => {
      const guard = new PIIGuard({
        onFailure: 'block',
        enableMasking: false,
      });

      const result = await guard.check(
        createContext('Email: test@example.com'),
      );

      expect(result.action).toBe('block');
      expect(result.transformedContent).toBeUndefined();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { BiasGuard } from '../guards/content/bias.guard.js';
import type { GuardContext } from '../types/index.js';

function createContext(input: string): GuardContext {
  return {
    input,
    type: 'input',
    timestamp: new Date(),
  };
}

describe('BiasGuard', () => {
  describe('gender bias detection', () => {
    it('should detect gender stereotypes', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('gender');
    });

    it('should detect gendered profession assumptions', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('The female doctor surprised everyone'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('gender');
    });

    it('should detect limiting language about gender', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext("Girls can't be good at math"),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('gender');
    });
  });

  describe('age bias detection', () => {
    it('should detect age stereotypes', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('Old people always struggle with technology'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('age');
    });

    it('should detect generational stereotypes', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('Millennials are always entitled'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('age');
    });

    it('should detect dismissive age language', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('ok boomer, you are too old for this'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('age');
    });
  });

  describe('disability bias detection', () => {
    it('should detect ableist language', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext("Disabled people can't work effectively"),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('disability');
    });

    it('should detect offensive disability terms', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('That idea is completely retarded'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('disability');
    });

    it('should detect problematic wheelchair language', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('She is confined to a wheelchair'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('disability');
    });
  });

  describe('political bias detection', () => {
    it('should detect political stereotypes', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All liberals are snowflakes'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('political');
    });

    it('should detect partisan generalizations', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('Every conservative wants the same thing'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('political');
    });
  });

  describe('religious bias detection', () => {
    it('should detect religious stereotypes', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All Muslims are extremists'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('religion');
    });

    it('should detect religious generalizations', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('Every Christian believes the same way'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('religion');
    });
  });

  describe('confidence scoring', () => {
    it('should include confidence scores', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate scores per category', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.details?.scores).toBeDefined();
      expect(result.details?.scores.gender).toBeDefined();
    });
  });

  describe('selective category detection', () => {
    it('should only check specified categories', async () => {
      const guard = new BiasGuard({
        categories: ['gender'],
      });

      const result = await guard.check(
        createContext('Old people always struggle with technology'),
      );

      // Should pass because age category is not being checked
      expect(result.passed).toBe(true);
    });

    it('should detect when specified category matches', async () => {
      const guard = new BiasGuard({
        categories: ['gender'],
      });

      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('gender');
    });
  });

  describe('custom patterns', () => {
    it('should detect custom bias patterns', async () => {
      const guard = new BiasGuard({
        customPatterns: {
          profession: [/all\s+(doctors|lawyers|engineers)\s+are/gi],
        },
      });

      const result = await guard.check(createContext('All doctors are rich'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('profession');
    });
  });

  describe('pattern matching', () => {
    it('should capture matched patterns', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.details?.patterns).toBeDefined();
      expect(result.details?.patterns.length).toBeGreaterThan(0);
    });

    it('should include multiple matches', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are emotional and all men are strong'),
      );

      expect(result.details?.patterns.length).toBeGreaterThan(1);
    });
  });

  describe('detections', () => {
    it('should include detection details', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.detections).toBeDefined();
      expect(result.detections?.length).toBeGreaterThan(0);
      expect(result.detections?.[0]).toHaveProperty('category');
      expect(result.detections?.[0]).toHaveProperty('matchedText');
    });

    it('should provide location information', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      const detection = result.detections?.[0];
      expect(detection?.startIndex).toBeGreaterThanOrEqual(0);
      expect(detection?.endIndex).toBeGreaterThan(detection?.startIndex!);
    });
  });

  describe('clean content', () => {
    it('should pass unbiased content', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('People have diverse perspectives and experiences'),
      );

      expect(result.passed).toBe(true);
      expect(result.details?.categories).toHaveLength(0);
      expect(result.message).toContain('No biased language detected');
    });
  });

  describe('multiple categories', () => {
    it('should detect multiple bias categories', async () => {
      const guard = new BiasGuard();
      const result = await guard.check(
        createContext('All women are emotional and old people are slow'),
      );

      expect(result.details?.categories.length).toBeGreaterThan(1);
      expect(result.details?.categories).toContain('gender');
      expect(result.details?.categories).toContain('age');
    });
  });

  describe('configuration', () => {
    it('should respect enabled flag', async () => {
      const guard = new BiasGuard({ enabled: false });
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.passed).toBe(true);
      expect(result.message).toContain('disabled');
    });

    it('should use configured onFailure action', async () => {
      const guard = new BiasGuard({ onFailure: 'warn' });
      const result = await guard.check(
        createContext('All women are always emotional'),
      );

      expect(result.passed).toBe(false);
      expect(result.action).toBe('warn');
    });
  });

  describe('case insensitivity', () => {
    it('should detect bias regardless of case', async () => {
      const guard = new BiasGuard();

      const lowerResult = await guard.check(
        createContext('all women are always emotional'),
      );
      const upperResult = await guard.check(
        createContext('ALL WOMEN ARE ALWAYS EMOTIONAL'),
      );
      const mixedResult = await guard.check(
        createContext('AlL wOmEn ArE aLwAyS eMoTiOnAl'),
      );

      expect(lowerResult.passed).toBe(false);
      expect(upperResult.passed).toBe(false);
      expect(mixedResult.passed).toBe(false);
    });
  });
});

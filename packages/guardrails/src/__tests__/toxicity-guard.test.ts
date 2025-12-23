import { describe, it, expect } from 'vitest';
import { ToxicityGuard } from '../guards/content/toxicity.guard.js';
import type { GuardContext } from '../types/index.js';

function createContext(input: string): GuardContext {
  return {
    input,
    type: 'input',
    timestamp: new Date(),
  };
}

// Helper to create guard with low thresholds for single-match detection
function createLowThresholdGuard(
  options: Parameters<typeof ToxicityGuard>[0] = {},
) {
  return new ToxicityGuard({
    threshold: 0.1, // Low global threshold for withConfidence check
    categoryThresholds: {
      hate: 0.2,
      violence: 0.2,
      sexual: 0.2,
      harassment: 0.2,
      'self-harm': 0.2,
      dangerous: 0.2,
    },
    ...options,
  });
}

describe('ToxicityGuard', () => {
  describe('hate speech detection', () => {
    it('should detect hateful language', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('hate');
    });

    it('should detect racist language', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('That is racist'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('hate');
    });
  });

  describe('violence detection', () => {
    it('should detect violent threats', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(
        createContext('I will attack you tomorrow'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('violence');
    });

    it('should detect weapon-related threats', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('bomb threat incoming'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('violence');
    });
  });

  describe('harassment detection', () => {
    it('should detect harassment language', async () => {
      const guard = createLowThresholdGuard();
      // Pattern: you're/you are + insult
      const result = await guard.check(createContext("You're stupid"));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('harassment');
    });

    it('should detect bullying', async () => {
      const guard = createLowThresholdGuard();
      // Pattern: harass/bully/stalk/intimidate as standalone word
      const result = await guard.check(createContext('I will bully you'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('harassment');
    });
  });

  describe('self-harm detection', () => {
    it('should detect self-harm language', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I want to hurt myself'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('self-harm');
    });

    it('should detect suicide references', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('thinking about suicide'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('self-harm');
    });
  });

  describe('dangerous content detection', () => {
    it('should detect dangerous instructions', async () => {
      const guard = createLowThresholdGuard();
      // Pattern: make/create/build + bomb/explosive/weapon
      const result = await guard.check(createContext('how to make a bomb'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('dangerous');
    });

    it('should detect hacking attempts', async () => {
      const guard = createLowThresholdGuard();
      // Pattern: hack/exploit/attack + system/server/website (directly)
      const result = await guard.check(createContext('how to hack system'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('dangerous');
    });
  });

  describe('confidence scoring', () => {
    it('should include confidence scores', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should calculate scores per category', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.details?.scores).toBeDefined();
      expect(result.details?.scores.hate).toBeDefined();
    });

    it('should respect threshold settings', async () => {
      const guard = new ToxicityGuard({
        threshold: 0.9, // Very high threshold
      });

      const result = await guard.check(createContext('I hate all of them'));

      // Should pass because confidence is below threshold
      expect(result.passed).toBe(true);
    });
  });

  describe('category-specific thresholds', () => {
    it('should use category-specific thresholds', async () => {
      const guard = new ToxicityGuard({
        threshold: 0.1, // Low global threshold to allow detection
        categoryThresholds: {
          'self-harm': 0.3, // Lower threshold for self-harm
          hate: 0.9, // High threshold for hate
        },
      });

      const selfHarmResult = await guard.check(
        createContext('I want to hurt myself'),
      );
      expect(selfHarmResult.passed).toBe(false);
    });
  });

  describe('selective category detection', () => {
    it('should only check specified categories', async () => {
      const guard = new ToxicityGuard({
        categories: ['hate', 'violence'],
      });

      const result = await guard.check(createContext('I want to hurt myself'));

      // Should pass because self-harm category is not being checked
      expect(result.passed).toBe(true);
    });

    it('should detect when specified category matches', async () => {
      const guard = createLowThresholdGuard({
        categories: ['hate'],
      });

      const result = await guard.check(createContext('I hate all of them'));

      expect(result.passed).toBe(false);
      expect(result.details?.categories).toContain('hate');
    });
  });

  describe('pattern matching', () => {
    it('should capture matched patterns', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.details?.patterns).toBeDefined();
      expect(result.details?.patterns.length).toBeGreaterThan(0);
    });

    it('should include multiple matches', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(
        createContext('I hate them and despise you all'),
      );

      expect(result.details?.patterns.length).toBeGreaterThan(1);
    });
  });

  describe('detections', () => {
    it('should include detection details', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.detections).toBeDefined();
      expect(result.detections?.length).toBeGreaterThan(0);
      expect(result.detections?.[0]).toHaveProperty('category');
      expect(result.detections?.[0]).toHaveProperty('matchedText');
    });

    it('should provide location information', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(createContext('I hate all of them'));

      const detection = result.detections?.[0];
      expect(detection?.startIndex).toBeGreaterThanOrEqual(0);
      expect(detection?.endIndex).toBeGreaterThan(detection?.startIndex!);
    });
  });

  describe('clean content', () => {
    it('should pass clean content', async () => {
      const guard = new ToxicityGuard();
      const result = await guard.check(
        createContext('This is a perfectly normal and friendly message'),
      );

      expect(result.passed).toBe(true);
      expect(result.details?.categories).toHaveLength(0);
      expect(result.message).toContain('No toxic content detected');
    });
  });

  describe('multiple categories', () => {
    it('should detect multiple toxic categories', async () => {
      const guard = createLowThresholdGuard();
      const result = await guard.check(
        createContext('I hate you and will attack you'),
      );

      expect(result.details?.categories.length).toBeGreaterThan(1);
      expect(result.details?.categories).toContain('hate');
      expect(result.details?.categories).toContain('violence');
    });
  });

  describe('configuration', () => {
    it('should respect enabled flag', async () => {
      const guard = new ToxicityGuard({ enabled: false });
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.passed).toBe(true);
      expect(result.message).toContain('disabled');
    });

    it('should use configured onFailure action', async () => {
      const guard = createLowThresholdGuard({ onFailure: 'warn' });
      const result = await guard.check(createContext('I hate all of them'));

      expect(result.passed).toBe(false);
      expect(result.action).toBe('warn');
    });
  });

  describe('case insensitivity', () => {
    it('should detect toxic content regardless of case', async () => {
      const guard = createLowThresholdGuard();

      const lowerResult = await guard.check(
        createContext('i hate all of them'),
      );
      const upperResult = await guard.check(
        createContext('I HATE ALL OF THEM'),
      );
      const mixedResult = await guard.check(
        createContext('I HaTe AlL oF tHeM'),
      );

      expect(lowerResult.passed).toBe(false);
      expect(upperResult.passed).toBe(false);
      expect(mixedResult.passed).toBe(false);
    });
  });
});

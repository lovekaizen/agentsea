import { describe, it, expect } from 'vitest';
import { TopicGuard } from '../guards/content/topic.guard.js';
import type { GuardContext } from '../types/index.js';

function createContext(input: string): GuardContext {
  return {
    input,
    type: 'input',
    timestamp: new Date(),
  };
}

describe('TopicGuard', () => {
  describe('topic classification', () => {
    it('should classify technology content', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('I need help with programming in Python and using APIs'),
      );

      expect(result.details?.topics).toContain('technology');
      expect(result.details?.scores.technology).toBeGreaterThan(0);
    });

    it('should classify finance content', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('What are the best investment strategies for stocks?'),
      );

      expect(result.details?.topics).toContain('finance');
    });

    it('should classify health content', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('I have symptoms and need medical advice'),
      );

      expect(result.details?.topics).toContain('health');
    });

    it('should classify politics content', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('The election results and government policy changes'),
      );

      expect(result.details?.topics).toContain('politics');
    });
  });

  describe('blocked topics', () => {
    it('should block configured topics', async () => {
      const guard = new TopicGuard({
        blockedTopics: ['gambling', 'weapons'],
      });

      const result = await guard.check(
        createContext('How do I bet on casino games?'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.blockedTopics).toContain('gambling');
    });

    it('should pass when blocked topic not detected', async () => {
      const guard = new TopicGuard({
        blockedTopics: ['gambling'],
      });

      const result = await guard.check(
        createContext('What is the weather today?'),
      );

      expect(result.passed).toBe(true);
    });

    it('should detect weapons topic', async () => {
      const guard = new TopicGuard({
        blockedTopics: ['weapons'],
      });

      const result = await guard.check(
        createContext('Where can I buy a gun and ammunition?'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.blockedTopics).toContain('weapons');
    });

    it('should detect drugs topic', async () => {
      const guard = new TopicGuard({
        blockedTopics: ['drugs'],
      });

      const result = await guard.check(
        createContext('How to buy illegal drugs online'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.blockedTopics).toContain('drugs');
    });

    it('should detect adult content topic', async () => {
      const guard = new TopicGuard({
        blockedTopics: ['adult'],
      });

      const result = await guard.check(
        createContext('Looking for adult content and explicit material'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.blockedTopics).toContain('adult');
    });
  });

  describe('allowed topics (whitelist)', () => {
    it('should pass when topic is in allowed list', async () => {
      const guard = new TopicGuard({
        allowedTopics: ['technology', 'finance'],
      });

      const result = await guard.check(
        createContext('Help me with programming and software development'),
      );

      expect(result.passed).toBe(true);
      expect(result.details?.withinAllowed).toBe(true);
    });

    it('should fail when topic is not in allowed list', async () => {
      const guard = new TopicGuard({
        allowedTopics: ['technology'],
      });

      const result = await guard.check(
        createContext('Tell me about election politics'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.withinAllowed).toBe(false);
    });

    it('should allow all topics when allowlist is empty', async () => {
      const guard = new TopicGuard({
        allowedTopics: [],
      });

      const result = await guard.check(createContext('Any topic should work'));

      expect(result.details?.withinAllowed).toBe(true);
    });
  });

  describe('custom topic keywords', () => {
    it('should detect custom topics', async () => {
      const guard = new TopicGuard({
        topicKeywords: {
          pets: ['dog', 'cat', 'pet', 'animal'],
        },
      });

      const result = await guard.check(
        createContext('I have a pet dog and cat'),
      );

      expect(result.details?.topics).toContain('pets');
    });

    it('should combine custom and default topics', async () => {
      const guard = new TopicGuard({
        topicKeywords: {
          custom: ['special', 'unique'],
        },
      });

      const techResult = await guard.check(
        createContext('Programming software'),
      );
      const customResult = await guard.check(
        createContext('This is special and unique'),
      );

      expect(techResult.details?.topics).toContain('technology');
      expect(customResult.details?.topics).toContain('custom');
    });
  });

  describe('confidence scoring', () => {
    it('should calculate topic scores', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('Programming with APIs and software'),
      );

      expect(result.details?.scores).toBeDefined();
      expect(result.details?.scores.technology).toBeGreaterThan(0);
    });

    it('should use minimum confidence threshold', async () => {
      const guard = new TopicGuard({
        minConfidence: 0.8,
      });

      const result = await guard.check(createContext('Maybe tech related'));

      // Low confidence should not classify as technology
      expect(result.details?.topics).not.toContain('technology');
    });

    it('should respect custom min confidence', async () => {
      const guard = new TopicGuard({
        minConfidence: 0.1, // Very low threshold
      });

      const result = await guard.check(createContext('computer'));

      expect(result.details?.topics).toContain('technology');
    });
  });

  describe('multiple topics', () => {
    it('should detect multiple topics', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext(
          'I need help with medical software for hospital databases',
        ),
      );

      expect(result.details?.topics.length).toBeGreaterThan(1);
      expect(result.details?.topics).toContain('technology');
      expect(result.details?.topics).toContain('health');
    });

    it('should block if any topic is blocked', async () => {
      const guard = new TopicGuard({
        blockedTopics: ['gambling'],
      });

      const result = await guard.check(
        createContext('Technology for casino betting software'),
      );

      expect(result.passed).toBe(false);
      expect(result.details?.blockedTopics).toContain('gambling');
    });
  });

  describe('detections', () => {
    it('should include detection details', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('Programming with software'),
      );

      expect(result.detections).toBeDefined();
      expect(result.detections?.length).toBeGreaterThan(0);
      expect(result.detections?.[0]).toHaveProperty('category');
      expect(result.detections?.[0]).toHaveProperty('pattern');
    });

    it('should provide location information', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(createContext('Programming software'));

      const detection = result.detections?.[0];
      expect(detection?.startIndex).toBeGreaterThanOrEqual(0);
      expect(detection?.endIndex).toBeGreaterThan(detection?.startIndex!);
    });
  });

  describe('pass conditions', () => {
    it('should pass general content with no classification', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('The weather is nice today'),
      );

      expect(result.passed).toBe(true);
    });

    it('should pass when no blocklist and no allowlist', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(createContext('Any content'));

      expect(result.passed).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should respect enabled flag', async () => {
      const guard = new TopicGuard({ enabled: false });
      const result = await guard.check(
        createContext('Gambling and casino games'),
      );

      expect(result.passed).toBe(true);
      expect(result.message).toContain('disabled');
    });

    it('should use configured onFailure action', async () => {
      const guard = new TopicGuard({
        onFailure: 'warn',
        blockedTopics: ['gambling'],
      });

      const result = await guard.check(createContext('Casino betting games'));

      expect(result.passed).toBe(false);
      expect(result.action).toBe('warn');
    });
  });

  describe('case insensitivity', () => {
    it('should detect topics regardless of case', async () => {
      const guard = new TopicGuard();

      const lowerResult = await guard.check(
        createContext('programming software'),
      );
      const upperResult = await guard.check(
        createContext('PROGRAMMING SOFTWARE'),
      );
      const mixedResult = await guard.check(
        createContext('PrOgRaMmInG sOfTwArE'),
      );

      expect(lowerResult.details?.topics).toContain('technology');
      expect(upperResult.details?.topics).toContain('technology');
      expect(mixedResult.details?.topics).toContain('technology');
    });
  });

  describe('keyword matching', () => {
    it('should match whole words only', async () => {
      const guard = new TopicGuard();

      // Should not match partial words
      const result = await guard.check(createContext('scam email'));

      // 'am' is in 'scam' but shouldn't trigger anything
      expect(result.passed).toBe(true);
    });

    it('should count multiple keyword matches', async () => {
      const guard = new TopicGuard();
      const result = await guard.check(
        createContext('Software programming code API database server cloud AI'),
      );

      expect(result.details?.scores.technology).toBeGreaterThan(0.5);
    });
  });
});

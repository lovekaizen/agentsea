/**
 * Similarity Metrics Tests
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanDistance,
  dotProduct,
  manhattanDistance,
  distanceToSimilarity,
  normalize,
  magnitude,
} from '../similarity/metrics/SimilarityMetrics.js';

describe('SimilarityMetrics', () => {
  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('returns -1 for opposite vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('returns 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('handles high-dimensional vectors', () => {
      const dim = 1536;
      const a = Array.from({ length: dim }, () => Math.random());
      const b = [...a]; // Copy
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('returns ~0.707 for 45-degree angle', () => {
      const a = [1, 0];
      const b = [1, 1];
      // cos(45) = 1/sqrt(2) ≈ 0.707
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.707, 2);
    });
  });

  describe('euclideanDistance', () => {
    it('returns 0 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(euclideanDistance(a, b)).toBe(0);
    });

    it('calculates distance correctly', () => {
      const a = [0, 0];
      const b = [3, 4];
      // 3-4-5 triangle
      expect(euclideanDistance(a, b)).toBe(5);
    });

    it('returns Infinity for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(euclideanDistance(a, b)).toBe(Infinity);
    });

    it('handles negative values', () => {
      const a = [-1, -1];
      const b = [1, 1];
      // sqrt(4 + 4) = sqrt(8) ≈ 2.828
      expect(euclideanDistance(a, b)).toBeCloseTo(2.828, 2);
    });
  });

  describe('dotProduct', () => {
    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(dotProduct(a, b)).toBe(0);
    });

    it('calculates dot product correctly', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(dotProduct(a, b)).toBe(32);
    });

    it('returns 0 for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(dotProduct(a, b)).toBe(0);
    });

    it('handles negative values', () => {
      const a = [-1, 2, -3];
      const b = [4, -5, 6];
      // -1*4 + 2*(-5) + (-3)*6 = -4 - 10 - 18 = -32
      expect(dotProduct(a, b)).toBe(-32);
    });
  });

  describe('manhattanDistance', () => {
    it('returns 0 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(manhattanDistance(a, b)).toBe(0);
    });

    it('calculates Manhattan distance correctly', () => {
      const a = [0, 0];
      const b = [3, 4];
      // |3-0| + |4-0| = 7
      expect(manhattanDistance(a, b)).toBe(7);
    });

    it('returns Infinity for different length vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(manhattanDistance(a, b)).toBe(Infinity);
    });

    it('handles negative values', () => {
      const a = [-1, -2];
      const b = [1, 2];
      // |1-(-1)| + |2-(-2)| = 2 + 4 = 6
      expect(manhattanDistance(a, b)).toBe(6);
    });
  });

  describe('distanceToSimilarity', () => {
    it('returns 1 for distance 0', () => {
      expect(distanceToSimilarity(0)).toBe(1);
    });

    it('returns 0.5 for distance 1', () => {
      expect(distanceToSimilarity(1)).toBe(0.5);
    });

    it('approaches 0 for large distances', () => {
      expect(distanceToSimilarity(1000)).toBeLessThan(0.01);
    });

    it('returns value between 0 and 1', () => {
      const distances = [0, 0.5, 1, 2, 5, 10, 100];
      for (const d of distances) {
        const sim = distanceToSimilarity(d);
        expect(sim).toBeGreaterThanOrEqual(0);
        expect(sim).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('normalize', () => {
    it('returns unit vector', () => {
      const v = [3, 4];
      const normalized = normalize(v);
      const mag = magnitude(normalized);
      expect(mag).toBeCloseTo(1, 5);
    });

    it('preserves direction', () => {
      const v = [3, 4];
      const normalized = normalize(v);
      // Ratio should be same
      expect(normalized[0] / normalized[1]).toBeCloseTo(v[0] / v[1], 5);
    });

    it('handles zero vector', () => {
      const v = [0, 0, 0];
      const normalized = normalize(v);
      expect(normalized).toEqual([0, 0, 0]);
    });

    it('handles already normalized vector', () => {
      const v = [0.6, 0.8];
      const normalized = normalize(v);
      expect(magnitude(normalized)).toBeCloseTo(1, 5);
    });
  });

  describe('magnitude', () => {
    it('calculates magnitude correctly', () => {
      const v = [3, 4];
      // sqrt(9 + 16) = 5
      expect(magnitude(v)).toBe(5);
    });

    it('returns 0 for zero vector', () => {
      const v = [0, 0, 0];
      expect(magnitude(v)).toBe(0);
    });

    it('returns 1 for unit vectors', () => {
      const v = [1, 0, 0];
      expect(magnitude(v)).toBe(1);
    });

    it('handles high-dimensional vectors', () => {
      // All 1s in n dimensions has magnitude sqrt(n)
      const dim = 100;
      const v = Array.from({ length: dim }, () => 1);
      expect(magnitude(v)).toBeCloseTo(Math.sqrt(dim), 5);
    });
  });
});

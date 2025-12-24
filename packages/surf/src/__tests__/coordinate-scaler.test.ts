import { describe, it, expect, beforeEach } from 'vitest';
import { CoordinateScaler } from '../agent/coordinate-scaler.js';
import type { Point, ScreenDimensions } from '../types/index.js';

describe('CoordinateScaler', () => {
  let scaler: CoordinateScaler;
  const sourceResolution: ScreenDimensions = {
    width: 1920,
    height: 1080,
    scaleFactor: 1,
  };
  const targetResolution: ScreenDimensions = {
    width: 3840,
    height: 2160,
    scaleFactor: 2,
  };

  beforeEach(() => {
    scaler = new CoordinateScaler(sourceResolution, targetResolution);
  });

  describe('constructor', () => {
    it('should create scaler with source and target resolution', () => {
      expect(scaler).toBeInstanceOf(CoordinateScaler);
    });

    it('should use source as target when target not provided', () => {
      const sameScaler = new CoordinateScaler(sourceResolution);
      const point: Point = { x: 100, y: 100 };
      const scaled = sameScaler.scalePoint(point);

      expect(scaled.x).toBe(100);
      expect(scaled.y).toBe(100);
    });
  });

  describe('setSourceResolution', () => {
    it('should update source resolution', () => {
      const newSource: ScreenDimensions = {
        width: 1280,
        height: 720,
        scaleFactor: 1,
      };
      scaler.setSourceResolution(newSource);

      const factors = scaler.getScaleFactors();
      expect(factors.scaleX).toBe(3840 / 1280);
      expect(factors.scaleY).toBe(2160 / 720);
    });
  });

  describe('setTargetResolution', () => {
    it('should update target resolution', () => {
      const newTarget: ScreenDimensions = {
        width: 2560,
        height: 1440,
        scaleFactor: 1.5,
      };
      scaler.setTargetResolution(newTarget);

      const factors = scaler.getScaleFactors();
      expect(factors.scaleX).toBeCloseTo(2560 / 1920);
      expect(factors.scaleY).toBeCloseTo(1440 / 1080);
    });
  });

  describe('scalePoint', () => {
    it('should scale point from source to target resolution', () => {
      const point: Point = { x: 960, y: 540 };
      const scaled = scaler.scalePoint(point);

      expect(scaled.x).toBe(1920);
      expect(scaled.y).toBe(1080);
    });

    it('should handle origin point', () => {
      const point: Point = { x: 0, y: 0 };
      const scaled = scaler.scalePoint(point);

      expect(scaled.x).toBe(0);
      expect(scaled.y).toBe(0);
    });

    it('should handle edge point at max resolution', () => {
      const point: Point = { x: 1920, y: 1080 };
      const scaled = scaler.scalePoint(point);

      expect(scaled.x).toBe(3840);
      expect(scaled.y).toBe(2160);
    });

    it('should round to nearest integer', () => {
      const oddScaler = new CoordinateScaler(
        { width: 1000, height: 1000, scaleFactor: 1 },
        { width: 1001, height: 1001, scaleFactor: 1 },
      );
      const point: Point = { x: 500, y: 500 };
      const scaled = oddScaler.scalePoint(point);

      expect(Number.isInteger(scaled.x)).toBe(true);
      expect(Number.isInteger(scaled.y)).toBe(true);
    });
  });

  describe('unscalePoint', () => {
    it('should unscale point from target to source resolution', () => {
      const point: Point = { x: 1920, y: 1080 };
      const unscaled = scaler.unscalePoint(point);

      expect(unscaled.x).toBe(960);
      expect(unscaled.y).toBe(540);
    });

    it('should be inverse of scalePoint', () => {
      const original: Point = { x: 480, y: 270 };
      const scaled = scaler.scalePoint(original);
      const restored = scaler.unscalePoint(scaled);

      expect(restored.x).toBe(original.x);
      expect(restored.y).toBe(original.y);
    });

    it('should handle origin point', () => {
      const point: Point = { x: 0, y: 0 };
      const unscaled = scaler.unscalePoint(point);

      expect(unscaled.x).toBe(0);
      expect(unscaled.y).toBe(0);
    });
  });

  describe('scaleForDisplay', () => {
    it('should scale point by display scale factor', () => {
      const point: Point = { x: 100, y: 100 };
      const scaled = scaler.scaleForDisplay(point);

      expect(scaled.x).toBe(200);
      expect(scaled.y).toBe(200);
    });

    it('should handle scale factor of 1', () => {
      const noScaleTarget: ScreenDimensions = {
        width: 1920,
        height: 1080,
        scaleFactor: 1,
      };
      const noScaleScaler = new CoordinateScaler(
        sourceResolution,
        noScaleTarget,
      );
      const point: Point = { x: 100, y: 100 };
      const scaled = noScaleScaler.scaleForDisplay(point);

      expect(scaled.x).toBe(100);
      expect(scaled.y).toBe(100);
    });

    it('should round to nearest integer', () => {
      const fractionalTarget: ScreenDimensions = {
        width: 1920,
        height: 1080,
        scaleFactor: 1.5,
      };
      const fractionalScaler = new CoordinateScaler(
        sourceResolution,
        fractionalTarget,
      );
      const point: Point = { x: 33, y: 33 };
      const scaled = fractionalScaler.scaleForDisplay(point);

      expect(Number.isInteger(scaled.x)).toBe(true);
      expect(Number.isInteger(scaled.y)).toBe(true);
    });
  });

  describe('unscaleFromDisplay', () => {
    it('should unscale point by display scale factor', () => {
      const point: Point = { x: 200, y: 200 };
      const unscaled = scaler.unscaleFromDisplay(point);

      expect(unscaled.x).toBe(100);
      expect(unscaled.y).toBe(100);
    });

    it('should be inverse of scaleForDisplay', () => {
      const original: Point = { x: 50, y: 50 };
      const scaled = scaler.scaleForDisplay(original);
      const restored = scaler.unscaleFromDisplay(scaled);

      expect(restored.x).toBe(original.x);
      expect(restored.y).toBe(original.y);
    });
  });

  describe('isWithinBounds', () => {
    it('should return true for point within bounds', () => {
      const point: Point = { x: 1920, y: 1080 };
      expect(scaler.isWithinBounds(point)).toBe(true);
    });

    it('should return true for origin', () => {
      const point: Point = { x: 0, y: 0 };
      expect(scaler.isWithinBounds(point)).toBe(true);
    });

    it('should return true for edge of screen', () => {
      const point: Point = { x: 3840, y: 2160 };
      expect(scaler.isWithinBounds(point)).toBe(true);
    });

    it('should return false for negative x', () => {
      const point: Point = { x: -1, y: 100 };
      expect(scaler.isWithinBounds(point)).toBe(false);
    });

    it('should return false for negative y', () => {
      const point: Point = { x: 100, y: -1 };
      expect(scaler.isWithinBounds(point)).toBe(false);
    });

    it('should return false for x beyond width', () => {
      const point: Point = { x: 3841, y: 100 };
      expect(scaler.isWithinBounds(point)).toBe(false);
    });

    it('should return false for y beyond height', () => {
      const point: Point = { x: 100, y: 2161 };
      expect(scaler.isWithinBounds(point)).toBe(false);
    });
  });

  describe('clampToBounds', () => {
    it('should not modify point within bounds', () => {
      const point: Point = { x: 1920, y: 1080 };
      const clamped = scaler.clampToBounds(point);

      expect(clamped.x).toBe(1920);
      expect(clamped.y).toBe(1080);
    });

    it('should clamp negative x to 0', () => {
      const point: Point = { x: -100, y: 100 };
      const clamped = scaler.clampToBounds(point);

      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(100);
    });

    it('should clamp negative y to 0', () => {
      const point: Point = { x: 100, y: -100 };
      const clamped = scaler.clampToBounds(point);

      expect(clamped.x).toBe(100);
      expect(clamped.y).toBe(0);
    });

    it('should clamp x beyond width to max', () => {
      const point: Point = { x: 5000, y: 100 };
      const clamped = scaler.clampToBounds(point);

      expect(clamped.x).toBe(3839);
      expect(clamped.y).toBe(100);
    });

    it('should clamp y beyond height to max', () => {
      const point: Point = { x: 100, y: 3000 };
      const clamped = scaler.clampToBounds(point);

      expect(clamped.x).toBe(100);
      expect(clamped.y).toBe(2159);
    });

    it('should clamp both coordinates when both out of bounds', () => {
      const point: Point = { x: -100, y: 5000 };
      const clamped = scaler.clampToBounds(point);

      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(2159);
    });
  });

  describe('getScaleFactors', () => {
    it('should return correct scale factors', () => {
      const factors = scaler.getScaleFactors();

      expect(factors.scaleX).toBe(2);
      expect(factors.scaleY).toBe(2);
    });

    it('should handle asymmetric scaling', () => {
      const asymmetricScaler = new CoordinateScaler(
        { width: 1920, height: 1080, scaleFactor: 1 },
        { width: 2560, height: 1440, scaleFactor: 1 },
      );
      const factors = asymmetricScaler.getScaleFactors();

      expect(factors.scaleX).toBeCloseTo(2560 / 1920);
      expect(factors.scaleY).toBeCloseTo(1440 / 1080);
    });

    it('should return 1 for same source and target', () => {
      const sameScaler = new CoordinateScaler(sourceResolution);
      const factors = sameScaler.getScaleFactors();

      expect(factors.scaleX).toBe(1);
      expect(factors.scaleY).toBe(1);
    });
  });

  describe('createAuto', () => {
    it('should create scaler with default 1920x1080 resolution', () => {
      const autoScaler = CoordinateScaler.createAuto();
      const factors = autoScaler.getScaleFactors();

      expect(factors.scaleX).toBe(1);
      expect(factors.scaleY).toBe(1);
    });

    it('should use provided target resolution', () => {
      const customTarget: ScreenDimensions = {
        width: 3840,
        height: 2160,
        scaleFactor: 2,
      };
      const autoScaler = CoordinateScaler.createAuto(customTarget);
      const factors = autoScaler.getScaleFactors();

      expect(factors.scaleX).toBe(2);
      expect(factors.scaleY).toBe(2);
    });

    it('should return instance of CoordinateScaler', () => {
      const autoScaler = CoordinateScaler.createAuto();
      expect(autoScaler).toBeInstanceOf(CoordinateScaler);
    });
  });

  describe('edge cases', () => {
    it('should handle very small source resolution', () => {
      const smallScaler = new CoordinateScaler(
        { width: 100, height: 100, scaleFactor: 1 },
        { width: 1920, height: 1080, scaleFactor: 1 },
      );
      const point: Point = { x: 50, y: 50 };
      const scaled = smallScaler.scalePoint(point);

      expect(scaled.x).toBe(960);
      expect(scaled.y).toBe(540);
    });

    it('should handle downscaling', () => {
      const downScaler = new CoordinateScaler(
        { width: 3840, height: 2160, scaleFactor: 1 },
        { width: 1920, height: 1080, scaleFactor: 1 },
      );
      const point: Point = { x: 3840, y: 2160 };
      const scaled = downScaler.scalePoint(point);

      expect(scaled.x).toBe(1920);
      expect(scaled.y).toBe(1080);
    });

    it('should handle non-standard aspect ratios', () => {
      const wideScaler = new CoordinateScaler(
        { width: 1920, height: 1080, scaleFactor: 1 },
        { width: 2560, height: 1080, scaleFactor: 1 },
      );
      const point: Point = { x: 960, y: 540 };
      const scaled = wideScaler.scalePoint(point);

      expect(scaled.x).toBeCloseTo(1280);
      expect(scaled.y).toBe(540);
    });
  });
});

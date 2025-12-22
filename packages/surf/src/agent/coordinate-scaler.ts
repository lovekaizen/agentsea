/**
 * Coordinate Scaler - Handle coordinate scaling between different resolutions
 */

import { Point, ScreenDimensions } from '../types';

/**
 * Coordinate scaler for handling different screen resolutions
 */
export class CoordinateScaler {
  private sourceResolution: ScreenDimensions;
  private targetResolution: ScreenDimensions;

  constructor(
    sourceResolution: ScreenDimensions,
    targetResolution?: ScreenDimensions,
  ) {
    this.sourceResolution = sourceResolution;
    this.targetResolution = targetResolution || sourceResolution;
  }

  /**
   * Update the source resolution (e.g., when screen size changes)
   */
  setSourceResolution(resolution: ScreenDimensions): void {
    this.sourceResolution = resolution;
  }

  /**
   * Update the target resolution
   */
  setTargetResolution(resolution: ScreenDimensions): void {
    this.targetResolution = resolution;
  }

  /**
   * Scale a point from source to target resolution
   */
  scalePoint(point: Point): Point {
    const scaleX = this.targetResolution.width / this.sourceResolution.width;
    const scaleY = this.targetResolution.height / this.sourceResolution.height;

    return {
      x: Math.round(point.x * scaleX),
      y: Math.round(point.y * scaleY),
    };
  }

  /**
   * Unscale a point from target back to source resolution
   */
  unscalePoint(point: Point): Point {
    const scaleX = this.sourceResolution.width / this.targetResolution.width;
    const scaleY = this.sourceResolution.height / this.targetResolution.height;

    return {
      x: Math.round(point.x * scaleX),
      y: Math.round(point.y * scaleY),
    };
  }

  /**
   * Scale coordinates accounting for display scale factor
   */
  scaleForDisplay(point: Point): Point {
    const scaleFactor = this.targetResolution.scaleFactor;
    return {
      x: Math.round(point.x * scaleFactor),
      y: Math.round(point.y * scaleFactor),
    };
  }

  /**
   * Unscale coordinates from display scale factor
   */
  unscaleFromDisplay(point: Point): Point {
    const scaleFactor = this.targetResolution.scaleFactor;
    return {
      x: Math.round(point.x / scaleFactor),
      y: Math.round(point.y / scaleFactor),
    };
  }

  /**
   * Check if a point is within screen bounds
   */
  isWithinBounds(point: Point): boolean {
    return (
      point.x >= 0 &&
      point.x <= this.targetResolution.width &&
      point.y >= 0 &&
      point.y <= this.targetResolution.height
    );
  }

  /**
   * Clamp a point to be within screen bounds
   */
  clampToBounds(point: Point): Point {
    return {
      x: Math.max(0, Math.min(point.x, this.targetResolution.width - 1)),
      y: Math.max(0, Math.min(point.y, this.targetResolution.height - 1)),
    };
  }

  /**
   * Get the current scale factors
   */
  getScaleFactors(): { scaleX: number; scaleY: number } {
    return {
      scaleX: this.targetResolution.width / this.sourceResolution.width,
      scaleY: this.targetResolution.height / this.sourceResolution.height,
    };
  }

  /**
   * Create a scaler with automatic resolution detection
   */
  static createAuto(targetResolution?: ScreenDimensions): CoordinateScaler {
    // Default to common resolution
    const defaultSource: ScreenDimensions = {
      width: 1920,
      height: 1080,
      scaleFactor: 1,
    };

    return new CoordinateScaler(
      defaultSource,
      targetResolution || defaultSource,
    );
  }
}

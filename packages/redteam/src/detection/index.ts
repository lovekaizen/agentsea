/**
 * Detection Module - Runtime Safety Monitoring
 *
 * Real-time detection of jailbreak attempts, data leakage,
 * bias, and other safety concerns.
 */

export {
  JailbreakDetector,
  createJailbreakDetector,
} from './JailbreakDetector.js';

// Re-export types for convenience
export type {
  DetectionResult,
  DetectionType,
  DetectionInput,
  DetectionIndicator,
  DetectionAnalysis,
  JailbreakDetectionResult,
  DataLeakageDetectionResult,
  BiasDetectionResult,
  HallucinationDetectionResult,
  ToxicityDetectionResult,
  MultiDetectionResult,
  DetectionConfig,
  DetectionMetrics,
  DetectionAlert,
} from '../types/detection.types.js';

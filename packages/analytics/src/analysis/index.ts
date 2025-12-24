/**
 * Analysis Module
 *
 * Exports analysis classes for flow, drop-off, success, and funnel analysis.
 */

export { FlowAnalyzer, type FlowAnalyzerEvents } from './FlowAnalyzer.js';
export {
  DropOffDetector,
  type DropOffDetectorEvents,
} from './DropOffDetector.js';
export {
  SuccessAnalyzer,
  type SuccessAnalyzerEvents,
} from './SuccessAnalyzer.js';
export {
  FunnelAnalyzer,
  type FunnelAnalyzerEvents,
  type FunnelDefinition,
} from './FunnelAnalyzer.js';

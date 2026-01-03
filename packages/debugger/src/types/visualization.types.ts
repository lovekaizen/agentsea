/**
 * Visualization Types
 *
 * Type definitions for decision trees and flow graphs.
 */

import type { Decision, ToolCall, StepType } from './debugger.types.js';

/**
 * Flow node type (alias for StepType)
 */
export type FlowNodeType = StepType;

/**
 * Alternative path in decision tree
 */
export interface AlternativePath {
  /** Path ID */
  id: string;
  /** Option that would have been taken */
  option: string;
  /** Probability/score if known */
  score?: number;
  /** Predicted outcome */
  outcome?: string;
}

/**
 * Mermaid export options
 */
export interface MermaidOptions {
  /** Diagram direction */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';
  /** Include styling */
  includeStyles?: boolean;
  /** Theme */
  theme?: 'default' | 'dark' | 'forest' | 'neutral';
}

/**
 * Export format
 */
export type ExportFormat = 'mermaid' | 'dot' | 'json' | 'svg';

/**
 * Decision tree node
 */
export interface DecisionTreeNode {
  /** Node ID */
  id: string;
  /** Label */
  label: string;
  /** Node type */
  type: 'decision' | 'outcome' | 'action' | 'branch';
  /** Decision data */
  decision?: Decision;
  /** Step index */
  stepIndex?: number;
  /** Child node IDs */
  children: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Decision tree
 */
export interface DecisionTree {
  /** Tree ID */
  id: string;
  /** Root node */
  root: DecisionTreeNode;
  /** All nodes */
  nodes: DecisionTreeNode[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Flow graph node
 */
export interface FlowGraphNode {
  /** Node ID */
  id: string;
  /** Label */
  label: string;
  /** Node type */
  type: StepType;
  /** Step index */
  stepIndex?: number;
  /** Style */
  style?: FlowNodeStyle;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Flow node style
 */
export interface FlowNodeStyle {
  /** Fill color */
  fill?: string;
  /** Stroke color */
  stroke?: string;
  /** Stroke width */
  strokeWidth?: number;
  /** Shape */
  shape?: 'rectangle' | 'ellipse' | 'diamond' | 'hexagon';
  /** Font size */
  fontSize?: number;
  /** Text color */
  textColor?: string;
}

/**
 * Flow graph edge
 */
export interface FlowGraphEdge {
  /** Edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge label */
  label?: string;
  /** Style */
  style?: FlowEdgeStyle;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Flow edge style
 */
export interface FlowEdgeStyle {
  /** Line color */
  stroke?: string;
  /** Line width */
  strokeWidth?: number;
  /** Line style */
  lineType?: 'solid' | 'dashed' | 'dotted';
  /** Arrow type */
  arrowType?: 'arrow' | 'none' | 'diamond';
  /** Curve type */
  curveType?: 'straight' | 'bezier' | 'step';
}

/**
 * Flow graph
 */
export interface FlowGraph {
  /** Graph ID */
  id: string;
  /** All nodes */
  nodes: FlowGraphNode[];
  /** All edges */
  edges: FlowGraphEdge[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * State timeline entry
 */
export interface StateTimelineEntry {
  /** Timestamp */
  timestamp: number;
  /** Step index */
  stepIndex: number;
  /** State variable name */
  variable: string;
  /** Previous value */
  previousValue?: unknown;
  /** New value */
  newValue: unknown;
  /** Change type */
  changeType: 'added' | 'modified' | 'removed';
}

/**
 * State timeline
 */
export interface StateTimeline {
  /** Recording ID */
  recordingId: string;
  /** Entries */
  entries: StateTimelineEntry[];
  /** Variables tracked */
  variables: string[];
  /** Duration */
  durationMs: number;
}

/**
 * Tool call tree node
 */
export interface ToolCallTreeNode {
  /** Node ID */
  id: string;
  /** Tool call */
  toolCall: ToolCall;
  /** Step index */
  stepIndex: number;
  /** Parent node ID */
  parentId?: string;
  /** Child node IDs */
  childIds: string[];
  /** Depth */
  depth: number;
}

/**
 * Tool call tree
 */
export interface ToolCallTree {
  /** Recording ID */
  recordingId: string;
  /** Root nodes (top-level calls) */
  roots: string[];
  /** All nodes */
  nodes: Map<string, ToolCallTreeNode>;
  /** Total tool calls */
  totalCalls: number;
  /** Max nesting depth */
  maxDepth: number;
}

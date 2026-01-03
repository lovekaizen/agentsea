/**
 * FlowGraph
 *
 * Execution flow graph visualization.
 */

import type {
  FlowGraph,
  FlowGraphNode,
  FlowGraphEdge,
  ExecutionStep,
  Recording,
  StepType,
} from '../types/index.js';
import { generateId } from '../utils/helpers.js';

/**
 * Node style configuration
 */
export interface NodeStyle {
  /** Fill color */
  fill?: string;
  /** Border color */
  stroke?: string;
  /** Border width */
  strokeWidth?: number;
  /** Shape type */
  shape?: 'rectangle' | 'ellipse' | 'diamond' | 'hexagon';
  /** Font size */
  fontSize?: number;
  /** Text color */
  textColor?: string;
}

/**
 * Edge style configuration
 */
export interface EdgeStyle {
  /** Line color */
  stroke?: string;
  /** Line width */
  strokeWidth?: number;
  /** Line type */
  lineType?: 'solid' | 'dashed' | 'dotted';
  /** Arrow type */
  arrowType?: 'arrow' | 'none' | 'diamond';
  /** Curve type */
  curveType?: 'straight' | 'bezier' | 'step';
}

/**
 * Graph building options
 */
export interface GraphBuildOptions {
  /** Group consecutive steps of same type */
  groupSimilar?: boolean;
  /** Include step durations */
  includeDurations?: boolean;
  /** Include tool call details */
  includeToolDetails?: boolean;
  /** Maximum nodes */
  maxNodes?: number;
  /** Custom node style by type */
  nodeStyles?: Partial<Record<StepType, NodeStyle>>;
}

/**
 * Default node styles by type
 */
const DEFAULT_NODE_STYLES: Record<StepType, NodeStyle> = {
  input: { fill: '#e3f2fd', shape: 'rectangle' },
  prompt: { fill: '#f3e5f5', shape: 'rectangle' },
  response: { fill: '#e8f5e9', shape: 'rectangle' },
  output: { fill: '#c8e6c9', shape: 'rectangle' },
  'tool-call': { fill: '#fff3e0', shape: 'hexagon' },
  'tool-result': { fill: '#fff8e1', shape: 'rectangle' },
  decision: { fill: '#fce4ec', shape: 'diamond' },
  error: { fill: '#ffebee', shape: 'rectangle' },
  'memory-read': { fill: '#e0f7fa', shape: 'ellipse' },
  'memory-write': { fill: '#e0f2f1', shape: 'ellipse' },
  handoff: { fill: '#ede7f6', shape: 'hexagon' },
  delegation: { fill: '#e8eaf6', shape: 'hexagon' },
  custom: { fill: '#fafafa', shape: 'rectangle' },
};

/**
 * Default build options
 */
const DEFAULT_BUILD_OPTIONS: Required<GraphBuildOptions> = {
  groupSimilar: false,
  includeDurations: true,
  includeToolDetails: true,
  maxNodes: 200,
  nodeStyles: {},
};

/**
 * FlowGraphBuilder
 *
 * Builds execution flow graphs from recordings.
 *
 * @example
 * ```typescript
 * const builder = new FlowGraphBuilder();
 *
 * // Build graph from recording
 * const graph = builder.build(recording);
 *
 * // Export for visualization
 * const svg = builder.toSVG();
 * const mermaid = builder.toMermaid();
 * ```
 */
export class FlowGraphBuilder {
  private nodes: Map<string, FlowGraphNode> = new Map();
  private edges: Map<string, FlowGraphEdge> = new Map();
  private options: Required<GraphBuildOptions>;
  private nodeStyles: Record<StepType, NodeStyle>;

  constructor(options?: GraphBuildOptions) {
    this.options = {
      ...DEFAULT_BUILD_OPTIONS,
      ...options,
    };

    this.nodeStyles = {
      ...DEFAULT_NODE_STYLES,
      ...options?.nodeStyles,
    };
  }

  /**
   * Build graph from a recording
   */
  build(recording: Recording): FlowGraph {
    this.clear();

    // Create start node
    const startNode = this.addNode({
      label: 'Start',
      type: 'input',
      metadata: {
        agentId: recording.agentId,
        agentName: recording.agentName,
      },
    });

    let previousNodeId = startNode.id;
    let nodeCount = 1;

    // Process steps
    for (const step of recording.steps) {
      if (nodeCount >= this.options.maxNodes) {
        break;
      }

      // Skip if grouping similar and same type as previous
      if (this.options.groupSimilar && previousNodeId) {
        const prevNode = this.nodes.get(previousNodeId);
        if (prevNode && prevNode.type === step.type) {
          // Update existing node
          this.updateNodeForGroup(prevNode, step);
          continue;
        }
      }

      const node = this.createNodeFromStep(step);
      this.nodes.set(node.id, node);

      // Create edge from previous node
      if (previousNodeId) {
        this.addEdge(previousNodeId, node.id, {
          durationMs: step.durationMs,
        });
      }

      previousNodeId = node.id;
      nodeCount++;
    }

    // Create end node
    const endNode = this.addNode({
      label: recording.status === 'completed' ? 'Complete' : 'Failed',
      type: recording.status === 'completed' ? 'response' : 'error',
      metadata: {
        status: recording.status,
        durationMs: recording.durationMs,
      },
    });

    if (previousNodeId) {
      this.addEdge(previousNodeId, endNode.id);
    }

    return this.export();
  }

  /**
   * Create a node from a step
   */
  private createNodeFromStep(step: ExecutionStep): FlowGraphNode {
    const style = this.nodeStyles[step.type] ?? DEFAULT_NODE_STYLES.custom;

    const node: FlowGraphNode = {
      id: generateId('node'),
      label: this.getStepLabel(step),
      type: step.type,
      stepIndex: step.index,
      style,
      metadata: this.getStepMetadata(step),
    };

    return node;
  }

  /**
   * Get label for a step
   */
  private getStepLabel(step: ExecutionStep): string {
    switch (step.type) {
      case 'input':
        return 'User Input';
      case 'prompt':
        return 'Prompt';
      case 'response':
        return 'Response';
      case 'tool-call':
        if (this.options.includeToolDetails && step.toolCall) {
          return `${step.toolCall.name}()`;
        }
        return 'Tool Call';
      case 'tool-result':
        return step.toolCall?.success ? 'Success' : 'Failed';
      case 'decision':
        return step.decision?.reason ?? 'Decision';
      case 'error':
        return step.error?.name ?? 'Error';
      case 'memory-read':
        return 'Read Memory';
      case 'memory-write':
        return 'Write Memory';
      case 'handoff':
      case 'delegation':
        return 'Hand Off';
      default:
        return step.type;
    }
  }

  /**
   * Get metadata for a step
   */
  private getStepMetadata(step: ExecutionStep): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      stepIndex: step.index,
      timestamp: step.timestamp,
    };

    if (this.options.includeDurations && step.durationMs) {
      metadata.durationMs = step.durationMs;
    }

    if (step.toolCall) {
      metadata.toolName = step.toolCall.name;
      if (this.options.includeToolDetails) {
        metadata.toolArguments = step.toolCall.arguments;
      }
    }

    if (step.decision) {
      metadata.confidence = step.decision.confidence;
      metadata.chosenOption = step.decision.chosen.description;
    }

    if (step.error) {
      metadata.errorMessage = step.error.message;
    }

    return metadata;
  }

  /**
   * Update node when grouping similar steps
   */
  private updateNodeForGroup(node: FlowGraphNode, step: ExecutionStep): void {
    const count = (node.metadata?.groupCount as number) ?? 1;
    node.metadata = {
      ...node.metadata,
      groupCount: count + 1,
      lastStepIndex: step.index,
    };
    node.label = `${node.label} (${count + 1})`;
  }

  /**
   * Add a node
   */
  addNode(options: {
    label: string;
    type: StepType;
    stepIndex?: number;
    style?: NodeStyle;
    metadata?: Record<string, unknown>;
  }): FlowGraphNode {
    const id = generateId('node');
    const style =
      options.style ??
      this.nodeStyles[options.type] ??
      DEFAULT_NODE_STYLES.custom;

    const node: FlowGraphNode = {
      id,
      label: options.label,
      type: options.type,
      stepIndex: options.stepIndex,
      style,
      metadata: options.metadata,
    };

    this.nodes.set(id, node);
    return node;
  }

  /**
   * Add an edge
   */
  addEdge(
    sourceId: string,
    targetId: string,
    options?: {
      label?: string;
      style?: EdgeStyle;
      durationMs?: number;
    },
  ): FlowGraphEdge {
    const id = generateId('edge');

    const edge: FlowGraphEdge = {
      id,
      source: sourceId,
      target: targetId,
      label: options?.label,
      style: options?.style,
      metadata: options?.durationMs
        ? { durationMs: options.durationMs }
        : undefined,
    };

    this.edges.set(id, edge);
    return edge;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): FlowGraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes
   */
  getNodes(): FlowGraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes by type
   */
  getNodesByType(type: StepType): FlowGraphNode[] {
    return this.getNodes().filter((n) => n.type === type);
  }

  /**
   * Get an edge by ID
   */
  getEdge(id: string): FlowGraphEdge | undefined {
    return this.edges.get(id);
  }

  /**
   * Get all edges
   */
  getEdges(): FlowGraphEdge[] {
    return Array.from(this.edges.values());
  }

  /**
   * Get edges from a node
   */
  getEdgesFrom(nodeId: string): FlowGraphEdge[] {
    return this.getEdges().filter((e) => e.source === nodeId);
  }

  /**
   * Get edges to a node
   */
  getEdgesTo(nodeId: string): FlowGraphEdge[] {
    return this.getEdges().filter((e) => e.target === nodeId);
  }

  /**
   * Find path between nodes
   */
  findPath(startId: string, endId: string): FlowGraphNode[] | null {
    const visited = new Set<string>();
    const path: FlowGraphNode[] = [];

    const dfs = (currentId: string): boolean => {
      if (visited.has(currentId)) {
        return false;
      }

      visited.add(currentId);
      const node = this.nodes.get(currentId);

      if (!node) {
        return false;
      }

      path.push(node);

      if (currentId === endId) {
        return true;
      }

      for (const edge of this.getEdgesFrom(currentId)) {
        if (dfs(edge.target)) {
          return true;
        }
      }

      path.pop();
      return false;
    };

    return dfs(startId) ? path : null;
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    avgDuration: number;
  } {
    const nodesByType: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;

    for (const node of this.nodes.values()) {
      nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;

      const duration = node.metadata?.durationMs as number | undefined;
      if (duration) {
        totalDuration += duration;
        durationCount++;
      }
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodesByType,
      avgDuration: durationCount > 0 ? totalDuration / durationCount : 0,
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
  }

  /**
   * Export graph structure
   */
  export(): FlowGraph {
    return {
      id: generateId('graph'),
      nodes: this.getNodes(),
      edges: this.getEdges(),
      metadata: this.getStats(),
    };
  }

  /**
   * Export to Mermaid format
   */
  toMermaid(): string {
    const lines: string[] = ['flowchart TD'];

    // Add nodes
    for (const node of this.nodes.values()) {
      const shape = this.getMermaidShape(node);
      lines.push(`    ${node.id}${shape}`);
    }

    // Add edges
    for (const edge of this.edges.values()) {
      const label = edge.label ? ` |${edge.label}|` : '';
      const arrow = edge.style?.lineType === 'dashed' ? '-.->' : '-->';
      lines.push(`    ${edge.source}${arrow}${label}${edge.target}`);
    }

    return lines.join('\n');
  }

  /**
   * Get Mermaid shape for node
   */
  private getMermaidShape(node: FlowGraphNode): string {
    const label = node.label.replace(/"/g, "'");

    switch (node.style?.shape) {
      case 'ellipse':
        return `([${label}])`;
      case 'diamond':
        return `{${label}}`;
      case 'hexagon':
        return `{{${label}}}`;
      default:
        return `[${label}]`;
    }
  }

  /**
   * Export to DOT format (Graphviz)
   */
  toDOT(): string {
    const lines: string[] = ['digraph G {', '    rankdir=TB;'];

    // Add nodes
    for (const node of this.nodes.values()) {
      const shape = this.getDOTShape(node);
      const fill = node.style?.fill ?? '#ffffff';
      lines.push(
        `    "${node.id}" [label="${node.label}", shape=${shape}, style=filled, fillcolor="${fill}"];`,
      );
    }

    // Add edges
    for (const edge of this.edges.values()) {
      const label = edge.label ? `, label="${edge.label}"` : '';
      const style = edge.style?.lineType === 'dashed' ? ', style=dashed' : '';
      lines.push(
        `    "${edge.source}" -> "${edge.target}" [${label}${style}];`,
      );
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Get DOT shape for node
   */
  private getDOTShape(node: FlowGraphNode): string {
    switch (node.style?.shape) {
      case 'ellipse':
        return 'ellipse';
      case 'diamond':
        return 'diamond';
      case 'hexagon':
        return 'hexagon';
      default:
        return 'box';
    }
  }
}

/**
 * Create a flow graph builder
 */
export function createFlowGraphBuilder(
  options?: GraphBuildOptions,
): FlowGraphBuilder {
  return new FlowGraphBuilder(options);
}

/**
 * DecisionTree
 *
 * Decision tree visualization for agent decision points.
 */

import type {
  DecisionTree,
  DecisionTreeNode,
  ExecutionStep,
  Decision,
  Recording,
} from '../types/index.js';
import { generateId } from '../utils/helpers.js';

/**
 * Node creation options
 */
export interface NodeOptions {
  /** Node label */
  label: string;
  /** Node type */
  type: 'decision' | 'outcome' | 'action' | 'branch';
  /** Decision data */
  decision?: Decision;
  /** Step reference */
  stepIndex?: number;
  /** Parent node ID */
  parentId?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Tree building options
 */
export interface TreeBuildOptions {
  /** Include tool calls as nodes */
  includeToolCalls?: boolean;
  /** Include all steps or just decisions */
  allSteps?: boolean;
  /** Maximum depth */
  maxDepth?: number;
  /** Collapse similar nodes */
  collapseSimilar?: boolean;
}

/**
 * Tree layout options
 */
export interface LayoutOptions {
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Node spacing */
  nodeSpacing?: number;
  /** Level spacing */
  levelSpacing?: number;
  /** Node width */
  nodeWidth?: number;
  /** Node height */
  nodeHeight?: number;
}

/**
 * Default options
 */
const DEFAULT_BUILD_OPTIONS: Required<TreeBuildOptions> = {
  includeToolCalls: true,
  allSteps: false,
  maxDepth: 50,
  collapseSimilar: false,
};

const DEFAULT_LAYOUT_OPTIONS: Required<LayoutOptions> = {
  direction: 'vertical',
  nodeSpacing: 50,
  levelSpacing: 100,
  nodeWidth: 200,
  nodeHeight: 80,
};

/**
 * DecisionTreeBuilder
 *
 * Builds decision trees from recordings.
 *
 * @example
 * ```typescript
 * const builder = new DecisionTreeBuilder();
 *
 * // Build tree from recording
 * const tree = builder.build(recording);
 *
 * // Add a node
 * const node = builder.addNode({
 *   label: 'Choose API',
 *   type: 'decision',
 *   decision: decisionData,
 * });
 *
 * // Export for visualization
 * const data = builder.export();
 * ```
 */
export class DecisionTreeBuilder {
  private nodes: Map<string, DecisionTreeNode> = new Map();
  private rootId?: string;
  private buildOptions: Required<TreeBuildOptions>;
  private layoutOptions: Required<LayoutOptions>;

  constructor(buildOptions?: TreeBuildOptions, layoutOptions?: LayoutOptions) {
    this.buildOptions = {
      ...DEFAULT_BUILD_OPTIONS,
      ...buildOptions,
    };

    this.layoutOptions = {
      ...DEFAULT_LAYOUT_OPTIONS,
      ...layoutOptions,
    };
  }

  /**
   * Build tree from a recording
   */
  build(recording: Recording): DecisionTree {
    this.clear();

    // Create root node
    const rootNode = this.addNode({
      label: 'Start',
      type: 'action',
      stepIndex: -1,
      metadata: {
        agentId: recording.agentId,
        agentName: recording.agentName,
      },
    });

    this.rootId = rootNode.id;
    let currentParentId = rootNode.id;
    let depth = 0;

    // Process steps
    for (const step of recording.steps) {
      if (depth >= this.buildOptions.maxDepth) {
        break;
      }

      const node = this.processStep(step, currentParentId, depth);

      if (node) {
        if (step.type === 'decision') {
          // Decision creates branches
          currentParentId = node.id;
          depth++;
        } else if (this.buildOptions.allSteps) {
          currentParentId = node.id;
        }
      }
    }

    // Add end node
    this.addNode({
      label: recording.status === 'completed' ? 'Complete' : 'Failed',
      type: 'outcome',
      parentId: currentParentId,
      metadata: {
        status: recording.status,
        durationMs: recording.durationMs,
      },
    });

    return this.export();
  }

  /**
   * Process a step into a node
   */
  private processStep(
    step: ExecutionStep,
    parentId: string,
    depth: number,
  ): DecisionTreeNode | null {
    // Handle decision steps
    if (step.type === 'decision' && step.decision) {
      return this.addDecisionNode(step, parentId, depth);
    }

    // Handle tool calls if enabled
    if (this.buildOptions.includeToolCalls && step.type === 'tool-call') {
      return this.addNode({
        label: `Tool: ${step.toolCall?.name ?? 'unknown'}`,
        type: 'action',
        stepIndex: step.index,
        parentId,
        metadata: {
          toolName: step.toolCall?.name,
          arguments: step.toolCall?.arguments,
        },
      });
    }

    // Handle all steps if enabled
    if (this.buildOptions.allSteps) {
      return this.addNode({
        label: this.getStepLabel(step),
        type: 'action',
        stepIndex: step.index,
        parentId,
      });
    }

    return null;
  }

  /**
   * Add a decision node with branches
   */
  private addDecisionNode(
    step: ExecutionStep,
    parentId: string,
    _depth: number,
  ): DecisionTreeNode {
    const decision = step.decision!;

    // Create decision node
    const decisionNode = this.addNode({
      label: decision.reason ?? 'Decision',
      type: 'decision',
      decision,
      stepIndex: step.index,
      parentId,
      metadata: {
        confidence: decision.confidence,
        optionsCount: decision.options.length,
      },
    });

    // Create branch nodes for each option
    for (const option of decision.options) {
      const isChosen = option.id === decision.chosen.id;

      this.addNode({
        label: option.description,
        type: 'branch',
        parentId: decisionNode.id,
        metadata: {
          optionId: option.id,
          chosen: isChosen,
          score: option.score,
        },
      });
    }

    return decisionNode;
  }

  /**
   * Get label for a step
   */
  private getStepLabel(step: ExecutionStep): string {
    switch (step.type) {
      case 'input':
        return 'User Input';
      case 'prompt':
        return 'Send Prompt';
      case 'response':
        return 'LLM Response';
      case 'tool-call':
        return `Call: ${step.toolCall?.name}`;
      case 'tool-result':
        return `Result: ${step.toolCall?.success ? 'OK' : 'Failed'}`;
      case 'decision':
        return 'Decision';
      case 'error':
        return `Error: ${step.error?.name}`;
      default:
        return step.type;
    }
  }

  /**
   * Add a node
   */
  addNode(options: NodeOptions): DecisionTreeNode {
    const id = generateId('node');

    const node: DecisionTreeNode = {
      id,
      label: options.label,
      type: options.type,
      decision: options.decision,
      stepIndex: options.stepIndex,
      children: [],
      metadata: options.metadata,
    };

    this.nodes.set(id, node);

    // Add to parent's children
    if (options.parentId) {
      const parent = this.nodes.get(options.parentId);
      if (parent) {
        parent.children.push(id);
      }
    }

    // Set as root if no parent
    if (!options.parentId && !this.rootId) {
      this.rootId = id;
    }

    return node;
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): DecisionTreeNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get root node
   */
  getRoot(): DecisionTreeNode | undefined {
    return this.rootId ? this.nodes.get(this.rootId) : undefined;
  }

  /**
   * Get all nodes
   */
  getNodes(): DecisionTreeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get nodes at depth
   */
  getNodesAtDepth(depth: number): DecisionTreeNode[] {
    const result: DecisionTreeNode[] = [];

    const traverse = (nodeId: string, currentDepth: number) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;

      if (currentDepth === depth) {
        result.push(node);
      } else {
        for (const childId of node.children) {
          traverse(childId, currentDepth + 1);
        }
      }
    };

    if (this.rootId) {
      traverse(this.rootId, 0);
    }

    return result;
  }

  /**
   * Get tree depth
   */
  getDepth(): number {
    let maxDepth = 0;

    const traverse = (nodeId: string, depth: number) => {
      maxDepth = Math.max(maxDepth, depth);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const childId of node.children) {
          traverse(childId, depth + 1);
        }
      }
    };

    if (this.rootId) {
      traverse(this.rootId, 0);
    }

    return maxDepth;
  }

  /**
   * Find path to node
   */
  findPath(nodeId: string): DecisionTreeNode[] {
    const path: DecisionTreeNode[] = [];

    const findParent = (targetId: string): string | null => {
      for (const [id, node] of this.nodes) {
        if (node.children.includes(targetId)) {
          return id;
        }
      }
      return null;
    };

    let currentId: string | null = nodeId;
    while (currentId) {
      const node = this.nodes.get(currentId);
      if (node) {
        path.unshift(node);
      }
      currentId = findParent(currentId);
    }

    return path;
  }

  /**
   * Find nodes by step index
   */
  findByStepIndex(stepIndex: number): DecisionTreeNode[] {
    return this.getNodes().filter((n) => n.stepIndex === stepIndex);
  }

  /**
   * Find decision nodes
   */
  findDecisionNodes(): DecisionTreeNode[] {
    return this.getNodes().filter((n) => n.type === 'decision');
  }

  /**
   * Clear the tree
   */
  clear(): void {
    this.nodes.clear();
    this.rootId = undefined;
  }

  /**
   * Export tree structure
   */
  export(): DecisionTree {
    const root = this.getRoot();

    return {
      id: generateId('tree'),
      root: root ?? {
        id: 'empty',
        label: 'Empty Tree',
        type: 'action',
        children: [],
      },
      nodes: this.getNodes(),
      metadata: {
        nodeCount: this.nodes.size,
        depth: this.getDepth(),
        decisionCount: this.findDecisionNodes().length,
      },
    };
  }

  /**
   * Export to Mermaid format
   */
  toMermaid(): string {
    const lines: string[] = ['graph TD'];

    const traverse = (nodeId: string) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;

      const shape = this.getMermaidShape(node);
      lines.push(`    ${nodeId}${shape}`);

      for (const childId of node.children) {
        const child = this.nodes.get(childId);
        const edgeLabel = child?.metadata?.chosen ? ' --> |chosen|' : ' --> ';
        lines.push(`    ${nodeId}${edgeLabel}${childId}`);
        traverse(childId);
      }
    };

    if (this.rootId) {
      traverse(this.rootId);
    }

    return lines.join('\n');
  }

  /**
   * Get Mermaid shape for node
   */
  private getMermaidShape(node: DecisionTreeNode): string {
    const label = node.label.replace(/"/g, "'");

    switch (node.type) {
      case 'decision':
        return `{${label}}`;
      case 'outcome':
        return `((${label}))`;
      case 'branch':
        return `[/${label}/]`;
      default:
        return `[${label}]`;
    }
  }

  /**
   * Calculate layout positions
   */
  calculateLayout(): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();

    const levelWidths: number[] = [];
    const levelPositions: number[] = [];

    // Calculate width at each level
    const calculateLevelWidths = (nodeId: string, level: number) => {
      if (!levelWidths[level]) {
        levelWidths[level] = 0;
      }
      levelWidths[level]++;

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const childId of node.children) {
          calculateLevelWidths(childId, level + 1);
        }
      }
    };

    if (this.rootId) {
      calculateLevelWidths(this.rootId, 0);
    }

    // Initialize level positions
    for (let i = 0; i < levelWidths.length; i++) {
      levelPositions[i] = 0;
    }

    // Assign positions
    const assignPositions = (nodeId: string, level: number) => {
      const node = this.nodes.get(nodeId);
      if (!node) return;

      const levelWidth = levelWidths[level] * this.layoutOptions.nodeSpacing;
      const startX = -levelWidth / 2;
      const x = startX + levelPositions[level] * this.layoutOptions.nodeSpacing;
      const y = level * this.layoutOptions.levelSpacing;

      positions.set(nodeId, { x, y });
      levelPositions[level]++;

      for (const childId of node.children) {
        assignPositions(childId, level + 1);
      }
    };

    if (this.rootId) {
      assignPositions(this.rootId, 0);
    }

    return positions;
  }
}

/**
 * Create a decision tree builder
 */
export function createDecisionTreeBuilder(
  buildOptions?: TreeBuildOptions,
  layoutOptions?: LayoutOptions,
): DecisionTreeBuilder {
  return new DecisionTreeBuilder(buildOptions, layoutOptions);
}

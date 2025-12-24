/**
 * DAG Executor
 *
 * Executes workflow DAGs with dependency management and parallel execution.
 */

import { nanoid } from 'nanoid';
import type {
  DAG,
  DAGNode,
  DAGResult,
  DAGEvent,
  ValidationResult,
  WorkflowStepConfig,
  StepResult,
  WorkflowContext,
} from '../types';
import type { ExecutionContext } from '../core';
import type { StepHandler } from './WorkflowBuilder';

/**
 * DAG executor configuration
 */
export interface DAGExecutorConfig {
  /** Maximum parallel executions */
  maxParallel?: number;
  /** Default step timeout (ms) */
  defaultTimeout?: number;
  /** Retry failed steps */
  retryOnFailure?: boolean;
  /** Maximum retries per step */
  maxRetries?: number;
  /** Enable step caching */
  enableCaching?: boolean;
}

/**
 * Node execution state
 */
interface NodeState {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: StepResult;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  retries: number;
}

/**
 * DAG Executor
 *
 * Executes workflow DAGs with support for parallel execution,
 * dependency resolution, and error handling.
 */
export class DAGExecutor {
  private readonly dag: DAG;
  private readonly _handlers: Map<string, StepHandler>;
  private readonly config: Required<DAGExecutorConfig>;
  private readonly nodeStates: Map<string, NodeState> = new Map();
  private readonly cache: Map<string, StepResult> = new Map();
  private aborted: boolean = false;

  constructor(
    dag: DAG,
    handlers: Map<string, StepHandler>,
    config: DAGExecutorConfig = {},
  ) {
    this.dag = dag;
    this._handlers = handlers;
    this.config = {
      maxParallel: config.maxParallel ?? 5,
      defaultTimeout: config.defaultTimeout ?? 60000,
      retryOnFailure: config.retryOnFailure ?? true,
      maxRetries: config.maxRetries ?? 2,
      enableCaching: config.enableCaching ?? false,
    };

    // Initialize node states
    for (const node of dag.nodes) {
      this.nodeStates.set(node.id, {
        status: 'pending',
        retries: 0,
      });
    }
  }

  /**
   * Execute the DAG
   */
  async execute(context: ExecutionContext): Promise<DAGResult> {
    const startTime = Date.now();
    const events: DAGEvent[] = [];

    // Collect events from stream
    for await (const event of this.executeStream(context)) {
      events.push(event);
    }

    // Build result
    const results: Map<string, StepResult> = new Map();
    for (const [nodeId, state] of this.nodeStates) {
      if (state.result) {
        results.set(nodeId, state.result);
      }
    }

    const failedNodes = Array.from(this.nodeStates.entries())
      .filter(([, state]) => state.status === 'failed')
      .map(([id]) => id);

    return {
      success: failedNodes.length === 0 && !this.aborted,
      results,
      events,
      executionTimeMs: Date.now() - startTime,
      failedNodes: failedNodes.length > 0 ? failedNodes : undefined,
    };
  }

  /**
   * Execute the DAG with streaming events
   */
  async *executeStream(context: ExecutionContext): AsyncGenerator<DAGEvent> {
    this.aborted = false;

    // Emit start event
    yield {
      type: 'dag:start',
      dagId: this.dag.id,
      timestamp: new Date(),
    };

    // Execute until all nodes are done
    while (!this.isComplete()) {
      if (this.aborted) {
        yield {
          type: 'dag:aborted',
          dagId: this.dag.id,
          timestamp: new Date(),
        };
        break;
      }

      // Get ready nodes
      const readyNodes = this.getReadyNodes();

      if (readyNodes.length === 0) {
        // Check if we're stuck (deadlock)
        const pendingCount = this.getPendingCount();
        if (pendingCount > 0) {
          yield {
            type: 'dag:error',
            dagId: this.dag.id,
            error: 'Deadlock detected: no nodes ready but pending nodes exist',
            timestamp: new Date(),
          };
          break;
        }
        continue;
      }

      // Execute ready nodes in parallel (up to limit)
      const batch = readyNodes.slice(0, this.config.maxParallel);
      const promises: Array<
        Promise<{ nodeId: string; result: StepResult | null; error?: string }>
      > = [];

      for (const node of batch) {
        // Mark as running
        this.updateNodeState(node.id, {
          status: 'running',
          startTime: new Date(),
        });

        yield {
          type: 'node:start',
          dagId: this.dag.id,
          nodeId: node.id,
          nodeName: node.name,
          timestamp: new Date(),
        };

        // Execute node
        promises.push(this.executeNode(node, context));
      }

      // Wait for batch completion
      const results = await Promise.all(promises);

      // Process results
      for (const { nodeId, result, error } of results) {
        const node = this.dag.nodes.find((n) => n.id === nodeId)!;

        if (error) {
          const state = this.nodeStates.get(nodeId)!;

          if (
            this.config.retryOnFailure &&
            state.retries < this.config.maxRetries
          ) {
            // Retry
            this.updateNodeState(nodeId, {
              status: 'pending',
              retries: state.retries + 1,
            });

            yield {
              type: 'node:retry',
              dagId: this.dag.id,
              nodeId,
              nodeName: node.name,
              attempt: state.retries + 1,
              error,
              timestamp: new Date(),
            };
          } else {
            // Failed
            this.updateNodeState(nodeId, {
              status: 'failed',
              error,
              endTime: new Date(),
            });

            yield {
              type: 'node:error',
              dagId: this.dag.id,
              nodeId,
              nodeName: node.name,
              error,
              timestamp: new Date(),
            };

            // Skip dependent nodes
            for (const depId of this.getDependentNodes(nodeId)) {
              this.updateNodeState(depId, { status: 'skipped' });

              yield {
                type: 'node:skipped',
                dagId: this.dag.id,
                nodeId: depId,
                nodeName:
                  this.dag.nodes.find((n) => n.id === depId)?.name ?? '',
                reason: `Dependency ${node.name} failed`,
                timestamp: new Date(),
              };
            }
          }
        } else {
          // Success
          this.updateNodeState(nodeId, {
            status: 'completed',
            result: result!,
            endTime: new Date(),
          });

          // Cache result if enabled
          if (this.config.enableCaching) {
            this.cache.set(nodeId, result!);
          }

          yield {
            type: 'node:complete',
            dagId: this.dag.id,
            nodeId,
            nodeName: node.name,
            result: result!,
            timestamp: new Date(),
          };
        }
      }
    }

    // Emit complete event
    yield {
      type: 'dag:complete',
      dagId: this.dag.id,
      success: this.isSuccessful(),
      timestamp: new Date(),
    };
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: DAGNode,
    context: ExecutionContext,
  ): Promise<{ nodeId: string; result: StepResult | null; error?: string }> {
    // Check cache
    if (this.config.enableCaching && this.cache.has(node.id)) {
      return { nodeId: node.id, result: this.cache.get(node.id)! };
    }

    // Get handler
    const nodeName = node.name ?? node.id;
    const handler = this._handlers.get(nodeName);

    if (!handler) {
      return {
        nodeId: node.id,
        result: null,
        error: `No handler found for node: ${nodeName}`,
      };
    }

    // Build workflow context
    const workflowContext = this.buildWorkflowContext(node, context);

    // Execute with timeout
    const timeout =
      (node.stepConfig as WorkflowStepConfig)?.timeoutMs ??
      this.config.defaultTimeout;

    try {
      const result = await Promise.race([
        handler(workflowContext),
        this.createTimeout(timeout, nodeName),
      ]);

      return { nodeId: node.id, result };
    } catch (error) {
      return {
        nodeId: node.id,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build workflow context for a node
   */
  private buildWorkflowContext(
    node: DAGNode,
    context: ExecutionContext,
  ): WorkflowContext {
    const stepResults: Map<string, StepResult> = new Map();

    // Collect results from dependencies
    for (const depId of node.dependencies ?? []) {
      const state = this.nodeStates.get(depId);
      if (state?.result) {
        const depNode = this.dag.nodes.find((n) => n.id === depId);
        if (depNode) {
          const depNodeName = depNode.name ?? depNode.id;
          stepResults.set(depNodeName, state.result);
        }
      }
    }

    return {
      stepName: node.name ?? node.id,
      stepResults,
      variables: new Map(context.entries()),
      setVariable: (key: string, value: unknown) => context.set(key, value),
      getVariable: (key: string) => context.get(key),
      emit: (event: Record<string, unknown>) =>
        context.emit(event as { type: string } & Record<string, unknown>),
      isAborted: () => context.isAborted || this.aborted,
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number, stepName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step "${stepName}" timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Get nodes ready for execution
   */
  private getReadyNodes(): DAGNode[] {
    const ready: DAGNode[] = [];

    for (const node of this.dag.nodes) {
      const state = this.nodeStates.get(node.id);
      if (state?.status !== 'pending') continue;

      // Check if all dependencies are completed
      const depsCompleted = (node.dependencies ?? []).every((depId) => {
        const depState = this.nodeStates.get(depId);
        return depState?.status === 'completed';
      });

      if (depsCompleted) {
        ready.push(node);
      }
    }

    return ready;
  }

  /**
   * Get nodes that depend on a given node
   */
  private getDependentNodes(nodeId: string): string[] {
    const dependents: string[] = [];

    for (const node of this.dag.nodes) {
      if (node.dependencies?.includes(nodeId)) {
        dependents.push(node.id);
        // Recursively get dependents
        dependents.push(...this.getDependentNodes(node.id));
      }
    }

    return [...new Set(dependents)];
  }

  /**
   * Update node state
   */
  private updateNodeState(nodeId: string, update: Partial<NodeState>): void {
    const current = this.nodeStates.get(nodeId) ?? {
      status: 'pending',
      retries: 0,
    };
    this.nodeStates.set(nodeId, { ...current, ...update });
  }

  /**
   * Check if all nodes are done
   */
  private isComplete(): boolean {
    for (const state of this.nodeStates.values()) {
      if (state.status === 'pending' || state.status === 'running') {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if execution was successful
   */
  private isSuccessful(): boolean {
    for (const state of this.nodeStates.values()) {
      if (state.status === 'failed') {
        return false;
      }
    }
    return !this.aborted;
  }

  /**
   * Get count of pending nodes
   */
  private getPendingCount(): number {
    let count = 0;
    for (const state of this.nodeStates.values()) {
      if (state.status === 'pending') count++;
    }
    return count;
  }

  /**
   * Abort execution
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Validate the DAG
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty DAG
    if (this.dag.nodes.length === 0) {
      errors.push('DAG has no nodes');
    }

    // Check for missing dependencies
    const nodeIds = new Set(this.dag.nodes.map((n) => n.id));
    for (const node of this.dag.nodes) {
      const nodeName = node.name ?? node.id;
      for (const depId of node.dependencies ?? []) {
        if (!nodeIds.has(depId)) {
          errors.push(`Node "${nodeName}" has missing dependency: ${depId}`);
        }
      }
    }

    // Check for cycles
    const cycle = this.detectCycle();
    if (cycle) {
      errors.push(`Cycle detected: ${cycle.join(' -> ')}`);
    }

    // Check for missing handlers
    for (const node of this.dag.nodes) {
      const nodeName = node.name ?? node.id;
      if (!this._handlers.has(nodeName)) {
        warnings.push(`Node "${nodeName}" has no handler`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect cycles in the DAG
   */
  private detectCycle(): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = this.dag.nodes.find((n) => n.id === nodeId);
      if (node) {
        for (const depId of node.dependencies ?? []) {
          if (!visited.has(depId)) {
            if (dfs(depId)) return true;
          } else if (recursionStack.has(depId)) {
            path.push(depId);
            return true;
          }
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const node of this.dag.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          // Extract cycle from path
          const cycleStart = path.indexOf(path[path.length - 1]);
          return path
            .slice(cycleStart)
            .map((id) => this.dag.nodes.find((n) => n.id === id)?.name ?? id);
        }
      }
    }

    return null;
  }

  /**
   * Get execution state for all nodes
   */
  getState(): Map<string, NodeState> {
    return new Map(this.nodeStates);
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalNodes: number;
    completed: number;
    failed: number;
    skipped: number;
    pending: number;
    running: number;
  } {
    let completed = 0;
    let failed = 0;
    let skipped = 0;
    let pending = 0;
    let running = 0;

    for (const state of this.nodeStates.values()) {
      switch (state.status) {
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
        case 'skipped':
          skipped++;
          break;
        case 'pending':
          pending++;
          break;
        case 'running':
          running++;
          break;
      }
    }

    return {
      totalNodes: this.dag.nodes.length,
      completed,
      failed,
      skipped,
      pending,
      running,
    };
  }
}

/**
 * Create a DAG from workflow steps
 */
export function createDAGFromSteps(
  steps: WorkflowStepConfig[],
  _handlers: Map<string, StepHandler>,
): DAG {
  const nodes: DAGNode[] = [];
  const previousNodeIds: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const nodeId = nanoid();

    const node: DAGNode = {
      id: nodeId,
      name: step.name,
      stepConfig: step,
      dependencies: [...previousNodeIds], // Sequential by default
    };

    nodes.push(node);
    previousNodeIds.length = 0;
    previousNodeIds.push(nodeId);
  }

  return {
    id: nanoid(),
    nodes,
    edges: [],
  };
}

/**
 * Factory function
 */
export function createDAGExecutor(
  dag: DAG,
  handlers: Map<string, StepHandler>,
  config?: DAGExecutorConfig,
): DAGExecutor {
  return new DAGExecutor(dag, handlers, config);
}

export default DAGExecutor;

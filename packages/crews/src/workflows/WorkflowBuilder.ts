/**
 * Workflow Builder
 *
 * Fluent API for building multi-agent workflows.
 */

import { nanoid } from 'nanoid';
import type {
  WorkflowDefinition,
  WorkflowStepConfig,
  ParallelStepConfig,
  ConditionalStepConfig,
  LoopStepConfig,
  WorkflowContext,
  StepResult,
} from '../types';

/**
 * Step handler function
 */
export type StepHandler = (context: WorkflowContext) => Promise<StepResult>;

/**
 * Condition function
 */
export type ConditionFn = (
  context: WorkflowContext,
) => boolean | Promise<boolean>;

/**
 * Step definition for builder
 */
interface StepDefinition {
  type: 'step' | 'parallel' | 'conditional' | 'loop' | 'checkpoint';
  config:
    | WorkflowStepConfig
    | ParallelStepConfig
    | ConditionalStepConfig
    | LoopStepConfig;
  handler?: StepHandler;
  children?: StepDefinition[];
}

/**
 * Branch builder for conditional flows
 */
export class BranchBuilder {
  private readonly parent: WorkflowBuilder;
  private readonly condition: ConditionFn;
  private thenSteps: StepDefinition[] = [];
  private elseSteps: StepDefinition[] = [];

  constructor(parent: WorkflowBuilder, condition: ConditionFn) {
    this.parent = parent;
    this.condition = condition;
  }

  /**
   * Add steps for true branch
   */
  then(builder: (b: WorkflowBuilder) => WorkflowBuilder): BranchBuilder {
    const subBuilder = new WorkflowBuilder(`then-${nanoid(6)}`);
    builder(subBuilder);
    this.thenSteps = subBuilder.getSteps();
    return this;
  }

  /**
   * Add steps for false branch
   */
  otherwise(builder: (b: WorkflowBuilder) => WorkflowBuilder): BranchBuilder {
    const subBuilder = new WorkflowBuilder(`else-${nanoid(6)}`);
    builder(subBuilder);
    this.elseSteps = subBuilder.getSteps();
    return this;
  }

  /**
   * Complete the branch and return to parent builder
   */
  endBranch(): WorkflowBuilder {
    const conditionalConfig: ConditionalStepConfig = {
      name: `conditional-${nanoid(6)}`,
      condition: this.condition,
      thenSteps: this.thenSteps.map((s) => s.config as WorkflowStepConfig),
      elseSteps:
        this.elseSteps.length > 0
          ? this.elseSteps.map((s) => s.config as WorkflowStepConfig)
          : undefined,
    };

    this.parent.addConditional(
      conditionalConfig,
      this.thenSteps,
      this.elseSteps,
    );
    return this.parent;
  }
}

/**
 * Loop builder
 */
export class LoopBuilder {
  private readonly parent: WorkflowBuilder;
  private readonly condition: ConditionFn;
  private bodySteps: StepDefinition[] = [];
  private maxIter: number = 100;

  constructor(parent: WorkflowBuilder, condition: ConditionFn) {
    this.parent = parent;
    this.condition = condition;
  }

  /**
   * Set loop body
   */
  do(builder: (b: WorkflowBuilder) => WorkflowBuilder): LoopBuilder {
    const subBuilder = new WorkflowBuilder(`loop-body-${nanoid(6)}`);
    builder(subBuilder);
    this.bodySteps = subBuilder.getSteps();
    return this;
  }

  /**
   * Set maximum iterations
   */
  maxIterations(max: number): LoopBuilder {
    this.maxIter = max;
    return this;
  }

  /**
   * Complete the loop and return to parent builder
   */
  endLoop(): WorkflowBuilder {
    const loopConfig: LoopStepConfig = {
      name: `loop-${nanoid(6)}`,
      condition: this.condition,
      maxIterations: this.maxIter,
      bodySteps: this.bodySteps.map((s) => s.config as WorkflowStepConfig),
    };

    this.parent.addLoop(loopConfig, this.bodySteps);
    return this.parent;
  }
}

/**
 * Workflow Builder
 *
 * Fluent API for constructing workflow definitions.
 */
export class WorkflowBuilder {
  private readonly name: string;
  private description?: string;
  private readonly steps: StepDefinition[] = [];
  private readonly stepHandlers: Map<string, StepHandler> = new Map();
  private checkpointEnabled: boolean = false;
  private checkpointInterval: number | 'after-step' = 'after-step';

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Set workflow description
   */
  describe(description: string): WorkflowBuilder {
    this.description = description;
    return this;
  }

  /**
   * Add a sequential step
   */
  addStep(
    name: string,
    handler: StepHandler,
    options: Partial<WorkflowStepConfig> = {},
  ): WorkflowBuilder {
    const stepConfig: WorkflowStepConfig = {
      name,
      type: 'task',
      ...options,
    };

    this.steps.push({
      type: 'step',
      config: stepConfig,
      handler,
    });

    this.stepHandlers.set(name, handler);
    return this;
  }

  /**
   * Add parallel steps
   */
  parallel(
    ...steps: Array<{ name: string; handler: StepHandler }>
  ): WorkflowBuilder {
    const parallelConfig: ParallelStepConfig = {
      name: `parallel-${nanoid(6)}`,
      steps: steps.map((s) => ({
        name: s.name,
        type: 'task' as const,
      })),
      waitFor: 'all',
    };

    const children: StepDefinition[] = steps.map((s) => ({
      type: 'step' as const,
      config: { name: s.name, type: 'task' as const },
      handler: s.handler,
    }));

    // Register handlers
    for (const step of steps) {
      this.stepHandlers.set(step.name, step.handler);
    }

    this.steps.push({
      type: 'parallel',
      config: parallelConfig,
      children,
    });

    return this;
  }

  /**
   * Add sequential steps
   */
  sequential(
    ...steps: Array<{ name: string; handler: StepHandler }>
  ): WorkflowBuilder {
    for (const step of steps) {
      this.addStep(step.name, step.handler);
    }
    return this;
  }

  /**
   * Add conditional branch
   */
  when(condition: ConditionFn): BranchBuilder {
    return new BranchBuilder(this, condition);
  }

  /**
   * Add a loop
   */
  while(condition: ConditionFn): LoopBuilder {
    return new LoopBuilder(this, condition);
  }

  /**
   * Add a checkpoint
   */
  checkpoint(name: string): WorkflowBuilder {
    this.steps.push({
      type: 'checkpoint',
      config: {
        name,
        type: 'checkpoint',
      } as WorkflowStepConfig,
    });
    return this;
  }

  /**
   * Enable automatic checkpointing
   */
  enableCheckpoints(
    interval: number | 'after-step' = 'after-step',
  ): WorkflowBuilder {
    this.checkpointEnabled = true;
    this.checkpointInterval = interval;
    return this;
  }

  /**
   * Add a task step with agent assignment
   */
  task(
    name: string,
    description: string,
    options: {
      agent?: string;
      requiredCapabilities?: string[];
      timeout?: number;
    } = {},
  ): WorkflowBuilder {
    const stepConfig: WorkflowStepConfig = {
      name,
      type: 'task',
      agentName: options.agent,
      taskConfig: {
        description,
        expectedOutput: `Result of ${name}`,
        requiredCapabilities: options.requiredCapabilities,
      },
      timeoutMs: options.timeout,
    };

    this.steps.push({
      type: 'step',
      config: stepConfig,
    });

    return this;
  }

  /**
   * Add a crew step (delegate to entire crew)
   */
  crew(
    name: string,
    description: string,
    options: {
      tasks?: Array<{ description: string; expectedOutput: string }>;
      timeout?: number;
    } = {},
  ): WorkflowBuilder {
    const stepConfig: WorkflowStepConfig = {
      name,
      type: 'crew',
      taskConfig: {
        description,
        expectedOutput: `Result of crew: ${name}`,
      },
      timeoutMs: options.timeout,
    };

    this.steps.push({
      type: 'step',
      config: stepConfig,
    });

    return this;
  }

  /**
   * Internal: add conditional step
   */
  addConditional(
    config: ConditionalStepConfig,
    thenSteps: StepDefinition[],
    elseSteps: StepDefinition[],
  ): void {
    this.steps.push({
      type: 'conditional',
      config,
      children: [...thenSteps, ...elseSteps],
    });

    // Register child handlers
    for (const step of [...thenSteps, ...elseSteps]) {
      if (step.handler) {
        this.stepHandlers.set(
          (step.config as WorkflowStepConfig).name,
          step.handler,
        );
      }
    }
  }

  /**
   * Internal: add loop step
   */
  addLoop(config: LoopStepConfig, bodySteps: StepDefinition[]): void {
    this.steps.push({
      type: 'loop',
      config,
      children: bodySteps,
    });

    // Register child handlers
    for (const step of bodySteps) {
      if (step.handler) {
        this.stepHandlers.set(
          (step.config as WorkflowStepConfig).name,
          step.handler,
        );
      }
    }
  }

  /**
   * Internal: get steps for sub-builders
   */
  getSteps(): StepDefinition[] {
    return [...this.steps];
  }

  /**
   * Build the workflow definition
   */
  build(): WorkflowDefinition {
    return {
      id: nanoid(),
      name: this.name,
      description: this.description,
      steps: this.steps.map((s) => s.config as WorkflowStepConfig),
      handlers: this.stepHandlers,
      checkpointing: this.checkpointEnabled
        ? { enabled: true, interval: this.checkpointInterval }
        : undefined,
    };
  }

  /**
   * Get a step handler by name
   */
  getHandler(stepName: string): StepHandler | undefined {
    return this.stepHandlers.get(stepName);
  }

  /**
   * Validate the workflow
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.steps.length === 0) {
      errors.push('Workflow has no steps');
    }

    // Check for duplicate step names
    const names = new Set<string>();
    for (const step of this.steps) {
      const name = (step.config as WorkflowStepConfig).name;
      if (names.has(name)) {
        errors.push(`Duplicate step name: ${name}`);
      }
      names.add(name);
    }

    // Check for missing handlers
    for (const step of this.steps) {
      if (step.type === 'step') {
        const name = (step.config as WorkflowStepConfig).name;
        if (
          !this.stepHandlers.has(name) &&
          !(step.config as WorkflowStepConfig).agentName
        ) {
          errors.push(`Step "${name}" has no handler and no assigned agent`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Factory function
 */
export function workflow(name: string): WorkflowBuilder {
  return new WorkflowBuilder(name);
}

export default WorkflowBuilder;

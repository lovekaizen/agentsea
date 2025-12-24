/**
 * WhatIfEngine
 *
 * What-if scenario testing engine for exploring alternative execution paths.
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Recording,
  ExecutionStep,
  WhatIfScenario,
  ScenarioResult,
  ScenarioComparison,
  ReplayModification,
} from '../types/index.js';
import { ReplayEngine } from '../replay/ReplayEngine.js';
import { StateRestorer } from '../replay/StateRestorer.js';
import { generateId, now, deepClone } from '../utils/helpers.js';

/**
 * What-if engine events
 */
export interface WhatIfEngineEvents {
  'scenario:created': (scenario: WhatIfScenario) => void;
  'scenario:started': (scenarioId: string) => void;
  'scenario:completed': (result: ScenarioResult) => void;
  'scenario:failed': (scenarioId: string, error: Error) => void;
  'comparison:completed': (comparison: ScenarioComparison) => void;
  error: (error: Error) => void;
}

/**
 * Scenario creation options
 */
export interface ScenarioOptions {
  /** Scenario name */
  name: string;
  /** Description */
  description?: string;
  /** Base recording to modify */
  recordingId: string;
  /** Modifications to apply */
  modifications: ReplayModification[];
  /** Whether to execute tools */
  executeTools?: boolean;
  /** Whether to call LLM */
  executeLLM?: boolean;
  /** Tool execution callback */
  onToolCall?: (step: ExecutionStep) => Promise<unknown>;
  /** LLM call callback */
  onLLMCall?: (step: ExecutionStep) => Promise<string>;
}

/**
 * Batch scenario options
 */
export interface BatchScenarioOptions {
  /** Base recording */
  recordingId: string;
  /** Parameter variations to test */
  variations: Array<{
    name: string;
    modifications: ReplayModification[];
  }>;
  /** Whether to run in parallel */
  parallel?: boolean;
}

/**
 * WhatIfEngine
 *
 * Explores alternative execution paths by modifying and replaying recordings.
 *
 * @example
 * ```typescript
 * const engine = new WhatIfEngine();
 *
 * // Create a what-if scenario
 * const scenario = engine.createScenario({
 *   name: 'Different API response',
 *   recordingId: 'rec_123',
 *   modifications: [
 *     { stepIndex: 5, type: 'modify', data: { output: 'alternative response' } }
 *   ],
 * });
 *
 * // Run the scenario
 * const result = await engine.runScenario(scenario.id, recording);
 *
 * // Compare with original
 * const comparison = engine.compare(recording, result);
 * ```
 */
export class WhatIfEngine extends EventEmitter<WhatIfEngineEvents> {
  private scenarios: Map<string, WhatIfScenario> = new Map();
  private results: Map<string, ScenarioResult> = new Map();
  private replayEngine: ReplayEngine;
  private stateRestorer: StateRestorer;

  constructor() {
    super();
    this.replayEngine = new ReplayEngine();
    this.stateRestorer = new StateRestorer();
  }

  /**
   * Create a what-if scenario
   */
  createScenario(options: ScenarioOptions): WhatIfScenario {
    const scenario: WhatIfScenario = {
      id: generateId('whatif'),
      name: options.name,
      description: options.description,
      baseRecordingId: options.recordingId,
      modifications: options.modifications,
      createdAt: now(),
      status: 'pending',
    };

    this.scenarios.set(scenario.id, scenario);
    this.emit('scenario:created', scenario);

    return scenario;
  }

  /**
   * Run a scenario
   */
  async runScenario(
    scenarioId: string,
    recording: Recording,
    options?: {
      executeTools?: boolean;
      executeLLM?: boolean;
      onToolCall?: (step: ExecutionStep) => Promise<unknown>;
      onLLMCall?: (step: ExecutionStep) => Promise<string>;
    },
  ): Promise<ScenarioResult> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    scenario.status = 'running';
    this.emit('scenario:started', scenarioId);

    try {
      // Run replay with modifications
      this.replayEngine.start(recording, {
        modifications: scenario.modifications,
        executeTools: options?.executeTools,
        executeLLM: options?.executeLLM,
        onToolCall: options?.onToolCall,
        onLLMCall: options?.onLLMCall,
      });

      // Wait for completion
      await this.waitForReplayCompletion();

      // Get differences from original
      const replaySession = this.replayEngine.getSession();
      const differences = replaySession?.differences ?? [];

      // Build result
      const result: ScenarioResult = {
        scenarioId,
        success: true,
        originalRecordingId: recording.id,
        modifiedSteps: scenario.modifications.length,
        differences,
        divergencePoint:
          differences.length > 0 ? differences[0].stepIndex : undefined,
        finalState: replaySession
          ? deepClone(recording.finalState ?? recording.initialState)
          : (recording.finalState ?? recording.initialState),
        executedAt: now(),
        durationMs: now() - scenario.createdAt,
      };

      scenario.status = 'completed';
      this.results.set(scenarioId, result);
      this.emit('scenario:completed', result);

      return result;
    } catch (error) {
      scenario.status = 'failed';
      this.emit('scenario:failed', scenarioId, error as Error);
      throw error;
    }
  }

  /**
   * Wait for replay to complete
   */
  private waitForReplayCompletion(): Promise<void> {
    return new Promise<void>((resolve) => {
      const handler = () => {
        this.replayEngine.off('replay:completed', handler);
        this.replayEngine.off('replay:stopped', handler);
        resolve();
      };

      this.replayEngine.on('replay:completed', handler);
      this.replayEngine.on('replay:stopped', handler);
    });
  }

  /**
   * Run multiple scenarios in batch
   */
  async runBatch(
    options: BatchScenarioOptions,
    recording: Recording,
  ): Promise<ScenarioResult[]> {
    const scenarios = options.variations.map((v) =>
      this.createScenario({
        name: v.name,
        recordingId: options.recordingId,
        modifications: v.modifications,
      }),
    );

    if (options.parallel) {
      return Promise.all(
        scenarios.map((s) => this.runScenario(s.id, recording)),
      );
    } else {
      const results: ScenarioResult[] = [];
      for (const scenario of scenarios) {
        const result = await this.runScenario(scenario.id, recording);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Compare original recording with scenario result
   */
  compare(original: Recording, result: ScenarioResult): ScenarioComparison {
    const scenario = this.scenarios.get(result.scenarioId);

    // Calculate outcome difference
    const outcomeChanged =
      original.status !== (result.success ? 'completed' : 'failed');

    // Calculate divergence metrics
    const totalSteps = original.steps.length;
    const divergenceStep = result.divergencePoint ?? totalSteps;
    const divergencePercentage =
      ((totalSteps - divergenceStep) / totalSteps) * 100;

    return {
      scenarioId: result.scenarioId,
      scenarioName: scenario?.name ?? 'Unknown',
      originalRecordingId: original.id,
      outcomeChanged,
      divergencePoint: result.divergencePoint,
      divergencePercentage,
      differences: result.differences,
      summary: this.generateComparisonSummary(original, result),
    };
  }

  /**
   * Generate a summary of the comparison
   */
  private generateComparisonSummary(
    original: Recording,
    result: ScenarioResult,
  ): string {
    const lines: string[] = [];

    if (result.divergencePoint !== undefined) {
      lines.push(`Diverged at step ${result.divergencePoint}`);
    } else {
      lines.push('No divergence detected');
    }

    lines.push(`${result.modifiedSteps} step(s) modified`);
    lines.push(`${result.differences.length} difference(s) detected`);

    return lines.join('. ');
  }

  /**
   * Create scenario from a decision point
   */
  createFromDecision(
    recording: Recording,
    stepIndex: number,
    alternativeChoice: string,
  ): WhatIfScenario {
    const step = recording.steps[stepIndex];

    if (step.type !== 'decision' || !step.decision) {
      throw new Error('Step is not a decision point');
    }

    const alternative = step.decision.options.find(
      (o) => o.id === alternativeChoice || o.description === alternativeChoice,
    );

    if (!alternative) {
      throw new Error('Alternative choice not found in decision options');
    }

    return this.createScenario({
      name: `What if: ${alternative.description}`,
      description: `Explore alternative decision at step ${stepIndex}`,
      recordingId: recording.id,
      modifications: [
        {
          stepIndex,
          type: 'modify',
          data: {
            decision: {
              ...step.decision,
              chosen: alternative,
            },
          },
        },
      ],
    });
  }

  /**
   * Create scenario from a tool result change
   */
  createFromToolResult(
    recording: Recording,
    stepIndex: number,
    alternativeResult: unknown,
  ): WhatIfScenario {
    const step = recording.steps[stepIndex];

    if (step.type !== 'tool-result' || !step.toolCall) {
      throw new Error('Step is not a tool result');
    }

    return this.createScenario({
      name: `What if: ${step.toolCall.name} returned different result`,
      description: `Explore alternative tool result at step ${stepIndex}`,
      recordingId: recording.id,
      modifications: [
        {
          stepIndex,
          type: 'modify',
          data: {
            toolCall: {
              ...step.toolCall,
              result: alternativeResult,
            },
          },
        },
      ],
    });
  }

  /**
   * Create scenario from skipping steps
   */
  createFromSkip(
    recording: Recording,
    stepIndices: number[],
    name?: string,
  ): WhatIfScenario {
    return this.createScenario({
      name: name ?? `What if: Skip steps ${stepIndices.join(', ')}`,
      description: `Skip specific steps in the execution`,
      recordingId: recording.id,
      modifications: stepIndices.map((stepIndex) => ({
        stepIndex,
        type: 'skip' as const,
      })),
    });
  }

  /**
   * Get a scenario by ID
   */
  getScenario(id: string): WhatIfScenario | undefined {
    return this.scenarios.get(id);
  }

  /**
   * Get all scenarios
   */
  getScenarios(): WhatIfScenario[] {
    return Array.from(this.scenarios.values());
  }

  /**
   * Get scenarios for a recording
   */
  getScenariosForRecording(recordingId: string): WhatIfScenario[] {
    return this.getScenarios().filter((s) => s.baseRecordingId === recordingId);
  }

  /**
   * Get a result by scenario ID
   */
  getResult(scenarioId: string): ScenarioResult | undefined {
    return this.results.get(scenarioId);
  }

  /**
   * Get all results
   */
  getResults(): ScenarioResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Delete a scenario
   */
  deleteScenario(id: string): boolean {
    this.results.delete(id);
    return this.scenarios.delete(id);
  }

  /**
   * Clear all scenarios
   */
  clear(): void {
    this.scenarios.clear();
    this.results.clear();
  }
}

/**
 * Create a what-if engine
 */
export function createWhatIfEngine(): WhatIfEngine {
  return new WhatIfEngine();
}

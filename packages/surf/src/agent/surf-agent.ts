/**
 * Surf Agent - Main agent class for computer automation
 */

import { AgentContext } from '@lov3kaizen/agentsea-core';

import {
  SurfConfig,
  SurfState,
  DesktopBackend,
  StreamEvent,
  ActionResult,
  SuggestedAction,
  DEFAULT_SURF_CONFIG,
  ModifierKey,
} from '../types';
import { VisionAnalyzer } from './vision-analyzer';
import { CoordinateScaler } from './coordinate-scaler';
import { SecurityValidator } from '../utils/security-validator';

/**
 * Surf Agent - Automates desktop tasks using vision and actions
 */
export class SurfAgent {
  private sessionId: string;
  private backend: DesktopBackend;
  private config: SurfConfig;
  private visionAnalyzer: VisionAnalyzer;
  private coordinateScaler: CoordinateScaler;
  private securityValidator: SecurityValidator;
  private state: SurfState;
  private stopRequested = false;

  constructor(
    sessionId: string,
    backend: DesktopBackend,
    config: Partial<SurfConfig> = {},
  ) {
    this.sessionId = sessionId;
    this.backend = backend;
    this.config = { ...DEFAULT_SURF_CONFIG, ...config };
    this.visionAnalyzer = new VisionAnalyzer(this.config.vision);
    this.coordinateScaler = CoordinateScaler.createAuto();
    this.securityValidator = new SecurityValidator(this.config.sandbox);

    this.state = {
      currentStep: 0,
      maxSteps: this.config.maxSteps,
      actionHistory: [],
      status: 'idle',
    };
  }

  /**
   * Execute a task and return the final result
   */
  async execute(
    task: string,
    _context?: Partial<AgentContext>,
  ): Promise<{ state: SurfState; response: string }> {
    this.state = {
      currentStep: 0,
      maxSteps: this.config.maxSteps,
      actionHistory: [],
      status: 'running',
      startTime: new Date(),
    };
    this.stopRequested = false;

    let response = '';

    try {
      // Initialize coordinate scaler with actual screen dimensions
      const dimensions = await this.backend.getScreenDimensions();
      this.coordinateScaler.setSourceResolution(dimensions);
      if (this.config.targetResolution) {
        this.coordinateScaler.setTargetResolution(this.config.targetResolution);
      }

      // Main action loop
      while (
        this.state.currentStep < this.state.maxSteps &&
        !this.stopRequested
      ) {
        this.state.currentStep++;

        // Take screenshot
        const screenshot = await this.backend.screenshot();
        this.state.lastScreenshot = screenshot;

        // Wait for any UI updates
        await this.backend.wait(this.config.screenshotDelay);

        // Get previous actions as strings
        const previousActions = this.state.actionHistory.map(
          (h) => `${h.action}: ${JSON.stringify(h.params)}`,
        );

        // Get next action from vision analyzer
        const nextAction = await this.visionAnalyzer.getNextAction(
          screenshot,
          task,
          previousActions,
          `Step ${this.state.currentStep} of ${this.state.maxSteps}`,
        );

        // Check if task is complete
        if (!nextAction) {
          this.state.status = 'completed';
          response = 'Task completed successfully';
          break;
        }

        // Validate action against security rules
        const validation = this.securityValidator.validateAction(
          nextAction.action,
          nextAction.params,
        );

        if (!validation.allowed) {
          this.state.actionHistory.push({
            step: this.state.currentStep,
            action: nextAction.action,
            params: nextAction.params,
            success: false,
            duration: 0,
            error: `Blocked by security: ${validation.reason}`,
            timestamp: new Date(),
          });
          continue;
        }

        // Execute the action
        const result = await this.executeAction(nextAction);

        // Record in history
        this.state.actionHistory.push({
          step: this.state.currentStep,
          action: nextAction.action,
          params: nextAction.params,
          success: result.success,
          duration: result.duration,
          error: result.error,
          timestamp: result.timestamp,
        });

        // If action failed, we might want to retry or adjust
        if (!result.success) {
          // Continue to next iteration - vision will see the current state
          continue;
        }
      }

      if (this.state.status !== 'completed') {
        if (this.stopRequested) {
          this.state.status = 'paused';
          response = 'Task was stopped by user';
        } else {
          this.state.status = 'completed';
          response = `Task completed after ${this.state.currentStep} steps`;
        }
      }
    } catch (error) {
      this.state.status = 'error';
      this.state.error =
        error instanceof Error ? error.message : 'Unknown error';
      response = `Task failed: ${this.state.error}`;
    }

    this.state.endTime = new Date();
    return { state: this.state, response };
  }

  /**
   * Execute a task with streaming updates
   */
  async *executeStream(
    task: string,
    _context?: Partial<AgentContext>,
  ): AsyncGenerator<StreamEvent> {
    this.state = {
      currentStep: 0,
      maxSteps: this.config.maxSteps,
      actionHistory: [],
      status: 'running',
      startTime: new Date(),
    };
    this.stopRequested = false;

    try {
      // Initialize coordinate scaler
      const dimensions = await this.backend.getScreenDimensions();
      this.coordinateScaler.setSourceResolution(dimensions);

      while (
        this.state.currentStep < this.state.maxSteps &&
        !this.stopRequested
      ) {
        this.state.currentStep++;

        // Take screenshot
        const screenshot = await this.backend.screenshot();
        this.state.lastScreenshot = screenshot;

        yield {
          type: 'screenshot',
          step: this.state.currentStep,
          timestamp: new Date(),
          screenshot,
        };

        await this.backend.wait(this.config.screenshotDelay);

        // Analyze screen
        const previousActions = this.state.actionHistory.map(
          (h) => `${h.action}: ${JSON.stringify(h.params)}`,
        );

        const analysis = await this.visionAnalyzer.analyzeScreen(
          screenshot,
          task,
          previousActions,
        );

        yield {
          type: 'analysis',
          step: this.state.currentStep,
          timestamp: new Date(),
          analysis,
        };

        // Get next action
        const nextAction = await this.visionAnalyzer.getNextAction(
          screenshot,
          task,
          previousActions,
          analysis.currentState,
        );

        if (!nextAction) {
          this.state.status = 'completed';
          break;
        }

        yield {
          type: 'action',
          step: this.state.currentStep,
          timestamp: new Date(),
          action: nextAction,
        };

        // Validate and execute
        const validation = this.securityValidator.validateAction(
          nextAction.action,
          nextAction.params,
        );

        let result: ActionResult;
        if (!validation.allowed) {
          result = {
            success: false,
            action: nextAction.action,
            timestamp: new Date(),
            duration: 0,
            error: `Blocked: ${validation.reason}`,
          };
        } else {
          result = await this.executeAction(nextAction);
        }

        yield {
          type: 'action_result',
          step: this.state.currentStep,
          timestamp: new Date(),
          result,
        };

        this.state.actionHistory.push({
          step: this.state.currentStep,
          action: nextAction.action,
          params: nextAction.params,
          success: result.success,
          duration: result.duration,
          error: result.error,
          timestamp: result.timestamp,
        });
      }

      this.state.status = this.stopRequested ? 'paused' : 'completed';
      this.state.endTime = new Date();

      yield {
        type: 'complete',
        step: this.state.currentStep,
        timestamp: new Date(),
        response: `Task ${this.state.status} after ${this.state.currentStep} steps`,
        state: this.state,
      };
    } catch (error) {
      this.state.status = 'error';
      this.state.error =
        error instanceof Error ? error.message : 'Unknown error';
      this.state.endTime = new Date();

      yield {
        type: 'error',
        step: this.state.currentStep,
        timestamp: new Date(),
        error: this.state.error,
      };
    }
  }

  /**
   * Stop the current execution
   */
  stop(): void {
    this.stopRequested = true;
  }

  /**
   * Get the current state
   */
  getState(): SurfState {
    return { ...this.state };
  }

  /**
   * Get the session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: SuggestedAction): Promise<ActionResult> {
    const params = action.params;

    // Scale coordinates if needed
    const scalePoint = (x: number, y: number) => {
      if (this.config.scalingMode === 'native') {
        return { x, y };
      }
      return this.coordinateScaler.scalePoint({ x, y });
    };

    try {
      switch (action.action) {
        case 'click': {
          const point = scalePoint(params.x as number, params.y as number);
          return await this.backend.click(point, {
            button: params.button as 'left' | 'right' | 'middle' | undefined,
            modifiers: params.modifiers as ModifierKey[] | undefined,
          });
        }

        case 'doubleClick': {
          const point = scalePoint(params.x as number, params.y as number);
          return await this.backend.doubleClick(point, {
            button: params.button as 'left' | 'right' | 'middle' | undefined,
          });
        }

        case 'type': {
          const options: Record<string, unknown> = {
            delayMs: params.delayMs,
            clearFirst: params.clearFirst,
          };
          if (params.x !== undefined && params.y !== undefined) {
            options.point = scalePoint(params.x as number, params.y as number);
          }
          return await this.backend.typeText(params.text as string, options);
        }

        case 'scroll': {
          const point = scalePoint(params.x as number, params.y as number);
          return await this.backend.scroll(
            params.direction as 'up' | 'down' | 'left' | 'right',
            point,
            {
              amount: params.amount as number | undefined,
              smooth: params.smooth as boolean | undefined,
            },
          );
        }

        case 'drag': {
          const from = scalePoint(
            params.fromX as number,
            params.fromY as number,
          );
          const to = scalePoint(params.toX as number, params.toY as number);
          return await this.backend.drag(from, to, {
            button: params.button as 'left' | 'right' | 'middle' | undefined,
            durationMs: params.durationMs as number | undefined,
          });
        }

        case 'keyPress': {
          return await this.backend.keyPress(
            params.key as string,
            params.modifiers as ModifierKey[] | undefined,
          );
        }

        case 'moveCursor': {
          const point = scalePoint(params.x as number, params.y as number);
          return await this.backend.moveCursor(point);
        }

        case 'wait': {
          return await this.backend.wait(params.ms as number);
        }

        default:
          return {
            success: false,
            action: action.action,
            timestamp: new Date(),
            duration: 0,
            error: `Unknown action: ${String(action.action)}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        action: action.action,
        timestamp: new Date(),
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

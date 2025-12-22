/**
 * NestJS Surf Service
 */

import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { AgentContext } from '@lov3kaizen/agentsea-core';

import {
  SurfConfig,
  SurfState,
  DesktopBackend,
  ActionResult,
  ScreenshotResult,
  StreamEvent,
  ModifierKey,
} from '../types';
import { SurfAgent } from '../agent';

/**
 * NestJS service for Surf computer-use functionality
 */
@Injectable()
export class SurfService implements OnModuleDestroy {
  private agents: Map<string, SurfAgent> = new Map();

  constructor(
    @Inject('DESKTOP_BACKEND') private readonly backend: DesktopBackend,
    @Inject('SURF_CONFIG') private readonly config: SurfConfig,
  ) {}

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    // Stop all running agents
    for (const agent of this.agents.values()) {
      agent.stop();
    }
    this.agents.clear();

    // Disconnect backend
    if (this.backend.isConnected) {
      await this.backend.disconnect();
    }
  }

  /**
   * Create a new Surf agent session
   */
  createAgent(
    sessionId: string,
    customConfig?: Partial<SurfConfig>,
  ): SurfAgent {
    const mergedConfig = { ...this.config, ...customConfig };
    const agent = new SurfAgent(sessionId, this.backend, mergedConfig);
    this.agents.set(sessionId, agent);
    return agent;
  }

  /**
   * Get an existing agent session
   */
  getAgent(sessionId: string): SurfAgent | undefined {
    return this.agents.get(sessionId);
  }

  /**
   * Check if an agent session exists
   */
  hasAgent(sessionId: string): boolean {
    return this.agents.has(sessionId);
  }

  /**
   * Execute a task with the Surf agent
   */
  async executeTask(
    sessionId: string,
    task: string,
    context?: Partial<AgentContext>,
  ): Promise<{ state: SurfState; response: string }> {
    let agent = this.agents.get(sessionId);
    if (!agent) {
      agent = this.createAgent(sessionId);
    }
    return agent.execute(task, context);
  }

  /**
   * Execute a task with streaming updates
   */
  async *executeTaskStream(
    sessionId: string,
    task: string,
    context?: Partial<AgentContext>,
  ): AsyncGenerator<StreamEvent> {
    let agent = this.agents.get(sessionId);
    if (!agent) {
      agent = this.createAgent(sessionId);
    }
    yield* agent.executeStream(task, context);
  }

  /**
   * Execute a single action directly (bypasses agent loop)
   */
  async executeAction(
    action: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    try {
      switch (action) {
        case 'screenshot': {
          const screenshot = await this.backend.screenshot(params);
          return {
            success: true,
            action: 'screenshot',
            timestamp: new Date(),
            duration: Date.now() - startTime,
            screenshot,
          };
        }

        case 'click':
          return this.backend.click(
            { x: params.x as number, y: params.y as number },
            params,
          );

        case 'doubleClick':
          return this.backend.doubleClick(
            { x: params.x as number, y: params.y as number },
            params,
          );

        case 'type':
          return this.backend.typeText(params.text as string, params);

        case 'scroll':
          return this.backend.scroll(
            params.direction as 'up' | 'down' | 'left' | 'right',
            { x: params.x as number, y: params.y as number },
            params,
          );

        case 'drag':
          return this.backend.drag(
            { x: params.fromX as number, y: params.fromY as number },
            { x: params.toX as number, y: params.toY as number },
            params,
          );

        case 'keyPress':
          return this.backend.keyPress(
            params.key as string,
            params.modifiers as ModifierKey[] | undefined,
          );

        case 'moveCursor':
          return this.backend.moveCursor({
            x: params.x as number,
            y: params.y as number,
          });

        case 'wait':
          return this.backend.wait(params.ms as number);

        default:
          return {
            success: false,
            action,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            error: `Unknown action: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        action,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current screen state
   */
  async getScreenState(): Promise<{
    screenshot: ScreenshotResult;
    dimensions: { width: number; height: number; scaleFactor: number };
  }> {
    const screenshot = await this.backend.screenshot();
    const dimensions = await this.backend.getScreenDimensions();
    return { screenshot, dimensions };
  }

  /**
   * Take a screenshot
   */
  async screenshot(options?: {
    region?: { x: number; y: number; width: number; height: number };
    format?: 'png' | 'jpeg';
    quality?: number;
  }): Promise<ScreenshotResult> {
    return this.backend.screenshot(options);
  }

  /**
   * Stop an active agent session
   */
  stopAgent(sessionId: string): boolean {
    const agent = this.agents.get(sessionId);
    if (agent) {
      agent.stop();
      return true;
    }
    return false;
  }

  /**
   * Remove an agent session
   */
  removeAgent(sessionId: string): boolean {
    const agent = this.agents.get(sessionId);
    if (agent) {
      agent.stop();
      this.agents.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Get all active session IDs
   */
  getActiveSessions(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get agent state
   */
  getAgentState(sessionId: string): SurfState | undefined {
    const agent = this.agents.get(sessionId);
    return agent?.getState();
  }

  /**
   * Get backend connection status
   */
  isBackendConnected(): boolean {
    return this.backend.isConnected;
  }

  /**
   * Get backend name
   */
  getBackendName(): string {
    return this.backend.name;
  }
}

/**
 * Crews Service
 *
 * Injectable service for managing crews in NestJS applications.
 */

import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Crew, createCrew, type CrewExecutionOptions } from '../core';
import { CrewDashboard, DebugMode } from '../monitoring';
import type { CrewConfig, CrewResult, CrewEvent } from '../types';
import type { CrewsModuleOptions } from './crews.module';

/**
 * Crew instance with monitoring
 */
export interface ManagedCrew {
  crew: Crew;
  dashboard?: CrewDashboard;
  debugMode?: DebugMode;
}

/**
 * Crews service
 *
 * Central service for managing multi-agent crews.
 */
export class CrewsService implements OnModuleInit, OnModuleDestroy {
  private readonly crews: Map<string, ManagedCrew> = new Map();
  private readonly options: CrewsModuleOptions;

  constructor(options: CrewsModuleOptions = {}) {
    this.options = options;
  }

  /**
   * Initialize module
   */
  async onModuleInit(): Promise<void> {
    // Initialize configured crews
    for (const config of this.options.crews ?? []) {
      await this.registerCrew(config);
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): Promise<void> {
    // Stop all running crews
    for (const managed of this.crews.values()) {
      if (managed.crew.getStatus().state === 'running') {
        managed.crew.abort();
      }
      managed.dashboard?.stop();
    }
    this.crews.clear();
    return Promise.resolve();
  }

  // ============ Crew Management ============

  /**
   * Register a crew
   */
  registerCrew(config: CrewConfig): Promise<Crew> {
    if (this.crews.has(config.name)) {
      throw new Error(`Crew already registered: ${config.name}`);
    }

    const crew = createCrew({
      ...config,
      delegationStrategy:
        config.delegationStrategy ?? this.options.defaultStrategy,
    });

    const managed: ManagedCrew = { crew };

    // Setup monitoring if enabled
    if (this.options.enableMonitoring) {
      managed.dashboard = new CrewDashboard(crew);
      managed.dashboard.start();
    }

    // Setup debug mode if enabled
    if (this.options.enableDebug) {
      managed.debugMode = new DebugMode(crew);
      managed.debugMode.enable();
    }

    this.crews.set(config.name, managed);

    return Promise.resolve(crew);
  }

  /**
   * Unregister a crew
   */
  unregisterCrew(name: string): boolean {
    const managed = this.crews.get(name);
    if (!managed) return false;

    // Cleanup
    managed.dashboard?.stop();
    managed.debugMode?.disable();

    return this.crews.delete(name);
  }

  /**
   * Get a crew by name
   */
  getCrew(name: string): Crew | undefined {
    return this.crews.get(name)?.crew;
  }

  /**
   * Get all crew names
   */
  getCrewNames(): string[] {
    return Array.from(this.crews.keys());
  }

  /**
   * Check if crew exists
   */
  hasCrew(name: string): boolean {
    return this.crews.has(name);
  }

  // ============ Execution ============

  /**
   * Run a crew
   */
  async runCrew(
    name: string,
    options?: CrewExecutionOptions,
  ): Promise<CrewResult> {
    const crew = this.getCrew(name);
    if (!crew) {
      throw new Error(`Crew not found: ${name}`);
    }

    return crew.kickoff(options);
  }

  /**
   * Run a crew with streaming
   */
  async *runCrewStream(
    name: string,
    options?: CrewExecutionOptions,
  ): AsyncGenerator<CrewEvent> {
    const crew = this.getCrew(name);
    if (!crew) {
      throw new Error(`Crew not found: ${name}`);
    }

    yield* crew.kickoffStream(options);
  }

  /**
   * Run crew with callback for events
   */
  async runCrewWithCallback(
    name: string,
    onEvent: (event: CrewEvent) => void,
    options?: CrewExecutionOptions,
  ): Promise<CrewResult> {
    const crew = this.getCrew(name);
    if (!crew) {
      throw new Error(`Crew not found: ${name}`);
    }

    const events: CrewEvent[] = [];

    for await (const event of crew.kickoffStream(options)) {
      events.push(event);
      onEvent(event);
    }

    const taskResults = Array.from(crew.getTasks())
      .filter((t) => t.getState().result)
      .map((t) => t.getState().result!);

    return {
      success: crew.getStatus().state === 'completed',
      taskResults,
      metrics: crew.getMetrics(),
      timeline: crew.getTimeline(),
      finalOutput: taskResults.map((r) => r.output).join('\n\n'),
      events,
    };
  }

  // ============ Control ============

  /**
   * Pause a crew
   */
  pauseCrew(name: string): void {
    const crew = this.getCrew(name);
    if (!crew) {
      throw new Error(`Crew not found: ${name}`);
    }
    crew.pause();
  }

  /**
   * Resume a crew
   */
  resumeCrew(name: string): void {
    const crew = this.getCrew(name);
    if (!crew) {
      throw new Error(`Crew not found: ${name}`);
    }
    crew.resume();
  }

  /**
   * Abort a crew
   */
  abortCrew(name: string): void {
    const crew = this.getCrew(name);
    if (!crew) {
      throw new Error(`Crew not found: ${name}`);
    }
    crew.abort();
  }

  // ============ Monitoring ============

  /**
   * Get dashboard for a crew
   */
  getDashboard(name: string): CrewDashboard | undefined {
    return this.crews.get(name)?.dashboard;
  }

  /**
   * Get debug mode for a crew
   */
  getDebugMode(name: string): DebugMode | undefined {
    return this.crews.get(name)?.debugMode;
  }

  /**
   * Get crew status
   */
  getCrewStatus(name: string): ReturnType<Crew['getStatus']> | undefined {
    return this.getCrew(name)?.getStatus();
  }

  /**
   * Get crew metrics
   */
  getCrewMetrics(name: string): ReturnType<Crew['getMetrics']> | undefined {
    return this.getCrew(name)?.getMetrics();
  }

  /**
   * Get all crews status
   */
  getAllStatus(): Map<string, ReturnType<Crew['getStatus']>> {
    const statuses = new Map<string, ReturnType<Crew['getStatus']>>();
    for (const [name, managed] of this.crews) {
      statuses.set(name, managed.crew.getStatus());
    }
    return statuses;
  }

  // ============ Health ============

  /**
   * Health check
   */
  healthCheck(): Promise<{
    healthy: boolean;
    crews: Array<{ name: string; status: string; healthy: boolean }>;
  }> {
    const crewsHealth = [];
    let allHealthy = true;

    for (const [name, managed] of this.crews) {
      const status = managed.crew.getStatus();
      const healthy = status.state !== 'failed';

      crewsHealth.push({
        name,
        status: status.state,
        healthy,
      });

      if (!healthy) {
        allHealthy = false;
      }
    }

    return Promise.resolve({
      healthy: allHealthy,
      crews: crewsHealth,
    });
  }
}

/**
 * Factory function
 */
export function createCrewsService(options?: CrewsModuleOptions): CrewsService {
  return new CrewsService(options);
}

export default CrewsService;

/**
 * Crews NestJS Module
 *
 * Dynamic module for NestJS integration.
 */

import type { DynamicModule, Provider, Type } from '@nestjs/common';
import type { CrewConfig, DelegationStrategyType } from '../types';

/**
 * Module options
 */
export interface CrewsModuleOptions {
  /** Crew configurations */
  crews?: CrewConfig[];
  /** Default delegation strategy */
  defaultStrategy?: DelegationStrategyType;
  /** Enable monitoring */
  enableMonitoring?: boolean;
  /** Enable debug mode */
  enableDebug?: boolean;
  /** Global providers */
  global?: boolean;
}

/**
 * Async options factory
 */
export interface CrewsModuleAsyncOptions {
  /** Module imports */
  imports?: Type<unknown>[];
  /** Factory function */
  useFactory?: (
    ...args: unknown[]
  ) => Promise<CrewsModuleOptions> | CrewsModuleOptions;
  /** Dependencies to inject */
  inject?: unknown[];
  /** Global providers */
  global?: boolean;
}

/**
 * Module tokens
 */
export const CREWS_MODULE_OPTIONS = 'CREWS_MODULE_OPTIONS';
export const CREWS_SERVICE = 'CREWS_SERVICE';

/**
 * Crews Module
 *
 * NestJS dynamic module for multi-agent crews.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     CrewsModule.forRoot({
 *       crews: [
 *         {
 *           name: 'research-crew',
 *           agents: [...],
 *           delegationStrategy: 'best-match',
 *         },
 *       ],
 *       enableMonitoring: true,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export class CrewsModule {
  /**
   * Configure module with static options
   */
  static forRoot(options: CrewsModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: CrewsModule,
      global: options.global ?? false,
      providers,
      exports: providers,
    };
  }

  /**
   * Configure module with async options
   */
  static forRootAsync(options: CrewsModuleAsyncOptions): DynamicModule {
    const providers = this.createAsyncProviders(options);

    return {
      module: CrewsModule,
      imports: options.imports ?? [],
      global: options.global ?? false,
      providers,
      exports: providers,
    };
  }

  /**
   * Register crew configurations
   */
  static forFeature(crews: CrewConfig[]): DynamicModule {
    const providers: Provider[] = crews.map((config) => ({
      provide: `CREW_${config.name.toUpperCase().replace(/-/g, '_')}`,
      useValue: config,
    }));

    return {
      module: CrewsModule,
      providers,
      exports: providers,
    };
  }

  /**
   * Create providers from static options
   */
  private static createProviders(options: CrewsModuleOptions): Provider[] {
    return [
      {
        provide: CREWS_MODULE_OPTIONS,
        useValue: options,
      },
      // Crew configurations
      ...(options.crews ?? []).map((config) => ({
        provide: `CREW_CONFIG_${config.name.toUpperCase().replace(/-/g, '_')}`,
        useValue: config,
      })),
    ];
  }

  /**
   * Create providers from async options
   */
  private static createAsyncProviders(
    options: CrewsModuleAsyncOptions,
  ): Provider[] {
    const providers: Provider[] = [];

    if (options.useFactory) {
      providers.push({
        provide: CREWS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        // eslint-disable-next-line @typescript-eslint/ban-types
        inject: (options.inject ?? []) as (string | symbol | Function)[],
      });
    }

    return providers;
  }
}

export default CrewsModule;

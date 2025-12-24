/**
 * Guardrails Module
 *
 * NestJS dynamic module for guardrails integration.
 */

import { DynamicModule, Module, Provider, Type } from '@nestjs/common';

import type { GuardrailsConfig } from '../types';
import { GuardrailsEngine } from '../core/guardrails-engine';
import {
  GuardrailsService,
  GUARDRAILS_CONFIG,
  GUARDRAILS_ENGINE,
} from './guardrails.service';

/**
 * Module options for synchronous configuration
 */
export interface GuardrailsModuleOptions extends Partial<GuardrailsConfig> {
  /** Make module global */
  global?: boolean;
}

/**
 * Module options for asynchronous configuration
 */
export interface GuardrailsModuleAsyncOptions {
  /** Make module global */
  global?: boolean;
  /** Imports for the module */
  imports?: Type<unknown>[];
  /** Factory function to create configuration */
  useFactory: (
    ...args: unknown[]
  ) => Promise<GuardrailsConfig> | GuardrailsConfig;
  /** Dependencies to inject into factory */
  inject?: unknown[];
  /** Use existing service */
  useExisting?: Type<GuardrailsService>;
  /** Use class for service */
  useClass?: Type<GuardrailsService>;
}

/**
 * Guardrails Module
 *
 * @example
 * ```typescript
 * // Synchronous configuration
 * @Module({
 *   imports: [
 *     GuardrailsModule.forRoot({
 *       guards: [
 *         { name: 'toxicity', enabled: true, onFailure: 'block' },
 *         { name: 'pii', enabled: true, onFailure: 'transform' },
 *       ],
 *       failureMode: 'fail-fast',
 *       defaultAction: 'block',
 *     }),
 *   ],
 * })
 * export class AppModule {}
 *
 * // Async configuration
 * @Module({
 *   imports: [
 *     GuardrailsModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (configService: ConfigService) => ({
 *         guards: configService.get('GUARDRAILS_GUARDS'),
 *         failureMode: configService.get('GUARDRAILS_FAILURE_MODE', 'fail-fast'),
 *       }),
 *       inject: [ConfigService],
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class GuardrailsModule {
  /**
   * Configure module synchronously
   */
  static forRoot(options: GuardrailsModuleOptions = {}): DynamicModule {
    const { global = false, ...config } = options;

    const configProvider: Provider = {
      provide: GUARDRAILS_CONFIG,
      useValue: config,
    };

    const engineProvider: Provider = {
      provide: GUARDRAILS_ENGINE,
      useFactory: () => new GuardrailsEngine(config),
    };

    return {
      module: GuardrailsModule,
      global,
      providers: [configProvider, engineProvider, GuardrailsService],
      exports: [GuardrailsService, GUARDRAILS_ENGINE, GUARDRAILS_CONFIG],
    };
  }

  /**
   * Configure module asynchronously
   */
  static forRootAsync(options: GuardrailsModuleAsyncOptions): DynamicModule {
    const { global = false, imports = [] } = options;

    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: GuardrailsModule,
      global,
      imports,
      providers: [...asyncProviders, GuardrailsService],
      exports: [GuardrailsService, GUARDRAILS_ENGINE, GUARDRAILS_CONFIG],
    };
  }

  /**
   * Create async providers
   */
  private static createAsyncProviders(
    options: GuardrailsModuleAsyncOptions,
  ): Provider[] {
    if (options.useExisting !== undefined || options.useFactory !== undefined) {
      return [this.createAsyncOptionsProvider(options)];
    }

    if (options.useClass) {
      return [
        this.createAsyncOptionsProvider(options),
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    return [this.createAsyncOptionsProvider(options)];
  }

  /**
   * Create async options provider
   */
  private static createAsyncOptionsProvider(
    options: GuardrailsModuleAsyncOptions,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: GUARDRAILS_CONFIG,
        useFactory: options.useFactory,
        // eslint-disable-next-line @typescript-eslint/ban-types
        inject: (options.inject ?? []) as (string | symbol | Function)[],
      };
    }

    if (options.useExisting) {
      return {
        provide: GUARDRAILS_CONFIG,
        useExisting: options.useExisting,
      };
    }

    if (options.useClass) {
      return {
        provide: GUARDRAILS_CONFIG,
        useClass: options.useClass,
      };
    }

    throw new Error('Invalid GuardrailsModuleAsyncOptions');
  }
}

export default GuardrailsModule;

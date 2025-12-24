/**
 * NestJS Surf Module
 */

import { DynamicModule, Module, Provider } from '@nestjs/common';

import { SurfConfig, BackendConfig, DEFAULT_SURF_CONFIG } from '../types';
import { createBackend } from '../backends';
import { SurfService } from './surf.service';
import { SurfController } from './surf.controller';
import { SurfGateway } from './surf.gateway';

/**
 * Module configuration options
 */
export interface SurfModuleOptions {
  /** Backend configuration */
  backend: BackendConfig;
  /** Agent configuration */
  config?: Partial<SurfConfig>;
  /** Enable REST API endpoints */
  enableRestApi?: boolean;
  /** Enable WebSocket gateway */
  enableWebSocket?: boolean;
  /** Make module global */
  global?: boolean;
}

/**
 * Async module configuration options
 */
export interface SurfModuleAsyncOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  imports?: any[];
  useFactory: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) => Promise<SurfModuleOptions> | SurfModuleOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inject?: any[];
}

/**
 * NestJS module for Surf computer-use functionality
 */
@Module({})
export class SurfModule {
  /**
   * Register module with synchronous configuration
   */
  static forRoot(options: SurfModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'SURF_MODULE_OPTIONS',
        useValue: options,
      },
      {
        provide: 'SURF_CONFIG',
        useValue: {
          ...DEFAULT_SURF_CONFIG,
          ...options.config,
        },
      },
      {
        provide: 'DESKTOP_BACKEND',
        useFactory: async () => {
          const backend = await createBackend(options.backend);
          await backend.connect();
          return backend;
        },
      },
      SurfService,
    ];

    const controllers = options.enableRestApi !== false ? [SurfController] : [];
    const gateways = options.enableWebSocket !== false ? [SurfGateway] : [];

    return {
      module: SurfModule,
      controllers,
      providers: [...providers, ...gateways],
      exports: [
        SurfService,
        'DESKTOP_BACKEND',
        'SURF_CONFIG',
        'SURF_MODULE_OPTIONS',
      ],
      global: options.global ?? false,
    };
  }

  /**
   * Register module with asynchronous configuration
   */
  static forRootAsync(options: SurfModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: 'SURF_MODULE_OPTIONS',
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
      {
        provide: 'SURF_CONFIG',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useFactory: async (...args: any[]) => {
          const moduleOptions = await options.useFactory(...args);
          return {
            ...DEFAULT_SURF_CONFIG,
            ...moduleOptions.config,
          };
        },
        inject: options.inject || [],
      },
      {
        provide: 'DESKTOP_BACKEND',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useFactory: async (...args: any[]) => {
          const moduleOptions = await options.useFactory(...args);
          const backend = await createBackend(moduleOptions.backend);
          await backend.connect();
          return backend;
        },
        inject: options.inject || [],
      },
      SurfService,
    ];

    return {
      module: SurfModule,
      imports: options.imports || [],
      providers,
      exports: [
        SurfService,
        'DESKTOP_BACKEND',
        'SURF_CONFIG',
        'SURF_MODULE_OPTIONS',
      ],
    };
  }
}

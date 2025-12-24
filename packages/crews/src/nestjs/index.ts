/**
 * NestJS Integration
 *
 * NestJS module, service, and decorators for crews.
 */

// Module
export {
  CrewsModule,
  CREWS_MODULE_OPTIONS,
  CREWS_SERVICE,
  type CrewsModuleOptions,
  type CrewsModuleAsyncOptions,
} from './crews.module';

// Service
export {
  CrewsService,
  createCrewsService,
  type ManagedCrew,
} from './crews.service';

// Decorators
export {
  // Class decorators
  CrewDef,

  // Property decorators
  RoleDef,
  RequireCapability,

  // Method decorators
  TaskDef,
  OnCrewEvent,
  Priority,
  Timeout,
  Retry,
  DependsOn,
  AssignTo,

  // Parameter decorators
  InjectCrew,

  // Metadata readers
  getCrewMetadata,
  getRoleMetadata,
  getTaskMetadata,
  getEventHandlerMetadata,
  getInjectCrewMetadata,
} from './decorators';

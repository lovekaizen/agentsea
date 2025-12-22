/**
 * Crews Decorators
 *
 * NestJS decorators for crew-related functionality.
 */

import 'reflect-metadata';
import type { CrewConfig, RoleConfig, TaskConfig } from '../types';

// Metadata keys
const CREW_METADATA = 'crews:crew';
const ROLE_METADATA = 'crews:role';
const TASK_METADATA = 'crews:task';
const ON_CREW_EVENT_METADATA = 'crews:on_event';
const INJECT_CREW_METADATA = 'crews:inject_crew';

/**
 * Mark a class as a Crew
 *
 * @example
 * ```typescript
 * @CrewDef({
 *   name: 'research-crew',
 *   delegationStrategy: 'best-match',
 * })
 * class ResearchCrew {
 *   @RoleDef({ name: 'researcher', capabilities: [...] })
 *   researcher: CrewAgent;
 * }
 * ```
 */
export function CrewDef(config: Partial<CrewConfig>): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/ban-types
  return (target: Function) => {
    Reflect.defineMetadata(CREW_METADATA, config, target);
  };
}

/**
 * Mark a property as a Role/Agent
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @RoleDef({
 *     name: 'researcher',
 *     description: 'Research expert',
 *     capabilities: [{ name: 'web-search', proficiency: 'expert' }],
 *   })
 *   researcher: CrewAgent;
 * }
 * ```
 */
export function RoleDef(config: RoleConfig): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existingRoles =
      Reflect.getMetadata(ROLE_METADATA, target.constructor) || [];
    existingRoles.push({
      propertyKey,
      config,
    });
    Reflect.defineMetadata(ROLE_METADATA, existingRoles, target.constructor);
  };
}

/**
 * Mark a method as a Task handler
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @TaskDef({
 *     description: 'Research the topic',
 *     expectedOutput: 'Research summary',
 *     priority: 'high',
 *   })
 *   async researchTask(context: ExecutionContext) {
 *     // Task implementation
 *   }
 * }
 * ```
 */
export function TaskDef(config: Partial<TaskConfig>): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const existingTasks =
      Reflect.getMetadata(TASK_METADATA, target.constructor) || [];
    existingTasks.push({
      methodKey: propertyKey,
      config,
      handler: descriptor.value,
    });
    Reflect.defineMetadata(TASK_METADATA, existingTasks, target.constructor);
  };
}

/**
 * Handle crew events
 *
 * @example
 * ```typescript
 * class MyService {
 *   @OnCrewEvent('task:completed')
 *   handleTaskCompleted(event: CrewEvent) {
 *     console.log('Task completed:', event);
 *   }
 * }
 * ```
 */
export function OnCrewEvent(eventType: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const existingHandlers =
      Reflect.getMetadata(ON_CREW_EVENT_METADATA, target.constructor) || [];
    existingHandlers.push({
      eventType,
      methodKey: propertyKey,
      handler: descriptor.value,
    });
    Reflect.defineMetadata(
      ON_CREW_EVENT_METADATA,
      existingHandlers,
      target.constructor,
    );
  };
}

/**
 * Inject a crew instance
 *
 * @example
 * ```typescript
 * class MyService {
 *   constructor(
 *     @InjectCrew('research-crew') private readonly crew: Crew,
 *   ) {}
 * }
 * ```
 */
export function InjectCrew(name?: string): ParameterDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    const existingInjections =
      Reflect.getMetadata(INJECT_CREW_METADATA, target) || [];
    existingInjections.push({
      index: parameterIndex,
      name,
    });
    Reflect.defineMetadata(INJECT_CREW_METADATA, existingInjections, target);
  };
}

// ============ Metadata Readers ============

/* eslint-disable @typescript-eslint/ban-types */

/**
 * Get crew metadata from a class
 */
export function getCrewMetadata(
  target: Function,
): Partial<CrewConfig> | undefined {
  return Reflect.getMetadata(CREW_METADATA, target);
}

/**
 * Get role metadata from a class
 */
export function getRoleMetadata(
  target: Function,
): Array<{ propertyKey: string | symbol; config: RoleConfig }> {
  return Reflect.getMetadata(ROLE_METADATA, target) || [];
}

/**
 * Get task metadata from a class
 */
export function getTaskMetadata(
  target: Function,
): Array<{
  methodKey: string | symbol;
  config: Partial<TaskConfig>;
  handler: Function;
}> {
  return Reflect.getMetadata(TASK_METADATA, target) || [];
}

/**
 * Get event handler metadata from a class
 */
export function getEventHandlerMetadata(
  target: Function,
): Array<{ eventType: string; methodKey: string | symbol; handler: Function }> {
  return Reflect.getMetadata(ON_CREW_EVENT_METADATA, target) || [];
}

/**
 * Get inject crew metadata from a constructor
 */
export function getInjectCrewMetadata(
  target: Function,
): Array<{ index: number; name?: string }> {
  return Reflect.getMetadata(INJECT_CREW_METADATA, target) || [];
}

/* eslint-enable @typescript-eslint/ban-types */

// ============ Utility Decorators ============

/**
 * Mark agent as required capability
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @RequireCapability('code-review')
 *   @RoleDef({ name: 'reviewer', ... })
 *   reviewer: CrewAgent;
 * }
 * ```
 */
export function RequireCapability(
  ...capabilities: string[]
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing =
      Reflect.getMetadata('crews:required_capabilities', target.constructor) ||
      {};
    existing[propertyKey] = capabilities;
    Reflect.defineMetadata(
      'crews:required_capabilities',
      existing,
      target.constructor,
    );
  };
}

/**
 * Mark task with priority
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @Priority('critical')
 *   @TaskDef({ description: 'Important task' })
 *   importantTask() {}
 * }
 * ```
 */
export function Priority(
  priority: 'critical' | 'high' | 'medium' | 'low',
): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing =
      Reflect.getMetadata('crews:task_priority', target.constructor) || {};
    existing[propertyKey] = priority;
    Reflect.defineMetadata('crews:task_priority', existing, target.constructor);
  };
}

/**
 * Mark task with timeout
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @Timeout(30000)
 *   @TaskDef({ description: 'Quick task' })
 *   quickTask() {}
 * }
 * ```
 */
export function Timeout(ms: number): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing =
      Reflect.getMetadata('crews:task_timeout', target.constructor) || {};
    existing[propertyKey] = ms;
    Reflect.defineMetadata('crews:task_timeout', existing, target.constructor);
  };
}

/**
 * Mark task with retry configuration
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @Retry(3)
 *   @TaskDef({ description: 'May fail task' })
 *   unreliableTask() {}
 * }
 * ```
 */
export function Retry(maxRetries: number): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing =
      Reflect.getMetadata('crews:task_retries', target.constructor) || {};
    existing[propertyKey] = maxRetries;
    Reflect.defineMetadata('crews:task_retries', existing, target.constructor);
  };
}

/**
 * Mark task as dependent on another task
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @DependsOn('researchTask')
 *   @TaskDef({ description: 'Write report' })
 *   writeReport() {}
 * }
 * ```
 */
export function DependsOn(...taskNames: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing =
      Reflect.getMetadata('crews:task_dependencies', target.constructor) || {};
    existing[propertyKey] = taskNames;
    Reflect.defineMetadata(
      'crews:task_dependencies',
      existing,
      target.constructor,
    );
  };
}

/**
 * Mark task to be assigned to specific agent
 *
 * @example
 * ```typescript
 * class MyCrew {
 *   @AssignTo('researcher')
 *   @TaskDef({ description: 'Research task' })
 *   researchTask() {}
 * }
 * ```
 */
export function AssignTo(agentName: string): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existing =
      Reflect.getMetadata('crews:task_assignment', target.constructor) || {};
    existing[propertyKey] = agentName;
    Reflect.defineMetadata(
      'crews:task_assignment',
      existing,
      target.constructor,
    );
  };
}

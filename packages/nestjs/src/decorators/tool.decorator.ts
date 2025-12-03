import { SetMetadata } from '@nestjs/common';

export const TOOL_METADATA = 'agentsea:tool';

export interface ToolOptions {
  name: string;
  description: string;
}

/**
 * Decorator to mark a method as a tool
 */
export function Tool(options: ToolOptions): MethodDecorator {
  return (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(TOOL_METADATA, options)(target, propertyKey, descriptor);
    return descriptor;
  };
}

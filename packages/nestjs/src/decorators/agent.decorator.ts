import { AgentConfig } from '@lov3kaizen/agentsea-core';
import { SetMetadata } from '@nestjs/common';

export const AGENT_METADATA = 'agentsea:agent';

/**
 * Decorator to mark a class as an agent handler
 */
export function Agent(config: Partial<AgentConfig>): ClassDecorator {
  return (target: any) => {
    SetMetadata(AGENT_METADATA, config)(target);
    return target;
  };
}

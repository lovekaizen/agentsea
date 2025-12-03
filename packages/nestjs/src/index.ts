/**
 * NestJS integration for AgentSea
 * This package provides decorators, modules, and guards for integrating AgentSea with NestJS applications
 */

// Re-export core exports for convenience
export * from '@lov3kaizen/agentsea-core';

// Decorators (with explicit exports to avoid naming conflicts)
export {
  Agent as AgentDecorator,
  AGENT_METADATA,
} from './decorators/agent.decorator';
export {
  Tool as ToolDecorator,
  TOOL_METADATA,
  type ToolOptions,
} from './decorators/tool.decorator';
export { Tenant, TenantId } from './decorators/tenant.decorator';

// Modules
export {
  AgenticModule,
  type AgenticModuleOptions,
} from './modules/agentic.module';

// Guards
export {
  RateLimitGuard,
  RateLimit,
  RATE_LIMIT_METADATA,
  type RateLimitOptions,
} from './guards/rate-limit.guard';
export { TenantGuard, type TenantGuardOptions } from './guards/tenant.guard';

// Controllers
export { AgentController } from './controllers/agent.controller';
export {
  TenantController,
  CreateTenantDto,
  UpdateTenantDto,
  CreateApiKeyDto,
  ListTenantsQuery,
} from './controllers/tenant.controller';

// Gateways
export { AgentGateway } from './gateways/agent.gateway';

// Services
export { AgentService } from './services/agent.service';

// DTOs
export { ExecuteAgentDto } from './dto/execute-agent.dto';

export const AGENTSEA_NESTJS_VERSION = '0.1.0';

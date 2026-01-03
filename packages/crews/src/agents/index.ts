/**
 * Agents Module
 *
 * Export agent-related classes and utilities.
 */

export {
  CrewAgent,
  createCrewAgent,
  type CrewAgentOptions,
  type CrewAgentStats,
  type TaskBid,
  type HelpRequest,
  type HelpResponse,
  type AgentExecutionResult,
} from './CrewAgent';

export { AgentCapabilities, type CapableAgent } from './AgentCapabilities';

export {
  AgentRegistry,
  createAgentRegistry,
  type AgentRegistryConfig,
  type RegisteredAgent,
  type AgentStatus,
  type RegistryStats,
  type AgentStats,
} from './AgentRegistry';

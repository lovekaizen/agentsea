import { Injectable } from '@nestjs/common';
import { Agent } from '@lov3kaizen/agentsea-core';

/**
 * Service for managing agents in NestJS
 */
@Injectable()
export class AgentService {
  private agents: Map<string, Agent> = new Map();

  /**
   * Register an agent
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.config.name, agent);
  }

  /**
   * Get an agent by name
   */
  getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent exists
   */
  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(name: string): boolean {
    return this.agents.delete(name);
  }
}

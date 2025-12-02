import { Agent } from '../agent/agent';
import { ToolRegistry } from '../tools/tool-registry';
import {
  AgentContext,
  AgentResponse,
  WorkflowConfig,
  LLMProvider,
  MemoryStore,
} from '../types';

/**
 * Base workflow class for orchestrating multiple agents
 */
export abstract class Workflow {
  protected agents: Map<string, Agent> = new Map();

  constructor(
    protected config: WorkflowConfig,
    protected provider: LLMProvider,
    protected toolRegistry: ToolRegistry,
    protected memory?: MemoryStore,
  ) {
    this.initializeAgents();
  }

  /**
   * Initialize all agents in the workflow
   */
  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      const agent = new Agent(
        agentConfig,
        this.provider,
        this.toolRegistry,
        this.memory,
      );
      this.agents.set(agentConfig.name, agent);
    }
  }

  /**
   * Execute the workflow
   */
  abstract execute(
    input: string,
    context: AgentContext,
  ): Promise<AgentResponse>;

  /**
   * Handle errors based on the configured strategy
   */
  protected handleError(
    error: Error,
    agentName: string,
    _context: AgentContext,
  ): AgentResponse | null {
    const strategy = this.config.errorHandling || 'fail-fast';

    switch (strategy) {
      case 'fail-fast':
        throw error;

      case 'retry':
        // Retry logic would go here
        throw error;

      case 'fallback':
        return {
          content: `Agent ${agentName} failed: ${error.message}. Using fallback response.`,
          metadata: {
            tokensUsed: 0,
            latencyMs: 0,
            iterations: 0,
          },
          finishReason: 'error',
        };

      case 'continue':
        return null;

      default:
        throw error;
    }
  }

  /**
   * Get an agent by name
   */
  protected getAgent(name: string): Agent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent '${name}' not found in workflow`);
    }
    return agent;
  }
}

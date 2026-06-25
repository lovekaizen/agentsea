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
   * Run a single agent, applying the `retry` error-handling strategy when
   * configured. On the `retry` strategy the agent is re-invoked up to
   * `retry.maxAttempts` times (with optional fixed/exponential backoff) before
   * the final error propagates to {@link handleError}. For every other strategy
   * the agent runs exactly once and any error propagates unchanged.
   */
  protected async executeAgent(
    agent: Agent,
    input: string,
    context: AgentContext,
  ): Promise<AgentResponse> {
    if ((this.config.errorHandling ?? 'fail-fast') !== 'retry') {
      return agent.execute(input, context);
    }

    const maxAttempts = Math.max(1, this.config.retry?.maxAttempts ?? 3);
    const initialDelayMs = this.config.retry?.initialDelayMs ?? 0;
    const maxDelayMs = this.config.retry?.maxDelayMs ?? Infinity;
    const backoff = this.config.retry?.backoff ?? 'exponential';

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await agent.execute(input, context);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts && initialDelayMs > 0) {
          const raw =
            backoff === 'linear'
              ? initialDelayMs * attempt
              : initialDelayMs * 2 ** (attempt - 1);
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(raw, maxDelayMs)),
          );
        }
      }
    }
    // All attempts failed — surface the last error to the caller's catch, which
    // routes it through handleError (terminating the workflow by default).
    throw lastError ?? new Error('Agent execution failed after retries');
  }

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
        // Retries are performed in executeAgent(); reaching here means every
        // attempt failed, so the error is terminal.
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

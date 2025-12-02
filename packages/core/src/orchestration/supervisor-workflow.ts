import { AgentContext, AgentResponse } from '../types';
import { Workflow } from './workflow';

/**
 * Supervisor workflow with dynamic routing based on agent responses
 */
export class SupervisorWorkflow extends Workflow {
  async execute(input: string, context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();
    let currentInput = input;
    let totalTokens = 0;
    let totalIterations = 0;
    const maxRouting = 10; // Prevent infinite loops
    let routingCount = 0;

    // Start with the first agent
    let currentAgentName = this.config.agents[0]?.name;
    if (!currentAgentName) {
      throw new Error('No agents configured in workflow');
    }

    let finalResponse: AgentResponse | null = null;

    while (routingCount < maxRouting) {
      routingCount++;

      try {
        const agent = this.getAgent(currentAgentName);
        const response = await agent.execute(currentInput, context);

        // Accumulate metrics
        totalTokens += response.metadata.tokensUsed;
        totalIterations += response.metadata.iterations;
        finalResponse = response;

        // Determine next agent based on routing logic
        const nextAgentName = this.determineNextAgent(response, context);

        if (!nextAgentName) {
          // No more routing, we're done
          break;
        }

        // Set up for next iteration
        currentAgentName = nextAgentName;
        currentInput = response.content;
      } catch (error) {
        const errorResponse = this.handleError(
          error as Error,
          currentAgentName,
          context,
        );
        if (errorResponse) {
          finalResponse = errorResponse;
          break;
        }
        // If errorResponse is null and strategy is 'continue', try to route to another agent
        const nextAgent = this.getFallbackAgent(currentAgentName);
        if (!nextAgent) {
          throw error;
        }
        currentAgentName = nextAgent;
      }
    }

    if (!finalResponse) {
      throw new Error('Workflow failed to produce a response');
    }

    if (routingCount >= maxRouting) {
      console.warn('Supervisor workflow reached maximum routing iterations');
    }

    return {
      ...finalResponse,
      metadata: {
        ...finalResponse.metadata,
        tokensUsed: totalTokens,
        latencyMs: Date.now() - startTime,
        iterations: totalIterations,
      },
    };
  }

  /**
   * Determine the next agent based on routing logic
   */
  private determineNextAgent(
    response: AgentResponse,
    context: AgentContext,
  ): string | null {
    // If response explicitly specifies next agent
    if (response.nextAgent) {
      return response.nextAgent;
    }

    // If routing logic is configured
    if (this.config.routing?.rules) {
      for (const rule of this.config.routing.rules) {
        if (rule.condition(context, response)) {
          return rule.nextAgent;
        }
      }
    }

    // Handle routing strategy
    if (this.config.routing?.strategy === 'round-robin') {
      return this.getNextRoundRobinAgent(context);
    }

    // No next agent determined
    return null;
  }

  /**
   * Get next agent in round-robin fashion
   */
  private getNextRoundRobinAgent(context: AgentContext): string | null {
    const agentNames = this.config.agents.map((a) => a.name);
    const currentIndex = context.metadata?.roundRobinIndex || 0;
    const nextIndex = (currentIndex + 1) % agentNames.length;

    // Store the index for next iteration
    context.metadata = context.metadata || {};
    context.metadata.roundRobinIndex = nextIndex;

    // If we've completed a full cycle, return null
    if (nextIndex === 0 && currentIndex !== 0) {
      return null;
    }

    return agentNames[nextIndex] || null;
  }

  /**
   * Get a fallback agent when current agent fails
   */
  private getFallbackAgent(failedAgentName: string): string | null {
    const agentNames = this.config.agents.map((a) => a.name);
    const failedIndex = agentNames.indexOf(failedAgentName);

    // Try the next agent in the list
    if (failedIndex >= 0 && failedIndex < agentNames.length - 1) {
      return agentNames[failedIndex + 1] || null;
    }

    return null;
  }
}

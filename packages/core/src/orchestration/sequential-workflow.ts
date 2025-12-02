import { AgentContext, AgentResponse } from '../types';
import { Workflow } from './workflow';

/**
 * Sequential workflow that executes agents one after another
 */
export class SequentialWorkflow extends Workflow {
  async execute(input: string, context: AgentContext): Promise<AgentResponse> {
    let currentInput = input;
    let finalResponse: AgentResponse | null = null;
    const startTime = Date.now();
    let totalTokens = 0;
    let totalIterations = 0;

    for (const agentConfig of this.config.agents) {
      try {
        const agent = this.getAgent(agentConfig.name);
        const response = await agent.execute(currentInput, context);

        // Accumulate metrics
        totalTokens += response.metadata.tokensUsed;
        totalIterations += response.metadata.iterations;

        // Use the response as input for the next agent
        currentInput = response.content;
        finalResponse = response;

        // Check if there's a nextAgent specified
        if (response.nextAgent) {
          const nextAgent = this.agents.get(response.nextAgent);
          if (!nextAgent) {
            console.warn(
              `Next agent '${response.nextAgent}' not found, continuing sequence`,
            );
          }
        }
      } catch (error) {
        const errorResponse = this.handleError(
          error as Error,
          agentConfig.name,
          context,
        );
        if (errorResponse) {
          finalResponse = errorResponse;
          break;
        }
        // If errorResponse is null, continue to next agent
      }
    }

    if (!finalResponse) {
      throw new Error('No agents produced a response');
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
}

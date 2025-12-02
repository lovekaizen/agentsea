import { AgentContext, AgentResponse } from '../types';
import { Workflow } from './workflow';

/**
 * Parallel workflow that executes multiple agents concurrently
 */
export class ParallelWorkflow extends Workflow {
  async execute(input: string, context: AgentContext): Promise<AgentResponse> {
    const startTime = Date.now();

    // Execute all agents in parallel
    const promises = this.config.agents.map(async (agentConfig) => {
      try {
        const agent = this.getAgent(agentConfig.name);
        const response = await agent.execute(input, context);
        return {
          agentName: agentConfig.name,
          response,
          error: null,
        };
      } catch (error) {
        return {
          agentName: agentConfig.name,
          response: null,
          error: error as Error,
        };
      }
    });

    const results = await Promise.all(promises);

    // Aggregate results
    let totalTokens = 0;
    let totalIterations = 0;
    const responses: string[] = [];
    const errors: string[] = [];

    for (const result of results) {
      if (result.response) {
        responses.push(`[${result.agentName}]: ${result.response.content}`);
        totalTokens += result.response.metadata.tokensUsed;
        totalIterations += result.response.metadata.iterations;
      } else if (result.error) {
        const errorResponse = this.handleError(
          result.error,
          result.agentName,
          context,
        );
        if (errorResponse) {
          responses.push(`[${result.agentName}]: ${errorResponse.content}`);
        } else {
          errors.push(`[${result.agentName}]: ${result.error.message}`);
        }
      }
    }

    // Combine all responses
    const combinedContent =
      responses.length > 0
        ? responses.join('\n\n')
        : `Workflow completed with errors:\n${errors.join('\n')}`;

    return {
      content: combinedContent,
      metadata: {
        tokensUsed: totalTokens,
        latencyMs: Date.now() - startTime,
        iterations: totalIterations,
      },
      finishReason: responses.length > 0 ? 'stop' : 'error',
    };
  }
}

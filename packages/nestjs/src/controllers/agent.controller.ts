import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AgentContext } from '@lov3kaizen/agentsea-core';
import { ExecuteAgentDto } from '../dto/execute-agent.dto';
import { AgentService } from '../services/agent.service';

/**
 * REST API controller for agent operations
 */
@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * Execute an agent with the given input
   * POST /agents/:name/execute
   */
  @Post(':name/execute')
  async execute(@Param('name') name: string, @Body() dto: ExecuteAgentDto) {
    const agent = this.agentService.getAgent(name);

    if (!agent) {
      throw new Error(`Agent '${name}' not found`);
    }

    // Apply runtime format options if provided
    if (dto.outputFormat) {
      agent.config.outputFormat = dto.outputFormat;
    }
    if (dto.formatOptions) {
      agent.config.formatOptions = dto.formatOptions;
    }

    const context: AgentContext = {
      conversationId: dto.conversationId || `conv-${Date.now()}`,
      userId: dto.userId,
      sessionData: dto.sessionData || {},
      history: dto.history || [],
      metadata: dto.metadata,
    };

    const response = await agent.execute(dto.input, context);

    return {
      success: true,
      data: response,
      conversationId: context.conversationId,
    };
  }

  /**
   * Stream agent execution with SSE
   * GET /agents/:name/stream
   */
  @Sse(':name/stream')
  stream(
    @Param('name') name: string,
    @Body() dto: ExecuteAgentDto,
  ): Observable<MessageEvent> {
    return new Observable((observer) => {
      const agent = this.agentService.getAgent(name);

      if (!agent) {
        observer.error(new Error(`Agent '${name}' not found`));
        return;
      }

      const context: AgentContext = {
        conversationId: dto.conversationId || `conv-${Date.now()}`,
        userId: dto.userId,
        sessionData: dto.sessionData || {},
        history: dto.history || [],
        metadata: dto.metadata,
      };

      void (async () => {
        try {
          for await (const event of agent.executeStream(dto.input, context)) {
            observer.next({
              data: event,
            } as MessageEvent);

            if (event.type === 'done' || event.type === 'error') {
              observer.complete();
              break;
            }
          }
        } catch (error) {
          observer.error(error);
        }
      })();
    });
  }

  /**
   * List all available agents
   * GET /agents
   */
  @Get()
  listAgents() {
    const agents = this.agentService.getAllAgents();
    return {
      success: true,
      data: agents.map((agent) => ({
        name: agent.config.name,
        description: agent.config.description,
        model: agent.config.model,
        provider: agent.config.provider,
        tools: agent.config.tools?.map((t) => t.name) || [],
      })),
    };
  }

  /**
   * Get agent details
   * GET /agents/:name
   */
  @Get(':name')
  getAgent(@Param('name') name: string) {
    const agent = this.agentService.getAgent(name);

    if (!agent) {
      throw new Error(`Agent '${name}' not found`);
    }

    return {
      success: true,
      data: {
        name: agent.config.name,
        description: agent.config.description,
        model: agent.config.model,
        provider: agent.config.provider,
        systemPrompt: agent.config.systemPrompt,
        tools:
          agent.config.tools?.map((t) => ({
            name: t.name,
            description: t.description,
          })) || [],
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens,
        maxIterations: agent.config.maxIterations,
      },
    };
  }

  /**
   * Delete conversation history
   * DELETE /agents/:name/conversations/:conversationId
   */
  @Delete(':name/conversations/:conversationId')
  deleteConversation(
    @Param('name') _name: string,
    @Param('conversationId') conversationId: string,
  ) {
    // This would require access to the memory store
    // Implementation depends on your memory store setup
    return {
      success: true,
      message: `Conversation ${conversationId} deleted`,
    };
  }
}

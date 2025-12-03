import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentContext } from '@lov3kaizen/agentsea-core';
import { AgentService } from '../services/agent.service';

/**
 * WebSocket gateway for real-time agent communication
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/agents',
})
export class AgentGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly agentService: AgentService) {}

  /**
   * Handle agent execution request via WebSocket
   */
  @SubscribeMessage('execute')
  async handleExecute(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      agentName: string;
      input: string;
      conversationId?: string;
      userId?: string;
      sessionData?: Record<string, any>;
      history?: any[];
      metadata?: Record<string, any>;
    },
  ) {
    const { agentName, input, ...contextData } = data;

    const agent = this.agentService.getAgent(agentName);

    if (!agent) {
      client.emit('error', {
        message: `Agent '${agentName}' not found`,
      });
      return;
    }

    const context: AgentContext = {
      conversationId: contextData.conversationId || `conv-${Date.now()}`,
      userId: contextData.userId,
      sessionData: contextData.sessionData || {},
      history: contextData.history || [],
      metadata: contextData.metadata,
    };

    try {
      // Stream events to the client
      for await (const event of agent.executeStream(input, context)) {
        client.emit('stream', event);

        if (event.type === 'done' || event.type === 'error') {
          break;
        }
      }

      client.emit('complete', {
        conversationId: context.conversationId,
      });
    } catch (error) {
      client.emit('error', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle agent info request
   */
  @SubscribeMessage('getAgent')
  handleGetAgent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentName: string },
  ) {
    const agent = this.agentService.getAgent(data.agentName);

    if (!agent) {
      client.emit('error', {
        message: `Agent '${data.agentName}' not found`,
      });
      return;
    }

    client.emit('agentInfo', {
      name: agent.config.name,
      description: agent.config.description,
      model: agent.config.model,
      provider: agent.config.provider,
      tools: agent.config.tools?.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    });
  }

  /**
   * Handle list agents request
   */
  @SubscribeMessage('listAgents')
  handleListAgents(@ConnectedSocket() client: Socket) {
    const agents = this.agentService.getAllAgents();

    client.emit('agentList', {
      agents: agents.map((agent) => ({
        name: agent.config.name,
        description: agent.config.description,
        model: agent.config.model,
        provider: agent.config.provider,
        tools: agent.config.tools?.map((t) => t.name) || [],
      })),
    });
  }
}

/**
 * NestJS Surf WebSocket Gateway
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { SurfService } from './surf.service';

/**
 * WebSocket gateway for real-time Surf interactions
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/surf',
})
export class SurfGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private clientSessions: Map<string, string> = new Map();

  constructor(private readonly surfService: SurfService) {}

  /**
   * Handle new client connection
   */
  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // Clean up session if exists
    const sessionId = this.clientSessions.get(client.id);
    if (sessionId) {
      this.surfService.stopAgent(sessionId);
      this.clientSessions.delete(client.id);
    }
  }

  /**
   * Execute a task with streaming updates
   */
  @SubscribeMessage('execute')
  async handleExecute(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      task: string;
      sessionId?: string;
      context?: Record<string, unknown>;
    },
  ) {
    const sessionId = data.sessionId || `ws-${client.id}-${Date.now()}`;
    this.clientSessions.set(client.id, sessionId);

    try {
      // Stream events back to client
      for await (const event of this.surfService.executeTaskStream(
        sessionId,
        data.task,
        data.context,
      )) {
        client.emit('stream', {
          sessionId,
          event,
        });
      }

      // Send completion event
      const state = this.surfService.getAgentState(sessionId);
      client.emit('complete', {
        sessionId,
        state,
      });
    } catch (error) {
      client.emit('error', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute a single action
   */
  @SubscribeMessage('action')
  async handleAction(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      action: string;
      params: Record<string, unknown>;
    },
  ) {
    try {
      const result = await this.surfService.executeAction(
        data.action,
        data.params,
      );

      client.emit('actionResult', {
        success: result.success,
        result,
      });
    } catch (error) {
      client.emit('actionResult', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Take a screenshot
   */
  @SubscribeMessage('screenshot')
  async handleScreenshot(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data?: {
      region?: { x: number; y: number; width: number; height: number };
      format?: 'png' | 'jpeg';
      quality?: number;
    },
  ) {
    try {
      const result = await this.surfService.screenshot(data);

      client.emit('screenshotResult', {
        success: true,
        data: {
          base64: result.base64,
          mimeType: result.mimeType,
          width: result.dimensions.width,
          height: result.dimensions.height,
        },
      });
    } catch (error) {
      client.emit('screenshotResult', {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Stop current execution
   */
  @SubscribeMessage('stop')
  handleStop(@ConnectedSocket() client: Socket) {
    const sessionId = this.clientSessions.get(client.id);
    if (sessionId) {
      const stopped = this.surfService.stopAgent(sessionId);
      client.emit('stopped', { sessionId, stopped });
    } else {
      client.emit('stopped', { stopped: false, error: 'No active session' });
    }
  }

  /**
   * Get current session state
   */
  @SubscribeMessage('getState')
  handleGetState(@ConnectedSocket() client: Socket) {
    const sessionId = this.clientSessions.get(client.id);
    if (sessionId) {
      const state = this.surfService.getAgentState(sessionId);
      client.emit('state', { sessionId, state });
    } else {
      client.emit('state', { state: null });
    }
  }

  /**
   * Get backend status
   */
  @SubscribeMessage('status')
  handleStatus(@ConnectedSocket() client: Socket) {
    client.emit('statusResult', {
      backend: this.surfService.getBackendName(),
      connected: this.surfService.isBackendConnected(),
      activeSessions: this.surfService.getActiveSessions().length,
    });
  }
}

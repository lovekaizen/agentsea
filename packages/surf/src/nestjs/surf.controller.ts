/**
 * NestJS Surf Controller
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Sse,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, from, map } from 'rxjs';

import { SurfService } from './surf.service';

/**
 * DTO for executing a task
 */
interface ExecuteTaskDto {
  task: string;
  sessionId?: string;
  context?: {
    conversationId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * DTO for executing an action
 */
interface ExecuteActionDto {
  action: string;
  params: Record<string, unknown>;
}

/**
 * DTO for screenshot
 */
interface ScreenshotDto {
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format?: 'png' | 'jpeg';
  quality?: number;
}

/**
 * REST API controller for Surf computer-use functionality
 */
@Controller('surf')
export class SurfController {
  constructor(private readonly surfService: SurfService) {}

  /**
   * Execute a task
   */
  @Post('execute')
  async executeTask(@Body() dto: ExecuteTaskDto) {
    try {
      const sessionId = dto.sessionId || `session-${Date.now()}`;
      const result = await this.surfService.executeTask(
        sessionId,
        dto.task,
        dto.context,
      );

      return {
        success: true,
        sessionId,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Execute a task with streaming response
   */
  @Sse('execute/stream')
  executeTaskStream(@Body() dto: ExecuteTaskDto): Observable<MessageEvent> {
    const sessionId = dto.sessionId || `session-${Date.now()}`;

    return from(
      this.surfService.executeTaskStream(sessionId, dto.task, dto.context),
    ).pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    );
  }

  /**
   * Execute a single action
   */
  @Post('action')
  async executeAction(@Body() dto: ExecuteActionDto) {
    try {
      const result = await this.surfService.executeAction(
        dto.action,
        dto.params,
      );

      return {
        success: result.success,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Take a screenshot
   */
  @Post('screenshot')
  async screenshot(@Body() dto?: ScreenshotDto) {
    try {
      const result = await this.surfService.screenshot(dto);

      return {
        success: true,
        data: {
          base64: result.base64,
          mimeType: result.mimeType,
          width: result.dimensions.width,
          height: result.dimensions.height,
          scaleFactor: result.dimensions.scaleFactor,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get screen state
   */
  @Get('screen')
  async getScreenState() {
    try {
      const state = await this.surfService.getScreenState();

      return {
        success: true,
        data: {
          screenshot: {
            base64: state.screenshot.base64,
            mimeType: state.screenshot.mimeType,
          },
          dimensions: state.dimensions,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all active sessions
   */
  @Get('sessions')
  getSessions() {
    const sessions = this.surfService.getActiveSessions();
    return {
      success: true,
      data: sessions.map((sessionId) => ({
        sessionId,
        state: this.surfService.getAgentState(sessionId),
      })),
    };
  }

  /**
   * Get session state
   */
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    const state = this.surfService.getAgentState(sessionId);

    if (!state) {
      throw new HttpException(
        {
          success: false,
          error: 'Session not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      data: { sessionId, state },
    };
  }

  /**
   * Stop a session
   */
  @Post('sessions/:sessionId/stop')
  stopSession(@Param('sessionId') sessionId: string) {
    const stopped = this.surfService.stopAgent(sessionId);

    if (!stopped) {
      throw new HttpException(
        {
          success: false,
          error: 'Session not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      message: 'Session stopped',
    };
  }

  /**
   * Delete a session
   */
  @Delete('sessions/:sessionId')
  deleteSession(@Param('sessionId') sessionId: string) {
    const removed = this.surfService.removeAgent(sessionId);

    if (!removed) {
      throw new HttpException(
        {
          success: false,
          error: 'Session not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      message: 'Session deleted',
    };
  }

  /**
   * Get backend status
   */
  @Get('status')
  getStatus() {
    return {
      success: true,
      data: {
        backend: this.surfService.getBackendName(),
        connected: this.surfService.isBackendConnected(),
        activeSessions: this.surfService.getActiveSessions().length,
      },
    };
  }
}

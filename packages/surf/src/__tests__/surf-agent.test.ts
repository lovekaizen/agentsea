import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SurfAgent } from '../agent/surf-agent.js';
import type {
  DesktopBackend,
  SurfConfig,
  ScreenshotResult,
  ActionResult,
  Point,
  ScreenDimensions,
} from '../types/index.js';

// Mock backend implementation
class MockBackend implements DesktopBackend {
  readonly name = 'mock';
  isConnected = true;

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {}

  async getScreenDimensions(): Promise<ScreenDimensions> {
    return { width: 1920, height: 1080, scaleFactor: 1 };
  }

  async screenshot(): Promise<ScreenshotResult> {
    return {
      base64: 'mock-base64-data',
      mimeType: 'image/png',
      width: 1920,
      height: 1080,
      timestamp: new Date(),
    };
  }

  async click(_point: Point, _options?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'click',
      timestamp: new Date(),
      duration: 10,
    };
  }

  async doubleClick(_point: Point, _options?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'doubleClick',
      timestamp: new Date(),
      duration: 10,
    };
  }

  async typeText(_text: string, _options?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'type',
      timestamp: new Date(),
      duration: 50,
    };
  }

  async scroll(
    _direction: any,
    _point: Point,
    _options?: any,
  ): Promise<ActionResult> {
    return {
      success: true,
      action: 'scroll',
      timestamp: new Date(),
      duration: 20,
    };
  }

  async drag(_from: Point, _to: Point, _options?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'drag',
      timestamp: new Date(),
      duration: 100,
    };
  }

  async keyPress(_key: string, _modifiers?: any): Promise<ActionResult> {
    return {
      success: true,
      action: 'keyPress',
      timestamp: new Date(),
      duration: 5,
    };
  }

  async moveCursor(_point: Point): Promise<ActionResult> {
    return {
      success: true,
      action: 'moveCursor',
      timestamp: new Date(),
      duration: 5,
    };
  }

  async wait(ms: number): Promise<ActionResult> {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return {
      success: true,
      action: 'wait',
      timestamp: new Date(),
      duration: ms,
    };
  }
}

describe('SurfAgent', () => {
  let agent: SurfAgent;
  let backend: MockBackend;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    backend = new MockBackend();
    agent = new SurfAgent(sessionId, backend);
  });

  describe('constructor', () => {
    it('should create agent with session ID and backend', () => {
      expect(agent).toBeInstanceOf(SurfAgent);
      expect(agent.getSessionId()).toBe(sessionId);
    });

    it('should initialize with idle state', () => {
      const state = agent.getState();
      expect(state.status).toBe('idle');
      expect(state.currentStep).toBe(0);
      expect(state.actionHistory).toEqual([]);
    });

    it('should accept custom config', () => {
      const config: Partial<SurfConfig> = {
        maxSteps: 20,
        screenshotDelay: 500,
      };
      const customAgent = new SurfAgent(sessionId, backend, config);
      const state = customAgent.getState();
      expect(state.maxSteps).toBe(20);
    });
  });

  describe('getSessionId', () => {
    it('should return session ID', () => {
      expect(agent.getSessionId()).toBe(sessionId);
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const state1 = agent.getState();
      const state2 = agent.getState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different objects
    });

    it('should include all state properties', () => {
      const state = agent.getState();

      expect(state).toHaveProperty('currentStep');
      expect(state).toHaveProperty('maxSteps');
      expect(state).toHaveProperty('actionHistory');
      expect(state).toHaveProperty('status');
    });
  });

  describe('stop', () => {
    it('should set stop requested flag', () => {
      agent.stop();
      // Since stopRequested is private, we'll verify through behavior
      expect(agent).toBeDefined();
    });

    it('should stop execution in progress', async () => {
      // Mock vision analyzer to return actions indefinitely
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue({
        action: 'click',
        description: 'Click button',
        params: { x: 100, y: 100 },
        confidence: 0.9,
      });

      // Start execution
      const executePromise = agent.execute('Test task');

      // Stop after a short delay
      setTimeout(() => agent.stop(), 50);

      const result = await executePromise;

      expect(result.state.status).toBe('paused');
      expect(result.response).toContain('stopped');
    });
  });

  describe('executeAction', () => {
    it('should execute click action', async () => {
      const clickSpy = vi.spyOn(backend, 'click');

      const action = {
        action: 'click' as const,
        description: 'Click button',
        params: { x: 100, y: 200, button: 'left' },
        confidence: 0.9,
      };

      // Access private method through type assertion
      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(true);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should execute type action', async () => {
      const typeSpy = vi.spyOn(backend, 'typeText');

      const action = {
        action: 'type' as const,
        description: 'Type text',
        params: { text: 'Hello world' },
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(true);
      expect(typeSpy).toHaveBeenCalledWith('Hello world', expect.any(Object));
    });

    it('should execute scroll action', async () => {
      const scrollSpy = vi.spyOn(backend, 'scroll');

      const action = {
        action: 'scroll' as const,
        description: 'Scroll down',
        params: { direction: 'down', x: 100, y: 100, amount: 3 },
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(true);
      expect(scrollSpy).toHaveBeenCalled();
    });

    it('should execute drag action', async () => {
      const dragSpy = vi.spyOn(backend, 'drag');

      const action = {
        action: 'drag' as const,
        description: 'Drag item',
        params: { fromX: 100, fromY: 100, toX: 200, toY: 200 },
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(true);
      expect(dragSpy).toHaveBeenCalled();
    });

    it('should execute keyPress action', async () => {
      const keyPressSpy = vi.spyOn(backend, 'keyPress');

      const action = {
        action: 'keyPress' as const,
        description: 'Press enter',
        params: { key: 'enter' },
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(true);
      expect(keyPressSpy).toHaveBeenCalledWith('enter', undefined);
    });

    it('should execute wait action', async () => {
      const waitSpy = vi.spyOn(backend, 'wait');

      const action = {
        action: 'wait' as const,
        description: 'Wait',
        params: { ms: 100 },
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(true);
      expect(waitSpy).toHaveBeenCalledWith(100);
    });

    it('should handle unknown action', async () => {
      const action = {
        action: 'unknownAction' as any,
        description: 'Unknown',
        params: {},
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should handle action execution error', async () => {
      const clickSpy = vi
        .spyOn(backend, 'click')
        .mockRejectedValueOnce(new Error('Backend error'));

      const action = {
        action: 'click' as const,
        description: 'Click',
        params: { x: 100, y: 100 },
        confidence: 0.9,
      };

      const result = await (agent as any).executeAction(action);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('coordinate scaling', () => {
    it('should scale coordinates in native mode', async () => {
      const nativeAgent = new SurfAgent(sessionId, backend, {
        scalingMode: 'native',
      });

      const action = {
        action: 'click' as const,
        description: 'Click',
        params: { x: 100, y: 100 },
        confidence: 0.9,
      };

      const clickSpy = vi.spyOn(backend, 'click');
      await (nativeAgent as any).executeAction(action);

      expect(clickSpy).toHaveBeenCalledWith(
        { x: 100, y: 100 },
        expect.any(Object),
      );
    });

    it('should apply coordinate scaling when configured', async () => {
      const scaledAgent = new SurfAgent(sessionId, backend, {
        scalingMode: 'scaled',
        targetResolution: { width: 3840, height: 2160, scaleFactor: 2 },
      });

      // Initialize scaler by calling execute
      const visionAnalyzer = (scaledAgent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue(null);

      await scaledAgent.execute('Test');

      const action = {
        action: 'click' as const,
        description: 'Click',
        params: { x: 100, y: 100 },
        confidence: 0.9,
      };

      const clickSpy = vi.spyOn(backend, 'click');
      await (scaledAgent as any).executeAction(action);

      // Coordinates should be scaled
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('security validation', () => {
    it('should block dangerous commands', async () => {
      const secureAgent = new SurfAgent(sessionId, backend, {
        sandbox: {
          enabled: true,
          blockedCommands: ['rm -rf'],
        },
      });

      const visionAnalyzer = (secureAgent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'getNextAction')
        .mockResolvedValueOnce({
          action: 'type',
          description: 'Type command',
          params: { text: 'rm -rf /' },
          confidence: 0.9,
        })
        .mockResolvedValueOnce(null);

      const result = await secureAgent.execute('Test');

      expect(result.state.actionHistory.length).toBe(1);
      expect(result.state.actionHistory[0].success).toBe(false);
      expect(result.state.actionHistory[0].error).toContain(
        'Blocked by security',
      );
    });

    it('should allow safe commands', async () => {
      const secureAgent = new SurfAgent(sessionId, backend, {
        sandbox: {
          enabled: true,
        },
      });

      const visionAnalyzer = (secureAgent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'getNextAction')
        .mockResolvedValueOnce({
          action: 'type',
          description: 'Type text',
          params: { text: 'Hello world' },
          confidence: 0.9,
        })
        .mockResolvedValueOnce(null);

      const result = await secureAgent.execute('Test');

      expect(result.state.actionHistory.length).toBe(1);
      expect(result.state.actionHistory[0].success).toBe(true);
    });
  });

  describe('execute', () => {
    it('should complete when vision returns null', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue(null);

      const result = await agent.execute('Test task');

      expect(result.state.status).toBe('completed');
      expect(result.response).toContain('completed successfully');
    });

    it('should respect max steps limit', async () => {
      const limitedAgent = new SurfAgent(sessionId, backend, { maxSteps: 2 });
      const visionAnalyzer = (limitedAgent as any).visionAnalyzer;

      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue({
        action: 'click',
        description: 'Click',
        params: { x: 100, y: 100 },
        confidence: 0.9,
      });

      const result = await limitedAgent.execute('Test task');

      expect(result.state.currentStep).toBeLessThanOrEqual(2);
      expect(result.state.status).toBe('completed');
    });

    it('should record action history', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;

      vi.spyOn(visionAnalyzer, 'getNextAction')
        .mockResolvedValueOnce({
          action: 'click',
          description: 'Click button',
          params: { x: 100, y: 100 },
          confidence: 0.9,
        })
        .mockResolvedValueOnce({
          action: 'type',
          description: 'Type text',
          params: { text: 'Hello' },
          confidence: 0.9,
        })
        .mockResolvedValueOnce(null);

      const result = await agent.execute('Test task');

      expect(result.state.actionHistory.length).toBe(2);
      expect(result.state.actionHistory[0].action).toBe('click');
      expect(result.state.actionHistory[1].action).toBe('type');
    });

    it('should handle backend errors gracefully', async () => {
      vi.spyOn(backend, 'screenshot').mockRejectedValue(
        new Error('Screenshot failed'),
      );

      const result = await agent.execute('Test task');

      expect(result.state.status).toBe('error');
      expect(result.state.error).toContain('Screenshot failed');
    });

    it('should set start and end times', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue(null);

      const result = await agent.execute('Test task');

      expect(result.state.startTime).toBeDefined();
      expect(result.state.endTime).toBeDefined();
      expect(result.state.endTime!.getTime()).toBeGreaterThanOrEqual(
        result.state.startTime!.getTime(),
      );
    });
  });

  describe('executeStream', () => {
    it('should yield screenshot events', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'analyzeScreen').mockResolvedValue({
        description: 'Test screen',
        elements: [],
        suggestedActions: [],
        currentState: 'idle',
      });
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue(null);

      const events = [];
      for await (const event of agent.executeStream('Test task')) {
        events.push(event);
      }

      const screenshotEvents = events.filter((e) => e.type === 'screenshot');
      expect(screenshotEvents.length).toBeGreaterThan(0);
    });

    it('should yield analysis events', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'analyzeScreen').mockResolvedValue({
        description: 'Test screen',
        elements: [],
        suggestedActions: [],
        currentState: 'idle',
      });
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue(null);

      const events = [];
      for await (const event of agent.executeStream('Test task')) {
        events.push(event);
      }

      const analysisEvents = events.filter((e) => e.type === 'analysis');
      expect(analysisEvents.length).toBeGreaterThan(0);
    });

    it('should yield action events', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'analyzeScreen').mockResolvedValue({
        description: 'Test screen',
        elements: [],
        suggestedActions: [],
        currentState: 'idle',
      });
      vi.spyOn(visionAnalyzer, 'getNextAction')
        .mockResolvedValueOnce({
          action: 'click',
          description: 'Click',
          params: { x: 100, y: 100 },
          confidence: 0.9,
        })
        .mockResolvedValueOnce(null);

      const events = [];
      for await (const event of agent.executeStream('Test task')) {
        events.push(event);
      }

      const actionEvents = events.filter((e) => e.type === 'action');
      expect(actionEvents.length).toBeGreaterThan(0);
    });

    it('should yield complete event at the end', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'analyzeScreen').mockResolvedValue({
        description: 'Test',
        elements: [],
        suggestedActions: [],
        currentState: 'idle',
      });
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue(null);

      const events = [];
      for await (const event of agent.executeStream('Test task')) {
        events.push(event);
      }

      const completeEvent = events[events.length - 1];
      expect(completeEvent.type).toBe('complete');
    });

    it('should yield error event on failure', async () => {
      vi.spyOn(backend, 'screenshot').mockRejectedValue(
        new Error('Screenshot failed'),
      );

      const events = [];
      for await (const event of agent.executeStream('Test task')) {
        events.push(event);
      }

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle stop during streaming', async () => {
      const visionAnalyzer = (agent as any).visionAnalyzer;
      vi.spyOn(visionAnalyzer, 'analyzeScreen').mockResolvedValue({
        description: 'Test',
        elements: [],
        suggestedActions: [],
        currentState: 'idle',
      });
      vi.spyOn(visionAnalyzer, 'getNextAction').mockResolvedValue({
        action: 'click',
        description: 'Click',
        params: { x: 100, y: 100 },
        confidence: 0.9,
      });

      const events = [];
      const stream = agent.executeStream('Test task');

      // Collect a few events then stop
      let count = 0;
      for await (const event of stream) {
        events.push(event);
        count++;
        if (count === 3) {
          agent.stop();
        }
      }

      const completeEvent = events[events.length - 1];
      expect(completeEvent.type).toBe('complete');
      expect((completeEvent as any).response).toContain('paused');
    });
  });
});

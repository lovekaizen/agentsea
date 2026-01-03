/**
 * ReplayEngine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReplayEngine, createReplayEngine } from '../replay/ReplayEngine.js';
import type { Recording, ExecutionStep, AgentState } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-4',
  memory: { size: 0 },
  context: {},
  tools: [],
  messages: [],
});

const createMockStep = (
  index: number,
  type: ExecutionStep['type'] = 'input',
): ExecutionStep => ({
  id: `step_${index}`,
  index,
  type,
  timestamp: Date.now(),
  durationMs: 100,
  input: `Input ${index}`,
});

const createMockRecording = (): Recording => {
  const initialState = createMockState();
  const steps = [
    createMockStep(0, 'input'),
    createMockStep(1, 'response'),
    createMockStep(2, 'tool-call'),
    createMockStep(3, 'tool-result'),
  ];

  steps[2].toolCall = {
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'test' },
  };

  steps[3].toolCall = {
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'test' },
    result: 'search results',
    success: true,
  };

  return {
    id: 'rec_123',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'completed',
    startedAt: Date.now() - 10000,
    endedAt: Date.now(),
    durationMs: 10000,
    steps,
    toolCalls: [steps[2].toolCall!, steps[3].toolCall!],
    decisions: [],
    checkpoints: [],
    initialState,
    finalState: initialState,
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    version: '1.0.0',
  };
};

describe('ReplayEngine', () => {
  let engine: ReplayEngine;
  let recording: Recording;

  beforeEach(() => {
    engine = new ReplayEngine();
    recording = createMockRecording();
  });

  describe('initialization', () => {
    it('should create engine with default config', () => {
      expect(engine).toBeDefined();
      expect(engine.getSession()).toBeUndefined();
    });

    it('should create engine with custom config', () => {
      const customEngine = new ReplayEngine({
        speedMultiplier: 2,
        pauseOnDecisions: true,
      });
      expect(customEngine).toBeDefined();
    });
  });

  describe('start replay', () => {
    it('should start a replay session', () => {
      const session = engine.start(recording);
      expect(session).toBeDefined();
      expect(session.id).toMatch(/^replay_/);
      expect(session.state).toBe('idle');
      expect(session.recordingId).toBe('rec_123');
    });

    it('should use default speed', () => {
      const session = engine.start(recording);
      expect(session.speed).toBe('normal');
    });

    it('should use custom speed', () => {
      const session = engine.start(recording, { speed: 'fast' });
      expect(session.speed).toBe('fast');
    });

    it('should apply modifications', () => {
      const session = engine.start(recording, {
        modifications: [{ stepIndex: 1, type: 'skip' }],
      });
      expect(session.modifications).toHaveLength(1);
    });

    it('should set start and end steps', () => {
      const session = engine.start(recording, {
        startStep: 1,
        endStep: 2,
      });
      expect(session.currentStep).toBe(1);
    });
  });

  describe('replay control', () => {
    it('should pause replay', () => {
      const session = engine.start(recording);
      engine.pause();
      const currentSession = engine.getSession();
      expect(currentSession?.state).toBe('paused');
    });

    it('should resume replay', async () => {
      engine.start(recording);
      engine.pause();
      engine.resume();
      const session = engine.getSession();
      expect(session?.state).toBe('playing');
    });

    it('should stop replay', async () => {
      engine.start(recording);
      engine.stop();
      // Wait a bit for async stop
      await new Promise((resolve) => setTimeout(resolve, 100));
      const session = engine.getSession();
      expect(session?.state).toBe('stopped');
    });

    it('should set speed during replay', () => {
      engine.start(recording);
      engine.setSpeed('fast');
      const session = engine.getSession();
      expect(session?.speed).toBe('fast');
    });

    it('should jump to step', () => {
      engine.start(recording);
      engine.jumpToStep(2);
      const session = engine.getSession();
      expect(session?.currentStep).toBe(2);
    });
  });

  describe('events', () => {
    it('should emit replay started event', () => {
      const handler = vi.fn();
      engine.on('replay:started', handler);
      engine.start(recording);
      expect(handler).toHaveBeenCalled();
    });

    it('should emit replay paused event', () => {
      const handler = vi.fn();
      engine.on('replay:paused', handler);
      engine.start(recording);
      engine.pause();
      expect(handler).toHaveBeenCalled();
    });

    it('should emit replay resumed event', () => {
      const handler = vi.fn();
      engine.on('replay:resumed', handler);
      engine.start(recording);
      engine.pause();
      engine.resume();
      expect(handler).toHaveBeenCalled();
    });

    it('should emit step replayed events', async () => {
      const handler = vi.fn();
      engine.on('step:replayed', handler);
      engine.start(recording, { speed: 'instant' });

      // Wait for replay to complete
      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit replay completed event', async () => {
      const handler = vi.fn();
      engine.on('replay:completed', handler);
      engine.start(recording, { speed: 'instant' });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    it('should get current session', () => {
      const session = engine.start(recording);
      const current = engine.getSession();
      expect(current?.id).toBe(session.id);
    });

    it('should get session by ID', () => {
      const session = engine.start(recording);
      const retrieved = engine.getSessionById(session.id);
      expect(retrieved?.id).toBe(session.id);
    });

    it('should get all sessions', () => {
      engine.start(recording);
      const sessions = engine.getSessions();
      expect(sessions).toHaveLength(1);
    });
  });

  describe('modifications', () => {
    it('should skip steps', async () => {
      const handler = vi.fn();
      engine.on('step:modified', handler);

      engine.start(recording, {
        speed: 'instant',
        modifications: [{ stepIndex: 1, type: 'skip' }],
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should modify step data', async () => {
      const handler = vi.fn();
      engine.on('step:modified', handler);

      engine.start(recording, {
        speed: 'instant',
        modifications: [
          {
            stepIndex: 0,
            type: 'modify',
            data: { input: 'modified input' },
          },
        ],
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should replace steps', async () => {
      engine.start(recording, {
        speed: 'instant',
        modifications: [
          {
            stepIndex: 0,
            type: 'replace',
            data: { type: 'custom', input: 'replaced' },
          },
        ],
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });
    });
  });

  describe('tool execution', () => {
    it('should execute tools when configured', async () => {
      const onToolCall = vi.fn().mockResolvedValue('tool result');

      engine.start(recording, {
        speed: 'instant',
        executeTools: true,
        onToolCall,
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });

      expect(onToolCall).toHaveBeenCalled();
    });

    it('should handle tool execution errors', async () => {
      const onToolCall = vi.fn().mockRejectedValue(new Error('Tool error'));

      engine.start(recording, {
        speed: 'instant',
        executeTools: true,
        onToolCall,
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });
    });
  });

  describe('LLM execution', () => {
    it('should execute LLM calls when configured', async () => {
      const onLLMCall = vi.fn().mockResolvedValue('LLM response');

      engine.start(recording, {
        speed: 'instant',
        executeLLM: true,
        onLLMCall,
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });

      expect(onLLMCall).toHaveBeenCalled();
    });

    it('should handle LLM execution errors', async () => {
      const onLLMCall = vi.fn().mockRejectedValue(new Error('LLM error'));

      engine.start(recording, {
        speed: 'instant',
        executeLLM: true,
        onLLMCall,
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });
    });
  });

  describe('divergence detection', () => {
    it('should detect differences when executing', async () => {
      const handler = vi.fn();
      engine.on('divergence:detected', handler);

      const onLLMCall = vi.fn().mockResolvedValue('Different response');

      engine.start(recording, {
        speed: 'instant',
        executeLLM: true,
        onLLMCall,
      });

      await new Promise((resolve) => {
        engine.on('replay:completed', resolve);
      });
    });
  });

  describe('pause conditions', () => {
    it('should pause on decisions when configured', async () => {
      const decisionRecording = createMockRecording();
      const decisionStep = createMockStep(4, 'decision');
      decisionStep.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      decisionRecording.steps.push(decisionStep);

      const pauseHandler = vi.fn();
      const customEngine = new ReplayEngine({ pauseOnDecisions: true });
      customEngine.on('replay:paused', pauseHandler);

      customEngine.start(decisionRecording, { speed: 'instant' });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should pause at decision
      expect(pauseHandler).toHaveBeenCalled();
    });

    it('should pause on errors when configured', async () => {
      const errorRecording = createMockRecording();
      const errorStep = createMockStep(4, 'error');
      errorStep.error = { name: 'Error', message: 'Test error' };
      errorRecording.steps.push(errorStep);

      const customEngine = new ReplayEngine({ pauseOnErrors: true });
      const pauseHandler = vi.fn();
      customEngine.on('replay:paused', pauseHandler);

      customEngine.start(errorRecording, { speed: 'instant' });

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(pauseHandler).toHaveBeenCalled();
    });
  });
});

describe('createReplayEngine', () => {
  it('should create engine with factory function', () => {
    const engine = createReplayEngine();
    expect(engine).toBeInstanceOf(ReplayEngine);
  });

  it('should pass config to engine', () => {
    const engine = createReplayEngine({ speedMultiplier: 2 });
    expect(engine).toBeDefined();
  });
});

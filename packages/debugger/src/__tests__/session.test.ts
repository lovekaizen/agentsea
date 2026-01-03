/**
 * Session Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DebugSessionManager, createDebugSession } from '../core/Session.js';
import type { ExecutionStep, AgentState } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-4',
  memory: { size: 0 },
  context: {},
  tools: ['search', 'calculate'],
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
  input: `Step ${index}`,
});

describe('DebugSessionManager', () => {
  let session: DebugSessionManager;
  let state: AgentState;

  beforeEach(() => {
    session = new DebugSessionManager({ agentId: 'test-agent' });
    state = createMockState();
  });

  describe('lifecycle', () => {
    it('should initialize with idle state', () => {
      expect(session.sessionState).toBe('idle');
      expect(session.id).toMatch(/^session_/);
    });

    it('should start session', () => {
      session.start();
      expect(session.sessionState).toBe('running');
    });

    it('should throw error when starting non-idle session', () => {
      session.start();
      expect(() => session.start()).toThrow('Cannot start session');
    });

    it('should stop session', () => {
      session.start();
      session.stop();
      expect(session.sessionState).toBe('stopped');
    });

    it('should not stop already stopped session', () => {
      session.start();
      session.stop();
      session.stop(); // Should not throw
      expect(session.sessionState).toBe('stopped');
    });

    it('should complete session', () => {
      session.start();
      session.complete();
      expect(session.sessionState).toBe('completed');
    });

    it('should mark session as errored', () => {
      session.start();
      const error = new Error('Test error');
      session.error(error);
      expect(session.sessionState).toBe('error');
    });
  });

  describe('pause and resume', () => {
    it('should pause running session', () => {
      session.start();
      session.pause();
      expect(session.sessionState).toBe('paused');
    });

    it('should resume paused session', () => {
      session.start();
      session.pause();
      session.continue();
      expect(session.sessionState).toBe('running');
    });

    it('should not resume non-paused session', () => {
      session.start();
      session.continue(); // Should not throw
      expect(session.sessionState).toBe('running');
    });
  });

  describe('step execution', () => {
    it('should add steps', () => {
      session.start();
      const step = createMockStep(0);
      const result = session.addStep(step, state);
      expect(result).toBe(true);
      expect(session.getSteps()).toHaveLength(1);
    });

    it('should not add steps when not running', () => {
      const step = createMockStep(0);
      const result = session.addStep(step, state);
      expect(result).toBe(false);
      expect(session.getSteps()).toHaveLength(0);
    });

    it('should update current step index', () => {
      session.start();
      const step = createMockStep(5);
      session.addStep(step, state);
      const sessionData = session.getSession();
      expect(sessionData.currentStep).toBe(5);
    });

    it('should update total steps count', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      session.addStep(createMockStep(1), state);
      session.addStep(createMockStep(2), state);
      const sessionData = session.getSession();
      expect(sessionData.totalSteps).toBe(3);
    });

    it('should emit step executed event', () => {
      const handler = vi.fn();
      session.on('step:executed', handler);
      session.start();
      const step = createMockStep(0);
      session.addStep(step, state);
      expect(handler).toHaveBeenCalledWith(step);
    });
  });

  describe('step controls', () => {
    it('should step over', () => {
      session.start();
      session.pause();
      session.stepOver();
      expect(session.sessionState).toBe('running');
    });

    it('should step into', () => {
      session.start();
      session.pause();
      session.stepInto();
      expect(session.sessionState).toBe('running');
    });

    it('should step out', () => {
      session.start();
      session.pause();
      session.stepOut();
      expect(session.sessionState).toBe('running');
    });

    it('should pause after step over', () => {
      session.start();
      const step = createMockStep(0);
      session.addStep(step, state);
      session.pause(); // Must pause first before calling stepOver
      session.stepOver();
      const step2 = createMockStep(1);
      const result = session.addStep(step2, state);
      expect(result).toBe(false);
      expect(session.sessionState).toBe('paused');
    });
  });

  describe('breakpoints', () => {
    it('should set breakpoint', () => {
      const bp = session.setBreakpoint({ type: 'tool-call' });
      expect(bp).toBeDefined();
      expect(bp.type).toBe('tool-call');
    });

    it('should get all breakpoints', () => {
      session.setBreakpoint({ type: 'error' });
      session.setBreakpoint({ type: 'decision' });
      const bps = session.getBreakpoints();
      expect(bps).toHaveLength(2);
    });

    it('should remove breakpoint', () => {
      const bp = session.setBreakpoint({ type: 'error' });
      const result = session.removeBreakpoint(bp.id);
      expect(result).toBe(true);
      expect(session.getBreakpoints()).toHaveLength(0);
    });

    it('should return false when removing non-existent breakpoint', () => {
      const result = session.removeBreakpoint('non-existent');
      expect(result).toBe(false);
    });

    it('should hit breakpoint and pause', () => {
      session.start();
      session.setBreakpoint({ type: 'error' });
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test error' };
      const result = session.addStep(errorStep, state);
      expect(result).toBe(false);
      expect(session.sessionState).toBe('paused');
    });

    it('should emit breakpoint hit event', () => {
      const handler = vi.fn();
      session.on('breakpoint:hit', handler);
      session.start();
      session.setBreakpoint({ type: 'tool-call' });
      const toolStep = createMockStep(0, 'tool-call');
      toolStep.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
      };
      session.addStep(toolStep, state);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('checkpoints', () => {
    it('should create checkpoint', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      const cp = session.createCheckpoint({ name: 'test-checkpoint' });
      expect(cp).toBeDefined();
      expect(cp.name).toBe('test-checkpoint');
    });

    it('should create automatic checkpoint', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      const cp = session.createCheckpoint({
        name: 'auto',
        automatic: true,
      });
      expect(cp.automatic).toBe(true);
    });

    it('should get checkpoint by ID', () => {
      session.start();
      const cp = session.createCheckpoint({ name: 'test' });
      const retrieved = session.getCheckpoint(cp.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(cp.id);
    });

    it('should list all checkpoints', () => {
      session.start();
      session.createCheckpoint({ name: 'cp1' });
      session.createCheckpoint({ name: 'cp2' });
      const checkpoints = session.getCheckpoints();
      expect(checkpoints).toHaveLength(2);
    });

    it('should restore from checkpoint', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      session.addStep(createMockStep(1), state);
      session.addStep(createMockStep(2), state);
      const cp = session.createCheckpoint({ name: 'before-step-3' });
      session.addStep(createMockStep(3), state);
      session.addStep(createMockStep(4), state);

      const result = session.restoreCheckpoint(cp.id);
      expect(result).toBe(true);
      expect(session.getSteps()).toHaveLength(3);
    });

    it('should return false when restoring non-existent checkpoint', () => {
      session.start();
      const result = session.restoreCheckpoint('non-existent');
      expect(result).toBe(false);
    });

    it('should emit checkpoint created event', () => {
      const handler = vi.fn();
      session.on('checkpoint:created', handler);
      session.start();
      const cp = session.createCheckpoint({ name: 'test' });
      expect(handler).toHaveBeenCalledWith(cp);
    });
  });

  describe('auto-checkpoint', () => {
    it('should create automatic checkpoints at interval', () => {
      const sessionWithCheckpoints = new DebugSessionManager({
        agentId: 'test-agent',
        checkpointInterval: 2,
      });
      sessionWithCheckpoints.start();
      sessionWithCheckpoints.addStep(createMockStep(0), state);
      sessionWithCheckpoints.addStep(createMockStep(1), state);

      const checkpoints = sessionWithCheckpoints.getCheckpoints();
      expect(checkpoints.length).toBeGreaterThan(0);
      expect(checkpoints[0].automatic).toBe(true);
    });
  });

  describe('state', () => {
    it('should get current state', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      const currentState = session.getState();
      expect(currentState.agentId).toBe('test-agent');
    });

    it('should update state with steps', () => {
      session.start();
      const newState = { ...state, context: { key: 'value' } };
      session.addStep(createMockStep(0), newState);
      const currentState = session.getState();
      expect(currentState.context).toEqual({ key: 'value' });
    });
  });

  describe('inspector', () => {
    it('should create inspector', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      const inspector = session.inspect();
      expect(inspector).toBeDefined();
      expect(inspector.getCurrentStepIndex()).toBe(0);
    });

    it('should provide current state to inspector', () => {
      session.start();
      const newState = { ...state, agentName: 'Modified Agent' };
      session.addStep(createMockStep(0), newState);
      const inspector = session.inspect();
      const result = inspector.inspect();
      expect(result.state.agentName).toBe('Modified Agent');
    });
  });

  describe('recording export', () => {
    it('should export to recording format', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      session.addStep(createMockStep(1), state);
      session.complete();

      const recording = session.toRecording();
      expect(recording).toBeDefined();
      expect(recording.agentId).toBe('test-agent');
      expect(recording.steps).toHaveLength(2);
      expect(recording.status).toBe('completed');
    });

    it('should include tool calls in recording', () => {
      session.start();
      const toolStep = createMockStep(0, 'tool-call');
      toolStep.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test' },
      };
      session.addStep(toolStep, state);

      const recording = session.toRecording();
      expect(recording.toolCalls).toHaveLength(1);
      expect(recording.toolCalls[0].name).toBe('search');
    });

    it('should include decisions in recording', () => {
      session.start();
      const decisionStep = createMockStep(0, 'decision');
      decisionStep.decision = {
        id: 'dec_1',
        prompt: 'Choose an option',
        options: [
          { id: 'opt1', description: 'Option 1' },
          { id: 'opt2', description: 'Option 2' },
        ],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      session.addStep(decisionStep, state);

      const recording = session.toRecording();
      expect(recording.decisions).toHaveLength(1);
      expect(recording.decisions[0].chosen.description).toBe('Option 1');
    });

    it('should calculate token usage', () => {
      session.start();
      const step1 = createMockStep(0, 'response');
      step1.tokenUsage = { prompt: 10, completion: 20, total: 30 };
      const step2 = createMockStep(1, 'response');
      step2.tokenUsage = { prompt: 15, completion: 25, total: 40 };
      session.addStep(step1, state);
      session.addStep(step2, state);

      const recording = session.toRecording();
      expect(recording.tokenUsage).toEqual({
        prompt: 25,
        completion: 45,
        total: 70,
      });
    });

    it('should include checkpoints in recording', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      session.createCheckpoint({ name: 'cp1' });
      session.addStep(createMockStep(1), state);
      session.createCheckpoint({ name: 'cp2' });

      const recording = session.toRecording();
      expect(recording.checkpoints).toHaveLength(2);
    });

    it('should set status to failed when not completed', () => {
      session.start();
      session.addStep(createMockStep(0), state);
      session.stop();

      const recording = session.toRecording();
      expect(recording.status).toBe('failed');
    });
  });

  describe('async wait for continue', () => {
    it('should resolve immediately when not paused', async () => {
      session.start();
      const action = await session.waitForContinue();
      expect(action).toBe('continue');
    });

    it('should wait for continue signal', async () => {
      session.start();
      session.pause();

      const promise = session.waitForContinue();

      // Continue after a delay
      setTimeout(() => session.continue(), 10);

      const action = await promise;
      expect(action).toBe('continue');
    });

    it('should resolve with step-over action', async () => {
      session.start();
      session.pause();

      const promise = session.waitForContinue();

      setTimeout(() => session.stepOver(), 10);

      const action = await promise;
      expect(action).toBe('step-over');
    });
  });

  describe('events', () => {
    it('should emit state changed events', () => {
      const handler = vi.fn();
      session.on('state:changed', handler);
      session.start();
      expect(handler).toHaveBeenCalledWith('running');
    });

    it('should emit step paused event', () => {
      const handler = vi.fn();
      session.on('step:paused', handler);
      session.start();
      session.setBreakpoint({ type: 'error' });
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test' };
      session.addStep(errorStep, state);
      expect(handler).toHaveBeenCalled();
    });

    it('should emit error event', () => {
      const handler = vi.fn();
      session.on('error', handler);
      const error = new Error('Test error');
      session.error(error);
      expect(handler).toHaveBeenCalledWith(error);
    });
  });
});

describe('createDebugSession', () => {
  it('should create a session with factory function', () => {
    const session = createDebugSession({ agentId: 'test-agent' });
    expect(session).toBeInstanceOf(DebugSessionManager);
    expect(session.id).toMatch(/^session_/);
  });
});

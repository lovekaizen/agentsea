/**
 * StateRestorer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateRestorer, createStateRestorer } from '../replay/StateRestorer.js';
import type {
  Recording,
  ExecutionStep,
  AgentState,
  Checkpoint,
} from '../types/index.js';

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
});

const createMockRecording = (): Recording => {
  const initialState = createMockState();
  const steps: ExecutionStep[] = [
    createMockStep(0, 'input'),
    createMockStep(1, 'response'),
    createMockStep(2, 'tool-call'),
    createMockStep(3, 'tool-result'),
    createMockStep(4, 'memory-write'),
  ];

  steps[0].input = 'Hello';
  steps[1].output = 'Hi there';

  steps[2].toolCall = {
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'test' },
  };

  steps[3].toolCall = {
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'test' },
    result: 'results',
    success: true,
  };

  steps[4].output = { working: { key: 'value' } };

  return {
    id: 'rec_123',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'completed',
    startedAt: Date.now() - 10000,
    endedAt: Date.now(),
    durationMs: 10000,
    steps,
    toolCalls: [],
    decisions: [],
    checkpoints: [],
    initialState,
    finalState: createMockState(),
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    version: '1.0.0',
  };
};

describe('StateRestorer', () => {
  let restorer: StateRestorer;
  let recording: Recording;

  beforeEach(() => {
    restorer = new StateRestorer();
    recording = createMockRecording();
  });

  describe('initialization', () => {
    it('should create restorer with default options', () => {
      expect(restorer).toBeDefined();
    });

    it('should create restorer with custom options', () => {
      const customRestorer = new StateRestorer({
        includeMemory: false,
        includeContext: false,
      });
      expect(customRestorer).toBeDefined();
    });
  });

  describe('restore from recording', () => {
    it('should restore initial state', () => {
      const state = restorer.restore(recording, -1);
      expect(state.agentId).toBe('test-agent');
      expect(state.messages).toHaveLength(0);
    });

    it('should restore state at step 0', () => {
      const state = restorer.restore(recording, 0);
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].content).toBe('Hello');
    });

    it('should restore state at later step', () => {
      const state = restorer.restore(recording, 1);
      expect(state.messages).toHaveLength(2);
      expect(state.messages[1].role).toBe('assistant');
    });

    it('should include tool calls in messages', () => {
      const state = restorer.restore(recording, 2);
      expect(state.messages).toHaveLength(3);
      expect(state.messages[2].role).toBe('assistant');
      expect(state.messages[2].toolCalls).toBeDefined();
    });

    it('should include tool results in messages', () => {
      const state = restorer.restore(recording, 3);
      expect(state.messages).toHaveLength(4);
      expect(state.messages[3].role).toBe('tool');
    });

    it('should apply memory changes', () => {
      const state = restorer.restore(recording, 4);
      expect(state.memory.working).toEqual({ key: 'value' });
    });
  });

  describe('restore with checkpoints', () => {
    it('should use checkpoint when available', () => {
      const checkpointState = createMockState();
      checkpointState.context = { checkpoint: true };
      const checkpoint: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'test-checkpoint',
        stepIndex: 2,
        timestamp: Date.now(),
        state: checkpointState,
        automatic: false,
      };

      recording.checkpoints.push(checkpoint);

      const state = restorer.restore(recording, 3);
      // Should start from checkpoint at step 2
      expect(state.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('should choose closest checkpoint', () => {
      const checkpoint1: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'checkpoint-1',
        stepIndex: 1,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };

      const checkpoint2: Checkpoint = {
        id: 'cp_2',
        recordingId: 'rec_123',
        name: 'checkpoint-2',
        stepIndex: 3,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };

      recording.checkpoints.push(checkpoint1, checkpoint2);

      const state = restorer.restore(recording, 4);
      expect(state).toBeDefined();
    });

    it('should not use checkpoint after target step', () => {
      const checkpoint: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'future-checkpoint',
        stepIndex: 5,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };

      recording.checkpoints.push(checkpoint);

      const state = restorer.restore(recording, 2);
      expect(state).toBeDefined();
    });
  });

  describe('restore from checkpoint', () => {
    it('should restore directly from checkpoint', () => {
      const checkpointState = createMockState();
      checkpointState.context = { restored: true };
      const checkpoint: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'test',
        stepIndex: 2,
        timestamp: Date.now(),
        state: checkpointState,
        automatic: false,
      };

      const state = restorer.restoreFromCheckpoint(checkpoint);
      expect(state.context).toEqual({ restored: true });
    });

    it('should not modify original checkpoint', () => {
      const checkpointState = createMockState();
      const checkpoint: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'test',
        stepIndex: 2,
        timestamp: Date.now(),
        state: checkpointState,
        automatic: false,
      };

      const state = restorer.restoreFromCheckpoint(checkpoint);
      state.context.modified = true;
      expect(checkpoint.state.context.modified).toBeUndefined();
    });
  });

  describe('apply step', () => {
    it('should apply input step', () => {
      const state = createMockState();
      const step = createMockStep(0, 'input');
      step.input = 'Test input';
      const newState = restorer.applyStep(state, step);
      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0].content).toBe('Test input');
    });

    it('should apply response step', () => {
      const state = createMockState();
      const step = createMockStep(0, 'response');
      step.output = 'Test response';
      const newState = restorer.applyStep(state, step);
      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0].role).toBe('assistant');
    });

    it('should apply tool call step', () => {
      const state = createMockState();
      const step = createMockStep(0, 'tool-call');
      step.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test' },
      };
      const newState = restorer.applyStep(state, step);
      expect(newState.messages).toHaveLength(1);
      expect(newState.messages[0].toolCalls).toBeDefined();
    });

    it('should apply decision step', () => {
      const state = createMockState();
      const step = createMockStep(0, 'decision');
      step.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      const newState = restorer.applyStep(state, step);
      expect(newState.context.lastDecision).toBeDefined();
    });

    it('should apply error step', () => {
      const state = createMockState();
      const step = createMockStep(0, 'error');
      step.error = { name: 'Error', message: 'Test error' };
      const newState = restorer.applyStep(state, step);
      expect(newState.context.lastError).toEqual(step.error);
    });

    it('should apply handoff step', () => {
      const state = createMockState();
      const step = createMockStep(0, 'handoff');
      step.output = { agentId: 'agent-2', agentName: 'Agent 2' };
      const newState = restorer.applyStep(state, step);
      expect(newState.context.delegatedTo).toBe('agent-2');
    });

    it('should not modify original state', () => {
      const state = createMockState();
      const step = createMockStep(0, 'input');
      step.input = 'Test';
      restorer.applyStep(state, step);
      expect(state.messages).toHaveLength(0);
    });
  });

  describe('restore options', () => {
    it('should skip messages when configured', () => {
      const noMessagesRestorer = new StateRestorer({
        includeMessages: false,
      });
      const state = noMessagesRestorer.restore(recording, 1);
      expect(state.messages).toHaveLength(0);
    });

    it('should skip memory when configured', () => {
      const noMemoryRestorer = new StateRestorer({ includeMemory: false });
      const state = noMemoryRestorer.restore(recording, 4);
      expect(state.memory.working).toBeUndefined();
    });

    it('should skip context when configured', () => {
      const decisionRecording = createMockRecording();
      const decisionStep = createMockStep(5, 'decision');
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

      const noContextRestorer = new StateRestorer({ includeContext: false });
      const state = noContextRestorer.restore(decisionRecording, 5);
      expect(state.context.lastDecision).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('should validate correct state', () => {
      const state = createMockState();
      const validation = restorer.validate(state);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing agentId', () => {
      const state = createMockState();
      state.agentId = '';
      const validation = restorer.validate(state);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing agentId');
    });

    it('should detect missing memory', () => {
      const state = createMockState();
      (state as any).memory = undefined;
      const validation = restorer.validate(state);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('memory'))).toBe(true);
    });

    it('should detect invalid messages array', () => {
      const state = createMockState();
      (state as any).messages = 'not an array';
      const validation = restorer.validate(state);
      expect(validation.valid).toBe(false);
    });

    it('should warn about missing optional fields', () => {
      const state = createMockState();
      state.agentName = '';
      const validation = restorer.validate(state);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should validate message structure', () => {
      const state = createMockState();
      state.messages = [{ role: 'user', content: '' } as any];
      const validation = restorer.validate(state);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('merge states', () => {
    it('should merge states', () => {
      const base = createMockState();
      const overlay = {
        agentName: 'New Name',
        context: { key: 'value' },
      };
      const merged = restorer.merge(base, overlay);
      expect(merged.agentName).toBe('New Name');
      expect(merged.context).toEqual({ key: 'value' });
    });

    it('should not modify base state', () => {
      const base = createMockState();
      const overlay = { agentName: 'New Name' };
      restorer.merge(base, overlay);
      expect(base.agentName).toBe('Test Agent');
    });

    it('should merge memory', () => {
      const base = createMockState();
      const overlay = { memory: { size: 100 } };
      const merged = restorer.merge(base, overlay);
      expect(merged.memory.size).toBe(100);
    });
  });

  describe('create minimal state', () => {
    it('should create minimal valid state', () => {
      const state = restorer.createMinimalState('agent-1', 'Agent', 'gpt-4');
      expect(state.agentId).toBe('agent-1');
      expect(state.agentName).toBe('Agent');
      expect(state.model).toBe('gpt-4');
      const validation = restorer.validate(state);
      expect(validation.valid).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache restored states', () => {
      restorer.restore(recording, 2);
      expect(restorer.getCacheSize()).toBeGreaterThan(0);
    });

    it('should use cached state on second restore', () => {
      const state1 = restorer.restore(recording, 2);
      const state2 = restorer.restore(recording, 2);
      expect(state1).toEqual(state2);
    });

    it('should clear cache', () => {
      restorer.restore(recording, 2);
      restorer.clearCache();
      expect(restorer.getCacheSize()).toBe(0);
    });

    it('should clear cache for specific recording', () => {
      restorer.restore(recording, 2);
      restorer.clearRecordingCache('rec_123');
      expect(restorer.getCacheSize()).toBe(0);
    });
  });
});

describe('createStateRestorer', () => {
  it('should create restorer with factory function', () => {
    const restorer = createStateRestorer();
    expect(restorer).toBeInstanceOf(StateRestorer);
  });

  it('should pass options to restorer', () => {
    const restorer = createStateRestorer({ includeMemory: false });
    expect(restorer).toBeDefined();
  });
});

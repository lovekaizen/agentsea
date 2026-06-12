/**
 * ReplayController Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReplayController,
  createReplayController,
} from '../replay/ReplayController.js';
import type {
  Recording,
  ReplaySession,
  ExecutionStep,
  AgentState,
  Checkpoint,
  ReplayConfig,
} from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-5.5',
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
    createMockStep(2, 'decision'),
    createMockStep(3, 'tool-call'),
  ];

  steps[2].decision = {
    id: 'dec_1',
    prompt: 'Choose',
    options: [{ id: 'opt1', description: 'Option 1' }],
    chosenIndex: 0,
    chosen: { id: 'opt1', description: 'Option 1' },
    confidence: 0.8,
    timestamp: Date.now(),
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
    toolCalls: [],
    decisions: [steps[2].decision!],
    checkpoints: [],
    initialState,
    finalState: initialState,
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    version: '1.0.0',
  };
};

const createMockSession = (): ReplaySession => ({
  id: 'replay_123',
  recordingId: 'rec_123',
  state: 'idle',
  currentStep: 0,
  totalSteps: 4,
  speed: 'normal',
  startedAt: Date.now(),
  modifications: [],
  differences: [],
});

const createMockConfig = (): Required<ReplayConfig> => ({
  speedMultiplier: 1,
  pauseOnDecisions: false,
  pauseOnErrors: false,
  pauseOnToolCalls: false,
  executeTools: false,
  executeLLM: false,
  compareResults: true,
  trackDifferences: true,
});

describe('ReplayController', () => {
  let controller: ReplayController;
  let recording: Recording;
  let session: ReplaySession;
  let config: Required<ReplayConfig>;

  beforeEach(() => {
    recording = createMockRecording();
    session = createMockSession();
    config = createMockConfig();
    controller = new ReplayController(recording, session, config);
  });

  describe('initialization', () => {
    it('should initialize with recording and session', () => {
      expect(controller).toBeDefined();
      expect(controller.stepsCount).toBe(4);
    });

    it('should start at initial state', () => {
      const playbackState = controller.getPlaybackState();
      expect(playbackState.currentStep).toBe(0);
      expect(playbackState.isPaused).toBe(false);
    });
  });

  describe('step forward', () => {
    it('should step forward', () => {
      const step = controller.stepForward();
      expect(step).toBeDefined();
      expect(step?.index).toBe(1);
    });

    it('should update current step index', () => {
      controller.stepForward();
      const playbackState = controller.getPlaybackState();
      expect(playbackState.currentStep).toBe(1);
    });

    it('should return undefined at end', () => {
      controller.stepForward(); // 1
      controller.stepForward(); // 2
      controller.stepForward(); // 3
      const step = controller.stepForward(); // Past end
      expect(step).toBeUndefined();
    });

    it('should emit step replayed event', () => {
      const handler = vi.fn();
      controller.on('step:replayed', handler);
      controller.stepForward();
      expect(handler).toHaveBeenCalled();
    });

    it('should update state', () => {
      const step = createMockStep(0, 'input');
      step.input = 'Test input';
      recording.steps[0] = step;

      const newController = new ReplayController(recording, session, config);
      newController.stepForward();

      const state = newController.getCurrentState();
      expect(state.messages).toHaveLength(1);
    });
  });

  describe('step backward', () => {
    it('should step backward', () => {
      controller.stepForward();
      controller.stepForward();
      const step = controller.stepBackward();
      expect(step).toBeDefined();
      expect(step?.index).toBe(0);
    });

    it('should update current step index', () => {
      controller.stepForward();
      controller.stepBackward();
      const playbackState = controller.getPlaybackState();
      expect(playbackState.currentStep).toBe(0);
    });

    it('should return undefined at beginning', () => {
      const step = controller.stepBackward();
      expect(step).toBeUndefined();
    });

    it('should restore to initial state', () => {
      controller.stepBackward();
      const playbackState = controller.getPlaybackState();
      expect(playbackState.currentStep).toBe(-1);
    });
  });

  describe('jump to step', () => {
    it('should jump to specific step', () => {
      const step = controller.jumpToStep(2);
      expect(step).toBeDefined();
      expect(step?.index).toBe(2);
    });

    it('should update current step index', () => {
      controller.jumpToStep(2);
      const playbackState = controller.getPlaybackState();
      expect(playbackState.currentStep).toBe(2);
    });

    it('should return undefined for invalid index', () => {
      const step = controller.jumpToStep(10);
      expect(step).toBeUndefined();
    });

    it('should allow jumping to -1 (initial state)', () => {
      controller.stepForward();
      const step = controller.jumpToStep(-1);
      expect(step).toBeUndefined();
      expect(controller.getPlaybackState().currentStep).toBe(-1);
    });

    it('should emit step replayed event', () => {
      const handler = vi.fn();
      controller.on('step:replayed', handler);
      controller.jumpToStep(2);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('checkpoints', () => {
    it('should jump to checkpoint', () => {
      const checkpoint: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'test-checkpoint',
        stepIndex: 2,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      recording.checkpoints.push(checkpoint);

      const newController = new ReplayController(recording, session, config);
      const result = newController.jumpToCheckpoint('cp_1');

      expect(result).toBe(true);
      expect(newController.getPlaybackState().currentStep).toBe(2);
    });

    it('should return false for non-existent checkpoint', () => {
      const result = controller.jumpToCheckpoint('non-existent');
      expect(result).toBe(false);
    });

    it('should emit checkpoint reached event', () => {
      const checkpoint: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'test',
        stepIndex: 1,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      recording.checkpoints.push(checkpoint);

      const handler = vi.fn();
      const newController = new ReplayController(recording, session, config);
      newController.on('checkpoint:reached', handler);
      newController.jumpToCheckpoint('cp_1');

      expect(handler).toHaveBeenCalledWith(checkpoint);
    });

    it('should get next checkpoint', () => {
      const cp1: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'cp1',
        stepIndex: 1,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      const cp2: Checkpoint = {
        id: 'cp_2',
        recordingId: 'rec_123',
        name: 'cp2',
        stepIndex: 3,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      recording.checkpoints.push(cp1, cp2);

      const newController = new ReplayController(recording, session, config);
      newController.jumpToStep(0);

      const next = newController.getNextCheckpoint();
      expect(next?.id).toBe('cp_1');
    });

    it('should get previous checkpoint', () => {
      const cp1: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'cp1',
        stepIndex: 1,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      const cp2: Checkpoint = {
        id: 'cp_2',
        recordingId: 'rec_123',
        name: 'cp2',
        stepIndex: 3,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      recording.checkpoints.push(cp1, cp2);

      const newController = new ReplayController(recording, session, config);
      newController.jumpToStep(3);

      const prev = newController.getPreviousCheckpoint();
      expect(prev?.id).toBe('cp_1');
    });

    it('should get all checkpoints', () => {
      const cp1: Checkpoint = {
        id: 'cp_1',
        recordingId: 'rec_123',
        name: 'cp1',
        stepIndex: 1,
        timestamp: Date.now(),
        state: createMockState(),
        automatic: false,
      };
      recording.checkpoints.push(cp1);

      const newController = new ReplayController(recording, session, config);
      const checkpoints = newController.getCheckpoints();
      expect(checkpoints).toHaveLength(1);
    });
  });

  describe('pause and resume', () => {
    it('should pause playback', () => {
      controller.pause();
      const playbackState = controller.getPlaybackState();
      expect(playbackState.isPaused).toBe(true);
    });

    it('should pause with reason', () => {
      controller.pause('Manual pause');
      const playbackState = controller.getPlaybackState();
      expect(playbackState.pauseReason).toBe('Manual pause');
    });

    it('should resume playback', () => {
      controller.pause();
      controller.resume();
      const playbackState = controller.getPlaybackState();
      expect(playbackState.isPaused).toBe(false);
    });

    it('should clear pause reason on resume', () => {
      controller.pause('Test');
      controller.resume();
      const playbackState = controller.getPlaybackState();
      expect(playbackState.pauseReason).toBeUndefined();
    });

    it('should emit paused event', () => {
      const handler = vi.fn();
      controller.on('paused', handler);
      controller.pause('Test');
      expect(handler).toHaveBeenCalledWith('Test');
    });

    it('should emit resumed event', () => {
      const handler = vi.fn();
      controller.on('resumed', handler);
      controller.pause();
      controller.resume();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('pause conditions', () => {
    it('should pause on decisions when configured', () => {
      const configWithPause = { ...config, pauseOnDecisions: true };
      const pauseController = new ReplayController(
        recording,
        session,
        configWithPause,
      );

      pauseController.stepForward(); // 0
      pauseController.stepForward(); // 1
      pauseController.stepForward(); // 2 - decision

      const playbackState = pauseController.getPlaybackState();
      expect(playbackState.isPaused).toBe(true);
    });

    it('should pause on errors when configured', () => {
      const errorStep = createMockStep(1, 'error');
      errorStep.error = { name: 'Error', message: 'Test error' };
      recording.steps[1] = errorStep;

      const configWithPause = { ...config, pauseOnErrors: true };
      const pauseController = new ReplayController(
        recording,
        session,
        configWithPause,
      );

      pauseController.stepForward(); // 0
      pauseController.stepForward(); // 1 - error

      const playbackState = pauseController.getPlaybackState();
      expect(playbackState.isPaused).toBe(true);
    });

    it('should pause on tool calls when configured', () => {
      const configWithPause = { ...config, pauseOnToolCalls: true };
      const pauseController = new ReplayController(
        recording,
        session,
        configWithPause,
      );

      pauseController.stepForward(); // 0
      pauseController.stepForward(); // 1
      pauseController.stepForward(); // 2
      pauseController.stepForward(); // 3 - tool call

      const playbackState = pauseController.getPlaybackState();
      expect(playbackState.isPaused).toBe(true);
    });
  });

  describe('current state', () => {
    it('should get current step', () => {
      controller.stepForward();
      const step = controller.getCurrentStep();
      expect(step?.index).toBe(1);
    });

    it('should get current state', () => {
      const state = controller.getCurrentState();
      expect(state).toBeDefined();
      expect(state.agentId).toBe('test-agent');
    });

    it('should return undefined when no current step', () => {
      controller.jumpToStep(-1);
      const step = controller.getCurrentStep();
      expect(step).toBeUndefined();
    });
  });

  describe('playback state', () => {
    it('should get playback state', () => {
      const state = controller.getPlaybackState();
      expect(state.currentStep).toBeDefined();
      expect(state.state).toBeDefined();
      expect(state.isPaused).toBe(false);
    });

    it('should reflect current position', () => {
      controller.stepForward();
      controller.stepForward();
      const state = controller.getPlaybackState();
      expect(state.currentStep).toBe(2);
    });
  });

  describe('position checks', () => {
    it('should detect at beginning', () => {
      expect(controller.isAtBeginning()).toBe(true);
    });

    it('should detect not at beginning', () => {
      controller.stepForward();
      expect(controller.isAtBeginning()).toBe(false);
    });

    it('should detect at end', () => {
      controller.stepForward(); // 1
      controller.stepForward(); // 2
      controller.stepForward(); // 3
      expect(controller.isAtEnd()).toBe(true);
    });

    it('should detect not at end', () => {
      controller.stepForward();
      expect(controller.isAtEnd()).toBe(false);
    });
  });

  describe('progress', () => {
    it('should calculate progress percentage', () => {
      const progress = controller.getProgress();
      expect(progress).toBe(25); // Step 1 of 4 = 25%
    });

    it('should update progress as stepping', () => {
      controller.stepForward();
      controller.stepForward();
      const progress = controller.getProgress();
      expect(progress).toBe(75); // Step 3 of 4 = 75%
    });

    it('should return 100% for empty recording', () => {
      const emptyRecording = createMockRecording();
      emptyRecording.steps = [];
      const emptyController = new ReplayController(
        emptyRecording,
        session,
        config,
      );
      expect(emptyController.getProgress()).toBe(100);
    });
  });

  describe('state history caching', () => {
    it('should cache states for performance', () => {
      controller.stepForward();
      controller.stepForward();
      const state1 = controller.getCurrentState();

      controller.stepBackward();
      controller.stepForward();
      const state2 = controller.getCurrentState();

      expect(state1).toEqual(state2);
    });

    it('should rebuild state when not cached', () => {
      controller.jumpToStep(2);
      const state = controller.getCurrentState();
      expect(state).toBeDefined();
    });
  });
});

describe('createReplayController', () => {
  it('should create controller with factory function', () => {
    const recording = createMockRecording();
    const session = createMockSession();
    const config = createMockConfig();

    const controller = createReplayController(recording, session, config);
    expect(controller).toBeInstanceOf(ReplayController);
  });
});

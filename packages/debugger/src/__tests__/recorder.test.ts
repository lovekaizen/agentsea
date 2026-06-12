/**
 * Recorder Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Recorder } from '../recording/Recorder.js';
import { SnapshotManager } from '../recording/Snapshot.js';
import { CheckpointManager } from '../recording/Checkpoint.js';
import { Timeline } from '../recording/Timeline.js';
import type { AgentState, ExecutionStep } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-5.5',
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

describe('Recorder', () => {
  let recorder: Recorder;
  let state: AgentState;

  beforeEach(() => {
    recorder = new Recorder();
    state = createMockState();
  });

  describe('lifecycle', () => {
    it('should start recording', () => {
      const id = recorder.start('test-agent', state);
      expect(id).toMatch(/^rec_/);
      expect(recorder.getState()).toBe('recording');
    });

    it('should stop recording and return recording', () => {
      recorder.start('test-agent', state);
      const recording = recorder.stop();
      expect(recording).toBeDefined();
      expect(recording.agentId).toBe('test-agent');
      expect(recorder.getState()).toBe('stopped');
    });

    it('should pause and resume', () => {
      recorder.start('test-agent', state);
      recorder.pause();
      expect(recorder.getState()).toBe('paused');
      recorder.resume();
      expect(recorder.getState()).toBe('recording');
    });
  });

  describe('step recording', () => {
    it('should record steps', () => {
      recorder.start('test-agent', state);
      const step = createMockStep(0);
      const result = recorder.recordStep(step, state);
      expect(result).toBe(true);
      expect(recorder.getStepsCount()).toBe(1);
    });

    it('should not record when paused', () => {
      recorder.start('test-agent', state);
      recorder.pause();
      const step = createMockStep(0);
      const result = recorder.recordStep(step, state);
      expect(result).toBe(false);
    });
  });

  describe('checkpoints', () => {
    it('should create checkpoint', () => {
      recorder.start('test-agent', state);
      const cp = recorder.createCheckpoint('Test CP');
      expect(cp).toBeDefined();
      expect(cp?.name).toBe('Test CP');
    });

    it('should list checkpoints', () => {
      recorder.start('test-agent', state);
      recorder.createCheckpoint('CP1');
      recorder.createCheckpoint('CP2');
      const checkpoints = recorder.getCheckpoints();
      expect(checkpoints.length).toBe(2);
    });
  });
});

describe('SnapshotManager', () => {
  let manager: SnapshotManager;
  let state: AgentState;

  beforeEach(() => {
    manager = new SnapshotManager();
    state = createMockState();
  });

  it('should create snapshot', () => {
    const snap = manager.create(state, 0);
    expect(snap).toBeDefined();
    expect(snap.stepIndex).toBe(0);
  });

  it('should get snapshot by ID', () => {
    const snap = manager.create(state, 0);
    const retrieved = manager.get(snap.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(snap.id);
  });

  it('should get snapshot at step', () => {
    manager.create(state, 0);
    manager.create(state, 5);
    manager.create(state, 10);

    const snap = manager.getAtStep(7);
    expect(snap?.stepIndex).toBe(5);
  });

  it('should restore state from snapshot', () => {
    state.context = { key: 'value' };
    const snap = manager.create(state, 0);
    const restored = manager.restore(snap.id);
    expect(restored).toBeDefined();
    expect(restored?.context.key).toBe('value');
  });

  it('should compare snapshots', () => {
    const state1 = createMockState();
    state1.context = { key: 'value1' };
    const snap1 = manager.create(state1, 0);

    const state2 = createMockState();
    state2.context = { key: 'value2' };
    const snap2 = manager.create(state2, 1);

    const differences = manager.compare(snap1.id, snap2.id);
    expect(differences).toBeDefined();
    expect(differences!.length).toBeGreaterThan(0);
  });
});

describe('CheckpointManager', () => {
  let manager: CheckpointManager;
  let state: AgentState;

  beforeEach(() => {
    manager = new CheckpointManager();
    state = createMockState();
  });

  it('should create checkpoint', () => {
    const cp = manager.create({
      recordingId: 'rec_123',
      name: 'Test CP',
      stepIndex: 5,
      state,
    });
    expect(cp).toBeDefined();
    expect(cp.name).toBe('Test CP');
  });

  it('should get by name', () => {
    manager.create({
      recordingId: 'rec_123',
      name: 'Unique CP',
      stepIndex: 5,
      state,
    });

    const cp = manager.getByName('Unique CP');
    expect(cp).toBeDefined();
    expect(cp?.name).toBe('Unique CP');
  });

  it('should filter checkpoints', () => {
    manager.create({
      recordingId: 'rec_123',
      name: 'CP1',
      stepIndex: 5,
      state,
      automatic: true,
    });
    manager.create({
      recordingId: 'rec_123',
      name: 'CP2',
      stepIndex: 10,
      state,
      automatic: false,
    });
    manager.create({
      recordingId: 'rec_123',
      name: 'CP3',
      stepIndex: 15,
      state,
      automatic: true,
    });

    const automatic = manager.filter({ automatic: true });
    expect(automatic.length).toBe(2);

    const inRange = manager.filter({ stepRange: { min: 8, max: 12 } });
    expect(inRange.length).toBe(1);
  });
});

describe('Timeline', () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = new Timeline();
  });

  it('should add events', () => {
    const event = timeline.addEvent({
      type: 'tool-call',
      stepIndex: 0,
      description: 'Called search tool',
    });
    expect(event).toBeDefined();
    expect(event.type).toBe('tool-call');
  });

  it('should filter events', () => {
    timeline.addEvent({ type: 'input', stepIndex: 0, description: 'Input' });
    timeline.addEvent({ type: 'tool-call', stepIndex: 1, description: 'Tool' });
    timeline.addEvent({
      type: 'response',
      stepIndex: 2,
      description: 'Response',
    });

    const toolEvents = timeline.filterEvents({ types: ['tool-call'] });
    expect(toolEvents.length).toBe(1);
  });

  it('should get events in range', () => {
    timeline.addEvent({ type: 'input', stepIndex: 0, description: 'Input' });
    timeline.addEvent({ type: 'tool-call', stepIndex: 5, description: 'Tool' });
    timeline.addEvent({
      type: 'response',
      stepIndex: 10,
      description: 'Response',
    });

    const events = timeline.getEventsInRange(3, 7);
    expect(events.length).toBe(1);
  });

  it('should add markers', () => {
    const marker = timeline.addMarker({
      name: 'Important',
      stepIndex: 5,
      color: '#ff0000',
    });
    expect(marker).toBeDefined();
    expect(marker.name).toBe('Important');
  });

  it('should calculate stats', () => {
    timeline.addEvent({
      type: 'input',
      stepIndex: 0,
      description: 'Input',
      durationMs: 100,
    });
    timeline.addEvent({
      type: 'tool-call',
      stepIndex: 1,
      description: 'Tool',
      durationMs: 200,
    });
    timeline.addEvent({
      type: 'response',
      stepIndex: 2,
      description: 'Response',
      durationMs: 300,
    });

    const stats = timeline.getStats();
    expect(stats.totalEvents).toBe(3);
    expect(stats.totalDurationMs).toBe(600);
    expect(stats.avgEventDurationMs).toBe(200);
  });
});

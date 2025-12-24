import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ExecutionContext,
  createExecutionContext,
} from '../core/ExecutionContext.js';
import type { TaskResult } from '../types/index.js';

describe('ExecutionContext', () => {
  let context: ExecutionContext;

  beforeEach(() => {
    context = new ExecutionContext({ crewName: 'TestCrew' });
  });

  describe('constructor', () => {
    it('should create context with required fields', () => {
      expect(context.crewName).toBe('TestCrew');
      expect(context.crewId).toBeDefined();
    });

    it('should use provided crew ID', () => {
      const ctx = new ExecutionContext({
        crewName: 'Test',
        crewId: 'custom-id',
      });
      expect(ctx.crewId).toBe('custom-id');
    });

    it('should set initial global context', () => {
      const ctx = new ExecutionContext({
        crewName: 'Test',
        globalContext: { key: 'value' },
      });

      expect(ctx.get('key')).toBe('value');
    });

    it('should default bufferEvents to false', () => {
      expect(context.getEventBuffer()).toHaveLength(0);
    });
  });

  describe('State Management', () => {
    it('should set and get state values', () => {
      context.set('testKey', 'testValue');
      expect(context.get('testKey')).toBe('testValue');
    });

    it('should check if key exists', () => {
      context.set('exists', true);
      expect(context.has('exists')).toBe(true);
      expect(context.has('doesNotExist')).toBe(false);
    });

    it('should delete state keys', () => {
      context.set('deleteMe', 'value');
      expect(context.has('deleteMe')).toBe(true);

      const deleted = context.delete('deleteMe');
      expect(deleted).toBe(true);
      expect(context.has('deleteMe')).toBe(false);
    });

    it('should return false when deleting non-existent key', () => {
      expect(context.delete('doesNotExist')).toBe(false);
    });

    it('should get all state keys', () => {
      context.set('key1', 'value1');
      context.set('key2', 'value2');

      const keys = context.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toHaveLength(2);
    });

    it('should get all state entries', () => {
      context.set('key1', 'value1');
      context.set('key2', 'value2');

      const entries = context.entries();
      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
    });

    it('should clear all state', () => {
      context.set('key1', 'value1');
      context.set('key2', 'value2');

      context.clearState();

      expect(context.keys()).toHaveLength(0);
    });
  });

  describe('Variables', () => {
    it('should set and get variables', () => {
      context.setVariable('testVar', 123);
      expect(context.getVariable('testVar')).toBe(123);
    });

    it('should return undefined for non-existent variable', () => {
      expect(context.getVariable('doesNotExist')).toBeUndefined();
    });

    it('should get all variables', () => {
      context.setVariable('var1', 'value1');
      context.setVariable('var2', 'value2');

      const variables = context.getVariables();
      expect(variables).toEqual({ var1: 'value1', var2: 'value2' });
    });

    it('should return copy of variables', () => {
      context.setVariable('var1', 'value1');
      const variables = context.getVariables();

      variables['var2'] = 'value2';

      expect(context.getVariable('var2')).toBeUndefined();
    });
  });

  describe('Task Tracking', () => {
    const mockResult: TaskResult = {
      output: 'Task completed',
      completedAt: new Date(),
      completedBy: 'TestAgent',
      iterations: 1,
      tokensUsed: 100,
    };

    it('should mark task as completed', () => {
      context.markTaskCompleted('task-1', mockResult);
      expect(context.isTaskCompleted('task-1')).toBe(true);
    });

    it('should check if task is not completed', () => {
      expect(context.isTaskCompleted('task-1')).toBe(false);
    });

    it('should get task result', () => {
      context.markTaskCompleted('task-1', mockResult);
      const result = context.getTaskResult('task-1');

      expect(result).toEqual(mockResult);
    });

    it('should return undefined for non-completed task', () => {
      expect(context.getTaskResult('task-1')).toBeUndefined();
    });

    it('should get all completed tasks', () => {
      context.markTaskCompleted('task-1', mockResult);
      context.markTaskCompleted('task-2', mockResult);

      const completed = context.getCompletedTasks();
      expect(completed.size).toBe(2);
      expect(completed.has('task-1')).toBe(true);
      expect(completed.has('task-2')).toBe(true);
    });

    it('should get completed task IDs', () => {
      context.markTaskCompleted('task-1', mockResult);
      context.markTaskCompleted('task-2', mockResult);

      const ids = context.getCompletedTaskIds();
      expect(ids.size).toBe(2);
      expect(ids.has('task-1')).toBe(true);
    });

    it('should get completed task count', () => {
      expect(context.getCompletedTaskCount()).toBe(0);

      context.markTaskCompleted('task-1', mockResult);
      context.markTaskCompleted('task-2', mockResult);

      expect(context.getCompletedTaskCount()).toBe(2);
    });
  });

  describe('Agent State', () => {
    it('should set and get agent state', () => {
      const state = { busy: true, currentTask: 'task-1' };
      context.setAgentState('Agent1', state);

      expect(context.getAgentState('Agent1')).toEqual(state);
    });

    it('should return undefined for non-existent agent state', () => {
      expect(context.getAgentState('Agent1')).toBeUndefined();
    });

    it('should get all agent states', () => {
      context.setAgentState('Agent1', { busy: true });
      context.setAgentState('Agent2', { busy: false });

      const states = context.getAgentStates();
      expect(states.size).toBe(2);
      expect(states.get('Agent1')).toEqual({ busy: true });
    });
  });

  describe('Event System', () => {
    it('should emit and receive events', () => {
      const handler = vi.fn();
      context.on('task:started', handler);

      context.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task:started',
          taskId: 'task-1',
          crewName: 'TestCrew',
        }),
      );
    });

    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      const subscription = context.on('task:started', handler);

      context.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      expect(handler).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();

      context.emit({
        type: 'task:started',
        taskId: 'task-2',
        agentName: 'Agent2',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should listen to all events with wildcard', () => {
      const handler = vi.fn();
      context.on('*', handler);

      context.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      context.emit({
        type: 'task:completed',
        taskId: 'task-1',
        agentName: 'Agent1',
        result: 'done',
      });

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should listen to event once', () => {
      const handler = vi.fn();
      context.once('task:started', handler);

      context.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      context.emit({
        type: 'task:started',
        taskId: 'task-2',
        agentName: 'Agent2',
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should remove all listeners for a type', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      context.on('task:started', handler1);
      context.on('task:started', handler2);

      context.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      context.off('task:started');

      context.emit({
        type: 'task:started',
        taskId: 'task-2',
        agentName: 'Agent2',
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should buffer events when enabled', () => {
      const ctx = new ExecutionContext({
        crewName: 'Test',
        bufferEvents: true,
      });

      ctx.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      const buffer = ctx.getEventBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].type).toBe('task:started');
    });

    it('should respect max buffer size', () => {
      const ctx = new ExecutionContext({
        crewName: 'Test',
        bufferEvents: true,
        maxBufferSize: 2,
      });

      ctx.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });
      ctx.emit({
        type: 'task:started',
        taskId: 'task-2',
        agentName: 'Agent2',
      });
      ctx.emit({
        type: 'task:started',
        taskId: 'task-3',
        agentName: 'Agent3',
      });

      const buffer = ctx.getEventBuffer();
      expect(buffer).toHaveLength(2);
    });

    it('should clear event buffer', () => {
      const ctx = new ExecutionContext({
        crewName: 'Test',
        bufferEvents: true,
      });

      ctx.emit({
        type: 'task:started',
        taskId: 'task-1',
        agentName: 'Agent1',
      });

      expect(ctx.getEventBuffer()).toHaveLength(1);

      ctx.clearEventBuffer();
      expect(ctx.getEventBuffer()).toHaveLength(0);
    });
  });

  describe('Lifecycle', () => {
    it('should provide abort signal', () => {
      expect(context.signal).toBeInstanceOf(AbortSignal);
      expect(context.isAborted).toBe(false);
    });

    it('should abort execution', () => {
      context.abort('Test abort');

      expect(context.isAborted).toBe(true);
      expect(context.getStatus()).toBe('aborted');
    });

    it('should get current status', () => {
      expect(context.getStatus()).toBe('idle');
    });

    it('should set status', () => {
      context.setStatus('running');
      expect(context.getStatus()).toBe('running');

      context.setStatus('completed');
      expect(context.getStatus()).toBe('completed');
    });

    it('should track execution duration', () => {
      context.setStatus('running');

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }

      context.setStatus('completed');

      const duration = context.getDuration();
      expect(duration).toBeGreaterThan(0);
    });

    it('should return undefined duration when not started', () => {
      expect(context.getDuration()).toBeUndefined();
    });
  });

  describe('Checkpointing', () => {
    it('should create checkpoint', () => {
      context.set('key', 'value');
      context.setVariable('var', 123);
      context.setAgentState('Agent1', { busy: true });

      const checkpoint = context.createCheckpoint();

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.crewId).toBe(context.crewId);
      expect(checkpoint.crewName).toBe('TestCrew');
      expect(checkpoint.state.get('key')).toBe('value');
      expect(checkpoint.variables).toEqual({ var: 123 });
    });

    it('should restore from checkpoint', () => {
      context.set('key1', 'value1');
      const checkpoint = context.createCheckpoint();

      // Modify state
      context.set('key2', 'value2');
      context.delete('key1');

      // Restore
      context.restoreCheckpoint(checkpoint);

      expect(context.has('key1')).toBe(true);
      expect(context.has('key2')).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should export state', () => {
      context.set('key', 'value');
      context.setVariable('var', 123);

      const exported = context.exportState();

      expect(exported.crewId).toBe(context.crewId);
      expect(exported.crewName).toBe('TestCrew');
      expect(exported.status).toBe('idle');
    });

    it('should import state', () => {
      const data = {
        state: { key: 'value' },
        variables: { var: 123 },
        status: 'running',
      };

      context.importState(data);

      expect(context.get('key')).toBe('value');
      expect(context.getVariable('var')).toBe(123);
      expect(context.getStatus()).toBe('running');
    });
  });

  describe('Reset', () => {
    it('should reset context', () => {
      context.set('key', 'value');
      context.setVariable('var', 123);
      context.setAgentState('Agent1', { busy: true });
      context.setStatus('running');

      context.reset();

      expect(context.keys()).toHaveLength(0);
      expect(context.getVariables()).toEqual({});
      expect(context.getAgentStates().size).toBe(0);
      expect(context.getStatus()).toBe('idle');
    });
  });

  describe('createExecutionContext factory', () => {
    it('should create context instance', () => {
      const ctx = createExecutionContext({ crewName: 'Test' });
      expect(ctx).toBeInstanceOf(ExecutionContext);
    });
  });
});

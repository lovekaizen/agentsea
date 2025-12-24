import { describe, it, expect, beforeEach } from 'vitest';
import { Task, createTask } from '../core/Task.js';
import type { TaskConfig, TaskResult } from '../types/index.js';

// Helper to create a task config
function createTaskConfig(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    description: 'Test task description',
    expectedOutput: 'Expected output',
    ...overrides,
  };
}

describe('Task', () => {
  describe('constructor', () => {
    it('should create a task with required fields', () => {
      const task = new Task(createTaskConfig());

      expect(task.id).toBeDefined();
      expect(task.description).toBe('Test task description');
      expect(task.expectedOutput).toBe('Expected output');
      expect(task.status).toBe('pending');
    });

    it('should use provided id', () => {
      const task = new Task(createTaskConfig({ id: 'custom-id' }));
      expect(task.id).toBe('custom-id');
    });

    it('should use default priority of medium', () => {
      const task = new Task(createTaskConfig());
      expect(task.priority).toBe('medium');
    });

    it('should accept custom priority', () => {
      const task = new Task(createTaskConfig({ priority: 'critical' }));
      expect(task.priority).toBe('critical');
    });

    it('should initialize with empty dependencies', () => {
      const task = new Task(createTaskConfig());
      expect(task.dependencies).toEqual([]);
    });

    it('should accept dependencies', () => {
      const task = new Task(
        createTaskConfig({ dependencies: ['task-1', 'task-2'] }),
      );
      expect(task.dependencies).toEqual(['task-1', 'task-2']);
    });

    it('should initialize metadata', () => {
      const task = new Task(createTaskConfig());
      const metadata = task.metadata;

      expect(metadata.createdAt).toBeInstanceOf(Date);
      expect(metadata.updatedAt).toBeInstanceOf(Date);
      expect(metadata.attempts).toBe(0);
      expect(metadata.statusHistory).toHaveLength(1);
      expect(metadata.statusHistory?.[0].status).toBe('pending');
    });

    it('should accept context', () => {
      const task = new Task(createTaskConfig({ context: { key: 'value' } }));
      expect(task.context).toEqual({ key: 'value' });
    });

    it('should accept required capabilities', () => {
      const task = new Task(
        createTaskConfig({ requiredCapabilities: ['coding', 'testing'] }),
      );
      expect(task.requiredCapabilities).toEqual(['coding', 'testing']);
    });

    it('should accept tags', () => {
      const task = new Task(createTaskConfig({ tags: ['urgent', 'review'] }));
      expect(task.tags).toEqual(['urgent', 'review']);
    });

    it('should default maxRetries to 3', () => {
      const task = new Task(createTaskConfig());
      expect(task.maxRetries).toBe(3);
    });

    it('should accept custom maxRetries', () => {
      const task = new Task(createTaskConfig({ maxRetries: 5 }));
      expect(task.maxRetries).toBe(5);
    });
  });

  describe('status getters', () => {
    it('should return isPending correctly', () => {
      const task = new Task(createTaskConfig());
      expect(task.isPending).toBe(true);
      expect(task.isCompleted).toBe(false);
      expect(task.isFailed).toBe(false);
    });

    it('should return isAssigned correctly', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      expect(task.isAssigned).toBe(true);
      expect(task.isPending).toBe(false);
    });

    it('should return isInProgress correctly', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();
      expect(task.isInProgress).toBe(true);
    });

    it('should return isBlocked correctly', () => {
      const task = new Task(createTaskConfig());
      task.block('waiting for dependency');
      expect(task.isBlocked).toBe(true);
    });
  });

  describe('assign', () => {
    it('should assign task to an agent', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');

      expect(task.status).toBe('assigned');
      expect(task.assignedAgent).toBe('agent-1');
      expect(task.metadata.assignedAt).toBeInstanceOf(Date);
      expect(task.attempts).toBe(1);
    });

    it('should allow reassigning blocked tasks', () => {
      const task = new Task(createTaskConfig());
      task.block('dependency missing');
      task.assign('agent-1');

      expect(task.status).toBe('assigned');
      expect(task.assignedAgent).toBe('agent-1');
    });

    it('should throw when assigning non-pending/blocked task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();

      expect(() => task.assign('agent-2')).toThrow(
        'Cannot assign task in status: in_progress',
      );
    });

    it('should increment attempts on each assignment', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      expect(task.attempts).toBe(1);

      task.start();
      task.fail('error');
      task.reset();
      task.assign('agent-2');
      expect(task.attempts).toBe(2);
    });
  });

  describe('start', () => {
    it('should start assigned task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();

      expect(task.status).toBe('in_progress');
      expect(task.metadata.startedAt).toBeInstanceOf(Date);
    });

    it('should throw when starting non-assigned task', () => {
      const task = new Task(createTaskConfig());
      expect(() => task.start()).toThrow(
        'Cannot start task in status: pending',
      );
    });
  });

  describe('complete', () => {
    let task: Task;
    const result: Omit<TaskResult, 'completedAt' | 'completedBy'> = {
      output: 'Task completed successfully',
      iterations: 2,
      tokensUsed: 1500,
    };

    beforeEach(() => {
      task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();
    });

    it('should complete task with result', () => {
      task.complete(result);

      expect(task.status).toBe('completed');
      expect(task.isCompleted).toBe(true);
      expect(task.result?.output).toBe('Task completed successfully');
      expect(task.result?.completedBy).toBe('agent-1');
      expect(task.result?.completedAt).toBeInstanceOf(Date);
    });

    it('should throw when completing non-in-progress task', () => {
      const pendingTask = new Task(createTaskConfig());
      expect(() => pendingTask.complete(result)).toThrow(
        'Cannot complete task in status: pending',
      );
    });

    it('should calculate actualDuration', () => {
      // Slight delay to ensure duration > 0
      task.complete(result);
      expect(task.metadata.actualDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('fail', () => {
    it('should fail in-progress task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();
      task.fail('Something went wrong');

      expect(task.status).toBe('failed');
      expect(task.isFailed).toBe(true);
      expect(task.result?.error).toBe('Something went wrong');
    });

    it('should fail assigned task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.fail('Agent unavailable');

      expect(task.status).toBe('failed');
    });

    it('should throw when failing pending task', () => {
      const task = new Task(createTaskConfig());
      expect(() => task.fail('error')).toThrow(
        'Cannot fail task in status: pending',
      );
    });
  });

  describe('block', () => {
    it('should block task with reason', () => {
      const task = new Task(createTaskConfig());
      task.block('Waiting for dependency');

      expect(task.status).toBe('blocked');
      expect(task.isBlocked).toBe(true);
    });

    it('should record reason in status history', () => {
      const task = new Task(createTaskConfig());
      task.block('Dependency not met');

      const history = task.metadata.statusHistory;
      const lastEntry = history?.[history.length - 1];
      expect(lastEntry?.status).toBe('blocked');
      expect(lastEntry?.reason).toBe('Dependency not met');
    });
  });

  describe('unblock', () => {
    it('should unblock blocked task', () => {
      const task = new Task(createTaskConfig());
      task.block('waiting');
      task.unblock();

      expect(task.status).toBe('pending');
    });

    it('should throw when unblocking non-blocked task', () => {
      const task = new Task(createTaskConfig());
      expect(() => task.unblock()).toThrow(
        'Cannot unblock task in status: pending',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel pending task', () => {
      const task = new Task(createTaskConfig());
      task.cancel('No longer needed');

      expect(task.status).toBe('cancelled');
    });

    it('should cancel in-progress task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();
      task.cancel('User requested');

      expect(task.status).toBe('cancelled');
    });

    it('should throw when cancelling completed task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();
      task.complete({ output: 'done', iterations: 1, tokensUsed: 100 });

      expect(() => task.cancel()).toThrow('Cannot cancel completed task');
    });
  });

  describe('reset', () => {
    it('should reset failed task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      task.start();
      task.fail('error');
      task.reset();

      expect(task.status).toBe('pending');
      expect(task.assignedAgent).toBeUndefined();
      expect(task.result).toBeUndefined();
    });

    it('should throw when resetting non-failed task', () => {
      const task = new Task(createTaskConfig());
      expect(() => task.reset()).toThrow('Can only reset failed tasks');
    });
  });

  describe('canStart', () => {
    it('should return true for pending task with no dependencies', () => {
      const task = new Task(createTaskConfig());
      expect(task.canStart()).toBe(true);
    });

    it('should return true for blocked task with satisfied dependencies', () => {
      const task = new Task(createTaskConfig({ dependencies: ['task-1'] }));
      task.block();
      expect(task.canStart(new Set(['task-1']))).toBe(true);
    });

    it('should return false for task with unmet dependencies', () => {
      const task = new Task(
        createTaskConfig({ dependencies: ['task-1', 'task-2'] }),
      );
      expect(task.canStart(new Set(['task-1']))).toBe(false);
    });

    it('should return false for non-pending/blocked task', () => {
      const task = new Task(createTaskConfig());
      task.assign('agent-1');
      expect(task.canStart()).toBe(false);
    });
  });

  describe('dependenciesSatisfied', () => {
    it('should return true when all dependencies are satisfied', () => {
      const task = new Task(
        createTaskConfig({ dependencies: ['task-1', 'task-2'] }),
      );
      expect(
        task.dependenciesSatisfied(new Set(['task-1', 'task-2', 'task-3'])),
      ).toBe(true);
    });

    it('should return false when some dependencies are missing', () => {
      const task = new Task(
        createTaskConfig({ dependencies: ['task-1', 'task-2'] }),
      );
      expect(task.dependenciesSatisfied(new Set(['task-1']))).toBe(false);
    });

    it('should return true for task with no dependencies', () => {
      const task = new Task(createTaskConfig());
      expect(task.dependenciesSatisfied(new Set())).toBe(true);
    });
  });

  describe('canRetry', () => {
    it('should return true for failed task with remaining retries', () => {
      const task = new Task(createTaskConfig({ maxRetries: 3 }));
      task.assign('agent-1');
      task.start();
      task.fail('error');

      expect(task.canRetry()).toBe(true);
    });

    it('should return false when max retries exceeded', () => {
      const task = new Task(createTaskConfig({ maxRetries: 1 }));
      task.assign('agent-1');
      task.start();
      task.fail('error');

      expect(task.canRetry()).toBe(false);
    });

    it('should return false for non-failed task', () => {
      const task = new Task(createTaskConfig());
      expect(task.canRetry()).toBe(false);
    });
  });

  describe('deadline methods', () => {
    it('should return null time remaining when no deadline', () => {
      const task = new Task(createTaskConfig());
      expect(task.getTimeRemaining()).toBeNull();
    });

    it('should return false for isPastDeadline when no deadline', () => {
      const task = new Task(createTaskConfig());
      expect(task.isPastDeadline()).toBe(false);
    });

    it('should return true for isPastDeadline when past deadline', () => {
      const pastDate = new Date(Date.now() - 10000);
      const task = new Task(createTaskConfig({ deadline: pastDate }));
      expect(task.isPastDeadline()).toBe(true);
    });

    it('should return positive time remaining for future deadline', () => {
      const futureDate = new Date(Date.now() + 60000);
      const task = new Task(createTaskConfig({ deadline: futureDate }));
      expect(task.getTimeRemaining()).toBeGreaterThan(0);
    });

    it('should return 0 or positive for past deadline', () => {
      const pastDate = new Date(Date.now() - 10000);
      const task = new Task(createTaskConfig({ deadline: pastDate }));
      expect(task.getTimeRemaining()).toBe(0);
    });
  });

  describe('getPriorityWeight', () => {
    it('should return correct weights', () => {
      expect(
        new Task(
          createTaskConfig({ priority: 'critical' }),
        ).getPriorityWeight(),
      ).toBe(100);
      expect(
        new Task(createTaskConfig({ priority: 'high' })).getPriorityWeight(),
      ).toBe(75);
      expect(
        new Task(createTaskConfig({ priority: 'medium' })).getPriorityWeight(),
      ).toBe(50);
      expect(
        new Task(createTaskConfig({ priority: 'low' })).getPriorityWeight(),
      ).toBe(25);
    });
  });

  describe('compareTo', () => {
    it('should prioritize by priority weight', () => {
      const high = new Task(createTaskConfig({ priority: 'high' }));
      const low = new Task(createTaskConfig({ priority: 'low' }));

      expect(low.compareTo(high)).toBeGreaterThan(0);
      expect(high.compareTo(low)).toBeLessThan(0);
    });

    it('should prioritize by deadline when same priority', () => {
      const earlier = new Task(
        createTaskConfig({
          priority: 'medium',
          deadline: new Date(Date.now() + 60000),
        }),
      );
      const later = new Task(
        createTaskConfig({
          priority: 'medium',
          deadline: new Date(Date.now() + 120000),
        }),
      );

      expect(earlier.compareTo(later)).toBeLessThan(0);
    });

    it('should prioritize task with deadline over task without', () => {
      const withDeadline = new Task(
        createTaskConfig({
          priority: 'medium',
          deadline: new Date(Date.now() + 60000),
        }),
      );
      const withoutDeadline = new Task(
        createTaskConfig({ priority: 'medium' }),
      );

      expect(withDeadline.compareTo(withoutDeadline)).toBeLessThan(0);
    });
  });

  describe('serialization', () => {
    it('should convert to config', () => {
      const task = new Task(
        createTaskConfig({
          id: 'test-id',
          description: 'Test',
          expectedOutput: 'Output',
          priority: 'high',
          tags: ['urgent'],
        }),
      );

      const config = task.toConfig();

      expect(config.id).toBe('test-id');
      expect(config.description).toBe('Test');
      expect(config.priority).toBe('high');
      expect(config.tags).toEqual(['urgent']);
    });

    it('should get full state', () => {
      const task = new Task(createTaskConfig({ id: 'test-id' }));
      task.assign('agent-1');

      const state = task.getState();

      expect(state.config.id).toBe('test-id');
      expect(state.status).toBe('assigned');
      expect(state.assignedAgent).toBe('agent-1');
      expect(state.metadata).toBeDefined();
    });

    it('should restore from state', () => {
      const original = new Task(createTaskConfig({ id: 'test-id' }));
      original.assign('agent-1');
      original.start();

      const state = original.getState();
      const restored = Task.fromState(state);

      expect(restored.id).toBe('test-id');
      expect(restored.status).toBe('in_progress');
      expect(restored.assignedAgent).toBe('agent-1');
    });

    it('should serialize to JSON', () => {
      const task = new Task(createTaskConfig());
      const json = task.toJSON();

      expect(json.config).toBeDefined();
      expect(json.status).toBe('pending');
    });
  });

  describe('createTask factory', () => {
    it('should create a task instance', () => {
      const task = createTask(createTaskConfig());
      expect(task).toBeInstanceOf(Task);
    });
  });
});

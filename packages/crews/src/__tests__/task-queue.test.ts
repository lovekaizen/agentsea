import { describe, it, expect, beforeEach } from 'vitest';
import { TaskQueue, createTaskQueue } from '../core/TaskQueue.js';
import { Task } from '../core/Task.js';
import type { TaskConfig } from '../types/index.js';

// Helper to create a task config
function createTaskConfig(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    description: 'Test task',
    expectedOutput: 'Output',
    ...overrides,
  };
}

// Helper to create a task
function createTask(overrides: Partial<TaskConfig> = {}): Task {
  return new Task(createTaskConfig(overrides));
}

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe('constructor', () => {
    it('should create empty queue with defaults', () => {
      expect(queue.size).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should create queue with max size', () => {
      const limitedQueue = new TaskQueue({ maxSize: 5 });
      expect(limitedQueue.isEmpty()).toBe(true);
    });

    it('should create queue with auto sort disabled', () => {
      const noSortQueue = new TaskQueue({ autoSort: false });
      expect(noSortQueue.isEmpty()).toBe(true);
    });
  });

  describe('enqueue', () => {
    it('should add task to queue', () => {
      const task = createTask({ id: 'task-1' });
      queue.enqueue(task);

      expect(queue.size).toBe(1);
      expect(queue.has('task-1')).toBe(true);
    });

    it('should throw when adding duplicate task', () => {
      const task = createTask({ id: 'task-1' });
      queue.enqueue(task);

      expect(() => queue.enqueue(task)).toThrow('Task task-1 already in queue');
    });

    it('should throw when queue is full', () => {
      const smallQueue = new TaskQueue({ maxSize: 2 });
      smallQueue.enqueue(createTask({ id: 'task-1' }));
      smallQueue.enqueue(createTask({ id: 'task-2' }));

      expect(() => smallQueue.enqueue(createTask({ id: 'task-3' }))).toThrow(
        'Queue is full',
      );
    });

    it('should auto sort by priority', () => {
      queue.enqueue(createTask({ id: 'low', priority: 'low' }));
      queue.enqueue(createTask({ id: 'high', priority: 'high' }));
      queue.enqueue(createTask({ id: 'critical', priority: 'critical' }));

      const first = queue.peek();
      expect(first?.id).toBe('critical');
    });
  });

  describe('enqueueMany', () => {
    it('should add multiple tasks', () => {
      queue.enqueueMany([
        createTask({ id: 'task-1' }),
        createTask({ id: 'task-2' }),
        createTask({ id: 'task-3' }),
      ]);

      expect(queue.size).toBe(3);
    });

    it('should skip duplicate tasks silently', () => {
      const task = createTask({ id: 'task-1' });
      queue.enqueue(task);

      queue.enqueueMany([
        createTask({ id: 'task-1' }),
        createTask({ id: 'task-2' }),
      ]);

      expect(queue.size).toBe(2);
    });

    it('should respect max size', () => {
      const smallQueue = new TaskQueue({ maxSize: 2 });
      smallQueue.enqueueMany([
        createTask({ id: 'task-1' }),
        createTask({ id: 'task-2' }),
        createTask({ id: 'task-3' }),
      ]);

      expect(smallQueue.size).toBe(2);
    });
  });

  describe('dequeue', () => {
    it('should remove and return highest priority task', () => {
      queue.enqueue(createTask({ id: 'low', priority: 'low' }));
      queue.enqueue(createTask({ id: 'high', priority: 'high' }));

      const task = queue.dequeue();

      expect(task?.id).toBe('high');
      expect(queue.size).toBe(1);
    });

    it('should return undefined for empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should remove task from internal map', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.dequeue();

      expect(queue.has('task-1')).toBe(false);
    });
  });

  describe('peek', () => {
    it('should return highest priority task without removing', () => {
      queue.enqueue(createTask({ id: 'task-1', priority: 'medium' }));
      queue.enqueue(createTask({ id: 'task-2', priority: 'high' }));

      const task = queue.peek();

      expect(task?.id).toBe('task-2');
      expect(queue.size).toBe(2);
    });

    it('should return undefined for empty queue', () => {
      expect(queue.peek()).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should return task by id', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      const task = queue.get('task-1');
      expect(task?.id).toBe('task-1');
    });

    it('should return undefined for non-existent id', () => {
      expect(queue.get('non-existent')).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove task by id', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));

      const removed = queue.remove('task-1');

      expect(removed?.id).toBe('task-1');
      expect(queue.size).toBe(1);
      expect(queue.has('task-1')).toBe(false);
    });

    it('should return undefined for non-existent id', () => {
      expect(queue.remove('non-existent')).toBeUndefined();
    });
  });

  describe('has', () => {
    it('should return true for existing task', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      expect(queue.has('task-1')).toBe(true);
    });

    it('should return false for non-existing task', () => {
      expect(queue.has('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all tasks', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));
      queue.clear();

      expect(queue.isEmpty()).toBe(true);
      expect(queue.has('task-1')).toBe(false);
    });
  });

  describe('getByStatus', () => {
    beforeEach(() => {
      const pending = createTask({ id: 'pending' });
      const blocked = createTask({ id: 'blocked' });
      blocked.block();
      queue.enqueue(pending);
      queue.enqueue(blocked);
    });

    it('should return tasks with matching status', () => {
      const pendingTasks = queue.getByStatus('pending');
      expect(pendingTasks).toHaveLength(1);
      expect(pendingTasks[0].id).toBe('pending');
    });

    it('should return empty array for no matches', () => {
      const completedTasks = queue.getByStatus('completed');
      expect(completedTasks).toHaveLength(0);
    });
  });

  describe('getByPriority', () => {
    beforeEach(() => {
      queue.enqueue(createTask({ id: 'high-1', priority: 'high' }));
      queue.enqueue(createTask({ id: 'high-2', priority: 'high' }));
      queue.enqueue(createTask({ id: 'low-1', priority: 'low' }));
    });

    it('should return tasks with matching priority', () => {
      const highPriority = queue.getByPriority('high');
      expect(highPriority).toHaveLength(2);
    });
  });

  describe('getReadyTasks', () => {
    beforeEach(() => {
      queue.enqueue(createTask({ id: 'no-deps' }));
      queue.enqueue(createTask({ id: 'has-deps', dependencies: ['dep-1'] }));
      queue.enqueue(
        createTask({ id: 'satisfied-deps', dependencies: ['task-x'] }),
      );
    });

    it('should return tasks with satisfied dependencies', () => {
      const ready = queue.getReadyTasks(new Set(['task-x']));
      expect(ready).toHaveLength(2);
      expect(ready.map((t) => t.id)).toContain('no-deps');
      expect(ready.map((t) => t.id)).toContain('satisfied-deps');
    });
  });

  describe('getByAgent', () => {
    it('should return tasks assigned to agent', () => {
      const task1 = createTask({ id: 'task-1' });
      task1.assign('agent-1');
      const task2 = createTask({ id: 'task-2' });
      task2.assign('agent-2');

      queue.enqueue(task1);
      queue.enqueue(task2);

      const agent1Tasks = queue.getByAgent('agent-1');
      expect(agent1Tasks).toHaveLength(1);
      expect(agent1Tasks[0].id).toBe('task-1');
    });
  });

  describe('getByTag', () => {
    beforeEach(() => {
      queue.enqueue(createTask({ id: 'task-1', tags: ['urgent', 'review'] }));
      queue.enqueue(createTask({ id: 'task-2', tags: ['review'] }));
      queue.enqueue(createTask({ id: 'task-3', tags: ['bug'] }));
    });

    it('should return tasks with matching tag', () => {
      const reviewTasks = queue.getByTag('review');
      expect(reviewTasks).toHaveLength(2);
    });

    it('should return empty for non-matching tag', () => {
      const noMatch = queue.getByTag('feature');
      expect(noMatch).toHaveLength(0);
    });
  });

  describe('status helper methods', () => {
    beforeEach(() => {
      const pending = createTask({ id: 'pending' });
      const blocked = createTask({ id: 'blocked' });
      blocked.block();
      const inProgress = createTask({ id: 'in-progress' });
      inProgress.assign('agent-1');
      inProgress.start();
      const failed = createTask({ id: 'failed' });
      failed.assign('agent-1');
      failed.start();
      failed.fail('error');

      queue.enqueue(pending);
      queue.enqueue(blocked);
      queue.enqueue(inProgress);
      queue.enqueue(failed);
    });

    it('getPending should return pending tasks', () => {
      expect(queue.getPending()).toHaveLength(1);
    });

    it('getBlocked should return blocked tasks', () => {
      expect(queue.getBlocked()).toHaveLength(1);
    });

    it('getInProgress should return in progress tasks', () => {
      expect(queue.getInProgress()).toHaveLength(1);
    });

    it('getFailed should return failed tasks', () => {
      expect(queue.getFailed()).toHaveLength(1);
    });
  });

  describe('getRetryable', () => {
    it('should return tasks that can be retried', () => {
      const task = createTask({ id: 'task-1', maxRetries: 3 });
      task.assign('agent-1');
      task.start();
      task.fail('error');
      queue.enqueue(task);

      expect(queue.getRetryable()).toHaveLength(1);
    });
  });

  describe('getOverdue', () => {
    it('should return tasks past deadline', () => {
      const pastDeadline = createTask({
        id: 'overdue',
        deadline: new Date(Date.now() - 10000),
      });
      const futureDeadline = createTask({
        id: 'future',
        deadline: new Date(Date.now() + 60000),
      });

      queue.enqueue(pastDeadline);
      queue.enqueue(futureDeadline);

      expect(queue.getOverdue()).toHaveLength(1);
      expect(queue.getOverdue()[0].id).toBe('overdue');
    });
  });

  describe('getNextReady', () => {
    beforeEach(() => {
      queue.enqueue(createTask({ id: 'task-1', priority: 'high' }));
      queue.enqueue(createTask({ id: 'task-2', priority: 'medium' }));
      queue.enqueue(createTask({ id: 'task-3', priority: 'low' }));
    });

    it('should return N ready tasks in priority order', () => {
      const next = queue.getNextReady(2);
      expect(next).toHaveLength(2);
      expect(next[0].id).toBe('task-1');
      expect(next[1].id).toBe('task-2');
    });

    it('should return all if less than N ready', () => {
      const next = queue.getNextReady(10);
      expect(next).toHaveLength(3);
    });
  });

  describe('state methods', () => {
    it('size should return queue size', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));
      expect(queue.size).toBe(2);
    });

    it('isEmpty should return true for empty queue', () => {
      expect(queue.isEmpty()).toBe(true);
    });

    it('isEmpty should return false for non-empty queue', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      expect(queue.isEmpty()).toBe(false);
    });

    it('isFull should return true when at max capacity', () => {
      const smallQueue = new TaskQueue({ maxSize: 2 });
      smallQueue.enqueue(createTask({ id: 'task-1' }));
      smallQueue.enqueue(createTask({ id: 'task-2' }));
      expect(smallQueue.isFull()).toBe(true);
    });

    it('isFull should return false when under capacity', () => {
      expect(queue.isFull()).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return copy of all tasks', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));

      const all = queue.getAll();
      expect(all).toHaveLength(2);

      // Should be a copy
      all.pop();
      expect(queue.size).toBe(2);
    });
  });

  describe('getAllIds', () => {
    it('should return all task IDs', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));

      const ids = queue.getAllIds();
      expect(ids).toContain('task-1');
      expect(ids).toContain('task-2');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      const pending = createTask({ id: 'pending', priority: 'high' });
      const blocked = createTask({ id: 'blocked', priority: 'medium' });
      blocked.block();
      const failed = createTask({
        id: 'failed',
        priority: 'low',
        maxRetries: 3,
        deadline: new Date(Date.now() - 10000),
      });
      failed.assign('agent-1');
      failed.start();
      failed.fail('error');

      queue.enqueue(pending);
      queue.enqueue(blocked);
      queue.enqueue(failed);
    });

    it('should return queue statistics', () => {
      const stats = queue.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byStatus.pending).toBe(1);
      expect(stats.byStatus.blocked).toBe(1);
      expect(stats.byStatus.failed).toBe(1);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.medium).toBe(1);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.overdue).toBe(1);
      expect(stats.retryable).toBe(1);
    });
  });

  describe('sort', () => {
    it('should sort tasks by priority', () => {
      const noSortQueue = new TaskQueue({ autoSort: false });
      noSortQueue.enqueue(createTask({ id: 'low', priority: 'low' }));
      noSortQueue.enqueue(createTask({ id: 'high', priority: 'high' }));

      noSortQueue.sort();
      expect(noSortQueue.peek()?.id).toBe('high');
    });
  });

  describe('updateBlockedTasks', () => {
    it('should unblock tasks with satisfied dependencies', () => {
      const task = createTask({ id: 'task-1', dependencies: ['dep-1'] });
      task.block('dependency not met');
      queue.enqueue(task);

      const unblocked = queue.updateBlockedTasks(new Set(['dep-1']));

      expect(unblocked).toBe(1);
      expect(task.status).toBe('pending');
    });

    it('should return 0 when no tasks unblocked', () => {
      const task = createTask({
        id: 'task-1',
        dependencies: ['dep-1', 'dep-2'],
      });
      task.block();
      queue.enqueue(task);

      const unblocked = queue.updateBlockedTasks(new Set(['dep-1']));
      expect(unblocked).toBe(0);
    });
  });

  describe('blockDependentTasks', () => {
    it('should block pending tasks dependent on failed task', () => {
      const dependent = createTask({
        id: 'dependent',
        dependencies: ['failed-task'],
      });
      queue.enqueue(dependent);

      const blocked = queue.blockDependentTasks('failed-task');

      expect(blocked).toBe(1);
      expect(dependent.status).toBe('blocked');
    });

    it('should not block non-pending tasks', () => {
      const dependent = createTask({
        id: 'dependent',
        dependencies: ['failed-task'],
      });
      dependent.block();
      queue.enqueue(dependent);

      const blocked = queue.blockDependentTasks('failed-task');
      expect(blocked).toBe(0);
    });
  });

  describe('reprioritize', () => {
    it('should return true for existing task', () => {
      queue.enqueue(createTask({ id: 'task-1' }));
      expect(queue.reprioritize('task-1', 'critical')).toBe(true);
    });

    it('should return false for non-existing task', () => {
      expect(queue.reprioritize('non-existent', 'critical')).toBe(false);
    });
  });

  describe('iteration', () => {
    beforeEach(() => {
      queue.enqueue(createTask({ id: 'task-1' }));
      queue.enqueue(createTask({ id: 'task-2' }));
    });

    it('should be iterable', () => {
      const ids: string[] = [];
      for (const task of queue) {
        ids.push(task.id);
      }
      expect(ids).toHaveLength(2);
    });

    it('forEach should iterate over all tasks', () => {
      const ids: string[] = [];
      queue.forEach((task) => ids.push(task.id));
      expect(ids).toHaveLength(2);
    });

    it('filter should return matching tasks', () => {
      queue.enqueue(createTask({ id: 'high', priority: 'high' }));
      const highPriority = queue.filter((t) => t.priority === 'high');
      expect(highPriority).toHaveLength(1);
    });

    it('find should return first matching task', () => {
      const task = queue.find((t) => t.id === 'task-1');
      expect(task?.id).toBe('task-1');
    });

    it('find should return undefined when no match', () => {
      const task = queue.find((t) => t.id === 'non-existent');
      expect(task).toBeUndefined();
    });
  });

  describe('createTaskQueue factory', () => {
    it('should create a queue instance', () => {
      const q = createTaskQueue();
      expect(q).toBeInstanceOf(TaskQueue);
    });

    it('should accept config', () => {
      const q = createTaskQueue({ maxSize: 10 });
      expect(q).toBeInstanceOf(TaskQueue);
    });
  });
});

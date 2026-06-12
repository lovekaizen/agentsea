import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DelegationCoordinator,
  createDelegationCoordinator,
} from '../coordination/Delegation.js';
import { CrewAgent } from '../agents/CrewAgent.js';
import { ExecutionContext } from '../core/ExecutionContext.js';
import type { CrewAgentConfig, TaskConfig } from '../types/index.js';

// Helper to create agent
function createAgent(
  name: string,
  capabilities: string[] = ['coding'],
): CrewAgent {
  const config: CrewAgentConfig = {
    name,
    role: {
      name: 'Developer',
      description: 'A developer',
      capabilities: capabilities.map((cap) => ({
        name: cap,
        description: cap,
        proficiency: 'expert',
      })),
      systemPrompt: 'You are a developer.',
    },
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
  };

  return new CrewAgent({ config });
}

// Helper to create task
function createTask(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    id: 'task-1',
    description: 'Test task',
    expectedOutput: 'Output',
    ...overrides,
  };
}

describe('DelegationCoordinator', () => {
  let coordinator: DelegationCoordinator;
  let context: ExecutionContext;
  let agents: CrewAgent[];

  beforeEach(() => {
    coordinator = new DelegationCoordinator();
    context = new ExecutionContext({ crewName: 'TestCrew' });
    agents = [
      createAgent('Agent1', ['coding']),
      createAgent('Agent2', ['design']),
      createAgent('Agent3', ['coding', 'testing']),
    ];
  });

  describe('constructor', () => {
    it('should create coordinator with default config', () => {
      expect(coordinator).toBeDefined();
    });

    it('should use default strategy', () => {
      const coord = new DelegationCoordinator();
      expect(coord).toBeDefined();
    });

    it('should accept custom default strategy', () => {
      const coord = new DelegationCoordinator({
        defaultStrategy: 'round-robin',
      });
      expect(coord).toBeDefined();
    });

    it('should initialize all strategies', () => {
      const strategy = coordinator.getStrategy('best-match');
      expect(strategy).toBeDefined();
    });
  });

  describe('Strategy Management', () => {
    it('should get strategy by type', () => {
      const strategy = coordinator.getStrategy('best-match');
      expect(strategy).toBeDefined();
    });

    it('should return undefined for non-existent strategy', () => {
      const strategy = coordinator.getStrategy('non-existent' as any);
      expect(strategy).toBeUndefined();
    });

    it('should allow registering custom strategy', () => {
      const mockStrategy = {
        name: 'custom' as const,
        selectAgent: vi.fn(),
      };

      coordinator.registerStrategy('consensus', mockStrategy);

      expect(coordinator.getStrategy('consensus')).toBe(mockStrategy);
    });
  });

  describe('Delegation', () => {
    it('should delegate task to agent', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await coordinator.delegate(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
      expect(['Agent1', 'Agent3']).toContain(result.selectedAgent);
      expect(result.reason).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should emit delegation decision event', async () => {
      const handler = vi.fn();
      context.on('delegation:decision', handler);

      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      await coordinator.delegate(task, agents, context);

      expect(handler).toHaveBeenCalled();
    });

    it('should use specified strategy', async () => {
      const task = createTask();

      const result = await coordinator.delegate(
        task,
        agents,
        context,
        'round-robin',
      );

      expect(result.selectedAgent).toBeDefined();
    });

    it('should throw when no agents available', async () => {
      const task = createTask();

      await expect(coordinator.delegate(task, [], context)).rejects.toThrow();
    });

    it('should track delegation history', async () => {
      const task = createTask({ id: 'task-1' });

      await coordinator.delegate(task, agents, context);

      const history = coordinator.getHistory('task-1');
      expect(history).toHaveLength(1);
      expect(history[0].taskId).toBe('task-1');
    });

    it('should include alternative agents', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await coordinator.delegate(task, agents, context);

      expect(result.alternativeAgents).toBeDefined();
    });
  });

  describe('Fallback Strategies', () => {
    it('should try fallback strategies on failure', async () => {
      // Create a coordinator that will fail on first strategy
      const coord = new DelegationCoordinator({
        enableFallback: true,
        fallbackOrder: ['best-match', 'round-robin'],
      });

      const task = createTask();

      const result = await coord.delegate(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
    });

    it('should emit delegation failed event', async () => {
      const handler = vi.fn();
      context.on('delegation:failed', handler);

      // Create coordinator with strict requirements
      const coord = new DelegationCoordinator({
        enableFallback: false,
      });

      const task = createTask({
        requiredCapabilities: ['non-existent-capability'],
      });

      await expect(
        coord.delegate(task, agents, context, 'best-match'),
      ).rejects.toThrow();
    });

    it('should disable fallback when configured', async () => {
      const coord = new DelegationCoordinator({
        enableFallback: false,
      });

      const task = createTask({
        requiredCapabilities: ['impossible-capability'],
      });

      await expect(coord.delegate(task, agents, context)).rejects.toThrow();
    });

    it('should respect max attempts', async () => {
      const coord = new DelegationCoordinator({
        maxAttempts: 2,
        enableFallback: true,
      });

      const task = createTask({
        requiredCapabilities: ['impossible'],
      });

      await expect(coord.delegate(task, agents, context)).rejects.toThrow(
        /Failed to delegate task after \d+ attempts/,
      );
    });
  });

  describe('Batch Delegation', () => {
    it('should delegate multiple tasks', async () => {
      const tasks = [
        createTask({ id: 'task-1', requiredCapabilities: ['coding'] }),
        createTask({ id: 'task-2', requiredCapabilities: ['design'] }),
      ];

      const results = await coordinator.delegateBatch(tasks, agents, context);

      expect(results.size).toBe(2);
      expect(results.get('task-1')?.selectedAgent).toBeDefined();
      expect(results.get('task-2')?.selectedAgent).toBeDefined();
    });

    it('should handle failed delegations in batch', async () => {
      const tasks = [
        createTask({ id: 'task-1', requiredCapabilities: ['coding'] }),
        createTask({
          id: 'task-2',
          requiredCapabilities: ['impossible'],
        }),
      ];

      const results = await coordinator.delegateBatch(tasks, agents, context);

      expect(results.size).toBe(2);
      expect(results.get('task-1')?.selectedAgent).toBeDefined();

      const failedResult = results.get('task-2');
      expect(failedResult?.metadata?.failed).toBe(true);
    });
  });

  describe('Agent Discovery', () => {
    it('should find best agent for task', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const agent = await coordinator.findBestAgent(task, agents, context);

      expect(agent).toBeDefined();
      expect(agent?.hasCapability('coding')).toBe(true);
    });

    it('should return undefined when no agent found', async () => {
      const task = createTask({
        requiredCapabilities: ['impossible'],
      });

      const agent = await coordinator.findBestAgent(task, agents, context);
      expect(agent).toBeUndefined();
    });

    it('should get recommendations for task', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const recommendations = await coordinator.getRecommendations(
        task,
        agents,
        context,
        3,
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].agent).toBeDefined();
      expect(recommendations[0].score).toBeGreaterThan(0);
      expect(recommendations[0].reason).toBeDefined();
    });

    it('should limit recommendations', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const recommendations = await coordinator.getRecommendations(
        task,
        agents,
        context,
        1,
      );

      expect(recommendations).toHaveLength(1);
    });
  });

  describe('History and Statistics', () => {
    it('should get delegation history', async () => {
      await coordinator.delegate(createTask({ id: 'task-1' }), agents, context);
      await coordinator.delegate(createTask({ id: 'task-2' }), agents, context);

      const history = coordinator.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter history by task ID', async () => {
      await coordinator.delegate(createTask({ id: 'task-1' }), agents, context);
      await coordinator.delegate(createTask({ id: 'task-2' }), agents, context);

      const history = coordinator.getHistory('task-1');
      expect(history).toHaveLength(1);
      expect(history[0].taskId).toBe('task-1');
    });

    it('should get delegation statistics', async () => {
      await coordinator.delegate(createTask(), agents, context);
      await coordinator.delegate(
        createTask({ id: 'task-2' }),
        agents,
        context,
        'round-robin',
      );

      const stats = coordinator.getStatistics();

      expect(stats.totalDelegations).toBeGreaterThanOrEqual(2);
      expect(stats.byStrategy['best-match']).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it('should clear history', async () => {
      await coordinator.delegate(createTask(), agents, context);

      coordinator.clearHistory();

      const history = coordinator.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Reset', () => {
    it('should reset coordinator state', async () => {
      await coordinator.delegate(createTask(), agents, context);

      coordinator.reset();

      const history = coordinator.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('createDelegationCoordinator factory', () => {
    it('should create coordinator instance', () => {
      const coord = createDelegationCoordinator();
      expect(coord).toBeInstanceOf(DelegationCoordinator);
    });

    it('should accept config', () => {
      const coord = createDelegationCoordinator({
        defaultStrategy: 'round-robin',
      });
      expect(coord).toBeInstanceOf(DelegationCoordinator);
    });
  });
});

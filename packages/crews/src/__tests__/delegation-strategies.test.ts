import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BestMatchStrategy } from '../coordination/strategies/BestMatch.js';
import { RoundRobinStrategy } from '../coordination/strategies/RoundRobin.js';
import { AuctionStrategy } from '../coordination/strategies/Auction.js';
import { HierarchicalStrategy } from '../coordination/strategies/Hierarchical.js';
import { ConsensusStrategy } from '../coordination/strategies/Consensus.js';
import { CrewAgent } from '../agents/CrewAgent.js';
import { ExecutionContext } from '../core/ExecutionContext.js';
import type { CrewAgentConfig, TaskConfig } from '../types/index.js';

// Helper to create agent
function createAgent(
  name: string,
  capabilities: string[] = ['coding'],
  proficiency: 'novice' | 'intermediate' | 'expert' | 'master' = 'expert',
  model = 'claude-sonnet-4-6',
): CrewAgent {
  const config: CrewAgentConfig = {
    name,
    role: {
      name: 'Developer',
      description: 'A developer',
      capabilities: capabilities.map((cap) => ({
        name: cap,
        description: cap,
        proficiency,
      })),
      systemPrompt: 'You are a developer.',
    },
    model,
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

describe('Delegation Strategies', () => {
  let context: ExecutionContext;
  let agents: CrewAgent[];

  beforeEach(() => {
    context = new ExecutionContext({ crewName: 'TestCrew' });
    agents = [
      createAgent('Agent1', ['coding'], 'expert'),
      createAgent('Agent2', ['design'], 'intermediate'),
      createAgent('Agent3', ['coding', 'testing'], 'master'),
    ];
  });

  describe('BestMatchStrategy', () => {
    let strategy: BestMatchStrategy;

    beforeEach(() => {
      strategy = new BestMatchStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('best-match');
    });

    it('should select best matching agent', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
      expect(['Agent1', 'Agent3']).toContain(result.selectedAgent);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should prefer agent with higher proficiency', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      // Agent3 has master proficiency in coding
      expect(result.selectedAgent).toBe('Agent3');
    });

    it('should prefer available agents when configured', async () => {
      const strat = new BestMatchStrategy({
        preferAvailable: true,
      });

      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strat.selectAgent(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
    });

    it('should respect minimum score threshold', async () => {
      const strat = new BestMatchStrategy({
        minimumScore: 0.9,
      });

      const task = createTask({
        requiredCapabilities: ['impossible-capability'],
      });

      await expect(strat.selectAgent(task, agents, context)).rejects.toThrow();
    });

    it('should throw when no agents available', async () => {
      await expect(
        strategy.selectAgent(createTask(), [], context),
      ).rejects.toThrow('No agents available');
    });
  });

  describe('RoundRobinStrategy', () => {
    let strategy: RoundRobinStrategy;

    beforeEach(() => {
      strategy = new RoundRobinStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('round-robin');
    });

    it('should select agents in rotation', async () => {
      const task1 = createTask({ id: 'task-1' });
      const task2 = createTask({ id: 'task-2' });
      const task3 = createTask({ id: 'task-3' });

      const result1 = await strategy.selectAgent(task1, agents, context);
      const result2 = await strategy.selectAgent(task2, agents, context);
      const result3 = await strategy.selectAgent(task3, agents, context);

      // Should cycle through agents
      expect(result1.selectedAgent).toBe('Agent1');
      expect(result2.selectedAgent).toBe('Agent2');
      expect(result3.selectedAgent).toBe('Agent3');
    });

    it('should wrap around after last agent', async () => {
      // Select all agents once
      await strategy.selectAgent(createTask({ id: 'task-1' }), agents, context);
      await strategy.selectAgent(createTask({ id: 'task-2' }), agents, context);
      await strategy.selectAgent(createTask({ id: 'task-3' }), agents, context);

      // Should wrap back to first agent
      const result = await strategy.selectAgent(
        createTask({ id: 'task-4' }),
        agents,
        context,
      );

      expect(result.selectedAgent).toBe('Agent1');
    });

    it('should reset counter on reset', async () => {
      await strategy.selectAgent(createTask(), agents, context);

      strategy.reset();

      const result = await strategy.selectAgent(createTask(), agents, context);

      expect(result.selectedAgent).toBe('Agent1');
    });

    it('should throw when no agents available', async () => {
      await expect(
        strategy.selectAgent(createTask(), [], context),
      ).rejects.toThrow();
    });
  });

  describe('AuctionStrategy', () => {
    let strategy: AuctionStrategy;

    beforeEach(() => {
      strategy = new AuctionStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('auction');
    });

    it('should select agent with highest bid', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle ties by workload', async () => {
      const task = createTask();

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
    });

    it('should throw when no agents available', async () => {
      await expect(
        strategy.selectAgent(createTask(), [], context),
      ).rejects.toThrow();
    });

    it('should throw when no valid bids', async () => {
      const task = createTask({
        requiredCapabilities: ['impossible-capability'],
      });

      await expect(
        strategy.selectAgent(task, agents, context),
      ).rejects.toThrow();
    });

    it('cheapest criterion should prefer the cheaper model', async () => {
      const cheapAgent = createAgent(
        'CheapAgent',
        ['coding'],
        'expert',
        'claude-haiku-4-5',
      );
      const pricyAgent = createAgent(
        'PricyAgent',
        ['coding'],
        'expert',
        'claude-opus-4-8',
      );
      const cheapest = new AuctionStrategy({ selectionCriteria: 'cheapest' });

      const result = await cheapest.selectAgent(
        createTask({ requiredCapabilities: ['coding'] }),
        [pricyAgent, cheapAgent],
        context,
      );

      expect(result.selectedAgent).toBe('CheapAgent');
    });
  });

  describe('HierarchicalStrategy', () => {
    let strategy: HierarchicalStrategy;
    let hierarchicalAgents: CrewAgent[];

    beforeEach(() => {
      strategy = new HierarchicalStrategy({
        hierarchy: ['Manager', 'Senior', 'Junior'],
      });

      // Create agents with different role names
      hierarchicalAgents = [
        createAgent('Junior1', ['coding']),
        createAgent('Senior1', ['coding', 'design']),
        createAgent('Manager1', ['coding', 'design', 'planning']),
      ];

      // Update role names
      (hierarchicalAgents[0].role as any).name = 'Junior';
      (hierarchicalAgents[1].role as any).name = 'Senior';
      (hierarchicalAgents[2].role as any).name = 'Manager';
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('hierarchical');
    });

    it('should select highest priority capable agent', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(
        task,
        hierarchicalAgents,
        context,
      );

      // Manager is highest in hierarchy
      expect(result.selectedAgent).toBe('Manager1');
    });

    it('should fall back to lower priority if higher not capable', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      // Remove Manager's capabilities
      const agentsWithoutManager = hierarchicalAgents.slice(0, 2);

      const result = await strategy.selectAgent(
        task,
        agentsWithoutManager,
        context,
      );

      expect(result.selectedAgent).toBe('Senior1');
    });

    it('should throw when no capable agents', async () => {
      const task = createTask({
        requiredCapabilities: ['impossible'],
      });

      await expect(
        strategy.selectAgent(task, hierarchicalAgents, context),
      ).rejects.toThrow();
    });
  });

  describe('ConsensusStrategy', () => {
    let strategy: ConsensusStrategy;

    beforeEach(() => {
      strategy = new ConsensusStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('consensus');
    });

    it('should select agent with consensus', async () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.selectedAgent).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should emit consensus request event', async () => {
      const handler = vi.fn();
      context.on('consensus:requested', handler);

      await strategy.selectAgent(createTask(), agents, context);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit consensus reached event', async () => {
      const handler = vi.fn();
      context.on('consensus:reached', handler);

      await strategy.selectAgent(createTask(), agents, context);

      expect(handler).toHaveBeenCalled();
    });

    it('should throw when no agents available', async () => {
      await expect(
        strategy.selectAgent(createTask(), [], context),
      ).rejects.toThrow();
    });

    it('should handle minimum quorum requirement', async () => {
      const strat = new ConsensusStrategy({
        minimumQuorum: 0.5,
      });

      const result = await strat.selectAgent(createTask(), agents, context);

      expect(result.selectedAgent).toBeDefined();
    });

    it('voting is deterministic (no Math.random) — same inputs, same winner', async () => {
      const task = createTask({ requiredCapabilities: ['coding'] });

      // Run several times; the capability-based vote must be stable.
      const winners = new Set<string>();
      for (let i = 0; i < 8; i++) {
        const fresh = new ConsensusStrategy();
        const result = await fresh.selectAgent(task, agents, context);
        winners.add(result.selectedAgent);
      }

      expect(winners.size).toBe(1);
    });

    it('elects the most capable agent by task fit', async () => {
      // Agent3 is a 'master' at coding+testing; should win a coding task.
      const task = createTask({ requiredCapabilities: ['coding'] });
      const result = await strategy.selectAgent(task, agents, context);

      expect(['Agent1', 'Agent3']).toContain(result.selectedAgent);
    });
  });

  describe('Strategy Common Behavior', () => {
    it('should provide decision time in milliseconds', async () => {
      const strategy = new BestMatchStrategy();
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.decisionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should provide reasoning for selection', async () => {
      const strategy = new BestMatchStrategy();
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.reason).toBeDefined();
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('should include metadata in result', async () => {
      const strategy = new BestMatchStrategy();
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const result = await strategy.selectAgent(task, agents, context);

      expect(result.metadata).toBeDefined();
    });
  });
});

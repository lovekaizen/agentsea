import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry, createAgentRegistry } from '../agents/AgentRegistry.js';
import { CrewAgent } from '../agents/CrewAgent.js';
import type { CrewAgentConfig, TaskConfig } from '../types/index.js';

// Helper to create agent config
function createAgentConfig(
  overrides: Partial<CrewAgentConfig> = {},
): CrewAgentConfig {
  return {
    name: 'TestAgent',
    role: {
      name: 'Developer',
      description: 'A software developer',
      capabilities: [
        {
          name: 'coding',
          description: 'Writing code',
          proficiency: 'expert',
        },
      ],
      systemPrompt: 'You are a developer.',
    },
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    ...overrides,
  };
}

// Helper to create agent
function createAgent(overrides: Partial<CrewAgentConfig> = {}): CrewAgent {
  return new CrewAgent({ config: createAgentConfig(overrides) });
}

// Helper to create task
function createTask(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    description: 'Test task',
    expectedOutput: 'Output',
    ...overrides,
  };
}

describe('AgentRegistry', () => {
  describe('constructor', () => {
    it('should create empty registry', () => {
      const registry = new AgentRegistry();
      expect(registry.size).toBe(0);
    });

    it('should default allowDuplicates to false', () => {
      const registry = new AgentRegistry();
      const agent = createAgent({ name: 'Agent1' });

      registry.register(agent);
      expect(() => registry.register(agent)).toThrow(
        'Agent "Agent1" is already registered',
      );
    });

    it('should allow duplicates when configured', () => {
      const registry = new AgentRegistry({ allowDuplicates: true });
      const agent1 = createAgent({ name: 'Agent1' });
      const agent2 = createAgent({ name: 'Agent1' });

      registry.register(agent1);
      expect(() => registry.register(agent2)).not.toThrow();
    });
  });

  describe('Registration', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
    });

    it('should register an agent', () => {
      const agent = createAgent({ name: 'Agent1' });
      registry.register(agent);

      expect(registry.size).toBe(1);
      expect(registry.has('Agent1')).toBe(true);
    });

    it('should register with metadata', () => {
      const agent = createAgent({ name: 'Agent1' });
      registry.register(agent, { customKey: 'value' });

      const entry = registry.getEntry('Agent1');
      expect(entry?.metadata).toEqual({ customKey: 'value' });
    });

    it('should throw on duplicate registration', () => {
      const agent = createAgent({ name: 'Agent1' });
      registry.register(agent);

      expect(() => registry.register(agent)).toThrow();
    });

    it('should register multiple agents', () => {
      const agents = [
        createAgent({ name: 'Agent1' }),
        createAgent({ name: 'Agent2' }),
        createAgent({ name: 'Agent3' }),
      ];

      registry.registerMany(agents);

      expect(registry.size).toBe(3);
    });

    it('should unregister an agent', () => {
      const agent = createAgent({ name: 'Agent1' });
      registry.register(agent);

      const removed = registry.unregister('Agent1');

      expect(removed).toBe(true);
      expect(registry.size).toBe(0);
    });

    it('should return false when unregistering non-existent agent', () => {
      expect(registry.unregister('DoesNotExist')).toBe(false);
    });

    it('should check if agent is registered', () => {
      const agent = createAgent({ name: 'Agent1' });
      registry.register(agent);

      expect(registry.has('Agent1')).toBe(true);
      expect(registry.has('Agent2')).toBe(false);
    });
  });

  describe('Retrieval', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
      registry.register(createAgent({ name: 'Agent1' }));
      registry.register(createAgent({ name: 'Agent2' }));
    });

    it('should get agent by name', () => {
      const agent = registry.get('Agent1');
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Agent1');
    });

    it('should return undefined for non-existent agent', () => {
      expect(registry.get('DoesNotExist')).toBeUndefined();
    });

    it('should get registered entry', () => {
      const entry = registry.getEntry('Agent1');

      expect(entry).toBeDefined();
      expect(entry?.agent.name).toBe('Agent1');
      expect(entry?.status).toBe('available');
      expect(entry?.registeredAt).toBeInstanceOf(Date);
    });

    it('should get all agents', () => {
      const agents = registry.getAll();

      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe('Agent1');
      expect(agents[1].name).toBe('Agent2');
    });

    it('should get all entries', () => {
      const entries = registry.getAllEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].status).toBe('available');
    });

    it('should get agent names', () => {
      const names = registry.getNames();

      expect(names).toContain('Agent1');
      expect(names).toContain('Agent2');
      expect(names).toHaveLength(2);
    });

    it('should return registry size', () => {
      expect(registry.size).toBe(2);
    });
  });

  describe('Status Management', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
      registry.register(createAgent({ name: 'Agent1' }));
    });

    it('should get agent status', () => {
      const status = registry.getStatus('Agent1');
      expect(status).toBe('available');
    });

    it('should set agent status', () => {
      registry.setStatus('Agent1', 'busy');

      expect(registry.getStatus('Agent1')).toBe('busy');
    });

    it('should update lastActiveAt when setting status', () => {
      const before = registry.getEntry('Agent1')?.lastActiveAt;

      // Wait a bit
      const start = Date.now();
      while (Date.now() - start < 10) {
        // busy wait
      }

      registry.setStatus('Agent1', 'busy');

      const after = registry.getEntry('Agent1')?.lastActiveAt;
      expect(after).toBeDefined();
    });

    it('should mark agent as busy', () => {
      registry.markBusy('Agent1', 'task-1');

      const entry = registry.getEntry('Agent1');
      expect(entry?.status).toBe('busy');
      expect(entry?.currentTask).toBe('task-1');
    });

    it('should mark agent as available', () => {
      registry.markBusy('Agent1', 'task-1');
      registry.markAvailable('Agent1');

      const entry = registry.getEntry('Agent1');
      expect(entry?.status).toBe('available');
      expect(entry?.currentTask).toBeUndefined();
    });

    it('should record task completion', () => {
      registry.markBusy('Agent1', 'task-1');
      registry.recordTaskCompletion('Agent1', true);

      const entry = registry.getEntry('Agent1');
      expect(entry?.tasksCompleted).toBe(1);
      expect(entry?.status).toBe('available');
    });

    it('should record task failure', () => {
      registry.markBusy('Agent1', 'task-1');
      registry.recordTaskCompletion('Agent1', false);

      const entry = registry.getEntry('Agent1');
      expect(entry?.tasksFailed).toBe(1);
    });

    it('should not track stats when disabled', () => {
      const reg = new AgentRegistry({ trackStats: false });
      reg.register(createAgent({ name: 'Agent1' }));

      reg.recordTaskCompletion('Agent1', true);

      const entry = reg.getEntry('Agent1');
      expect(entry?.tasksCompleted).toBe(0);
    });
  });

  describe('Discovery', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();

      registry.register(
        createAgent({
          name: 'Coder',
          role: {
            name: 'Developer',
            description: 'Developer',
            capabilities: [
              {
                name: 'coding',
                description: 'Coding',
                proficiency: 'expert',
              },
            ],
            systemPrompt: 'You are a developer.',
          },
        }),
      );

      registry.register(
        createAgent({
          name: 'Designer',
          role: {
            name: 'Designer',
            description: 'Designer',
            capabilities: [
              {
                name: 'design',
                description: 'Design',
                proficiency: 'expert',
              },
            ],
            systemPrompt: 'You are a designer.',
          },
        }),
      );
    });

    it('should find agents by capability', () => {
      const agents = registry.findByCapability('coding');

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('Coder');
    });

    it('should return empty array when capability not found', () => {
      const agents = registry.findByCapability('marketing');
      expect(agents).toHaveLength(0);
    });

    it('should find agents by role', () => {
      const agents = registry.findByRole('Developer');

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('Coder');
    });

    it('should find best match for task', () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const agent = registry.findBestMatch(task);

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Coder');
    });

    it('should return undefined when no match found', () => {
      const task = createTask({
        requiredCapabilities: ['marketing'],
      });

      const agent = registry.findBestMatch(task);
      expect(agent).toBeUndefined();
    });

    it('should rank agents for task', () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const ranked = registry.rankForTask(task);

      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].agentName).toBe('Coder');
    });

    it('should find capable agents', () => {
      const task = createTask({
        requiredCapabilities: ['coding'],
      });

      const agents = registry.findCapableAgents(task);

      expect(agents).toHaveLength(1);
      expect(agents[0].name).toBe('Coder');
    });
  });

  describe('Filtering', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
      registry.register(createAgent({ name: 'Agent1' }));
      registry.register(createAgent({ name: 'Agent2' }));
      registry.register(createAgent({ name: 'Agent3' }));

      registry.markBusy('Agent1', 'task-1');
      registry.setStatus('Agent3', 'unavailable');
    });

    it('should get available agents', () => {
      const available = registry.getAvailable();

      expect(available).toHaveLength(1);
      expect(available[0].name).toBe('Agent2');
    });

    it('should get busy agents', () => {
      const busy = registry.getBusy();

      expect(busy).toHaveLength(1);
      expect(busy[0].name).toBe('Agent1');
    });

    it('should get agents by status', () => {
      const unavailable = registry.getByStatus('unavailable');

      expect(unavailable).toHaveLength(1);
      expect(unavailable[0].name).toBe('Agent3');
    });

    it('should get available count', () => {
      expect(registry.getAvailableCount()).toBe(1);
    });

    it('should check if any agent is available', () => {
      expect(registry.hasAvailable()).toBe(true);

      registry.markBusy('Agent2', 'task-2');
      expect(registry.hasAvailable()).toBe(false);
    });
  });

  describe('Statistics', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
      registry.register(createAgent({ name: 'Agent1' }));
      registry.register(createAgent({ name: 'Agent2' }));

      registry.markBusy('Agent1', 'task-1');
      registry.recordTaskCompletion('Agent1', true);

      registry.markBusy('Agent2', 'task-2');
    });

    it('should get registry statistics', () => {
      const stats = registry.getStats();

      expect(stats.total).toBe(2);
      expect(stats.available).toBe(1);
      expect(stats.busy).toBe(1);
      expect(stats.totalTasksCompleted).toBe(1);
    });

    it('should get agent statistics', () => {
      const stats = registry.getAgentStats('Agent1');

      expect(stats).toBeDefined();
      expect(stats?.name).toBe('Agent1');
      expect(stats?.status).toBe('available');
      expect(stats?.tasksCompleted).toBe(1);
      expect(stats?.successRate).toBe(1);
    });

    it('should return undefined for non-existent agent stats', () => {
      expect(registry.getAgentStats('DoesNotExist')).toBeUndefined();
    });

    it('should calculate success rate', () => {
      registry.recordTaskCompletion('Agent1', false);

      const stats = registry.getAgentStats('Agent1');
      expect(stats?.successRate).toBe(0.5);
    });
  });

  describe('Iteration', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
      registry.register(createAgent({ name: 'Agent1' }));
      registry.register(createAgent({ name: 'Agent2' }));
    });

    it('should be iterable', () => {
      const names: string[] = [];
      for (const agent of registry) {
        names.push(agent.name);
      }

      expect(names).toHaveLength(2);
      expect(names).toContain('Agent1');
    });

    it('should support forEach', () => {
      const names: string[] = [];
      registry.forEach((agent) => names.push(agent.name));

      expect(names).toHaveLength(2);
    });
  });

  describe('Utilities', () => {
    let registry: AgentRegistry;

    beforeEach(() => {
      registry = new AgentRegistry();
      registry.register(createAgent({ name: 'Agent1' }));
      registry.register(createAgent({ name: 'Agent2' }));
    });

    it('should clear all agents', () => {
      registry.clear();

      expect(registry.size).toBe(0);
    });

    it('should reset all agent statuses', () => {
      registry.markBusy('Agent1', 'task-1');
      registry.setStatus('Agent2', 'error');

      registry.resetAllStatuses();

      expect(registry.getStatus('Agent1')).toBe('available');
      expect(registry.getStatus('Agent2')).toBe('available');
    });
  });

  describe('createAgentRegistry factory', () => {
    it('should create registry instance', () => {
      const registry = createAgentRegistry();
      expect(registry).toBeInstanceOf(AgentRegistry);
    });

    it('should accept config', () => {
      const registry = createAgentRegistry({ allowDuplicates: true });
      expect(registry).toBeInstanceOf(AgentRegistry);
    });
  });
});

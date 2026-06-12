import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrewAgent, createCrewAgent } from '../agents/CrewAgent.js';
import { ExecutionContext } from '../core/ExecutionContext.js';
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
      systemPrompt: 'You are a helpful developer.',
    },
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
    ...overrides,
  };
}

// Helper to create task config
function createTaskConfig(overrides: Partial<TaskConfig> = {}): TaskConfig {
  return {
    description: 'Test task',
    expectedOutput: 'Expected output',
    ...overrides,
  };
}

describe('CrewAgent', () => {
  describe('constructor', () => {
    it('should create agent with required fields', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('TestAgent');
      expect(agent.model).toBe('claude-sonnet-4-6');
      expect(agent.provider).toBe('anthropic');
    });

    it('should initialize role from config', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      expect(agent.role.name).toBe('Developer');
      expect(agent.capabilities).toHaveLength(1);
    });

    it('should use default temperature', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      expect(agent.temperature).toBe(0.7);
    });

    it('should use custom temperature', () => {
      const agent = new CrewAgent({
        config: createAgentConfig({ temperature: 0.5 }),
      });
      expect(agent.temperature).toBe(0.5);
    });

    it('should use default maxIterations', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      expect(agent.maxIterations).toBe(10);
    });

    it('should use custom maxIterations', () => {
      const agent = new CrewAgent({
        config: createAgentConfig({ maxIterations: 20 }),
      });
      expect(agent.maxIterations).toBe(20);
    });

    it('should use role required tools', () => {
      const config = createAgentConfig({
        role: {
          name: 'Developer',
          description: 'Developer',
          capabilities: [
            {
              name: 'coding',
              description: 'Coding',
              proficiency: 'expert',
              tools: ['editor', 'git'],
            },
          ],
          systemPrompt: 'You are a developer.',
        },
      });

      const agent = new CrewAgent({ config });
      expect(agent.tools).toContain('editor');
      expect(agent.tools).toContain('git');
    });

    it('should override with custom tools', () => {
      const agent = new CrewAgent({
        config: createAgentConfig({ tools: ['custom-tool'] }),
      });
      expect(agent.tools).toEqual(['custom-tool']);
    });

    it('should default parallelCapable to false', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      expect(agent.parallelCapable).toBe(false);
    });
  });

  describe('Execution', () => {
    it('should execute with mock response when no execute function', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const result = await agent.execute('Test input');

      expect(result.output).toContain('TestAgent');
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.latencyMs).toBeGreaterThan(0);
      expect(result.iterations).toBe(1);
    });

    it('should execute with provided execute function', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        output: 'Custom response',
        tokensUsed: 250,
        latencyMs: 1000,
        iterations: 1,
      });

      const agent = new CrewAgent({
        config: createAgentConfig(),
        execute: mockExecute,
      });

      const result = await agent.execute('Test input');

      expect(mockExecute).toHaveBeenCalled();
      expect(result.output).toBe('Custom response');
      expect(result.tokensUsed).toBe(250);
    });

    it('should track total tokens used', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      await agent.execute('Test 1');
      await agent.execute('Test 2');

      const stats = agent.getStats();
      expect(stats.totalTokensUsed).toBeGreaterThan(0);
    });

    it('should execute task', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      const task = createTaskConfig({ id: 'task-1' });

      const result = await agent.executeTask(task);

      expect(result.output).toBeDefined();
      expect(result.completedBy).toBe('TestAgent');
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.iterations).toBe(1);
    });

    it('should track task completion', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      const task = createTaskConfig();

      await agent.executeTask(task);

      const stats = agent.getStats();
      expect(stats.tasksCompleted).toBe(1);
      expect(stats.tasksFailed).toBe(0);
    });

    it('should track task failure', async () => {
      const mockExecute = vi
        .fn()
        .mockRejectedValue(new Error('Execution failed'));

      const agent = new CrewAgent({
        config: createAgentConfig(),
        execute: mockExecute,
      });

      await expect(agent.executeTask(createTaskConfig())).rejects.toThrow(
        'Execution failed',
      );

      const stats = agent.getStats();
      expect(stats.tasksFailed).toBe(1);
    });

    it('should format task input with context', async () => {
      const mockExecute = vi.fn().mockResolvedValue({
        output: 'Response',
        tokensUsed: 100,
        latencyMs: 500,
        iterations: 1,
      });

      const agent = new CrewAgent({
        config: createAgentConfig(),
        execute: mockExecute,
      });

      const task = createTaskConfig({
        context: { key: 'value' },
        deadline: new Date('2025-12-31'),
      });

      await agent.executeTask(task);

      expect(mockExecute).toHaveBeenCalled();
      const input = mockExecute.mock.calls[0][0];
      expect(input).toContain('Test task');
      expect(input).toContain('Expected output');
      expect(input).toContain('Context');
      expect(input).toContain('Deadline');
    });
  });

  describe('Capability Matching', () => {
    it('should check if agent has capability', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      expect(agent.hasCapability('coding')).toBe(true);
      expect(agent.hasCapability('design')).toBe(false);
    });

    it('should get proficiency score', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      expect(agent.getProficiencyScore('coding')).toBe(0.75);
      expect(agent.getProficiencyScore('design')).toBe(0);
    });

    it('should match required capabilities', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const match = agent.matchesCapabilities([
        {
          name: 'coding',
          description: 'Coding',
          proficiency: 'intermediate',
        },
      ]);

      expect(match.canExecute).toBe(true);
      expect(match.matched).toHaveLength(1);
      expect(match.missing).toHaveLength(0);
    });

    it('should detect missing capabilities', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const match = agent.matchesCapabilities([
        {
          name: 'coding',
          description: 'Coding',
          proficiency: 'intermediate',
        },
        {
          name: 'design',
          description: 'Design',
          proficiency: 'intermediate',
        },
      ]);

      expect(match.canExecute).toBe(false);
      expect(match.matched).toHaveLength(1);
      expect(match.missing).toHaveLength(1);
    });

    it('should calculate task score', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const task = createTaskConfig({
        requiredCapabilities: ['coding'],
      });

      const score = agent.calculateTaskScore(task);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Bidding', () => {
    it('should generate bid for task', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const task = createTaskConfig({
        id: 'task-1',
        requiredCapabilities: ['coding'],
      });

      const bid = await agent.bidOnTask(task);

      expect(bid.agentName).toBe('TestAgent');
      expect(bid.taskId).toBe('task-1');
      expect(bid.confidence).toBeGreaterThan(0);
      expect(bid.reasoning).toBeDefined();
      expect(bid.capabilities).toContain('coding');
    });

    it('should reduce confidence if missing capabilities', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const task = createTaskConfig({
        requiredCapabilities: ['coding', 'design'],
      });

      const bid = await agent.bidOnTask(task);
      expect(bid.confidence).toBeLessThan(1);
    });

    it('should reduce confidence if already busy', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      // Start a task (will be in progress)
      const taskPromise = agent.executeTask(createTaskConfig());

      const bid = await agent.bidOnTask(createTaskConfig({ id: 'bid-task' }));
      expect(bid.confidence).toBeLessThan(1);

      await taskPromise;
    });

    it('should estimate task time', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const bid = await agent.bidOnTask(createTaskConfig());
      expect(bid.estimatedTime).toBeGreaterThan(0);
    });
  });

  describe('Collaboration', () => {
    it('should create help request', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const request = agent.createHelpRequest('task-1', 'Need help');

      expect(request.requestId).toBeDefined();
      expect(request.fromAgent).toBe('TestAgent');
      expect(request.taskId).toBe('task-1');
      expect(request.request).toBe('Need help');
    });

    it('should respond to help request', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const request = {
        requestId: 'req-1',
        fromAgent: 'OtherAgent',
        taskId: 'task-1',
        request: 'How do I debug this?',
      };

      const response = await agent.respondToHelpRequest(request);

      expect(response.requestId).toBe('req-1');
      expect(response.fromAgent).toBe('TestAgent');
      expect(response.response).toBeDefined();
      expect(response.helpful).toBe(true);
    });

    it('should provide help for task', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      const context = new ExecutionContext({ crewName: 'Test' });

      const task = createTaskConfig({
        requiredCapabilities: ['coding'],
      });

      const help = await agent.provideHelp(task, 'Need help', context);

      expect(help.helpful).toBe(true);
      expect(help.response).toBeDefined();
    });

    it('should decline help when not capable', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      const context = new ExecutionContext({ crewName: 'Test' });

      const task = createTaskConfig({
        requiredCapabilities: ['design', 'marketing'],
      });

      const help = await agent.provideHelp(task, 'Need help', context);

      expect(help.helpful).toBe(false);
    });
  });

  describe('State', () => {
    it('should not be busy initially', () => {
      const agent = new CrewAgent({ config: createAgentConfig() });
      expect(agent.isBusy).toBe(false);
    });

    it('should be busy during task execution', async () => {
      // Create a controlled async task
      let resolveTask:
        | ((value: {
            output: string;
            tokensUsed: number;
            latencyMs: number;
            iterations: number;
          }) => void)
        | undefined;
      const taskPromise = new Promise<{
        output: string;
        tokensUsed: number;
        latencyMs: number;
        iterations: number;
      }>((resolve) => {
        resolveTask = resolve;
      });

      // Create agent with a slow execute function
      const agent = new CrewAgent({
        config: createAgentConfig(),
        execute: () => taskPromise,
      });

      const execPromise = agent.executeTask(createTaskConfig({ id: 'task-1' }));

      // Give the event loop a tick to start execution
      await new Promise((r) => setTimeout(r, 0));

      expect(agent.isBusy).toBe(true);

      resolveTask!({
        output: 'done',
        tokensUsed: 100,
        latencyMs: 500,
        iterations: 1,
      });
      await execPromise;
      expect(agent.isBusy).toBe(false);
    });

    it('should get current task ID', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      const taskPromise = agent.executeTask(createTaskConfig({ id: 'task-1' }));
      expect(agent.getCurrentTask()).toBe('task-1');

      await taskPromise;
      expect(agent.getCurrentTask()).toBeUndefined();
    });

    it('should get agent statistics', async () => {
      const agent = new CrewAgent({ config: createAgentConfig() });

      await agent.executeTask(createTaskConfig());

      const stats = agent.getStats();

      expect(stats.name).toBe('TestAgent');
      expect(stats.role).toBe('Developer');
      expect(stats.tasksCompleted).toBe(1);
      expect(stats.tasksFailed).toBe(0);
      expect(stats.successRate).toBe(1);
      expect(stats.isBusy).toBe(false);
    });

    it('should calculate success rate', async () => {
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce({
          output: 'Success',
          tokensUsed: 100,
          latencyMs: 500,
          iterations: 1,
        })
        .mockRejectedValueOnce(new Error('Failed'));

      const agent = new CrewAgent({
        config: createAgentConfig(),
        execute: mockExecute,
      });

      await agent.executeTask(createTaskConfig());

      try {
        await agent.executeTask(createTaskConfig());
      } catch {
        // Expected
      }

      const stats = agent.getStats();
      expect(stats.successRate).toBe(0.5);
    });
  });

  describe('Serialization', () => {
    it('should convert to config', () => {
      const originalConfig = createAgentConfig({
        temperature: 0.8,
        maxTokens: 2000,
      });

      const agent = new CrewAgent({ config: originalConfig });
      const config = agent.toConfig();

      expect(config.name).toBe('TestAgent');
      expect(config.temperature).toBe(0.8);
      expect(config.maxTokens).toBe(2000);
    });

    it('should create from config', () => {
      const config = createAgentConfig();
      const agent = CrewAgent.fromConfig(config);

      expect(agent).toBeInstanceOf(CrewAgent);
      expect(agent.name).toBe('TestAgent');
    });
  });

  describe('createCrewAgent factory', () => {
    it('should create agent instance', () => {
      const agent = createCrewAgent({ config: createAgentConfig() });
      expect(agent).toBeInstanceOf(CrewAgent);
    });
  });
});

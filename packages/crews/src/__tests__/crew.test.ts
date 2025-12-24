import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Crew, createCrew } from '../core/Crew.js';
import { CrewAgent } from '../agents/CrewAgent.js';
import type { CrewConfig, CrewAgentConfig } from '../types/index.js';
import { Role } from '../core/Role.js';

// Mock agent config
function createMockAgentConfig(
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
    model: 'claude-sonnet-4',
    provider: 'anthropic',
    ...overrides,
  };
}

// Mock crew config
function createMockCrewConfig(overrides: Partial<CrewConfig> = {}): CrewConfig {
  return {
    name: 'Test Crew',
    description: 'A test crew',
    agents: [createMockAgentConfig()],
    delegationStrategy: 'best-match',
    ...overrides,
  };
}

describe('Crew', () => {
  describe('constructor', () => {
    it('should create a crew with required fields', () => {
      const crew = new Crew(createMockCrewConfig());

      expect(crew.id).toBeDefined();
      expect(crew.name).toBe('Test Crew');
      expect(crew.description).toBe('A test crew');
    });

    it('should initialize agents from config', () => {
      const config = createMockCrewConfig({
        agents: [
          createMockAgentConfig({ name: 'Agent1' }),
          createMockAgentConfig({ name: 'Agent2' }),
        ],
      });

      const crew = new Crew(config);
      const agents = crew.getAgents();

      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe('Agent1');
      expect(agents[1].name).toBe('Agent2');
    });

    it('should use default maxIterations', () => {
      const crew = new Crew(createMockCrewConfig());
      const status = crew.getStatus();

      expect(status.maxIterations).toBe(100);
    });

    it('should use custom maxIterations', () => {
      const crew = new Crew(createMockCrewConfig({ maxIterations: 50 }));
      const status = crew.getStatus();

      expect(status.maxIterations).toBe(50);
    });
  });

  describe('Agent Management', () => {
    let crew: Crew;

    beforeEach(() => {
      crew = new Crew(
        createMockCrewConfig({
          agents: [], // Start with empty agents
        }),
      );
    });

    it('should add agent to crew', () => {
      const agentConfig = createMockAgentConfig({ name: 'NewAgent' });
      const agent = new CrewAgent({ config: agentConfig });

      crew.addAgent(agent);

      expect(crew.getAgents()).toHaveLength(1);
      expect(crew.getAgent('NewAgent')).toBeDefined();
    });

    it('should remove agent from crew', () => {
      const agentConfig = createMockAgentConfig({ name: 'RemoveMe' });
      const agent = new CrewAgent({ config: agentConfig });

      crew.addAgent(agent);
      expect(crew.getAgents()).toHaveLength(1);

      crew.removeAgent('RemoveMe');
      expect(crew.getAgents()).toHaveLength(0);
      expect(crew.getAgent('RemoveMe')).toBeUndefined();
    });

    it('should get agent by name', () => {
      const agentConfig = createMockAgentConfig({ name: 'FindMe' });
      const agent = new CrewAgent({ config: agentConfig });

      crew.addAgent(agent);

      const found = crew.getAgent('FindMe');
      expect(found).toBeDefined();
      expect(found?.name).toBe('FindMe');
    });

    it('should return undefined for non-existent agent', () => {
      expect(crew.getAgent('DoesNotExist')).toBeUndefined();
    });

    it('should get all agents', () => {
      const agent1 = new CrewAgent({
        config: createMockAgentConfig({ name: 'Agent1' }),
      });
      const agent2 = new CrewAgent({
        config: createMockAgentConfig({ name: 'Agent2' }),
      });

      crew.addAgent(agent1);
      crew.addAgent(agent2);

      const agents = crew.getAgents();
      expect(agents).toHaveLength(2);
    });
  });

  describe('Task Management', () => {
    let crew: Crew;

    beforeEach(() => {
      crew = new Crew(createMockCrewConfig());
    });

    it('should add task to crew', () => {
      const task = crew.addTask({
        description: 'Test task',
        expectedOutput: 'Output',
      });

      expect(task).toBeDefined();
      expect(task.description).toBe('Test task');
      expect(crew.getTasks()).toHaveLength(1);
    });

    it('should add multiple tasks', () => {
      const tasks = crew.addTasks([
        { description: 'Task 1', expectedOutput: 'Output 1' },
        { description: 'Task 2', expectedOutput: 'Output 2' },
      ]);

      expect(tasks).toHaveLength(2);
      expect(crew.getTasks()).toHaveLength(2);
    });

    it('should get task by ID', () => {
      const task = crew.addTask({
        id: 'test-task-id',
        description: 'Find me',
        expectedOutput: 'Output',
      });

      const found = crew.getTask('test-task-id');
      expect(found).toBeDefined();
      expect(found?.id).toBe('test-task-id');
    });

    it('should return undefined for non-existent task', () => {
      expect(crew.getTask('non-existent')).toBeUndefined();
    });

    it('should get all tasks', () => {
      crew.addTask({
        description: 'Task 1',
        expectedOutput: 'Output 1',
      });
      crew.addTask({
        description: 'Task 2',
        expectedOutput: 'Output 2',
      });

      const tasks = crew.getTasks();
      expect(tasks).toHaveLength(2);
    });
  });

  describe('Control Methods', () => {
    let crew: Crew;

    beforeEach(() => {
      // Create crew with a slow-executing agent
      const slowAgent = new CrewAgent({
        config: createMockAgentConfig({ name: 'SlowAgent' }),
        execute: () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  output: 'done',
                  tokensUsed: 100,
                  latencyMs: 500,
                  iterations: 1,
                }),
              500,
            );
          }),
      });

      crew = new Crew({
        ...createMockCrewConfig(),
        agents: [],
      });
      crew.addAgent(slowAgent);

      // Add a task for the crew to work on
      crew.addTask({
        description: 'A slow task',
        expectedOutput: 'Output',
        requiredCapabilities: ['coding'],
      });
    });

    it('should pause running crew', async () => {
      // Start crew execution in background
      const kickoffPromise = crew.kickoff();

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      crew.pause();
      const status = crew.getStatus();

      expect(status.state).toBe('paused');

      // Clean up
      crew.abort();
      await kickoffPromise.catch(() => {
        /* ignore */
      });
    });

    it('should resume paused crew', async () => {
      // Start crew execution in background
      const kickoffPromise = crew.kickoff();

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      crew.pause();
      expect(crew.getStatus().state).toBe('paused');

      crew.resume();
      expect(crew.getStatus().state).toBe('running');

      // Clean up
      crew.abort();
      await kickoffPromise.catch(() => {
        /* ignore */
      });
    });

    it('should abort running crew', async () => {
      // Start crew execution in background
      const kickoffPromise = crew.kickoff();

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      crew.abort();
      const status = crew.getStatus();

      expect(status.state).toBe('aborted');

      await kickoffPromise.catch(() => {
        /* ignore */
      });
    });

    it('should not pause when not running', () => {
      crew.pause();
      expect(crew.getStatus().state).toBe('idle');
    });

    it('should not resume when not paused', () => {
      crew.resume();
      expect(crew.getStatus().state).toBe('idle');
    });
  });

  describe('Status and Metrics', () => {
    let crew: Crew;

    beforeEach(() => {
      crew = new Crew(createMockCrewConfig());
    });

    it('should return initial status', () => {
      const status = crew.getStatus();

      expect(status.state).toBe('idle');
      expect(status.currentIteration).toBe(0);
      expect(status.tasksPending).toBe(0);
      expect(status.tasksInProgress).toBe(0);
      expect(status.tasksCompleted).toBe(0);
      expect(status.tasksFailed).toBe(0);
    });

    it('should return metrics', () => {
      const metrics = crew.getMetrics();

      expect(metrics.totalTasks).toBe(0);
      expect(metrics.completedTasks).toBe(0);
      expect(metrics.failedTasks).toBe(0);
      expect(metrics.totalIterations).toBe(0);
    });

    it('should return progress', () => {
      const progress = crew.getProgress();

      expect(progress.percentage).toBe(0);
      expect(progress.tasksCompleted).toBe(0);
      expect(progress.totalTasks).toBe(0);
    });

    it('should calculate progress with tasks', () => {
      crew.addTask({ description: 'Task 1', expectedOutput: 'Output' });
      crew.addTask({ description: 'Task 2', expectedOutput: 'Output' });

      const progress = crew.getProgress();

      expect(progress.percentage).toBe(0);
      expect(progress.totalTasks).toBe(2);
    });

    it('should return timeline', () => {
      const timeline = crew.getTimeline();

      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline).toHaveLength(0);
    });
  });

  describe('Checkpointing', () => {
    let crew: Crew;

    beforeEach(() => {
      crew = new Crew(createMockCrewConfig());
    });

    it('should create checkpoint', () => {
      crew.addTask({ description: 'Task 1', expectedOutput: 'Output' });

      const checkpoint = crew.createCheckpoint();

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.crewId).toBe(crew.id);
      expect(checkpoint.state).toBe('idle');
      expect(checkpoint.taskQueue).toHaveLength(1);
    });

    it('should restore from checkpoint', () => {
      crew.addTask({ description: 'Task 1', expectedOutput: 'Output' });
      const checkpoint = crew.createCheckpoint();

      // Clear crew
      crew.reset();
      expect(crew.getTasks()).toHaveLength(0);

      // Restore
      crew.restoreCheckpoint(checkpoint);
      expect(crew.getTasks()).toHaveLength(1);
    });

    it('should throw when restoring checkpoint while running', async () => {
      const checkpoint = crew.createCheckpoint();

      // Start crew
      const kickoffPromise = crew.kickoff();

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => crew.restoreCheckpoint(checkpoint)).toThrow(
        'Cannot restore checkpoint while crew is running',
      );

      // Clean up
      crew.abort();
      await kickoffPromise.catch(() => {
        /* ignore */
      });
    });
  });

  describe('Reset', () => {
    let crew: Crew;
    let slowCrew: Crew;

    beforeEach(() => {
      crew = new Crew(createMockCrewConfig());

      // Create crew with slow-executing agent for running state tests
      const slowAgent = new CrewAgent({
        config: createMockAgentConfig({ name: 'SlowAgent' }),
        execute: () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  output: 'done',
                  tokensUsed: 100,
                  latencyMs: 500,
                  iterations: 1,
                }),
              500,
            );
          }),
      });

      slowCrew = new Crew({
        ...createMockCrewConfig(),
        agents: [],
      });
      slowCrew.addAgent(slowAgent);
      slowCrew.addTask({
        description: 'A slow task',
        expectedOutput: 'Output',
        requiredCapabilities: ['coding'],
      });
    });

    it('should reset crew state', () => {
      crew.addTask({ description: 'Task 1', expectedOutput: 'Output' });

      crew.reset();

      expect(crew.getStatus().state).toBe('idle');
      expect(crew.getTasks()).toHaveLength(0);
      expect(crew.getTimeline()).toHaveLength(0);
      expect(crew.getMetrics().totalTasks).toBe(0);
    });

    it('should throw when resetting while running', async () => {
      const kickoffPromise = slowCrew.kickoff();

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(() => slowCrew.reset()).toThrow(
        'Cannot reset while crew is running',
      );

      // Clean up
      slowCrew.abort();
      await kickoffPromise.catch(() => {
        /* ignore */
      });
    });

    it('should throw when resetting while paused', async () => {
      const kickoffPromise = slowCrew.kickoff();

      // Give it a moment to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      slowCrew.pause();

      expect(() => slowCrew.reset()).toThrow(
        'Cannot reset while crew is running',
      );

      // Clean up
      slowCrew.abort();
      await kickoffPromise.catch(() => {
        /* ignore */
      });
    });
  });

  describe('Serialization', () => {
    it('should get crew configuration', () => {
      const originalConfig = createMockCrewConfig();
      const crew = new Crew(originalConfig);

      const config = crew.getConfig();

      expect(config.name).toBe(originalConfig.name);
      expect(config.description).toBe(originalConfig.description);
      expect(config.delegationStrategy).toBe(originalConfig.delegationStrategy);
    });
  });

  describe('createCrew factory', () => {
    it('should create a crew instance', () => {
      const crew = createCrew(createMockCrewConfig());
      expect(crew).toBeInstanceOf(Crew);
    });
  });

  describe('kickoff with no tasks', () => {
    it('should complete immediately with no tasks', async () => {
      const crew = new Crew(createMockCrewConfig());

      const result = await crew.kickoff();

      expect(result.success).toBe(true);
      expect(result.taskResults).toHaveLength(0);
    });
  });

  describe('kickoff options', () => {
    it('should accept initial input', async () => {
      const crew = new Crew(createMockCrewConfig());

      const result = await crew.kickoff({
        input: 'Test input',
      });

      expect(result.success).toBe(true);
    });

    it('should accept initial context', async () => {
      const crew = new Crew(createMockCrewConfig());

      const result = await crew.kickoff({
        context: { key: 'value' },
      });

      expect(result.success).toBe(true);
    });

    it('should accept timeout', async () => {
      // Create crew with slow-executing agent
      const slowAgent = new CrewAgent({
        config: {
          name: 'SlowAgent',
          role: {
            name: 'Developer',
            description: 'A developer',
            capabilities: [
              {
                name: 'coding',
                description: 'Writing code',
                proficiency: 'expert',
              },
            ],
            systemPrompt: 'You are a developer.',
          },
          model: 'claude-sonnet-4',
          provider: 'anthropic',
        },
        execute: () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  output: 'done',
                  tokensUsed: 100,
                  latencyMs: 1000,
                  iterations: 1,
                }),
              1000,
            );
          }),
      });

      const crew = new Crew({
        ...createMockCrewConfig(),
        agents: [],
      });
      crew.addAgent(slowAgent);
      crew.addTask({
        description: 'Long task',
        expectedOutput: 'Output',
        requiredCapabilities: ['coding'],
      });

      await crew.kickoff({
        timeoutMs: 50,
      });

      // Should abort due to timeout
      expect(crew.getStatus().state).toBe('aborted');
    });
  });
});

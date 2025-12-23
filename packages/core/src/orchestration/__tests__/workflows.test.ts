import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SequentialWorkflow } from '../sequential-workflow';
import { ParallelWorkflow } from '../parallel-workflow';
import { Agent } from '../../agent/agent';
import { AgentContext, AgentResponse, WorkflowConfig } from '../../types';

// Mock Agent
vi.mock('../../agent/agent');

describe('Workflow Tests', () => {
  let mockAgent1: any;
  let mockAgent2: any;
  let context: AgentContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAgent1 = {
      execute: vi.fn().mockResolvedValue({
        content: 'Response from agent 1',
        metadata: {
          tokensUsed: 100,
          latencyMs: 1000,
          iterations: 1,
        },
        finishReason: 'stop',
      }),
      config: { name: 'agent1' },
    };

    mockAgent2 = {
      execute: vi.fn().mockResolvedValue({
        content: 'Response from agent 2',
        metadata: {
          tokensUsed: 150,
          latencyMs: 1200,
          iterations: 1,
        },
        finishReason: 'stop',
      }),
      config: { name: 'agent2' },
    };

    context = {
      conversationId: 'test-123',
      sessionData: {},
      history: [],
    };
  });

  describe('SequentialWorkflow', () => {
    it('should execute agents sequentially', async () => {
      const config: WorkflowConfig = {
        name: 'sequential-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      const workflow = new SequentialWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test input', context);

      expect(mockAgent1.execute).toHaveBeenCalledWith('test input', context);
      expect(mockAgent2.execute).toHaveBeenCalledWith(
        'Response from agent 1',
        context,
      );
      expect(response.content).toBe('Response from agent 2');
      expect(response.metadata.tokensUsed).toBe(250); // 100 + 150
    });

    it('should chain agent outputs as inputs', async () => {
      const config: WorkflowConfig = {
        name: 'sequential-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      mockAgent1.execute.mockResolvedValue({
        content: 'Intermediate result',
        metadata: { tokensUsed: 50, latencyMs: 500, iterations: 1 },
        finishReason: 'stop',
      });

      const workflow = new SequentialWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      await workflow.execute('initial input', context);

      expect(mockAgent2.execute).toHaveBeenCalledWith(
        'Intermediate result',
        context,
      );
    });

    it('should accumulate token usage', async () => {
      const config: WorkflowConfig = {
        name: 'sequential-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      const workflow = new SequentialWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test', context);

      expect(response.metadata.tokensUsed).toBe(250);
      expect(response.metadata.iterations).toBe(2);
    });

    it('should handle agent errors with error handling', async () => {
      const config: WorkflowConfig = {
        name: 'sequential-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
        errorHandling: {
          strategy: 'continue',
          defaultResponse: 'Error occurred',
        },
      };

      mockAgent1.execute.mockRejectedValue(new Error('Agent 1 failed'));

      const workflow = new SequentialWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test', context);

      // Should return error response
      expect(response).toBeDefined();
    });

    it('should throw error when no agents produce response', async () => {
      const config: WorkflowConfig = {
        name: 'sequential-test',
        agents: [{ name: 'agent1', role: 'first' }],
      };

      mockAgent1.execute.mockRejectedValue(new Error('Failed'));

      const workflow = new SequentialWorkflow(config);
      (workflow as any).agents = new Map([['agent1', mockAgent1]]);

      await expect(workflow.execute('test', context)).rejects.toThrow();
    });

    it('should track latency', async () => {
      const config: WorkflowConfig = {
        name: 'sequential-test',
        agents: [{ name: 'agent1', role: 'first' }],
      };

      const workflow = new SequentialWorkflow(config);
      (workflow as any).agents = new Map([['agent1', mockAgent1]]);

      const response = await workflow.execute('test', context);

      expect(response.metadata.latencyMs).toBeGreaterThan(0);
    });
  });

  describe('ParallelWorkflow', () => {
    it('should execute agents in parallel', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [
          { name: 'agent1', role: 'analyst' },
          { name: 'agent2', role: 'reviewer' },
        ],
      };

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test input', context);

      expect(mockAgent1.execute).toHaveBeenCalledWith('test input', context);
      expect(mockAgent2.execute).toHaveBeenCalledWith('test input', context);
      expect(response.content).toContain('[agent1]:');
      expect(response.content).toContain('[agent2]:');
    });

    it('should combine responses from all agents', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test', context);

      expect(response.content).toContain('Response from agent 1');
      expect(response.content).toContain('Response from agent 2');
    });

    it('should aggregate token usage from all agents', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test', context);

      expect(response.metadata.tokensUsed).toBe(250); // 100 + 150
      expect(response.metadata.iterations).toBe(2);
    });

    it('should handle errors from individual agents', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
        errorHandling: {
          strategy: 'continue',
        },
      };

      mockAgent1.execute.mockRejectedValue(new Error('Agent 1 failed'));

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test', context);

      // Should still include agent2's response
      expect(response.content).toContain('[agent2]:');
    });

    it('should return error finish reason when all agents fail', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      mockAgent1.execute.mockRejectedValue(new Error('Failed 1'));
      mockAgent2.execute.mockRejectedValue(new Error('Failed 2'));

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const response = await workflow.execute('test', context);

      expect(response.finishReason).toBe('error');
      expect(response.content).toContain('errors');
    });

    it('should execute faster than sequential for same agents', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [
          { name: 'agent1', role: 'first' },
          { name: 'agent2', role: 'second' },
        ],
      };

      // Add delay to agent execution
      mockAgent1.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          content: 'Response 1',
          metadata: { tokensUsed: 100, latencyMs: 50, iterations: 1 },
          finishReason: 'stop',
        };
      });

      mockAgent2.execute.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          content: 'Response 2',
          metadata: { tokensUsed: 100, latencyMs: 50, iterations: 1 },
          finishReason: 'stop',
        };
      });

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([
        ['agent1', mockAgent1],
        ['agent2', mockAgent2],
      ]);

      const startTime = Date.now();
      await workflow.execute('test', context);
      const duration = Date.now() - startTime;

      // Parallel should be closer to 50ms than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should include agent name in responses', async () => {
      const config: WorkflowConfig = {
        name: 'parallel-test',
        agents: [{ name: 'agent1', role: 'test' }],
      };

      const workflow = new ParallelWorkflow(config);
      (workflow as any).agents = new Map([['agent1', mockAgent1]]);

      const response = await workflow.execute('test', context);

      expect(response.content).toContain('[agent1]:');
    });
  });
});

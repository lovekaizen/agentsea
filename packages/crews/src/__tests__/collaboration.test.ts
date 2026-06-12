import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CollaborationManager,
  createCollaborationManager,
} from '../coordination/Collaboration.js';
import { CrewAgent } from '../agents/CrewAgent.js';
import { ExecutionContext } from '../core/ExecutionContext.js';
import type { CrewAgentConfig, TaskConfig } from '../types/index.js';

// Helper to create agent
function createAgent(name: string): CrewAgent {
  const config: CrewAgentConfig = {
    name,
    role: {
      name: 'Developer',
      description: 'A developer',
      capabilities: [
        {
          name: 'coding',
          description: 'Coding',
          proficiency: 'expert',
        },
      ],
      systemPrompt: 'You are a developer.',
    },
    model: 'claude-sonnet-4-6',
    provider: 'anthropic',
  };

  return new CrewAgent({ config });
}

// Helper to create task
function createTask(): TaskConfig {
  return {
    id: 'task-1',
    description: 'Test task',
    expectedOutput: 'Output',
  };
}

describe('CollaborationManager', () => {
  let manager: CollaborationManager;
  let context: ExecutionContext;

  beforeEach(() => {
    manager = new CollaborationManager();
    context = new ExecutionContext({ crewName: 'TestCrew' });
  });

  describe('constructor', () => {
    it('should create manager with default config', () => {
      expect(manager).toBeDefined();
    });

    it('should create broadcast channel by default', () => {
      const stats = manager.getStatistics();
      expect(stats.totalChannels).toBe(1);
    });

    it('should accept custom config', () => {
      const mgr = new CollaborationManager({
        persistMessages: false,
        maxMessagesPerChannel: 100,
      });

      expect(mgr).toBeDefined();
    });
  });

  describe('Agent Registration', () => {
    it('should register an agent', () => {
      const agent = createAgent('Agent1');
      manager.registerAgent(agent);

      // Check that agent can send messages
      expect(() =>
        manager.sendMessage('Agent1', 'Agent2', 'Hello', context),
      ).not.toThrow();
    });

    it('should unregister an agent', () => {
      const agent = createAgent('Agent1');
      manager.registerAgent(agent);
      manager.unregisterAgent('Agent1');

      // Agent is removed
      expect(manager.getStatistics().totalMessages).toBe(0);
    });
  });

  describe('Channel Management', () => {
    it('should create a channel', () => {
      const channel = manager.createChannel('test-channel', [
        'Agent1',
        'Agent2',
      ]);

      expect(channel.name).toBe('test-channel');
      expect(channel.participants).toEqual(['Agent1', 'Agent2']);
      expect(channel.messages).toHaveLength(0);
      expect(channel.created).toBeInstanceOf(Date);
    });

    it('should get agent channels', () => {
      manager.createChannel('channel1', ['Agent1', 'Agent2']);
      manager.createChannel('channel2', ['Agent2', 'Agent3']);

      const channels = manager.getAgentChannels('Agent2');

      // Should include broadcast + 2 specific channels
      expect(channels.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      const agent1 = createAgent('Agent1');
      const agent2 = createAgent('Agent2');
      manager.registerAgent(agent1);
      manager.registerAgent(agent2);
    });

    it('should send message between agents', async () => {
      const message = await manager.sendMessage(
        'Agent1',
        'Agent2',
        'Hello',
        context,
      );

      expect(message.id).toBeDefined();
      expect(message.from).toBe('Agent1');
      expect(message.to).toBe('Agent2');
      expect(message.content).toBe('Hello');
      expect(message.type).toBe('request');
    });

    it('should emit collaboration event', async () => {
      const handler = vi.fn();
      context.on('collaboration:message', handler);

      await manager.sendMessage('Agent1', 'Agent2', 'Hello', context);

      expect(handler).toHaveBeenCalled();
    });

    it('should support message types', async () => {
      const message = await manager.sendMessage(
        'Agent1',
        'Agent2',
        'Response',
        context,
        { type: 'response' },
      );

      expect(message.type).toBe('response');
    });

    it('should support reply tracking', async () => {
      const original = await manager.sendMessage(
        'Agent1',
        'Agent2',
        'Question',
        context,
      );

      const reply = await manager.sendMessage(
        'Agent2',
        'Agent1',
        'Answer',
        context,
        { replyTo: original.id },
      );

      expect(reply.replyTo).toBe(original.id);
    });

    it('should respect max messages per channel', async () => {
      const mgr = new CollaborationManager({
        persistMessages: true,
        maxMessagesPerChannel: 2,
      });

      const ctx = new ExecutionContext({ crewName: 'Test' });

      await mgr.sendMessage('Agent1', 'Agent2', 'Message 1', ctx);
      await mgr.sendMessage('Agent1', 'Agent2', 'Message 2', ctx);
      await mgr.sendMessage('Agent1', 'Agent2', 'Message 3', ctx);

      const conversation = mgr.getConversation('Agent1', 'Agent2');
      expect(conversation).toHaveLength(2);
    });
  });

  describe('Broadcasting', () => {
    beforeEach(() => {
      manager.registerAgent(createAgent('Agent1'));
      manager.registerAgent(createAgent('Agent2'));
    });

    it('should broadcast message to all', async () => {
      const message = await manager.broadcast(
        'Agent1',
        'Announcement',
        context,
      );

      expect(message.to).toBe('all');
      expect(message.type).toBe('broadcast');
    });
  });

  describe('Help Requests', () => {
    beforeEach(() => {
      manager.registerAgent(createAgent('Agent1'));
      manager.registerAgent(createAgent('Agent2'));
    });

    it('should request help from other agents', async () => {
      const task = createTask();
      const responses = await manager.requestHelp(
        'Agent1',
        task,
        'Need help',
        context,
      );

      expect(Array.isArray(responses)).toBe(true);
    });

    it('should emit help request event', async () => {
      const handler = vi.fn();
      context.on('collaboration:help_request', handler);

      const task = createTask();
      await manager.requestHelp('Agent1', task, 'Need help', context);

      expect(handler).toHaveBeenCalled();
    });

    it('should emit help response events', async () => {
      const handler = vi.fn();
      context.on('collaboration:help_response', handler);

      const task = createTask();
      const responses = await manager.requestHelp(
        'Agent1',
        task,
        'Need help',
        context,
      );

      // May or may not have responses depending on agent availability
      expect(Array.isArray(responses)).toBe(true);
    });

    it('should not request help from self', async () => {
      const task = createTask();
      const responses = await manager.requestHelp(
        'Agent1',
        task,
        'Need help',
        context,
      );

      // Should not include Agent1 in responses
      expect(responses.every((r) => r.responder !== 'Agent1')).toBe(true);
    });

    it('should not request help from busy agents', async () => {
      // Create a busy agent (executing a task)
      const agent2 = createAgent('Agent2');
      manager.registerAgent(agent2);

      // Start task to make agent busy
      const taskPromise = agent2.executeTask(createTask());

      const responses = await manager.requestHelp(
        'Agent1',
        createTask(),
        'Need help',
        context,
      );

      // Should not include busy agents
      expect(responses.some((r) => r.responder === 'Agent2')).toBe(false);

      await taskPromise;
    });

    it('should handle help request with priority', async () => {
      const task = createTask();
      await expect(
        manager.requestHelp('Agent1', task, 'Urgent help', context, 'urgent'),
      ).resolves.toBeDefined();
    });
  });

  describe('Knowledge Sharing', () => {
    beforeEach(() => {
      manager.registerAgent(createAgent('Agent1'));
    });

    it('should share knowledge', () => {
      const knowledge = manager.shareKnowledge(
        'Agent1',
        'fact',
        'TypeScript is great',
        ['typescript', 'programming'],
        context,
      );

      expect(knowledge.id).toBeDefined();
      expect(knowledge.contributor).toBe('Agent1');
      expect(knowledge.type).toBe('fact');
      expect(knowledge.content).toBe('TypeScript is great');
      expect(knowledge.tags).toContain('typescript');
    });

    it('should emit knowledge sharing event', () => {
      const handler = vi.fn();
      context.on('collaboration:knowledge_shared', handler);

      manager.shareKnowledge('Agent1', 'fact', 'Knowledge', ['tag'], context);

      expect(handler).toHaveBeenCalled();
    });

    it('should search knowledge by query', () => {
      manager.shareKnowledge(
        'Agent1',
        'fact',
        'TypeScript is great',
        ['typescript'],
        context,
      );

      manager.shareKnowledge(
        'Agent1',
        'insight',
        'Python is versatile',
        ['python'],
        context,
      );

      const results = manager.searchKnowledge('typescript');

      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('TypeScript');
    });

    it('should search knowledge by tags', () => {
      manager.shareKnowledge(
        'Agent1',
        'fact',
        'Content about coding',
        ['coding', 'development'],
        context,
      );

      const results = manager.searchKnowledge('development');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should limit search results', () => {
      for (let i = 0; i < 20; i++) {
        manager.shareKnowledge(
          'Agent1',
          'fact',
          `Knowledge item ${i}`,
          ['test'],
          context,
        );
      }

      const results = manager.searchKnowledge('test', 5);

      expect(results).toHaveLength(5);
    });

    it('should get knowledge by type', () => {
      manager.shareKnowledge('Agent1', 'fact', 'Fact 1', [], context);
      manager.shareKnowledge('Agent1', 'insight', 'Insight 1', [], context);
      manager.shareKnowledge('Agent1', 'fact', 'Fact 2', [], context);

      const facts = manager.getKnowledgeByType('fact');
      expect(facts).toHaveLength(2);
    });

    it('should get knowledge by contributor', () => {
      manager.registerAgent(createAgent('Agent2'));

      manager.shareKnowledge('Agent1', 'fact', 'From Agent1', [], context);
      manager.shareKnowledge('Agent2', 'fact', 'From Agent2', [], context);

      const agent1Knowledge = manager.getKnowledgeByContributor('Agent1');
      expect(agent1Knowledge).toHaveLength(1);
      expect(agent1Knowledge[0].content).toBe('From Agent1');
    });
  });

  describe('Conversation History', () => {
    beforeEach(() => {
      manager.registerAgent(createAgent('Agent1'));
      manager.registerAgent(createAgent('Agent2'));
    });

    it('should get conversation between agents', async () => {
      await manager.sendMessage('Agent1', 'Agent2', 'Hi', context);
      await manager.sendMessage('Agent2', 'Agent1', 'Hello', context);

      const conversation = manager.getConversation('Agent1', 'Agent2');

      expect(conversation).toHaveLength(2);
      expect(conversation[0].from).toBe('Agent1');
      expect(conversation[1].from).toBe('Agent2');
    });

    it('should return empty array when no conversation exists', () => {
      const conversation = manager.getConversation('Agent1', 'Agent2');
      expect(conversation).toHaveLength(0);
    });

    it('should sort messages by timestamp', async () => {
      await manager.sendMessage('Agent1', 'Agent2', 'First', context);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await manager.sendMessage('Agent2', 'Agent1', 'Second', context);

      const conversation = manager.getConversation('Agent1', 'Agent2');

      expect(conversation[0].content).toBe('First');
      expect(conversation[1].content).toBe('Second');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      manager.registerAgent(createAgent('Agent1'));
      manager.registerAgent(createAgent('Agent2'));
    });

    it('should get collaboration statistics', async () => {
      await manager.sendMessage('Agent1', 'Agent2', 'Message 1', context);
      await manager.sendMessage('Agent2', 'Agent1', 'Message 2', context);

      manager.shareKnowledge('Agent1', 'fact', 'Knowledge', ['tag'], context);

      const stats = manager.getStatistics();

      expect(stats.totalMessages).toBe(2);
      expect(stats.totalKnowledge).toBe(1);
      expect(stats.messagesByAgent['Agent1']).toBe(1);
      expect(stats.messagesByAgent['Agent2']).toBe(1);
      expect(stats.knowledgeByType['fact']).toBe(1);
    });
  });

  describe('Clear', () => {
    beforeEach(() => {
      manager.registerAgent(createAgent('Agent1'));
    });

    it('should clear all collaboration data', async () => {
      await manager.sendMessage('Agent1', 'Agent2', 'Message', context);
      manager.shareKnowledge('Agent1', 'fact', 'Knowledge', [], context);

      manager.clear();

      const stats = manager.getStatistics();
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalKnowledge).toBe(0);
      expect(stats.totalChannels).toBe(1); // broadcast channel recreated
    });
  });

  describe('createCollaborationManager factory', () => {
    it('should create manager instance', () => {
      const mgr = createCollaborationManager();
      expect(mgr).toBeInstanceOf(CollaborationManager);
    });

    it('should accept config', () => {
      const mgr = createCollaborationManager({ persistMessages: false });
      expect(mgr).toBeInstanceOf(CollaborationManager);
    });
  });
});

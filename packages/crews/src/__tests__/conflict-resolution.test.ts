import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ConflictResolver,
  createConflictResolver,
  type AgentResponse,
  type Conflict,
} from '../coordination/ConflictResolution.js';
import { ExecutionContext } from '../core/ExecutionContext.js';
import type { TaskConfig } from '../types/index.js';

// Helper to create task
function createTask(): TaskConfig {
  return {
    id: 'task-1',
    description: 'Test task',
    expectedOutput: 'Output',
  };
}

// Helper to create agent response
function createResponse(overrides: Partial<AgentResponse> = {}): AgentResponse {
  return {
    agentName: 'Agent1',
    content: 'Response content',
    confidence: 0.8,
    ...overrides,
  };
}

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let context: ExecutionContext;

  beforeEach(() => {
    resolver = new ConflictResolver();
    context = new ExecutionContext({ crewName: 'TestCrew' });
  });

  describe('constructor', () => {
    it('should create resolver with default config', () => {
      expect(resolver).toBeDefined();
    });

    it('should use default resolution strategy', () => {
      const res = new ConflictResolver();
      expect(res).toBeDefined();
    });

    it('should accept custom config', () => {
      const res = new ConflictResolver({
        defaultStrategy: 'voting',
        autoResolveThreshold: 0.5,
      });
      expect(res).toBeDefined();
    });
  });

  describe('Conflict Detection', () => {
    it('should return null for single response', () => {
      const responses = [createResponse()];
      const conflict = resolver.detectConflict(
        responses,
        createTask(),
        context,
      );

      expect(conflict).toBeNull();
    });

    it('should detect disagreement by length difference', () => {
      const responses = [
        createResponse({ content: 'Short' }),
        createResponse({ content: 'A much longer response with more detail' }),
      ];

      const conflict = resolver.detectConflict(
        responses,
        createTask(),
        context,
      );

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe('disagreement');
    });

    it('should detect contradictory keywords', () => {
      const responses = [
        createResponse({ content: 'Yes, this is correct' }),
        createResponse({ content: 'No, this is incorrect' }),
      ];

      const conflict = resolver.detectConflict(
        responses,
        createTask(),
        context,
      );

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe('disagreement');
    });

    it('should detect confidence spread', () => {
      const responses = [
        createResponse({ confidence: 0.9 }),
        createResponse({ confidence: 0.2 }),
      ];

      const conflict = resolver.detectConflict(
        responses,
        createTask(),
        context,
      );

      expect(conflict).toBeDefined();
    });

    it('should detect contradictory assertions', () => {
      const responses = [
        createResponse({
          metadata: { assertions: ['The sky is blue'] },
        }),
        createResponse({
          metadata: { assertions: ['not The sky is blue'] },
        }),
      ];

      const conflict = resolver.detectConflict(
        responses,
        createTask(),
        context,
      );

      expect(conflict).toBeDefined();
      expect(conflict?.type).toBe('assertion');
    });

    it('should emit conflict detected event', () => {
      const handler = vi.fn();
      context.on('conflict:detected', handler);

      const responses = [
        createResponse({ content: 'Yes' }),
        createResponse({ content: 'No' }),
      ];

      resolver.detectConflict(responses, createTask(), context);

      expect(handler).toHaveBeenCalled();
    });

    it('should return null when no conflict detected', () => {
      const responses = [
        createResponse({ content: 'Similar content', confidence: 0.8 }),
        createResponse({ content: 'Similar content', confidence: 0.75 }),
      ];

      const conflict = resolver.detectConflict(
        responses,
        createTask(),
        context,
      );

      expect(conflict).toBeNull();
    });
  });

  describe('Resolution Strategies', () => {
    let conflict: Conflict;

    beforeEach(() => {
      conflict = {
        id: 'conflict-1',
        type: 'disagreement',
        description: 'Test conflict',
        participants: ['Agent1', 'Agent2'],
        responses: [
          createResponse({
            agentName: 'Agent1',
            content: 'Response A',
            confidence: 0.9,
          }),
          createResponse({
            agentName: 'Agent2',
            content: 'Response B',
            confidence: 0.7,
          }),
        ],
        task: createTask(),
        severity: 'medium',
        detected: new Date(),
      };
    });

    it('should resolve by highest confidence', async () => {
      const resolution = await resolver.resolve(
        conflict,
        context,
        'highest-confidence',
      );

      expect(resolution.successful).toBe(true);
      expect(resolution.winner?.agentName).toBe('Agent1');
      expect(resolution.strategy).toBe('highest-confidence');
    });

    it('should resolve by newest', async () => {
      const resolution = await resolver.resolve(conflict, context, 'newest');

      expect(resolution.successful).toBe(true);
      expect(resolution.winner?.agentName).toBe('Agent2');
    });

    it('should resolve by voting', async () => {
      const resolution = await resolver.resolve(conflict, context, 'voting');

      expect(resolution.successful).toBe(true);
      expect(resolution.winner).toBeDefined();
    });

    it('should resolve by authority', async () => {
      const resolution = await resolver.resolve(conflict, context, 'authority');

      expect(resolution.successful).toBe(true);
    });

    it('should resolve by consensus', async () => {
      const consensusConflict: Conflict = {
        ...conflict,
        responses: [
          createResponse({ content: 'Same answer' }),
          createResponse({ content: 'Same answer' }),
          createResponse({ content: 'Different answer' }),
        ],
      };

      const resolution = await resolver.resolve(
        consensusConflict,
        context,
        'consensus',
      );

      expect(resolution.successful).toBe(true);
    });

    it('should resolve by merge', async () => {
      const mergeConflict: Conflict = {
        ...conflict,
        responses: [
          createResponse({ content: 'Part A of answer' }),
          createResponse({ content: 'Part B of answer' }),
        ],
      };

      const resolution = await resolver.resolve(
        mergeConflict,
        context,
        'merge',
      );

      expect(resolution.successful).toBe(true);
      expect(resolution.merged || resolution.winner).toBeDefined();
    });

    it('should escalate to human', async () => {
      const resolution = await resolver.resolve(conflict, context, 'human');

      expect(resolution.escalated).toBe(true);
      expect(resolution.successful).toBe(false);
    });

    it('should emit resolution event', async () => {
      const handler = vi.fn();
      context.on('conflict:resolved', handler);

      await resolver.resolve(conflict, context);

      expect(handler).toHaveBeenCalled();
    });

    it('should use default strategy when not specified', async () => {
      const resolution = await resolver.resolve(conflict, context);

      expect(resolution.strategy).toBe('highest-confidence');
    });
  });

  describe('Escalation', () => {
    let conflict: Conflict;

    beforeEach(() => {
      conflict = {
        id: 'conflict-1',
        type: 'disagreement',
        description: 'Test conflict',
        participants: ['Agent1', 'Agent2'],
        responses: [
          createResponse({ agentName: 'Agent1' }),
          createResponse({ agentName: 'Agent2' }),
        ],
        task: createTask(),
        severity: 'medium',
        detected: new Date(),
      };
    });

    it('should escalate on repeated conflicts', async () => {
      const res = new ConflictResolver({ escalateOnRepeated: 2 });

      // First resolution
      await res.resolve(conflict, context);

      // Second resolution (should escalate)
      const resolution = await res.resolve(conflict, context);

      expect(resolution.escalated).toBe(true);
    });

    it('should emit escalation event', async () => {
      const handler = vi.fn();
      context.on('conflict:escalated', handler);

      await resolver.resolve(conflict, context, 'human');

      expect(handler).toHaveBeenCalled();
    });

    it('should track conflict counts', async () => {
      await resolver.resolve(conflict, context);
      await resolver.resolve(conflict, context);

      // Should have tracked the conflicts
      const stats = resolver.getStatistics();
      expect(stats.totalConflicts).toBeGreaterThan(0);
    });
  });

  describe('History and Statistics', () => {
    let conflict: Conflict;

    beforeEach(() => {
      conflict = {
        id: 'conflict-1',
        type: 'disagreement',
        description: 'Test conflict',
        participants: ['Agent1', 'Agent2'],
        responses: [
          createResponse({ agentName: 'Agent1', confidence: 0.9 }),
          createResponse({ agentName: 'Agent2', confidence: 0.7 }),
        ],
        task: createTask(),
        severity: 'medium',
        detected: new Date(),
      };
    });

    it('should track resolution history', async () => {
      await resolver.resolve(conflict, context);

      const history = resolver.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].conflictId).toBe('conflict-1');
    });

    it('should filter history by conflict ID', async () => {
      const conflict2: Conflict = {
        ...conflict,
        id: 'conflict-2',
      };

      await resolver.resolve(conflict, context);
      await resolver.resolve(conflict2, context);

      const history = resolver.getHistory('conflict-1');
      expect(history).toHaveLength(1);
      expect(history[0].conflictId).toBe('conflict-1');
    });

    it('should get resolution statistics', async () => {
      await resolver.resolve(conflict, context, 'highest-confidence');
      await resolver.resolve(conflict, context, 'voting');

      const stats = resolver.getStatistics();

      expect(stats.totalConflicts).toBe(2);
      expect(stats.byStrategy['highest-confidence']).toBe(1);
      expect(stats.byStrategy['voting']).toBe(1);
      expect(stats.successRate).toBeGreaterThan(0);
    });

    it('should calculate success rate', async () => {
      await resolver.resolve(conflict, context, 'highest-confidence');
      await resolver.resolve(conflict, context, 'human'); // escalated

      const stats = resolver.getStatistics();

      expect(stats.successRate).toBe(0.5);
      expect(stats.escalationRate).toBe(0.5);
    });

    it('should not track history when disabled', async () => {
      const res = new ConflictResolver({ trackHistory: false });

      await res.resolve(conflict, context);

      const history = res.getHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Clear', () => {
    it('should clear history and counts', async () => {
      const conflict: Conflict = {
        id: 'conflict-1',
        type: 'disagreement',
        description: 'Test conflict',
        participants: ['Agent1', 'Agent2'],
        responses: [
          createResponse({ agentName: 'Agent1' }),
          createResponse({ agentName: 'Agent2' }),
        ],
        task: createTask(),
        severity: 'medium',
        detected: new Date(),
      };

      await resolver.resolve(conflict, context);

      resolver.clear();

      const history = resolver.getHistory();
      const stats = resolver.getStatistics();

      expect(history).toHaveLength(0);
      expect(stats.totalConflicts).toBe(0);
    });
  });

  describe('createConflictResolver factory', () => {
    it('should create resolver instance', () => {
      const res = createConflictResolver();
      expect(res).toBeInstanceOf(ConflictResolver);
    });

    it('should accept config', () => {
      const res = createConflictResolver({ defaultStrategy: 'voting' });
      expect(res).toBeInstanceOf(ConflictResolver);
    });
  });
});

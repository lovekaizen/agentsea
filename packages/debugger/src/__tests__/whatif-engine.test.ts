/**
 * WhatIfEngine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhatIfEngine, createWhatIfEngine } from '../analysis/WhatIfEngine.js';
import type { Recording, ExecutionStep, AgentState } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-4',
  memory: { size: 0 },
  context: {},
  tools: [],
  messages: [],
});

const createMockStep = (
  index: number,
  type: ExecutionStep['type'] = 'input',
): ExecutionStep => ({
  id: `step_${index}`,
  index,
  type,
  timestamp: Date.now(),
  durationMs: 100,
});

const createMockRecording = (): Recording => {
  const steps = [
    createMockStep(0, 'input'),
    createMockStep(1, 'response'),
    createMockStep(2, 'decision'),
    createMockStep(3, 'tool-call'),
    createMockStep(4, 'tool-result'),
  ];

  steps[2].decision = {
    id: 'dec_1',
    prompt: 'Choose an action',
    options: [
      { id: 'opt1', description: 'Option 1' },
      { id: 'opt2', description: 'Option 2' },
    ],
    chosenIndex: 0,
    chosen: { id: 'opt1', description: 'Option 1' },
    confidence: 0.8,
    timestamp: Date.now(),
  };

  steps[3].toolCall = {
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'test' },
  };

  steps[4].toolCall = {
    id: 'tool_1',
    name: 'search',
    arguments: { query: 'test' },
    result: 'original results',
    success: true,
  };

  return {
    id: 'rec_123',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'completed',
    startedAt: Date.now() - 10000,
    endedAt: Date.now(),
    durationMs: 10000,
    steps,
    toolCalls: [steps[3].toolCall!, steps[4].toolCall!],
    decisions: [steps[2].decision!],
    checkpoints: [],
    initialState: createMockState(),
    finalState: createMockState(),
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    version: '1.0.0',
  };
};

describe('WhatIfEngine', () => {
  let engine: WhatIfEngine;
  let recording: Recording;

  beforeEach(() => {
    engine = new WhatIfEngine();
    recording = createMockRecording();
  });

  describe('initialization', () => {
    it('should create engine', () => {
      expect(engine).toBeDefined();
    });

    it('should start with no scenarios', () => {
      expect(engine.getScenarios()).toHaveLength(0);
    });
  });

  describe('create scenario', () => {
    it('should create basic scenario', () => {
      const scenario = engine.createScenario({
        name: 'Test Scenario',
        recordingId: 'rec_123',
        modifications: [{ stepIndex: 0, type: 'skip' }],
      });

      expect(scenario).toBeDefined();
      expect(scenario.id).toMatch(/^whatif_/);
      expect(scenario.name).toBe('Test Scenario');
      expect(scenario.status).toBe('pending');
    });

    it('should create scenario with description', () => {
      const scenario = engine.createScenario({
        name: 'Test',
        description: 'A test scenario',
        recordingId: 'rec_123',
        modifications: [],
      });

      expect(scenario.description).toBe('A test scenario');
    });

    it('should store scenario', () => {
      engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      expect(engine.getScenarios()).toHaveLength(1);
    });

    it('should emit scenario created event', () => {
      const handler = vi.fn();
      engine.on('scenario:created', handler);

      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      expect(handler).toHaveBeenCalledWith(scenario);
    });
  });

  describe('create from decision', () => {
    it('should create scenario from decision point', () => {
      const scenario = engine.createFromDecision(recording, 2, 'opt2');

      expect(scenario).toBeDefined();
      expect(scenario.name).toContain('Option 2');
      expect(scenario.modifications).toHaveLength(1);
      expect(scenario.modifications[0].stepIndex).toBe(2);
    });

    it('should handle decision by option ID', () => {
      const scenario = engine.createFromDecision(recording, 2, 'opt2');
      expect(scenario.modifications[0].type).toBe('modify');
    });

    it('should handle decision by description', () => {
      const scenario = engine.createFromDecision(recording, 2, 'Option 2');
      expect(scenario).toBeDefined();
    });

    it('should throw error for non-decision step', () => {
      expect(() => {
        engine.createFromDecision(recording, 0, 'opt1');
      }).toThrow('not a decision');
    });

    it('should throw error for invalid option', () => {
      expect(() => {
        engine.createFromDecision(recording, 2, 'invalid');
      }).toThrow('not found');
    });
  });

  describe('create from tool result', () => {
    it('should create scenario from tool result', () => {
      const scenario = engine.createFromToolResult(
        recording,
        4,
        'alternative results',
      );

      expect(scenario).toBeDefined();
      expect(scenario.name).toContain('search');
      expect(scenario.modifications).toHaveLength(1);
    });

    it('should modify tool result', () => {
      const scenario = engine.createFromToolResult(recording, 4, 'new result');

      const modification = scenario.modifications[0];
      expect(modification.type).toBe('modify');
      expect(modification.stepIndex).toBe(4);
    });

    it('should throw error for non-tool-result step', () => {
      expect(() => {
        engine.createFromToolResult(recording, 0, 'result');
      }).toThrow('not a tool result');
    });
  });

  describe('create from skip', () => {
    it('should create skip scenario', () => {
      const scenario = engine.createFromSkip(recording, [1, 2]);

      expect(scenario).toBeDefined();
      expect(scenario.name).toContain('Skip steps');
      expect(scenario.modifications).toHaveLength(2);
    });

    it('should create skip modifications', () => {
      const scenario = engine.createFromSkip(recording, [1, 2, 3]);

      scenario.modifications.forEach((mod) => {
        expect(mod.type).toBe('skip');
      });
    });

    it('should use custom name', () => {
      const scenario = engine.createFromSkip(
        recording,
        [1],
        'Custom skip scenario',
      );

      expect(scenario.name).toBe('Custom skip scenario');
    });
  });

  describe('run scenario', () => {
    it('should run scenario', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [{ stepIndex: 0, type: 'skip' }],
      });

      const resultPromise = engine.runScenario(scenario.id, recording);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Expect scenario to be running or completed
      const updated = engine.getScenario(scenario.id);
      expect(['running', 'completed']).toContain(updated?.status);
    }, 10000);

    it('should emit scenario started event', async () => {
      const handler = vi.fn();
      engine.on('scenario:started', handler);

      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledWith(scenario.id);
    });

    it('should emit scenario completed event', async () => {
      const handler = vi.fn();
      engine.on('scenario:completed', handler);

      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      expect(handler).toHaveBeenCalled();
    }, 10000);

    it('should store result', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      const result = engine.getResult(scenario.id);
      expect(result).toBeDefined();
    }, 10000);

    it('should throw error for non-existent scenario', async () => {
      await expect(
        engine.runScenario('non-existent', recording),
      ).rejects.toThrow('not found');
    });
  });

  describe('run batch', () => {
    it('should run multiple scenarios sequentially', async () => {
      const results = await engine.runBatch(
        {
          recordingId: 'rec_123',
          variations: [
            {
              name: 'Variation 1',
              modifications: [{ stepIndex: 0, type: 'skip' }],
            },
            {
              name: 'Variation 2',
              modifications: [{ stepIndex: 1, type: 'skip' }],
            },
          ],
          parallel: false,
        },
        recording,
      );

      expect(results).toHaveLength(2);
    }, 10000);

    it('should run scenarios in parallel when configured', async () => {
      const results = await engine.runBatch(
        {
          recordingId: 'rec_123',
          variations: [
            { name: 'Var 1', modifications: [] },
            { name: 'Var 2', modifications: [] },
          ],
          parallel: true,
        },
        recording,
      );

      expect(results).toHaveLength(2);
    }, 10000);
  });

  describe('compare', () => {
    it('should compare original with scenario result', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [{ stepIndex: 0, type: 'skip' }],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      const result = engine.getResult(scenario.id)!;
      const comparison = engine.compare(recording, result);

      expect(comparison).toBeDefined();
      expect(comparison.scenarioId).toBe(scenario.id);
      expect(comparison.scenarioName).toBe('Test');
    }, 10000);

    it('should calculate divergence percentage', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      const result = engine.getResult(scenario.id)!;
      const comparison = engine.compare(recording, result);

      expect(comparison.divergencePercentage).toBeDefined();
      expect(comparison.divergencePercentage).toBeGreaterThanOrEqual(0);
      expect(comparison.divergencePercentage).toBeLessThanOrEqual(100);
    }, 10000);

    it('should include summary', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [{ stepIndex: 0, type: 'skip' }],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      const result = engine.getResult(scenario.id)!;
      const comparison = engine.compare(recording, result);

      expect(comparison.summary).toBeDefined();
      expect(comparison.summary).toContain('modified');
    }, 10000);
  });

  describe('get scenarios', () => {
    it('should get scenario by ID', () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      const retrieved = engine.getScenario(scenario.id);
      expect(retrieved?.id).toBe(scenario.id);
    });

    it('should return undefined for non-existent scenario', () => {
      const scenario = engine.getScenario('non-existent');
      expect(scenario).toBeUndefined();
    });

    it('should get all scenarios', () => {
      engine.createScenario({
        name: 'Test 1',
        recordingId: 'rec_123',
        modifications: [],
      });
      engine.createScenario({
        name: 'Test 2',
        recordingId: 'rec_123',
        modifications: [],
      });

      expect(engine.getScenarios()).toHaveLength(2);
    });

    it('should get scenarios for recording', () => {
      engine.createScenario({
        name: 'Test 1',
        recordingId: 'rec_123',
        modifications: [],
      });
      engine.createScenario({
        name: 'Test 2',
        recordingId: 'rec_456',
        modifications: [],
      });

      const scenarios = engine.getScenariosForRecording('rec_123');
      expect(scenarios).toHaveLength(1);
      expect(scenarios[0].baseRecordingId).toBe('rec_123');
    });
  });

  describe('get results', () => {
    it('should get result by scenario ID', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario.id, recording);

      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      const result = engine.getResult(scenario.id);
      expect(result).toBeDefined();
      expect(result?.scenarioId).toBe(scenario.id);
    }, 10000);

    it('should get all results', async () => {
      const scenario1 = engine.createScenario({
        name: 'Test 1',
        recordingId: 'rec_123',
        modifications: [],
      });
      const scenario2 = engine.createScenario({
        name: 'Test 2',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario1.id, recording);
      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      engine.runScenario(scenario2.id, recording);
      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      const results = engine.getResults();
      expect(results.length).toBeGreaterThanOrEqual(2);
    }, 10000);
  });

  describe('delete scenario', () => {
    it('should delete scenario', () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      const result = engine.deleteScenario(scenario.id);
      expect(result).toBe(true);
      expect(engine.getScenario(scenario.id)).toBeUndefined();
    });

    it('should return false for non-existent scenario', () => {
      const result = engine.deleteScenario('non-existent');
      expect(result).toBe(false);
    });

    it('should delete associated results', async () => {
      const scenario = engine.createScenario({
        name: 'Test',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.runScenario(scenario.id, recording);
      await new Promise((resolve) => {
        engine.on('scenario:completed', resolve);
      });

      engine.deleteScenario(scenario.id);
      expect(engine.getResult(scenario.id)).toBeUndefined();
    }, 10000);
  });

  describe('clear', () => {
    it('should clear all scenarios and results', () => {
      engine.createScenario({
        name: 'Test 1',
        recordingId: 'rec_123',
        modifications: [],
      });
      engine.createScenario({
        name: 'Test 2',
        recordingId: 'rec_123',
        modifications: [],
      });

      engine.clear();
      expect(engine.getScenarios()).toHaveLength(0);
      expect(engine.getResults()).toHaveLength(0);
    });
  });
});

describe('createWhatIfEngine', () => {
  it('should create engine with factory function', () => {
    const engine = createWhatIfEngine();
    expect(engine).toBeInstanceOf(WhatIfEngine);
  });
});

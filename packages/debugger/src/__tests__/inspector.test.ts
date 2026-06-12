/**
 * Inspector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Inspector, createInspector } from '../core/Inspector.js';
import type { ExecutionStep, AgentState } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-5.5',
  memory: {
    size: 100,
    working: { key: 'value', nested: { deep: 'data' } },
    shortTerm: ['item1', 'item2', 'item3'],
    longTermSummary: 'Summary of long-term memory',
  },
  context: { userId: '123', session: 'abc' },
  tools: ['search', 'calculate'],
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ],
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
  input: `Input ${index}`,
});

describe('Inspector', () => {
  let inspector: Inspector;
  let steps: ExecutionStep[];
  let state: AgentState;

  beforeEach(() => {
    state = createMockState();
    steps = [
      createMockStep(0, 'input'),
      createMockStep(1, 'response'),
      createMockStep(2, 'tool-call'),
    ];
    inspector = new Inspector(steps, state);
  });

  describe('initialization', () => {
    it('should initialize with steps and state', () => {
      expect(inspector.getCurrentStepIndex()).toBe(2); // Last step
      expect(inspector.getSteps()).toHaveLength(3);
    });

    it('should handle empty steps', () => {
      const emptyInspector = new Inspector([], state);
      expect(emptyInspector.getCurrentStepIndex()).toBe(-1);
      expect(emptyInspector.getCurrentStep()).toBeNull();
    });

    it('should use custom config', () => {
      const customInspector = new Inspector(steps, state, {
        maxDepth: 5,
        maxStringLength: 500,
      });
      expect(customInspector).toBeDefined();
    });
  });

  describe('step navigation', () => {
    it('should get current step', () => {
      const step = inspector.getCurrentStep();
      expect(step).not.toBeNull();
      expect(step?.index).toBe(2);
    });

    it('should get step by index', () => {
      const step = inspector.getStep(1);
      expect(step).toBeDefined();
      expect(step?.index).toBe(1);
    });

    it('should return undefined for invalid index', () => {
      const step = inspector.getStep(10);
      expect(step).toBeUndefined();
    });

    it('should set current step index', () => {
      inspector.setCurrentStepIndex(1);
      expect(inspector.getCurrentStepIndex()).toBe(1);
    });

    it('should not set invalid step index', () => {
      inspector.setCurrentStepIndex(10);
      expect(inspector.getCurrentStepIndex()).toBe(2); // Unchanged
    });

    it('should get all steps', () => {
      const allSteps = inspector.getSteps();
      expect(allSteps).toHaveLength(3);
      expect(allSteps[0].index).toBe(0);
    });

    it('should get steps up to current', () => {
      inspector.setCurrentStepIndex(1);
      const upToSteps = inspector.getStepsUpToCurrent();
      expect(upToSteps).toHaveLength(2);
    });
  });

  describe('inspect', () => {
    it('should return inspection result', () => {
      const result = inspector.inspect();
      expect(result.currentStep).not.toBeNull();
      expect(result.stepIndex).toBe(2);
      expect(result.totalSteps).toBe(3);
      expect(result.state).toBeDefined();
    });

    it('should include tool calls', () => {
      const toolStep = createMockStep(3, 'tool-call');
      toolStep.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test' },
      };
      const newSteps = [...steps, toolStep];
      const newInspector = new Inspector(newSteps, state);
      const result = newInspector.inspect();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('search');
    });

    it('should include decisions', () => {
      const decisionStep = createMockStep(3, 'decision');
      decisionStep.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      const newSteps = [...steps, decisionStep];
      const newInspector = new Inspector(newSteps, state);
      const result = newInspector.inspect();
      expect(result.decisions).toHaveLength(1);
    });

    it('should include memory snapshot', () => {
      const result = inspector.inspect();
      expect(result.memory).toBeDefined();
      expect(result.memory.size).toBe(100);
    });

    it('should include variables', () => {
      const result = inspector.inspect();
      expect(result.variables).toEqual({ userId: '123', session: 'abc' });
    });

    it('should include call stack', () => {
      const result = inspector.inspect();
      expect(result.callStack).toBeDefined();
      expect(result.callStack).toContain('Test Agent');
    });
  });

  describe('tool calls', () => {
    it('should get all tool calls', () => {
      const toolStep1 = createMockStep(3, 'tool-call');
      toolStep1.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test1' },
      };
      const toolStep2 = createMockStep(4, 'tool-call');
      toolStep2.toolCall = {
        id: 'tool_2',
        name: 'calculate',
        arguments: { expr: '2+2' },
      };
      const newSteps = [...steps, toolStep1, toolStep2];
      const newInspector = new Inspector(newSteps, state);
      const toolCalls = newInspector.getToolCalls();
      expect(toolCalls).toHaveLength(2);
    });

    it('should get tool calls by name', () => {
      const toolStep1 = createMockStep(3, 'tool-call');
      toolStep1.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
      };
      const toolStep2 = createMockStep(4, 'tool-call');
      toolStep2.toolCall = {
        id: 'tool_2',
        name: 'search',
        arguments: {},
      };
      const toolStep3 = createMockStep(5, 'tool-call');
      toolStep3.toolCall = {
        id: 'tool_3',
        name: 'calculate',
        arguments: {},
      };
      const newSteps = [...steps, toolStep1, toolStep2, toolStep3];
      const newInspector = new Inspector(newSteps, state);
      const searchCalls = newInspector.getToolCallsByName('search');
      expect(searchCalls).toHaveLength(2);
    });
  });

  describe('decisions', () => {
    it('should get all decisions', () => {
      const decisionStep1 = createMockStep(3, 'decision');
      decisionStep1.decision = {
        id: 'dec_1',
        prompt: 'Choose 1',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      const decisionStep2 = createMockStep(4, 'decision');
      decisionStep2.decision = {
        id: 'dec_2',
        prompt: 'Choose 2',
        options: [{ id: 'opt2', description: 'Option 2' }],
        chosenIndex: 0,
        chosen: { id: 'opt2', description: 'Option 2' },
        confidence: 0.9,
        timestamp: Date.now(),
      };
      const newSteps = [...steps, decisionStep1, decisionStep2];
      const newInspector = new Inspector(newSteps, state);
      const decisions = newInspector.getDecisions();
      expect(decisions).toHaveLength(2);
    });
  });

  describe('memory snapshot', () => {
    it('should get memory snapshot', () => {
      const snapshot = inspector.getMemorySnapshot();
      expect(snapshot.size).toBe(100);
    });

    it('should include full memory when configured', () => {
      const fullInspector = new Inspector(steps, state, {
        includeFullMemory: true,
      });
      const snapshot = fullInspector.getMemorySnapshot();
      expect(snapshot.working).toEqual(state.memory.working);
    });

    it('should summarize memory by default', () => {
      const snapshot = inspector.getMemorySnapshot();
      expect(snapshot.working).toBeDefined();
      expect(snapshot.shortTerm).toHaveLength(3);
    });

    it('should limit short-term memory items', () => {
      const largeState = { ...state };
      largeState.memory.shortTerm = Array.from({ length: 20 }, (_, i) => i);
      const largeInspector = new Inspector(steps, largeState);
      const snapshot = largeInspector.getMemorySnapshot();
      expect(snapshot.shortTerm).toHaveLength(10); // Limited to last 10
    });
  });

  describe('variables', () => {
    it('should get all variables', () => {
      const vars = inspector.getVariables();
      expect(vars).toEqual({ userId: '123', session: 'abc' });
    });

    it('should get variable by path', () => {
      const newState = { ...state };
      newState.context = { user: { name: 'John', age: 30 } };
      const newInspector = new Inspector(steps, newState);
      const name = newInspector.getVariable('user.name');
      expect(name).toBe('John');
    });

    it('should return undefined for non-existent path', () => {
      const value = inspector.getVariable('non.existent.path');
      expect(value).toBeUndefined();
    });

    it('should handle nested paths', () => {
      const newState = { ...state };
      newState.context = { a: { b: { c: { d: 'deep' } } } };
      const newInspector = new Inspector(steps, newState);
      const value = newInspector.getVariable('a.b.c.d');
      expect(value).toBe('deep');
    });
  });

  describe('call stack', () => {
    it('should get call stack', () => {
      const stack = inspector.getCallStack();
      expect(stack).toContain('Test Agent');
    });

    it('should build stack from handoff steps', () => {
      const handoffStep = createMockStep(3, 'handoff');
      handoffStep.output = { agentName: 'Supervisor' };
      const newSteps = [...steps, handoffStep];
      const newInspector = new Inspector(newSteps, state);
      const stack = newInspector.getCallStack();
      expect(stack).toContain('Supervisor');
    });

    it('should build stack from delegation steps', () => {
      const delegationStep = createMockStep(3, 'delegation');
      delegationStep.output = { agentName: 'Worker' };
      const newSteps = [...steps, delegationStep];
      const newInspector = new Inspector(newSteps, state);
      inspector.setCurrentStepIndex(3);
      const stack = newInspector.getCallStack();
      expect(stack.length).toBeGreaterThan(0);
    });
  });

  describe('watches', () => {
    it('should watch a variable', () => {
      const watch = inspector.watch('userId');
      expect(watch).toBeDefined();
      expect(watch.path).toBe('userId');
      expect(watch.value).toBe('123');
      expect(watch.changed).toBe(false);
    });

    it('should unwatch a variable', () => {
      inspector.watch('userId');
      const result = inspector.unwatch('userId');
      expect(result).toBe(true);
      expect(inspector.getWatches()).toHaveLength(0);
    });

    it('should get all watches', () => {
      inspector.watch('userId');
      inspector.watch('session');
      const watches = inspector.getWatches();
      expect(watches).toHaveLength(2);
    });

    it('should detect variable changes', () => {
      inspector.watch('userId');
      const newState = { ...state };
      newState.context = { userId: '456', session: 'abc' };
      inspector.update(steps, newState);
      const changed = inspector.getChangedWatches();
      expect(changed).toHaveLength(1);
      expect(changed[0].path).toBe('userId');
    });

    it('should not mark unchanged variables as changed', () => {
      inspector.watch('userId');
      inspector.update(steps, state);
      const changed = inspector.getChangedWatches();
      expect(changed).toHaveLength(0);
    });
  });

  describe('search', () => {
    it('should search steps by content', () => {
      const step1 = createMockStep(0, 'input');
      step1.input = 'search for cats';
      const step2 = createMockStep(1, 'input');
      step2.input = 'search for dogs';
      const step3 = createMockStep(2, 'response');
      step3.output = 'here are some cats';
      const newSteps = [step1, step2, step3];
      const newInspector = new Inspector(newSteps, state);
      const results = newInspector.searchSteps('cats');
      expect(results).toHaveLength(2);
    });

    it('should search case-insensitively by default', () => {
      const step = createMockStep(0, 'input');
      step.input = 'UPPERCASE TEXT';
      const newInspector = new Inspector([step], state);
      const results = newInspector.searchSteps('uppercase');
      expect(results).toHaveLength(1);
    });

    it('should search case-sensitively when configured', () => {
      const step = createMockStep(0, 'input');
      step.input = 'UPPERCASE TEXT';
      const newInspector = new Inspector([step], state);
      const results = newInspector.searchSteps('uppercase', {
        caseSensitive: true,
      });
      expect(results).toHaveLength(0);
    });

    it('should filter by step types', () => {
      const step1 = createMockStep(0, 'input');
      step1.input = 'test';
      const step2 = createMockStep(1, 'response');
      step2.output = 'test';
      const step3 = createMockStep(2, 'tool-call');
      step3.toolCall = { id: 'tool_1', name: 'test', arguments: {} };
      const newSteps = [step1, step2, step3];
      const newInspector = new Inspector(newSteps, state);
      const results = newInspector.searchSteps('test', {
        types: ['input', 'response'],
      });
      expect(results).toHaveLength(2);
    });
  });

  describe('step summary', () => {
    it('should summarize input step', () => {
      const step = createMockStep(0, 'input');
      step.input = 'Hello, how are you?';
      const summary = inspector.getStepSummary(step);
      expect(summary).toContain('Input:');
      expect(summary).toContain('Hello');
    });

    it('should summarize response step', () => {
      const step = createMockStep(0, 'response');
      step.output = 'I am doing well, thank you!';
      const summary = inspector.getStepSummary(step);
      expect(summary).toContain('Response:');
    });

    it('should summarize tool call step', () => {
      const step = createMockStep(0, 'tool-call');
      step.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test' },
      };
      const summary = inspector.getStepSummary(step);
      expect(summary).toContain('Tool:');
      expect(summary).toContain('search');
    });

    it('should summarize decision step', () => {
      const step = createMockStep(0, 'decision');
      step.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Go left' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Go left' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      const summary = inspector.getStepSummary(step);
      expect(summary).toContain('Decision:');
      expect(summary).toContain('Go left');
    });

    it('should summarize error step', () => {
      const step = createMockStep(0, 'error');
      step.error = { name: 'Error', message: 'Something went wrong' };
      const summary = inspector.getStepSummary(step);
      expect(summary).toContain('Error:');
    });

    it('should truncate long content', () => {
      const step = createMockStep(0, 'input');
      step.input = 'a'.repeat(100);
      const summary = inspector.getStepSummary(step);
      expect(summary.length).toBeLessThan(100);
    });
  });

  describe('update', () => {
    it('should update steps and state', () => {
      const newSteps = [...steps, createMockStep(3)];
      const newState = { ...state };
      inspector.update(newSteps, newState);
      expect(inspector.getSteps()).toHaveLength(4);
    });

    it('should update current step index', () => {
      const newSteps = [...steps, createMockStep(3)];
      inspector.update(newSteps, state);
      expect(inspector.getCurrentStepIndex()).toBe(3);
    });

    it('should update with custom step index', () => {
      const newSteps = [...steps, createMockStep(3)];
      inspector.update(newSteps, state, 1);
      expect(inspector.getCurrentStepIndex()).toBe(1);
    });
  });

  describe('export', () => {
    it('should export inspection data', () => {
      const exported = inspector.export();
      expect(exported.inspection).toBeDefined();
      expect(exported.watches).toBeDefined();
      expect(exported.steps).toBeDefined();
    });

    it('should include step summaries in export', () => {
      const exported = inspector.export();
      expect(exported.steps).toHaveLength(3);
      expect(exported.steps[0]).toHaveProperty('summary');
    });
  });
});

describe('createInspector', () => {
  it('should create inspector with factory function', () => {
    const state = createMockState();
    const steps = [createMockStep(0)];
    const inspector = createInspector(steps, state);
    expect(inspector).toBeInstanceOf(Inspector);
  });

  it('should pass config to inspector', () => {
    const state = createMockState();
    const steps = [createMockStep(0)];
    const inspector = createInspector(steps, state, { maxDepth: 5 });
    expect(inspector).toBeDefined();
  });
});

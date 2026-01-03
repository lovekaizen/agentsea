/**
 * Breakpoint Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BreakpointManager,
  createBreakpointManager,
  BreakpointHelpers,
} from '../core/Breakpoint.js';
import type { ExecutionStep, AgentState } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-4',
  memory: { size: 0 },
  context: {},
  tools: ['search'],
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

describe('BreakpointManager', () => {
  let manager: BreakpointManager;

  beforeEach(() => {
    manager = new BreakpointManager();
  });

  describe('add and remove', () => {
    it('should add breakpoint', () => {
      const bp = manager.add({ type: 'tool-call' });
      expect(bp.id).toMatch(/^bp_/);
      expect(bp.type).toBe('tool-call');
      expect(bp.enabled).toBe(true);
      expect(bp.hitCount).toBe(0);
    });

    it('should add breakpoint with custom enabled state', () => {
      const bp = manager.add({ type: 'error', enabled: false });
      expect(bp.enabled).toBe(false);
    });

    it('should remove breakpoint', () => {
      const bp = manager.add({ type: 'error' });
      const result = manager.remove(bp.id);
      expect(result).toBe(true);
      expect(manager.count).toBe(0);
    });

    it('should return false when removing non-existent breakpoint', () => {
      const result = manager.remove('non-existent');
      expect(result).toBe(false);
    });

    it('should emit added event', () => {
      const handler = vi.fn();
      manager.on('breakpoint:added', handler);
      const bp = manager.add({ type: 'error' });
      expect(handler).toHaveBeenCalledWith(bp);
    });

    it('should emit removed event', () => {
      const handler = vi.fn();
      const bp = manager.add({ type: 'error' });
      manager.on('breakpoint:removed', handler);
      manager.remove(bp.id);
      expect(handler).toHaveBeenCalledWith(bp.id);
    });
  });

  describe('get', () => {
    it('should get breakpoint by ID', () => {
      const bp = manager.add({ type: 'error' });
      const retrieved = manager.get(bp.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(bp.id);
    });

    it('should return undefined for non-existent breakpoint', () => {
      const bp = manager.get('non-existent');
      expect(bp).toBeUndefined();
    });

    it('should get all breakpoints', () => {
      manager.add({ type: 'error' });
      manager.add({ type: 'decision' });
      const bps = manager.getAll();
      expect(bps).toHaveLength(2);
    });

    it('should get enabled breakpoints', () => {
      manager.add({ type: 'error', enabled: true });
      manager.add({ type: 'decision', enabled: false });
      manager.add({ type: 'tool-call', enabled: true });
      const enabled = manager.getEnabled();
      expect(enabled).toHaveLength(2);
    });
  });

  describe('toggle and enable/disable', () => {
    it('should toggle breakpoint', () => {
      const bp = manager.add({ type: 'error', enabled: true });
      manager.toggle(bp.id);
      const updated = manager.get(bp.id);
      expect(updated?.enabled).toBe(false);
    });

    it('should toggle back to enabled', () => {
      const bp = manager.add({ type: 'error', enabled: true });
      manager.toggle(bp.id);
      manager.toggle(bp.id);
      const updated = manager.get(bp.id);
      expect(updated?.enabled).toBe(true);
    });

    it('should enable breakpoint', () => {
      const bp = manager.add({ type: 'error', enabled: false });
      const result = manager.enable(bp.id);
      expect(result).toBe(true);
      expect(manager.get(bp.id)?.enabled).toBe(true);
    });

    it('should not enable already enabled breakpoint', () => {
      const bp = manager.add({ type: 'error', enabled: true });
      const result = manager.enable(bp.id);
      expect(result).toBe(false);
    });

    it('should disable breakpoint', () => {
      const bp = manager.add({ type: 'error', enabled: true });
      const result = manager.disable(bp.id);
      expect(result).toBe(true);
      expect(manager.get(bp.id)?.enabled).toBe(false);
    });

    it('should emit toggled event', () => {
      const handler = vi.fn();
      const bp = manager.add({ type: 'error' });
      manager.on('breakpoint:toggled', handler);
      manager.toggle(bp.id);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all breakpoints', () => {
      manager.add({ type: 'error' });
      manager.add({ type: 'decision' });
      manager.clear();
      expect(manager.count).toBe(0);
    });

    it('should emit removed events for each breakpoint', () => {
      const handler = vi.fn();
      manager.add({ type: 'error' });
      manager.add({ type: 'decision' });
      manager.on('breakpoint:removed', handler);
      manager.clear();
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('check - step breakpoint', () => {
    it('should trigger on specific step', () => {
      const state = createMockState();
      manager.add({ type: 'step', step: 5 });
      const step5 = createMockStep(5);
      const hit = manager.check(step5, state);
      expect(hit).not.toBeNull();
      expect(hit?.type).toBe('step');
    });

    it('should not trigger on different step', () => {
      const state = createMockState();
      manager.add({ type: 'step', step: 5 });
      const step3 = createMockStep(3);
      const hit = manager.check(step3, state);
      expect(hit).toBeNull();
    });

    it('should increment hit count', () => {
      const state = createMockState();
      const bp = manager.add({ type: 'step', step: 5 });
      const step5 = createMockStep(5);
      manager.check(step5, state);
      expect(manager.get(bp.id)?.hitCount).toBe(1);
    });
  });

  describe('check - tool breakpoint', () => {
    it('should trigger on any tool call', () => {
      const state = createMockState();
      manager.add({ type: 'tool-call' });
      const step = createMockStep(0, 'tool-call');
      step.toolCall = { id: 'tool_1', name: 'search', arguments: {} };
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should trigger on specific tool', () => {
      const state = createMockState();
      manager.add({ type: 'tool-call', toolName: 'search' });
      const step = createMockStep(0, 'tool-call');
      step.toolCall = { id: 'tool_1', name: 'search', arguments: {} };
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should not trigger on different tool', () => {
      const state = createMockState();
      manager.add({ type: 'tool-call', toolName: 'search' });
      const step = createMockStep(0, 'tool-call');
      step.toolCall = { id: 'tool_1', name: 'calculator', arguments: {} };
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });

    it('should not trigger on non-tool-call step', () => {
      const state = createMockState();
      manager.add({ type: 'tool-call' });
      const step = createMockStep(0, 'input');
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });
  });

  describe('check - tool result breakpoint', () => {
    it('should trigger on tool result', () => {
      const state = createMockState();
      manager.add({ type: 'tool-result' });
      const step = createMockStep(0, 'tool-result');
      step.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        result: 'result',
      };
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should trigger on specific tool result', () => {
      const state = createMockState();
      manager.add({ type: 'tool-result', toolName: 'search' });
      const step = createMockStep(0, 'tool-result');
      step.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        result: 'result',
      };
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });
  });

  describe('check - decision breakpoint', () => {
    it('should trigger on decision', () => {
      const state = createMockState();
      manager.add({ type: 'decision' });
      const step = createMockStep(0, 'decision');
      step.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.8,
        timestamp: Date.now(),
      };
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should not trigger on non-decision step', () => {
      const state = createMockState();
      manager.add({ type: 'decision' });
      const step = createMockStep(0, 'input');
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });
  });

  describe('check - error breakpoint', () => {
    it('should trigger on error', () => {
      const state = createMockState();
      manager.add({ type: 'error' });
      const step = createMockStep(0, 'error');
      step.error = { name: 'Error', message: 'Test error' };
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should not trigger when no error', () => {
      const state = createMockState();
      manager.add({ type: 'error' });
      const step = createMockStep(0, 'input');
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });
  });

  describe('check - memory change breakpoint', () => {
    it('should trigger on memory write', () => {
      const state = createMockState();
      manager.add({ type: 'memory-change' });
      const step = createMockStep(0, 'memory-write');
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should not trigger on non-memory-write step', () => {
      const state = createMockState();
      manager.add({ type: 'memory-change' });
      const step = createMockStep(0, 'input');
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });
  });

  describe('check - custom condition', () => {
    it('should trigger when condition returns true', () => {
      const state = createMockState();
      manager.add({
        type: 'custom',
        condition: (ctx) => ctx.stepIndex > 5,
      });
      const step = createMockStep(10);
      const hit = manager.check(step, state);
      expect(hit).not.toBeNull();
    });

    it('should not trigger when condition returns false', () => {
      const state = createMockState();
      manager.add({
        type: 'custom',
        condition: (ctx) => ctx.stepIndex > 5,
      });
      const step = createMockStep(3);
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });

    it('should handle condition errors gracefully', () => {
      const state = createMockState();
      manager.add({
        type: 'custom',
        condition: () => {
          throw new Error('Condition error');
        },
      });
      const step = createMockStep(0);
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });

    it('should provide context to condition', () => {
      const state = createMockState();
      const conditionFn = vi.fn(() => true);
      manager.add({ type: 'custom', condition: conditionFn });
      const step = createMockStep(5);
      manager.check(step, state);
      expect(conditionFn).toHaveBeenCalledWith(
        expect.objectContaining({
          step,
          stepIndex: 5,
          state,
        }),
      );
    });
  });

  describe('check - disabled breakpoints', () => {
    it('should not trigger disabled breakpoints', () => {
      const state = createMockState();
      manager.add({ type: 'error', enabled: false });
      const step = createMockStep(0, 'error');
      step.error = { name: 'Error', message: 'Test' };
      const hit = manager.check(step, state);
      expect(hit).toBeNull();
    });
  });

  describe('check - events', () => {
    it('should emit breakpoint hit event', () => {
      const handler = vi.fn();
      const state = createMockState();
      manager.on('breakpoint:hit', handler);
      manager.add({ type: 'error' });
      const step = createMockStep(0, 'error');
      step.error = { name: 'Error', message: 'Test' };
      manager.check(step, state);
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('counts', () => {
    it('should track total count', () => {
      expect(manager.count).toBe(0);
      manager.add({ type: 'error' });
      manager.add({ type: 'decision' });
      expect(manager.count).toBe(2);
    });

    it('should track enabled count', () => {
      manager.add({ type: 'error', enabled: true });
      manager.add({ type: 'decision', enabled: false });
      manager.add({ type: 'tool-call', enabled: true });
      expect(manager.enabledCount).toBe(2);
    });
  });
});

describe('BreakpointHelpers', () => {
  it('should create step breakpoint', () => {
    const bp = BreakpointHelpers.atStep(10);
    expect(bp.type).toBe('step');
    expect(bp.step).toBe(10);
    expect(bp.description).toContain('10');
  });

  it('should create step breakpoint with custom description', () => {
    const bp = BreakpointHelpers.atStep(10, 'Custom description');
    expect(bp.description).toBe('Custom description');
  });

  it('should create tool call breakpoint', () => {
    const bp = BreakpointHelpers.onToolCall();
    expect(bp.type).toBe('tool-call');
    expect(bp.toolName).toBeUndefined();
  });

  it('should create specific tool breakpoint', () => {
    const bp = BreakpointHelpers.onTool('search');
    expect(bp.type).toBe('tool-call');
    expect(bp.toolName).toBe('search');
  });

  it('should create error breakpoint', () => {
    const bp = BreakpointHelpers.onError();
    expect(bp.type).toBe('error');
  });

  it('should create decision breakpoint', () => {
    const bp = BreakpointHelpers.onDecision();
    expect(bp.type).toBe('decision');
  });

  it('should create decision breakpoint with condition', () => {
    const condition = (ctx: any) => ctx.decision?.confidence < 0.5;
    const bp = BreakpointHelpers.onDecision(condition);
    expect(bp.type).toBe('decision');
    expect(bp.condition).toBe(condition);
  });

  it('should create low confidence breakpoint', () => {
    const bp = BreakpointHelpers.onLowConfidence(0.6);
    expect(bp.type).toBe('decision');
    expect(bp.condition).toBeDefined();
    expect(bp.description).toContain('0.6');
  });

  it('should create memory change breakpoint', () => {
    const bp = BreakpointHelpers.onMemoryChange();
    expect(bp.type).toBe('memory-change');
  });

  it('should create custom breakpoint', () => {
    const condition = (ctx: any) => ctx.stepIndex > 10;
    const bp = BreakpointHelpers.custom(condition, 'After step 10');
    expect(bp.type).toBe('custom');
    expect(bp.condition).toBe(condition);
    expect(bp.description).toBe('After step 10');
  });
});

describe('createBreakpointManager', () => {
  it('should create manager with factory function', () => {
    const manager = createBreakpointManager();
    expect(manager).toBeInstanceOf(BreakpointManager);
    expect(manager.count).toBe(0);
  });
});

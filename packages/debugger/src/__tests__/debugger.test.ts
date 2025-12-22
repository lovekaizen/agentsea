/**
 * Debugger Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Debugger } from '../core/Debugger.js';
import { BreakpointHelpers } from '../core/Breakpoint.js';

describe('Debugger', () => {
  let debugger_: Debugger;

  beforeEach(() => {
    debugger_ = new Debugger();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const config = debugger_.getConfig();
      expect(config.maxSteps).toBe(10000);
      expect(config.recording.enabled).toBe(true);
    });

    it('should merge custom config', () => {
      const customDebugger = new Debugger({
        maxSteps: 5000,
        recording: { includePrompts: false },
      });
      const config = customDebugger.getConfig();
      expect(config.maxSteps).toBe(5000);
      expect(config.recording.includePrompts).toBe(false);
    });
  });

  describe('session management', () => {
    it('should start a session', async () => {
      const session = await debugger_.startSession({ agentId: 'test-agent' });
      expect(session).toBeDefined();
      expect(session.id).toMatch(/^session_/);
    });

    it('should end a session and return recording', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const recording = await debugger_.endSession();
      expect(recording).toBeDefined();
      expect(recording?.agentId).toBe('test-agent');
    });

    it('should get current session', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const session = debugger_.getSession();
      expect(session).toBeDefined();
    });
  });

  describe('breakpoints', () => {
    it('should set a breakpoint', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const bp = debugger_.setBreakpoint({
        type: 'tool-call',
        toolName: 'search',
      });
      expect(bp).toBeDefined();
      expect(bp?.type).toBe('tool-call');
    });

    it('should store global breakpoints', () => {
      debugger_.setBreakpoint({ type: 'error' });
      // Breakpoint stored globally, should apply to next session
    });

    it('should clear breakpoints', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      debugger_.setBreakpoint({ type: 'error' });
      debugger_.clearBreakpoints();
      // No way to verify directly, but should not throw
    });
  });

  describe('step recording', () => {
    it('should record a step manually', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const result = debugger_.recordStep({
        type: 'input',
        input: 'Hello',
      });
      expect(result).toBe(true);
    });

    it('should use step builder', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const builder = debugger_.steps();

      const inputStep = builder.input('Hello');
      expect(inputStep.type).toBe('input');

      const responseStep = builder.response('Hi there');
      expect(responseStep.type).toBe('response');

      const toolStep = builder.toolCall({
        id: 'tool_1',
        name: 'search',
        arguments: { query: 'test' },
      });
      expect(toolStep.type).toBe('tool-call');
    });
  });

  describe('agent attachment', () => {
    it('should attach to agent', () => {
      const mockAgent = {
        id: 'agent-1',
        name: 'Test Agent',
        model: 'gpt-4',
      };
      debugger_.attach(mockAgent);
      // No direct way to verify, but should not throw
    });

    it('should detach from agent', () => {
      debugger_.detach();
      // Should not throw
    });
  });

  describe('checkpoints', () => {
    it('should create checkpoint', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const cp = debugger_.createCheckpoint({
        name: 'test-checkpoint',
        description: 'Test checkpoint',
      });
      expect(cp).toBeDefined();
      expect(cp?.name).toBe('test-checkpoint');
    });

    it('should list checkpoints', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      debugger_.createCheckpoint({ name: 'cp1' });
      debugger_.createCheckpoint({ name: 'cp2' });
      const checkpoints = debugger_.listCheckpoints();
      expect(checkpoints.length).toBe(2);
    });
  });

  describe('inspection', () => {
    it('should return inspector when session is active', async () => {
      await debugger_.startSession({ agentId: 'test-agent' });
      const inspector = debugger_.inspect();
      expect(inspector).toBeDefined();
    });

    it('should return undefined when no session', () => {
      const inspector = debugger_.inspect();
      expect(inspector).toBeUndefined();
    });
  });
});

describe('BreakpointHelpers', () => {
  it('should create step breakpoint', () => {
    const bp = BreakpointHelpers.atStep(10);
    expect(bp.type).toBe('step');
    expect(bp.step).toBe(10);
  });

  it('should create tool call breakpoint', () => {
    const bp = BreakpointHelpers.onToolCall();
    expect(bp.type).toBe('tool-call');
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

  it('should create low confidence breakpoint', () => {
    const bp = BreakpointHelpers.onLowConfidence(0.5);
    expect(bp.type).toBe('decision');
    expect(bp.condition).toBeDefined();
  });

  it('should create custom breakpoint', () => {
    const bp = BreakpointHelpers.custom(
      (ctx) => ctx.stepIndex > 10,
      'After step 10',
    );
    expect(bp.type).toBe('custom');
    expect(bp.condition).toBeDefined();
  });
});

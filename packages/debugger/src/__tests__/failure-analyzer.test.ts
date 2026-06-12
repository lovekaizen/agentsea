/**
 * FailureAnalyzer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FailureAnalyzer,
  createFailureAnalyzer,
  type FailurePattern,
} from '../analysis/FailureAnalyzer.js';
import type { Recording, ExecutionStep, AgentState } from '../types/index.js';

const createMockState = (): AgentState => ({
  agentId: 'test-agent',
  agentName: 'Test Agent',
  model: 'gpt-5.5',
  memory: { size: 1000 },
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

const createMockRecording = (
  status: 'completed' | 'failed' = 'failed',
): Recording => {
  return {
    id: 'rec_123',
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status,
    startedAt: Date.now() - 10000,
    endedAt: Date.now(),
    durationMs: 10000,
    steps: [],
    toolCalls: [],
    decisions: [],
    checkpoints: [],
    initialState: createMockState(),
    finalState: createMockState(),
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    version: '1.0.0',
  };
};

describe('FailureAnalyzer', () => {
  let analyzer: FailureAnalyzer;
  let recording: Recording;

  beforeEach(() => {
    analyzer = new FailureAnalyzer();
    recording = createMockRecording();
  });

  describe('initialization', () => {
    it('should create analyzer with default options', () => {
      expect(analyzer).toBeDefined();
    });

    it('should create analyzer with custom options', () => {
      const customAnalyzer = new FailureAnalyzer({
        includeDetailedSteps: false,
        includeMemoryAnalysis: false,
      });
      expect(customAnalyzer).toBeDefined();
    });
  });

  describe('analyze - explicit errors', () => {
    it('should detect explicit error', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test error' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      expect(analysis).toBeDefined();
      expect(analysis.rootCause).toContain('Test error');
      expect(analysis.errorStepIndex).toBe(0);
    });

    it('should include error message', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'TypeError', message: 'Cannot read property' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      expect(analysis.errorMessage).toBe('Cannot read property');
    });

    it('should include stack trace when available', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = {
        name: 'Error',
        message: 'Test',
        stack: 'Error: Test\n    at line 1',
      };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      expect(analysis.stackTrace).toBeDefined();
      expect(analysis.stackTrace).toContain('at line 1');
    });
  });

  describe('analyze - repeated tool failures', () => {
    it('should detect repeated tool failures', () => {
      const toolStep1 = createMockStep(0, 'tool-result');
      toolStep1.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        success: false,
      };
      const toolStep2 = createMockStep(1, 'tool-result');
      toolStep2.toolCall = {
        id: 'tool_2',
        name: 'search',
        arguments: {},
        success: false,
      };
      recording.steps.push(toolStep1, toolStep2);

      const analysis = analyzer.analyze(recording);
      const hasRepeatedFailure = analysis.contributingFactors.some(
        (f) => f.type === 'repeated_tool_failure',
      );
      expect(hasRepeatedFailure).toBe(true);
    });

    it('should provide recommendations for tool failures', () => {
      const toolStep1 = createMockStep(0, 'tool-result');
      toolStep1.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        success: false,
      };
      const toolStep2 = createMockStep(1, 'tool-result');
      toolStep2.toolCall = {
        id: 'tool_2',
        name: 'search',
        arguments: {},
        success: false,
      };
      recording.steps.push(toolStep1, toolStep2);

      const analysis = analyzer.analyze(recording);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(
        analysis.recommendations.some((r) => r.title.includes('retry')),
      ).toBe(true);
    });
  });

  describe('analyze - low confidence decisions', () => {
    it('should detect low confidence decisions', () => {
      const decisionStep = createMockStep(0, 'decision');
      decisionStep.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.3, // Low confidence
        timestamp: Date.now(),
      };
      recording.steps.push(decisionStep);

      const analysis = analyzer.analyze(recording);
      const hasLowConfidence = analysis.contributingFactors.some(
        (f) => f.type === 'low_confidence_decision',
      );
      expect(hasLowConfidence).toBe(true);
    });

    it('should not detect high confidence decisions', () => {
      const decisionStep = createMockStep(0, 'decision');
      decisionStep.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.9, // High confidence
        timestamp: Date.now(),
      };
      recording.steps.push(decisionStep);

      const analysis = analyzer.analyze(recording);
      const hasLowConfidence = analysis.contributingFactors.some(
        (f) => f.type === 'low_confidence_decision',
      );
      expect(hasLowConfidence).toBe(false);
    });
  });

  describe('analyze - infinite loop detection', () => {
    it('should detect potential infinite loops', () => {
      // Create repeating pattern
      for (let i = 0; i < 25; i++) {
        recording.steps.push(createMockStep(i, 'input'));
        recording.steps.push(createMockStep(i + 1, 'response'));
        recording.steps.push(createMockStep(i + 2, 'tool-call'));
      }

      const analysis = analyzer.analyze(recording);
      const hasInfiniteLoop = analysis.contributingFactors.some(
        (f) => f.type === 'infinite_loop',
      );
      expect(hasInfiniteLoop).toBe(true);
      expect(analysis.severity).toBe('critical');
    });
  });

  describe('analyze - memory issues', () => {
    it('should detect memory overflow', () => {
      recording.initialState.memory.size = 100;
      recording.finalState = {
        ...createMockState(),
        memory: { size: 2000000 }, // 2MB
      };

      const analysis = analyzer.analyze(recording);
      const hasMemoryIssue = analysis.contributingFactors.some(
        (f) => f.type === 'memory_overflow',
      );
      expect(hasMemoryIssue).toBe(true);
    });

    it('should not detect memory issues with normal growth', () => {
      recording.initialState.memory.size = 1000;
      recording.finalState = {
        ...createMockState(),
        memory: { size: 5000 }, // 5x growth but small absolute size
      };

      const analysis = analyzer.analyze(recording);
      const hasMemoryIssue = analysis.contributingFactors.some(
        (f) => f.type === 'memory_overflow',
      );
      expect(hasMemoryIssue).toBe(false);
    });
  });

  describe('analyze - slow execution', () => {
    it('should detect slow execution', () => {
      recording.durationMs = 200000; // 200 seconds
      recording.steps = [
        createMockStep(0, 'input'),
        createMockStep(1, 'response'),
      ]; // Only 2 steps
      // Average of 100 seconds per step

      const analysis = analyzer.analyze(recording);
      const hasTimeout = analysis.contributingFactors.some(
        (f) => f.type === 'timeout_likely',
      );
      expect(hasTimeout).toBe(true);
    });
  });

  describe('analyze - missing context', () => {
    it('should detect missing context pattern', () => {
      recording.steps.push(createMockStep(0, 'input'));
      recording.steps.push(createMockStep(1, 'tool-call'));

      const analysis = analyzer.analyze(recording);
      const hasMissingContext = analysis.contributingFactors.some(
        (f) => f.type === 'missing_context',
      );
      expect(hasMissingContext).toBe(true);
    });
  });

  describe('contributing factors', () => {
    it('should sort factors by severity', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Critical error' };
      recording.steps.push(errorStep);

      const decisionStep = createMockStep(1, 'decision');
      decisionStep.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.3,
        timestamp: Date.now(),
      };
      recording.steps.push(decisionStep);

      const analysis = analyzer.analyze(recording);
      // Explicit error (high) should come before low confidence (medium)
      expect(analysis.contributingFactors[0].severity).toBe('high');
    });

    it('should include evidence for factors', () => {
      const toolStep1 = createMockStep(0, 'tool-result');
      toolStep1.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        success: false,
      };
      const toolStep2 = createMockStep(1, 'tool-result');
      toolStep2.toolCall = {
        id: 'tool_2',
        name: 'search',
        arguments: {},
        success: false,
      };
      recording.steps.push(toolStep1, toolStep2);

      const analysis = analyzer.analyze(recording);
      const factor = analysis.contributingFactors.find(
        (f) => f.type === 'repeated_tool_failure',
      );
      expect(factor?.evidence).toBeDefined();
      expect(factor?.evidence?.failureCount).toBe(2);
    });

    it('should include step indices for factors', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      const factor = analysis.contributingFactors.find(
        (f) => f.type === 'explicit_error',
      );
      expect(factor?.stepIndices).toContain(0);
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should prioritize recommendations by severity', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      // First recommendation should have highest priority (lowest number)
      expect(analysis.recommendations[0].priority).toBeLessThanOrEqual(
        analysis.recommendations[analysis.recommendations.length - 1].priority,
      );
    });

    it('should not duplicate recommendations', () => {
      const toolStep1 = createMockStep(0, 'tool-result');
      toolStep1.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        success: false,
      };
      const toolStep2 = createMockStep(1, 'tool-result');
      toolStep2.toolCall = {
        id: 'tool_2',
        name: 'search',
        arguments: {},
        success: false,
      };
      recording.steps.push(toolStep1, toolStep2);

      const analysis = analyzer.analyze(recording);
      const titles = analysis.recommendations.map((r) => r.title);
      const uniqueTitles = new Set(titles);
      expect(titles.length).toBe(uniqueTitles.size);
    });
  });

  describe('confidence', () => {
    it('should have high confidence with explicit error', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      expect(analysis.confidence).toBeGreaterThan(0.9);
    });

    it('should have lower confidence without clear errors', () => {
      recording.status = 'failed';
      const analysis = analyzer.analyze(recording);
      expect(analysis.confidence).toBeLessThan(0.9);
    });
  });

  describe('severity', () => {
    it('should mark critical severity for infinite loops', () => {
      for (let i = 0; i < 25; i++) {
        recording.steps.push(createMockStep(i, 'input'));
        recording.steps.push(createMockStep(i + 1, 'response'));
        recording.steps.push(createMockStep(i + 2, 'tool-call'));
      }

      const analysis = analyzer.analyze(recording);
      expect(analysis.severity).toBe('critical');
    });

    it('should mark high severity for errors', () => {
      const errorStep = createMockStep(0, 'error');
      errorStep.error = { name: 'Error', message: 'Test' };
      recording.steps.push(errorStep);

      const analysis = analyzer.analyze(recording);
      expect(analysis.severity).toBe('high');
    });
  });

  describe('step analysis', () => {
    it('should analyze individual steps', () => {
      const steps = [
        createMockStep(0, 'input'),
        createMockStep(1, 'error'),
        createMockStep(2, 'response'),
      ];
      steps[1].error = { name: 'Error', message: 'Test' };

      const stepAnalyses = analyzer.analyzeSteps(steps);
      expect(stepAnalyses).toHaveLength(3);
      expect(stepAnalyses[1].suspicious).toBe(true);
      expect(stepAnalyses[1].reasons).toContain('Error: Test');
    });

    it('should mark failed tool calls as suspicious', () => {
      const step = createMockStep(0, 'tool-result');
      step.toolCall = {
        id: 'tool_1',
        name: 'search',
        arguments: {},
        success: false,
      };

      const analyses = analyzer.analyzeSteps([step]);
      expect(analyses[0].suspicious).toBe(true);
    });

    it('should mark low confidence decisions as suspicious', () => {
      const step = createMockStep(0, 'decision');
      step.decision = {
        id: 'dec_1',
        prompt: 'Choose',
        options: [{ id: 'opt1', description: 'Option 1' }],
        chosenIndex: 0,
        chosen: { id: 'opt1', description: 'Option 1' },
        confidence: 0.3,
        timestamp: Date.now(),
      };

      const analyses = analyzer.analyzeSteps([step]);
      expect(analyses[0].suspicious).toBe(true);
    });

    it('should mark slow steps as suspicious', () => {
      const step = createMockStep(0, 'response');
      step.durationMs = 35000; // 35 seconds

      const analyses = analyzer.analyzeSteps([step]);
      expect(analyses[0].suspicious).toBe(true);
      expect(analyses[0].reasons.some((r) => r.includes('Long duration'))).toBe(
        true,
      );
    });
  });

  describe('custom patterns', () => {
    it('should add custom pattern', () => {
      const customPattern: FailurePattern = {
        id: 'custom_pattern',
        name: 'Custom Pattern',
        description: 'A custom failure pattern',
        matcher: () => true,
        severity: 'medium',
        recommendations: ['Custom recommendation'],
      };

      analyzer.addPattern(customPattern);
      const patterns = analyzer.getPatterns();
      expect(patterns.some((p) => p.id === 'custom_pattern')).toBe(true);
    });

    it('should use custom pattern in analysis', () => {
      const customPattern: FailurePattern = {
        id: 'always_match',
        name: 'Always Match',
        description: 'This pattern always matches',
        matcher: () => true,
        severity: 'medium',
        recommendations: ['Fix it'],
      };

      analyzer.addPattern(customPattern);
      const analysis = analyzer.analyze(recording);
      expect(
        analysis.contributingFactors.some((f) => f.type === 'always_match'),
      ).toBe(true);
    });

    it('should remove pattern', () => {
      const customPattern: FailurePattern = {
        id: 'removable',
        name: 'Removable',
        description: 'Can be removed',
        matcher: () => true,
        severity: 'low',
        recommendations: [],
      };

      analyzer.addPattern(customPattern);
      const removed = analyzer.removePattern('removable');
      expect(removed).toBe(true);
      expect(analyzer.getPatterns().some((p) => p.id === 'removable')).toBe(
        false,
      );
    });
  });
});

describe('createFailureAnalyzer', () => {
  it('should create analyzer with factory function', () => {
    const analyzer = createFailureAnalyzer();
    expect(analyzer).toBeInstanceOf(FailureAnalyzer);
  });

  it('should pass options to analyzer', () => {
    const analyzer = createFailureAnalyzer({
      includeDetailedSteps: false,
    });
    expect(analyzer).toBeDefined();
  });
});

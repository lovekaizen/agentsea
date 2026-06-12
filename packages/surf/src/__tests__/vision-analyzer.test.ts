import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisionAnalyzer } from '../agent/vision-analyzer.js';
import type {
  ScreenshotResult,
  VisionConfig,
  ScreenAnalysis,
  SuggestedAction,
} from '../types/index.js';

// Mock AnthropicProvider
vi.mock('@lov3kaizen/agentsea-core', () => ({
  AnthropicProvider: class {
    constructor(_apiKey?: string) {}

    async generateResponse(_messages: any, _options: any) {
      return { content: '{"action": null}' };
    }
  },
}));

describe('VisionAnalyzer', () => {
  let analyzer: VisionAnalyzer;
  const config: VisionConfig = {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
  };

  const mockScreenshot: ScreenshotResult = {
    base64: 'mock-base64-data',
    mimeType: 'image/png',
    width: 1920,
    height: 1080,
    timestamp: new Date(),
  };

  beforeEach(() => {
    analyzer = new VisionAnalyzer(config);
  });

  describe('constructor', () => {
    it('should create analyzer with config', () => {
      expect(analyzer).toBeInstanceOf(VisionAnalyzer);
    });

    it('should create analyzer with API key', () => {
      const analyzerWithKey = new VisionAnalyzer(config, 'test-api-key');
      expect(analyzerWithKey).toBeInstanceOf(VisionAnalyzer);
    });

    it('should store config', () => {
      const customConfig: VisionConfig = {
        model: 'claude-opus-4-8',
        maxTokens: 2048,
      };
      const customAnalyzer = new VisionAnalyzer(customConfig);
      expect(customAnalyzer).toBeInstanceOf(VisionAnalyzer);
    });
  });

  describe('analyzeScreen', () => {
    it('should analyze screenshot and return ScreenAnalysis', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          description: 'A desktop with a text editor',
          elements: [
            {
              type: 'button',
              label: 'Save',
              clickPoint: { x: 100, y: 50 },
              confidence: 0.9,
            },
          ],
          suggestedActions: [
            {
              action: 'click',
              description: 'Click save button',
              params: { x: 100, y: 50 },
              confidence: 0.9,
            },
          ],
          currentState: 'Editor open with unsaved changes',
        }),
      });

      const result = await analyzer.analyzeScreen(
        mockScreenshot,
        'Save the document',
        [],
      );

      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('elements');
      expect(result).toHaveProperty('suggestedActions');
      expect(result).toHaveProperty('currentState');
      expect(result.description).toBe('A desktop with a text editor');
      expect(result.elements.length).toBe(1);
      expect(result.suggestedActions.length).toBe(1);
    });

    it('should handle previous actions', async () => {
      const provider = (analyzer as any).provider;
      const spy = vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          elements: [],
          suggestedActions: [],
          currentState: 'test',
        }),
      });

      const previousActions = [
        'click: {"x": 100, "y": 100}',
        'type: {"text": "hello"}',
      ];

      await analyzer.analyzeScreen(
        mockScreenshot,
        'Test task',
        previousActions,
      );

      expect(spy).toHaveBeenCalled();
      const callArgs = spy.mock.calls[0];
      const userMessage = JSON.stringify(callArgs[0]);
      expect(userMessage).toContain('Previous actions');
    });

    it('should return minimal analysis on error', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockRejectedValue(
        new Error('API error'),
      );

      const result = await analyzer.analyzeScreen(mockScreenshot, 'Test task');

      expect(result.description).toBe('Failed to analyze screen');
      expect(result.elements).toEqual([]);
      expect(result.suggestedActions).toEqual([]);
      expect(result.currentState).toBe('unknown');
    });

    it('should parse elements with all properties', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          description: 'Test',
          elements: [
            {
              type: 'input',
              label: 'Username',
              clickPoint: { x: 200, y: 300 },
              boundingBox: { x: 150, y: 280, width: 200, height: 40 },
              confidence: 0.95,
            },
          ],
          suggestedActions: [],
          currentState: 'test',
        }),
      });

      const result = await analyzer.analyzeScreen(mockScreenshot, 'Test');

      expect(result.elements[0].type).toBe('input');
      expect(result.elements[0].label).toBe('Username');
      expect(result.elements[0].clickPoint).toEqual({ x: 200, y: 300 });
      expect(result.elements[0].confidence).toBe(0.95);
    });

    it('should handle malformed JSON response', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: 'This is not valid JSON',
      });

      const result = await analyzer.analyzeScreen(mockScreenshot, 'Test');

      expect(result.description).toBe('This is not valid JSON');
      expect(result.elements).toEqual([]);
    });

    it('should handle JSON in markdown code blocks', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content:
          '```json\n{"description": "Test", "elements": [], "suggestedActions": [], "currentState": "test"}\n```',
      });

      const result = await analyzer.analyzeScreen(mockScreenshot, 'Test');

      expect(result.description).toBe('Test');
    });
  });

  describe('getNextAction', () => {
    it('should return suggested action', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          action: 'click',
          description: 'Click the button',
          params: { x: 100, y: 200, button: 'left' },
          confidence: 0.9,
          reasoning: 'Button is visible and clickable',
        }),
      });

      const result = await analyzer.getNextAction(
        mockScreenshot,
        'Click the button',
        [],
        'Button visible',
      );

      expect(result).not.toBeNull();
      expect(result!.action).toBe('click');
      expect(result!.description).toBe('Click the button');
      expect(result!.params).toEqual({ x: 100, y: 200, button: 'left' });
      expect(result!.confidence).toBe(0.9);
    });

    it('should return null when task is complete', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          action: null,
          description: 'Task complete',
          reasoning: 'All steps finished',
        }),
      });

      const result = await analyzer.getNextAction(
        mockScreenshot,
        'Complete task',
        [],
        'Done',
      );

      expect(result).toBeNull();
    });

    it('should include previous actions in prompt', async () => {
      const provider = (analyzer as any).provider;
      const spy = vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({ action: null }),
      });

      const previousActions = [
        'click: {"x": 100, "y": 100}',
        'type: {"text": "test"}',
      ];

      await analyzer.getNextAction(
        mockScreenshot,
        'Test',
        previousActions,
        'state',
      );

      const callArgs = spy.mock.calls[0];
      const messages = JSON.stringify(callArgs[0]);
      expect(messages).toContain('Previous actions taken');
      expect(messages).toContain('click');
      expect(messages).toContain('type');
    });

    it('should handle empty previous actions', async () => {
      const provider = (analyzer as any).provider;
      const spy = vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({ action: null }),
      });

      await analyzer.getNextAction(mockScreenshot, 'Test', [], 'state');

      const callArgs = spy.mock.calls[0];
      const messages = JSON.stringify(callArgs[0]);
      expect(messages).toContain('None');
    });

    it('should return null on error', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockRejectedValue(
        new Error('API error'),
      );

      const result = await analyzer.getNextAction(
        mockScreenshot,
        'Test',
        [],
        'state',
      );

      expect(result).toBeNull();
    });

    it('should handle different action types', async () => {
      const provider = (analyzer as any).provider;

      const actionTypes = [
        'click',
        'type',
        'scroll',
        'keyPress',
        'drag',
        'wait',
        'doubleClick',
        'moveCursor',
      ];

      for (const actionType of actionTypes) {
        vi.spyOn(provider, 'generateResponse').mockResolvedValue({
          content: JSON.stringify({
            action: actionType,
            description: `Perform ${actionType}`,
            params: {},
            confidence: 0.8,
          }),
        });

        const result = await analyzer.getNextAction(
          mockScreenshot,
          'Test',
          [],
          'state',
        );

        expect(result!.action).toBe(actionType);
      }
    });

    it('should parse JSON from markdown code blocks', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content:
          '```json\n{"action": "click", "description": "Click", "params": {"x": 100, "y": 100}, "confidence": 0.9}\n```',
      });

      const result = await analyzer.getNextAction(
        mockScreenshot,
        'Test',
        [],
        'state',
      );

      expect(result).not.toBeNull();
      expect(result!.action).toBe('click');
    });

    it('should handle missing optional fields', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          action: 'click',
          // Missing description, params, confidence
        }),
      });

      const result = await analyzer.getNextAction(
        mockScreenshot,
        'Test',
        [],
        'state',
      );

      expect(result).not.toBeNull();
      expect(result!.action).toBe('click');
      expect(result!.description).toBe('');
      expect(result!.params).toEqual({});
      expect(result!.confidence).toBe(0.5);
    });
  });

  describe('isTaskComplete', () => {
    it('should return completion status when task is complete', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          complete: true,
          confidence: 0.95,
          reason: 'Document saved successfully',
        }),
      });

      const result = await analyzer.isTaskComplete(
        mockScreenshot,
        'Save document',
        'Document should be saved',
      );

      expect(result.complete).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.reason).toBe('Document saved successfully');
    });

    it('should return false when task is not complete', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({
          complete: false,
          confidence: 0.8,
          reason: 'Save button not yet clicked',
        }),
      });

      const result = await analyzer.isTaskComplete(
        mockScreenshot,
        'Save document',
        'Document should be saved',
      );

      expect(result.complete).toBe(false);
      expect(result.reason).toBe('Save button not yet clicked');
    });

    it('should handle analysis failure', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockRejectedValue(
        new Error('API error'),
      );

      const result = await analyzer.isTaskComplete(
        mockScreenshot,
        'Test',
        'Expected outcome',
      );

      expect(result.complete).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe('Analysis failed');
    });

    it('should parse JSON with markdown code blocks', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content:
          '```json\n{"complete": true, "confidence": 1.0, "reason": "Done"}\n```',
      });

      const result = await analyzer.isTaskComplete(
        mockScreenshot,
        'Test',
        'Expected',
      );

      expect(result.complete).toBe(true);
    });

    it('should handle missing fields with defaults', async () => {
      const provider = (analyzer as any).provider;
      vi.spyOn(provider, 'generateResponse').mockResolvedValue({
        content: JSON.stringify({}),
      });

      const result = await analyzer.isTaskComplete(
        mockScreenshot,
        'Test',
        'Expected',
      );

      expect(result.complete).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe('Unable to determine');
    });
  });

  describe('parseJsonResponse', () => {
    it('should parse plain JSON', () => {
      const json = '{"key": "value"}';
      const result = (analyzer as any).parseJsonResponse(json);
      expect(result.key).toBe('value');
    });

    it('should extract JSON from code blocks with json tag', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = (analyzer as any).parseJsonResponse(markdown);
      expect(result.key).toBe('value');
    });

    it('should extract JSON from code blocks without tag', () => {
      const markdown = '```\n{"key": "value"}\n```';
      const result = (analyzer as any).parseJsonResponse(markdown);
      expect(result.key).toBe('value');
    });

    it('should extract JSON from text with surrounding content', () => {
      const text = 'Here is the result: {"key": "value"} done';
      const result = (analyzer as any).parseJsonResponse(text);
      expect(result.key).toBe('value');
    });

    it('should throw on invalid JSON', () => {
      const invalid = 'not json at all';
      expect(() => {
        (analyzer as any).parseJsonResponse(invalid);
      }).toThrow();
    });

    it('should handle nested objects', () => {
      const json = '{"outer": {"inner": "value"}}';
      const result = (analyzer as any).parseJsonResponse(json);
      expect(result.outer.inner).toBe('value');
    });

    it('should handle arrays', () => {
      const json = '{"items": [1, 2, 3]}';
      const result = (analyzer as any).parseJsonResponse(json);
      expect(result.items).toEqual([1, 2, 3]);
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build system prompt', () => {
      const prompt = (analyzer as any).buildSystemPrompt();
      expect(prompt).toContain('computer vision');
      expect(prompt).toContain('screenshots');
      expect(prompt).toContain('JSON format');
    });
  });

  describe('buildAnalysisPrompt', () => {
    it('should build prompt with task', () => {
      const prompt = (analyzer as any).buildAnalysisPrompt('Save document', []);
      expect(prompt).toContain('Save document');
    });

    it('should include previous actions', () => {
      const previousActions = ['click: {"x": 100}', 'type: {"text": "test"}'];
      const prompt = (analyzer as any).buildAnalysisPrompt(
        'Test',
        previousActions,
      );
      expect(prompt).toContain('Previous actions');
      expect(prompt).toContain('click');
      expect(prompt).toContain('type');
    });

    it('should handle empty previous actions', () => {
      const prompt = (analyzer as any).buildAnalysisPrompt('Test', []);
      expect(prompt).not.toContain('Previous actions');
    });

    it('should request JSON format', () => {
      const prompt = (analyzer as any).buildAnalysisPrompt('Test', []);
      expect(prompt).toContain('JSON');
    });
  });
});

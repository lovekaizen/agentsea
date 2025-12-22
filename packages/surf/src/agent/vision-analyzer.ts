/**
 * Vision Analyzer - Screen analysis using Claude's vision capabilities
 */

import { AnthropicProvider } from '@lov3kaizen/agentsea-core';

import type {
  ScreenshotResult,
  VisionConfig,
  ScreenAnalysis,
  SuggestedAction,
  UIElement as _UIElement,
} from '../types';

/**
 * Vision Analyzer for screen analysis using Claude's vision capabilities
 */
export class VisionAnalyzer {
  private provider: AnthropicProvider;
  private config: VisionConfig;

  constructor(config: VisionConfig, apiKey?: string) {
    this.config = config;
    this.provider = new AnthropicProvider(apiKey);
  }

  /**
   * Analyze a screenshot and extract UI elements and suggested actions
   */
  async analyzeScreen(
    screenshot: ScreenshotResult,
    task: string,
    previousActions: string[] = [],
  ): Promise<ScreenAnalysis> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildAnalysisPrompt(task, previousActions);

    try {
      const response = await this.provider.generateResponse(
        [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: screenshot.mimeType,
                  data: screenshot.base64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        {
          model: this.config.model,
          maxTokens: this.config.maxTokens,
          systemPrompt,
        },
      );

      return this.parseAnalysisResponse(response.content);
    } catch (error) {
      // Return a minimal analysis on error
      return {
        description: 'Failed to analyze screen',
        elements: [],
        suggestedActions: [],
        currentState: 'unknown',
      };
    }
  }

  /**
   * Get the next action based on screen analysis and task
   */
  async getNextAction(
    screenshot: ScreenshotResult,
    task: string,
    previousActions: string[],
    currentState: string,
  ): Promise<SuggestedAction | null> {
    const systemPrompt = `You are an AI assistant that determines the next action to take to accomplish a task on a computer.

Based on the current screen state and the task at hand, determine the single best next action to take.

You must respond with a JSON object containing:
{
  "action": "click" | "type" | "scroll" | "keyPress" | "drag" | "wait" | "doubleClick" | "moveCursor",
  "description": "what this action accomplishes",
  "params": { action-specific parameters },
  "confidence": 0.0-1.0,
  "reasoning": "why this action is the best choice"
}

Action parameters:
- click: { x: number, y: number, button?: "left"|"right", clickType?: "single"|"double" }
- type: { text: string, x?: number, y?: number, clearFirst?: boolean }
- scroll: { direction: "up"|"down"|"left"|"right", x: number, y: number, amount?: number }
- keyPress: { key: string, modifiers?: ["ctrl"|"alt"|"shift"|"meta"][] }
- drag: { fromX: number, fromY: number, toX: number, toY: number }
- wait: { ms: number, reason: string }
- doubleClick: { x: number, y: number }
- moveCursor: { x: number, y: number }

If the task appears complete, respond with:
{ "action": null, "description": "Task complete", "reasoning": "explanation" }`;

    const userPrompt = `Task: ${task}

Current state: ${currentState}

Previous actions taken:
${previousActions.length > 0 ? previousActions.map((a, i) => `${i + 1}. ${a}`).join('\n') : 'None'}

Analyze the screenshot and determine the next best action to accomplish the task.`;

    try {
      const response = await this.provider.generateResponse(
        [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: screenshot.mimeType,
                  data: screenshot.base64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        {
          model: this.config.model,
          maxTokens: 1024,
          systemPrompt,
        },
      );

      const parsed = this.parseJsonResponse(response.content);

      if (!parsed.action) {
        return null; // Task complete
      }

      return {
        action: parsed.action as
          | 'click'
          | 'type'
          | 'scroll'
          | 'keyPress'
          | 'drag'
          | 'wait'
          | 'doubleClick'
          | 'moveCursor',
        description: (parsed.description as string) || '',
        params: (parsed.params as Record<string, unknown>) || {},
        confidence: (parsed.confidence as number) || 0.5,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Determine if the task is complete based on screen state
   */
  async isTaskComplete(
    screenshot: ScreenshotResult,
    task: string,
    expectedOutcome: string,
  ): Promise<{ complete: boolean; confidence: number; reason: string }> {
    const systemPrompt = `You are analyzing a screenshot to determine if a task has been completed.

Respond with a JSON object:
{
  "complete": boolean,
  "confidence": 0.0-1.0,
  "reason": "explanation of why the task is or is not complete"
}`;

    const userPrompt = `Task: ${task}
Expected outcome: ${expectedOutcome}

Analyze the screenshot and determine if the task appears to be complete.`;

    try {
      const response = await this.provider.generateResponse(
        [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: screenshot.mimeType,
                  data: screenshot.base64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        {
          model: this.config.model,
          maxTokens: 512,
          systemPrompt,
        },
      );

      const parsed = this.parseJsonResponse(response.content);
      return {
        complete: (parsed.complete as boolean) || false,
        confidence: (parsed.confidence as number) || 0,
        reason: (parsed.reason as string) || 'Unable to determine',
      };
    } catch {
      return { complete: false, confidence: 0, reason: 'Analysis failed' };
    }
  }

  /**
   * Build the system prompt for screen analysis
   */
  private buildSystemPrompt(): string {
    return `You are a computer vision AI assistant analyzing screenshots of a computer screen.

Your task is to:
1. Describe what you see on the screen
2. Identify clickable UI elements with their approximate coordinates
3. Suggest the next action to take to accomplish the given task
4. Determine if the task appears complete

When identifying UI elements:
- Provide coordinates for the CENTER of each element
- Include element type (button, input, link, etc.)
- Include any visible text/label
- Rate your confidence (0.0-1.0) in the identification

When suggesting actions:
- Consider the current screen state and task goal
- Choose the most direct path to accomplish the task
- Account for previous actions already taken

Respond in JSON format for structured analysis.`;
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(task: string, previousActions: string[]): string {
    let prompt = `Task to accomplish: ${task}\n\n`;

    if (previousActions.length > 0) {
      prompt += `Previous actions taken:\n`;
      previousActions.forEach((action, i) => {
        prompt += `${i + 1}. ${action}\n`;
      });
      prompt += '\n';
    }

    prompt += `Analyze this screenshot and provide:
1. A description of the current screen state
2. Key UI elements with their coordinates (x, y for center point)
3. The recommended next action to progress toward the task
4. Whether the task appears to be complete

Respond in JSON format:
{
  "description": "description of current screen",
  "elements": [
    {
      "type": "button|input|link|text|image|menu|window|other",
      "label": "element text",
      "clickPoint": { "x": number, "y": number },
      "confidence": 0.0-1.0
    }
  ],
  "suggestedActions": [
    {
      "action": "click|type|scroll|keyPress|drag|wait",
      "description": "what this accomplishes",
      "params": { /* action parameters */ },
      "confidence": 0.0-1.0
    }
  ],
  "currentState": "description of application state",
  "taskComplete": false
}`;

    return prompt;
  }

  /**
   * Parse analysis response into structured format
   */
  private parseAnalysisResponse(content: string): ScreenAnalysis {
    try {
      const parsed = this.parseJsonResponse(content);
      const elements = parsed.elements as
        | Array<Record<string, unknown>>
        | undefined;
      const suggestedActions = parsed.suggestedActions as
        | Array<Record<string, unknown>>
        | undefined;

      return {
        description: (parsed.description as string) || content,
        elements: (elements || []).map((e: Record<string, unknown>) => ({
          type:
            (e.type as
              | 'button'
              | 'input'
              | 'link'
              | 'text'
              | 'image'
              | 'menu'
              | 'window'
              | 'checkbox'
              | 'dropdown'
              | 'other') || 'other',
          label: e.label as string | undefined,
          boundingBox: e.boundingBox as
            | { x: number; y: number; width: number; height: number }
            | undefined,
          clickPoint: e.clickPoint as { x: number; y: number } | undefined,
          confidence: (e.confidence as number) || 0.5,
        })),
        suggestedActions: (suggestedActions || []).map(
          (a: Record<string, unknown>) => ({
            action: a.action as
              | 'click'
              | 'type'
              | 'scroll'
              | 'keyPress'
              | 'drag'
              | 'wait'
              | 'doubleClick'
              | 'moveCursor',
            description: (a.description as string) || '',
            params: (a.params as Record<string, unknown>) || {},
            confidence: (a.confidence as number) || 0.5,
          }),
        ),
        currentState: (parsed.currentState as string) || 'unknown',
      };
    } catch {
      return {
        description: content,
        elements: [],
        suggestedActions: [],
        currentState: 'unknown',
      };
    }
  }

  /**
   * Parse JSON from response (handles markdown code blocks)
   */
  private parseJsonResponse(content: string): Record<string, unknown> {
    // Try to extract JSON from markdown code blocks
    const jsonMatch =
      content.match(/```json\n?([\s\S]*?)\n?```/) ||
      content.match(/```\n?([\s\S]*?)\n?```/) ||
      content.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      return JSON.parse(jsonStr);
    }

    return JSON.parse(content);
  }
}

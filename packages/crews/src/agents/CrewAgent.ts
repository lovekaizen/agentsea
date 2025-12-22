/**
 * CrewAgent
 *
 * Enhanced agent with crew capabilities, role-based behavior,
 * and collaboration features.
 */

import { nanoid } from 'nanoid';
import type {
  CrewAgentConfig,
  Capability,
  CapabilityMatch,
  TaskConfig,
  TaskResult,
} from '../types';
import { Role } from '../core/Role';
import type { ExecutionContext } from '../core/ExecutionContext';
import { AgentCapabilities, type CapableAgent } from './AgentCapabilities';

/**
 * Task bid from an agent
 */
export interface TaskBid {
  agentName: string;
  taskId: string;
  confidence: number;
  estimatedTime?: number;
  reasoning: string;
  capabilities: string[];
}

/**
 * Help request from an agent
 */
export interface HelpRequest {
  requestId: string;
  fromAgent: string;
  taskId: string;
  request: string;
  context?: Record<string, unknown>;
}

/**
 * Help response to an agent
 */
export interface HelpResponse {
  requestId: string;
  fromAgent: string;
  response: string;
  helpful: boolean;
}

/**
 * Agent execution result
 */
export interface AgentExecutionResult {
  output: string;
  tokensUsed: number;
  latencyMs: number;
  iterations: number;
  toolCalls?: Array<{ tool: string; input: unknown; result: unknown }>;
}

/**
 * CrewAgent configuration
 */
export interface CrewAgentOptions {
  /** Agent configuration */
  config: CrewAgentConfig;
  /** Execute function (provided by actual LLM integration) */
  execute?: (
    input: string,
    systemPrompt: string,
  ) => Promise<AgentExecutionResult>;
}

/**
 * Enhanced agent with crew capabilities
 */
export class CrewAgent implements CapableAgent {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly capabilities: Capability[];
  readonly model: string;
  readonly provider: string;
  readonly tools: string[];
  readonly temperature: number;
  readonly maxTokens?: number;
  readonly maxIterations: number;
  readonly parallelCapable: boolean;

  private executeFunc?: (
    input: string,
    systemPrompt: string,
  ) => Promise<AgentExecutionResult>;
  private currentTaskId?: string;
  private tasksCompleted: number = 0;
  private tasksFailed: number = 0;
  private totalTokensUsed: number = 0;

  constructor(options: CrewAgentOptions) {
    const { config, execute } = options;

    this.id = nanoid();
    this.name = config.name;
    this.role = new Role(config.role);
    this.capabilities = config.role.capabilities;
    this.model = config.model;
    this.provider = config.provider;
    this.tools = config.tools ?? this.role.getRequiredTools();
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens;
    this.maxIterations = config.maxIterations ?? 10;
    this.parallelCapable = config.parallelCapable ?? false;
    this.executeFunc = execute;
  }

  // ============ Execution ============

  /**
   * Execute a task
   */
  async execute(input: string): Promise<AgentExecutionResult> {
    if (!this.executeFunc) {
      // Return mock result if no execute function provided
      return {
        output: `[Mock response from ${this.name}]: ${input.slice(0, 100)}...`,
        tokensUsed: Math.floor(Math.random() * 500) + 100,
        latencyMs: Math.floor(Math.random() * 2000) + 500,
        iterations: 1,
      };
    }

    const systemPrompt = this.role.generateSystemPrompt();
    const result = await this.executeFunc(input, systemPrompt);

    this.totalTokensUsed += result.tokensUsed;
    return result;
  }

  /**
   * Execute with task context
   */
  async executeTask(task: TaskConfig): Promise<TaskResult> {
    this.currentTaskId = task.id;

    try {
      const input = this.formatTaskInput(task);
      const result = await this.execute(input);

      this.tasksCompleted++;

      return {
        output: result.output,
        completedAt: new Date(),
        completedBy: this.name,
        iterations: result.iterations,
        tokensUsed: result.tokensUsed,
        metadata: {
          latencyMs: result.latencyMs,
          toolCalls: result.toolCalls,
        },
      };
    } catch (error) {
      this.tasksFailed++;
      throw error;
    } finally {
      this.currentTaskId = undefined;
    }
  }

  /**
   * Format task input for the agent
   */
  private formatTaskInput(task: TaskConfig): string {
    const parts: string[] = [];

    parts.push(`# Task: ${task.description}`);
    parts.push(`\n## Expected Output:\n${task.expectedOutput}`);

    if (task.context && Object.keys(task.context).length > 0) {
      parts.push(`\n## Context:\n${JSON.stringify(task.context, null, 2)}`);
    }

    if (task.deadline) {
      parts.push(`\n## Deadline: ${task.deadline.toISOString()}`);
    }

    return parts.join('\n');
  }

  // ============ Capability Matching ============

  /**
   * Check if agent has a specific capability
   */
  hasCapability(name: string): boolean {
    return this.role.hasCapability(name);
  }

  /**
   * Get proficiency score for a capability
   */
  getProficiencyScore(name: string): number {
    return this.role.getProficiencyScore(name);
  }

  /**
   * Match required capabilities
   */
  matchesCapabilities(required: Capability[]): CapabilityMatch {
    return AgentCapabilities.match(required, this.capabilities);
  }

  /**
   * Calculate suitability score for a task
   */
  calculateTaskScore(task: TaskConfig): number {
    return AgentCapabilities.calculateAgentScore(this, task);
  }

  // ============ Bidding ============

  /**
   * Generate a bid for a task
   */
  bidOnTask(task: TaskConfig): Promise<TaskBid> {
    const score = this.calculateTaskScore(task);
    const hasRequired = this.hasRequiredCapabilities(task);

    // Calculate confidence based on capability match
    let confidence = score;

    // Reduce confidence if some capabilities are missing
    if (!hasRequired) {
      confidence *= 0.5;
    }

    // Factor in current workload
    if (this.currentTaskId) {
      confidence *= 0.7; // Reduce if already busy
    }

    // Get matched capabilities
    const matchedCaps = this.capabilities
      .filter(
        (c) =>
          task.requiredCapabilities?.some(
            (req) => req.toLowerCase() === c.name.toLowerCase(),
          ) ?? true,
      )
      .map((c) => c.name);

    // Estimate time based on task complexity
    const estimatedTime = this.estimateTaskTime(task);

    // Generate reasoning
    const reasoning = this.generateBidReasoning(task, confidence, matchedCaps);

    return Promise.resolve({
      agentName: this.name,
      taskId: task.id ?? 'unknown',
      confidence,
      estimatedTime,
      reasoning,
      capabilities: matchedCaps,
    });
  }

  /**
   * Check if agent has all required capabilities
   */
  private hasRequiredCapabilities(task: TaskConfig): boolean {
    if (!task.requiredCapabilities || task.requiredCapabilities.length === 0) {
      return true;
    }

    for (const required of task.requiredCapabilities) {
      if (!this.hasCapability(required)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Estimate time to complete a task
   */
  private estimateTaskTime(task: TaskConfig): number {
    // Base estimate: 30 seconds
    let estimate = 30000;

    // Add time based on expected output length
    const outputWords = task.expectedOutput.split(' ').length;
    estimate += outputWords * 100; // 100ms per expected output word

    // Add time for required capabilities
    estimate += (task.requiredCapabilities?.length ?? 0) * 5000;

    return estimate;
  }

  /**
   * Generate reasoning for a bid
   */
  private generateBidReasoning(
    task: TaskConfig,
    confidence: number,
    matchedCaps: string[],
  ): string {
    const parts: string[] = [];

    if (matchedCaps.length > 0) {
      parts.push(`I have relevant capabilities: ${matchedCaps.join(', ')}`);
    }

    if (confidence > 0.8) {
      parts.push('I am highly suited for this task');
    } else if (confidence > 0.5) {
      parts.push('I can handle this task adequately');
    } else {
      parts.push('This task is outside my primary expertise');
    }

    if (this.currentTaskId) {
      parts.push('Note: I am currently working on another task');
    }

    return parts.join('. ') + '.';
  }

  // ============ Collaboration ============

  /**
   * Create a help request
   */
  createHelpRequest(taskId: string, request: string): HelpRequest {
    return {
      requestId: nanoid(),
      fromAgent: this.name,
      taskId,
      request,
    };
  }

  /**
   * Respond to a help request
   */
  async respondToHelpRequest(request: HelpRequest): Promise<HelpResponse> {
    // Generate a helpful response based on the request
    const input = `
Another agent needs help with their task.

Their request: ${request.request}

Please provide a helpful response based on your expertise as a ${this.role.name}.
`;

    const result = await this.execute(input);

    return {
      requestId: request.requestId,
      fromAgent: this.name,
      response: result.output,
      helpful: true,
    };
  }

  /**
   * Provide help for a task (called by CollaborationManager)
   */
  async provideHelp(
    task: TaskConfig,
    question: string,
    _context: ExecutionContext,
  ): Promise<{ helpful: boolean; response: string; suggestions?: string[] }> {
    // Check if we can help with this task
    const score = this.calculateTaskScore(task);
    const canHelp = score > 0.3;

    if (!canHelp) {
      return {
        helpful: false,
        response: `I may not be the best agent to help with this. My expertise in ${this.role.name} might not be directly applicable.`,
      };
    }

    // Generate helpful response
    const input = `
# Help Request

## Task Context:
${task.description}

## Question:
${question}

## Your Role:
You are a ${this.role.name}. ${this.role.description}

Please provide helpful guidance based on your expertise.
`;

    try {
      const result = await this.execute(input);

      // Extract suggestions if present
      const suggestions = this.extractSuggestions(result.output);

      return {
        helpful: true,
        response: result.output,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };
    } catch (error) {
      return {
        helpful: false,
        response: `I encountered an error while trying to help: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Extract suggestions from help response
   */
  private extractSuggestions(response: string): string[] {
    const suggestions: string[] = [];

    // Look for numbered lists
    const numberPattern = /^\d+\.\s+(.+)$/gm;
    let match;
    while ((match = numberPattern.exec(response)) !== null) {
      suggestions.push(match[1].trim());
    }

    // Look for bullet points
    const bulletPattern = /^[-*]\s+(.+)$/gm;
    while ((match = bulletPattern.exec(response)) !== null) {
      suggestions.push(match[1].trim());
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  // ============ State ============

  /**
   * Check if agent is busy
   */
  get isBusy(): boolean {
    return this.currentTaskId !== undefined;
  }

  /**
   * Get current task ID
   */
  getCurrentTask(): string | undefined {
    return this.currentTaskId;
  }

  /**
   * Get agent statistics
   */
  getStats(): CrewAgentStats {
    return {
      name: this.name,
      role: this.role.name,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      totalTokensUsed: this.totalTokensUsed,
      successRate:
        this.tasksCompleted + this.tasksFailed > 0
          ? this.tasksCompleted / (this.tasksCompleted + this.tasksFailed)
          : 0,
      isBusy: this.isBusy,
      currentTask: this.currentTaskId,
    };
  }

  // ============ Serialization ============

  /**
   * Convert to config
   */
  toConfig(): CrewAgentConfig {
    return {
      name: this.name,
      role: this.role.toJSON(),
      model: this.model,
      provider: this.provider,
      tools: this.tools.length > 0 ? this.tools : undefined,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      maxIterations: this.maxIterations,
      parallelCapable: this.parallelCapable,
    };
  }

  /**
   * Create from config
   */
  static fromConfig(config: CrewAgentConfig): CrewAgent {
    return new CrewAgent({ config });
  }
}

/**
 * Agent statistics
 */
export interface CrewAgentStats {
  name: string;
  role: string;
  tasksCompleted: number;
  tasksFailed: number;
  totalTokensUsed: number;
  successRate: number;
  isBusy: boolean;
  currentTask?: string;
}

/**
 * Factory function for creating crew agents
 */
export function createCrewAgent(options: CrewAgentOptions): CrewAgent {
  return new CrewAgent(options);
}

export default CrewAgent;

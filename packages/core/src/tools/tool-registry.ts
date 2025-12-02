import { Tool, ToolCall, ToolContext } from '../types';

/**
 * Registry for managing and executing tools
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools
   */
  registerMany(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall: ToolCall, context: ToolContext): Promise<any> {
    const tool = this.tools.get(toolCall.tool);

    if (!tool) {
      throw new Error(`Tool '${toolCall.tool}' not found`);
    }

    // Validate parameters
    try {
      const validatedParams = tool.parameters.parse(toolCall.parameters);

      // Execute with retry logic if configured
      if (tool.retryConfig) {
        return await this.executeWithRetry(
          () => tool.execute(validatedParams, context),
          tool.retryConfig,
        );
      }

      return await tool.execute(validatedParams, context);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Tool execution failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Execute a function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: Required<Tool>['retryConfig'],
  ): Promise<T> {
    if (!config) {
      return fn();
    }

    let lastError: Error | undefined;
    const {
      maxAttempts,
      backoff,
      initialDelayMs = 1000,
      maxDelayMs = 30000,
    } = config;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (
          config.retryableErrors &&
          !config.retryableErrors.includes(lastError.message)
        ) {
          throw lastError;
        }

        // Don't wait after last attempt
        if (attempt < maxAttempts - 1) {
          const delay = this.calculateDelay(
            attempt,
            backoff,
            initialDelayMs,
            maxDelayMs,
          );
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Tool execution failed after retries');
  }

  /**
   * Calculate backoff delay
   */
  private calculateDelay(
    attempt: number,
    strategy: 'linear' | 'exponential',
    initialDelay: number,
    maxDelay: number,
  ): number {
    let delay: number;

    if (strategy === 'exponential') {
      delay = initialDelay * Math.pow(2, attempt);
    } else {
      delay = initialDelay * (attempt + 1);
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

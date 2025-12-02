import { z } from 'zod';

/**
 * Conversation turn representing a single message exchange
 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Conversation state that can be tracked throughout the flow
 */
export interface ConversationState {
  currentStep: string;
  data: Record<string, any>;
  history: ConversationTurn[];
  metadata: Record<string, any>;
}

/**
 * Step in a conversation flow
 */
export interface ConversationStep {
  id: string;
  prompt: string;
  schema?: z.ZodSchema;
  next?: string | ((response: any, state: ConversationState) => string);
  onComplete?: (
    response: any,
    state: ConversationState,
  ) => void | Promise<void>;
  validation?: (response: any) => boolean | Promise<boolean>;
  errorMessage?: string;
  maxRetries?: number;
}

/**
 * Configuration for conversation schema
 */
export interface ConversationSchemaConfig {
  name: string;
  description?: string;
  startStep: string;
  steps: ConversationStep[];
  onComplete?: (state: ConversationState) => void | Promise<void>;
  onError?: (error: Error, state: ConversationState) => void | Promise<void>;
}

/**
 * ConversationSchema allows users to define structured conversation flows
 * with validation, state management, and dynamic routing.
 *
 * @example
 * ```ts
 * const bookingSchema = new ConversationSchema({
 *   name: 'hotel-booking',
 *   startStep: 'ask-destination',
 *   steps: [
 *     {
 *       id: 'ask-destination',
 *       prompt: 'Where would you like to stay?',
 *       schema: z.object({ destination: z.string() }),
 *       next: 'ask-dates',
 *     },
 *     {
 *       id: 'ask-dates',
 *       prompt: 'What are your check-in and check-out dates?',
 *       schema: z.object({
 *         checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 *         checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 *       }),
 *       validation: (response) => {
 *         return new Date(response.checkOut) > new Date(response.checkIn);
 *       },
 *       next: 'confirm',
 *     },
 *     {
 *       id: 'confirm',
 *       prompt: 'Please confirm your booking.',
 *       next: null,
 *     },
 *   ],
 * });
 * ```
 */
export class ConversationSchema {
  private config: ConversationSchemaConfig;
  private state: ConversationState;

  constructor(config: ConversationSchemaConfig) {
    this.config = config;
    this.state = {
      currentStep: config.startStep,
      data: {},
      history: [],
      metadata: {},
    };
  }

  /**
   * Get the current conversation state
   */
  getState(): ConversationState {
    return { ...this.state };
  }

  /**
   * Reset conversation to initial state
   */
  reset(): void {
    this.state = {
      currentStep: this.config.startStep,
      data: {},
      history: [],
      metadata: {},
    };
  }

  /**
   * Get the current step
   */
  getCurrentStep(): ConversationStep | undefined {
    return this.config.steps.find((step) => step.id === this.state.currentStep);
  }

  /**
   * Process user response and advance conversation
   */
  async processResponse(userResponse: string): Promise<{
    success: boolean;
    message?: string;
    nextPrompt?: string;
    isComplete: boolean;
    state: ConversationState;
  }> {
    const currentStep = this.getCurrentStep();

    if (!currentStep) {
      return {
        success: false,
        message: 'Invalid conversation state',
        isComplete: true,
        state: this.state,
      };
    }

    // Add user response to history
    this.state.history.push({
      role: 'user',
      content: userResponse,
      timestamp: new Date(),
    });

    try {
      // Parse and validate response
      let parsedResponse: any = userResponse;

      if (currentStep.schema) {
        try {
          parsedResponse = currentStep.schema.parse(JSON.parse(userResponse));
        } catch (error) {
          // If JSON parse fails, try to extract data from natural language
          parsedResponse = this.extractDataFromResponse(
            userResponse,
            currentStep.schema,
          );
        }
      }

      // Custom validation
      if (currentStep.validation) {
        const isValid = await currentStep.validation(parsedResponse);
        if (!isValid) {
          return {
            success: false,
            message:
              currentStep.errorMessage || 'Invalid response. Please try again.',
            nextPrompt: currentStep.prompt,
            isComplete: false,
            state: this.state,
          };
        }
      }

      // Store extracted data
      this.state.data[currentStep.id] = parsedResponse;

      // Call onComplete callback
      if (currentStep.onComplete) {
        await currentStep.onComplete(parsedResponse, this.state);
      }

      // Determine next step
      let nextStepId: string | null = null;

      if (typeof currentStep.next === 'function') {
        nextStepId = currentStep.next(parsedResponse, this.state);
      } else {
        nextStepId = currentStep.next || null;
      }

      // Check if conversation is complete
      if (!nextStepId) {
        if (this.config.onComplete) {
          await this.config.onComplete(this.state);
        }

        return {
          success: true,
          isComplete: true,
          state: this.state,
        };
      }

      // Move to next step
      this.state.currentStep = nextStepId;
      const nextStep = this.getCurrentStep();

      if (!nextStep) {
        return {
          success: false,
          message: 'Invalid next step',
          isComplete: true,
          state: this.state,
        };
      }

      // Add assistant prompt to history
      this.state.history.push({
        role: 'assistant',
        content: nextStep.prompt,
        timestamp: new Date(),
      });

      return {
        success: true,
        nextPrompt: nextStep.prompt,
        isComplete: false,
        state: this.state,
      };
    } catch (error) {
      if (this.config.onError) {
        await this.config.onError(error as Error, this.state);
      }

      return {
        success: false,
        message: `Error processing response: ${(error as Error).message}`,
        isComplete: false,
        state: this.state,
      };
    }
  }

  /**
   * Extract structured data from natural language response
   * This is a simple implementation - you can enhance it with LLM-based extraction
   */
  private extractDataFromResponse(response: string, _schema: z.ZodSchema): any {
    // For now, just return the response
    // In a real implementation, you would use an LLM to extract structured data
    return response;
  }

  /**
   * Get conversation history as formatted string
   */
  getFormattedHistory(): string {
    return this.state.history
      .map((turn) => `${turn.role}: ${turn.content}`)
      .join('\n\n');
  }

  /**
   * Export conversation state to JSON
   */
  exportState(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import conversation state from JSON
   */
  importState(stateJson: string): void {
    this.state = JSON.parse(stateJson);
  }
}

/**
 * Builder for creating conversation schemas with fluent API
 */
export class ConversationSchemaBuilder {
  private config: Partial<ConversationSchemaConfig> = {
    steps: [],
  };

  name(name: string): this {
    this.config.name = name;
    return this;
  }

  description(description: string): this {
    this.config.description = description;
    return this;
  }

  startAt(stepId: string): this {
    this.config.startStep = stepId;
    return this;
  }

  addStep(step: ConversationStep): this {
    this.config.steps!.push(step);
    return this;
  }

  onComplete(
    callback: (state: ConversationState) => void | Promise<void>,
  ): this {
    this.config.onComplete = callback;
    return this;
  }

  onError(
    callback: (error: Error, state: ConversationState) => void | Promise<void>,
  ): this {
    this.config.onError = callback;
    return this;
  }

  build(): ConversationSchema {
    if (!this.config.name) {
      throw new Error('Conversation name is required');
    }

    if (!this.config.startStep) {
      throw new Error('Start step is required');
    }

    if (!this.config.steps || this.config.steps.length === 0) {
      throw new Error('At least one step is required');
    }

    return new ConversationSchema(this.config as ConversationSchemaConfig);
  }
}

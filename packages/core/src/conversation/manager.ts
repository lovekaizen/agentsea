import {
  ConversationSchema,
  ConversationState,
  ConversationTurn,
} from './schema';
import { Agent } from '../agent/agent';

/**
 * Conversation manager integrates ConversationSchema with Agent
 * to enable structured conversational flows with AI assistance
 */
export class ConversationManager {
  private agent: Agent;
  private schema: ConversationSchema;
  private conversationId: string;

  constructor(
    agent: Agent,
    schema: ConversationSchema,
    conversationId?: string,
  ) {
    this.agent = agent;
    this.schema = schema;
    this.conversationId = conversationId || `conv-${Date.now()}`;
  }

  /**
   * Start or resume conversation
   */
  start(): {
    prompt: string;
    state: ConversationState;
  } {
    const currentStep = this.schema.getCurrentStep();

    if (!currentStep) {
      throw new Error('Invalid conversation state');
    }

    return {
      prompt: currentStep.prompt,
      state: this.schema.getState(),
    };
  }

  /**
   * Process user message with AI assistance
   */
  async processMessage(userMessage: string): Promise<{
    response: string;
    isComplete: boolean;
    state: ConversationState;
    aiResponse?: string;
  }> {
    const state = this.schema.getState();

    // Use AI to help extract structured data or understand intent
    const aiPrompt = this.buildAIPrompt(userMessage, state);

    const aiResponse = await this.agent.execute(aiPrompt, {
      conversationId: this.conversationId,
      sessionData: { schemaState: state },
      history: state.history.map((turn) => ({
        role: turn.role,
        content: turn.content,
      })),
    });

    // Process the response through the schema
    const result = await this.schema.processResponse(userMessage);

    return {
      response: result.nextPrompt || 'Conversation complete',
      isComplete: result.isComplete,
      state: result.state,
      aiResponse: aiResponse.content,
    };
  }

  /**
   * Build AI prompt for understanding user intent
   */
  private buildAIPrompt(
    userMessage: string,
    _state: ConversationState,
  ): string {
    const currentStep = this.schema.getCurrentStep();

    return `You are helping with a structured conversation.

Current step: ${currentStep?.id}
Expected information: ${currentStep?.prompt}

User message: "${userMessage}"

Task: Analyze the user's message and extract any relevant information. If the message contains the needed information, format it appropriately. If it's unclear or missing information, ask for clarification.

Previous conversation:
${this.schema.getFormattedHistory()}

Respond naturally while ensuring you gather the required information.`;
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return this.schema.getState();
  }

  /**
   * Reset conversation to beginning
   */
  reset(): void {
    this.schema.reset();
  }

  /**
   * Get formatted conversation history
   */
  getHistory(): ConversationTurn[] {
    return this.schema.getState().history;
  }

  /**
   * Export conversation for persistence
   */
  export(): string {
    return this.schema.exportState();
  }

  /**
   * Import conversation from saved state
   */
  import(stateJson: string): void {
    this.schema.importState(stateJson);
  }
}

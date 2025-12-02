import { MemoryStore, Message, LLMProvider } from '../types';

/**
 * Summary memory that keeps recent messages and a summary of older ones
 */
export class SummaryMemory implements MemoryStore {
  private store = new Map<string, { summary: string; recent: Message[] }>();

  constructor(
    private provider: LLMProvider,
    private maxRecentMessages: number = 10,
    private summaryModel: string = 'claude-3-haiku-20240307',
  ) {}

  /**
   * Save messages with automatic summarization
   */
  async save(conversationId: string, messages: Message[]): Promise<void> {
    const existing = this.store.get(conversationId) || {
      summary: '',
      recent: [],
    };

    // If we have more messages than max, summarize the old ones
    if (messages.length > this.maxRecentMessages) {
      const toSummarize = messages.slice(0, -this.maxRecentMessages);
      const recent = messages.slice(-this.maxRecentMessages);

      // Create or update summary
      const newSummary = await this.createSummary(
        existing.summary,
        toSummarize,
      );

      this.store.set(conversationId, {
        summary: newSummary,
        recent,
      });
    } else {
      this.store.set(conversationId, {
        summary: existing.summary,
        recent: messages,
      });
    }
  }

  /**
   * Load messages (returns summary + recent messages)
   */
  load(conversationId: string): Promise<Message[]> {
    const data = this.store.get(conversationId);
    if (!data) {
      return Promise.resolve([]);
    }

    const messages: Message[] = [];

    // Add summary as a system message if it exists
    if (data.summary) {
      messages.push({
        role: 'system',
        content: `Previous conversation summary: ${data.summary}`,
      });
    }

    // Add recent messages
    messages.push(...data.recent);

    return Promise.resolve(messages);
  }

  /**
   * Clear conversation
   */
  clear(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
    return Promise.resolve();
  }

  /**
   * Create a summary of messages
   */
  private async createSummary(
    existingSummary: string,
    messages: Message[],
  ): Promise<string> {
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = existingSummary
      ? `Previous summary: ${existingSummary}\n\nNew messages:\n${conversationText}\n\nPlease create an updated summary that incorporates both the previous summary and the new messages. Be concise but comprehensive.`
      : `Please summarize the following conversation concisely:\n\n${conversationText}`;

    try {
      const response = await this.provider.generateResponse(
        [{ role: 'user', content: prompt }],
        {
          model: this.summaryModel,
          temperature: 0.3,
          maxTokens: 500,
        },
      );

      return response.content;
    } catch (error) {
      console.error('Failed to create summary:', error);
      // Fallback: just concatenate
      return existingSummary
        ? `${existingSummary}\n\n${conversationText}`
        : conversationText;
    }
  }
}

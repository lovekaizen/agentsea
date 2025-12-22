/**
 * BaseCollector
 *
 * Abstract base class for feedback collectors.
 */

import { nanoid } from 'nanoid';
import type {
  FeedbackEntry,
  FeedbackCollectorOptions,
  FeedbackStoreInterface,
} from '../../types/index.js';

/**
 * Abstract base class for feedback collectors
 */
export abstract class BaseCollector<TInput, TEntry extends FeedbackEntry> {
  protected store?: FeedbackStoreInterface;
  protected autoTimestamp: boolean;
  protected generateId: () => string;
  protected validateInput: boolean;

  constructor(options: FeedbackCollectorOptions = {}) {
    this.store = options.store;
    this.autoTimestamp = options.autoTimestamp ?? true;
    this.generateId = options.generateId ?? (() => nanoid());
    this.validateInput = options.validateInput ?? true;
  }

  /**
   * Collect feedback
   */
  async collect(input: TInput): Promise<TEntry> {
    // Validate input
    if (this.validateInput) {
      this.validate(input);
    }

    // Transform to entry
    const entry = this.transform(input);

    // Save to store if configured
    if (this.store) {
      await this.store.save(entry);
    }

    return entry;
  }

  /**
   * Collect multiple feedback entries
   */
  async collectBatch(inputs: TInput[]): Promise<TEntry[]> {
    const entries: TEntry[] = [];

    for (const input of inputs) {
      const entry = await this.collect(input);
      entries.push(entry);
    }

    return entries;
  }

  /**
   * Validate input
   */
  protected abstract validate(input: TInput): void;

  /**
   * Transform input to entry
   */
  protected abstract transform(input: TInput): TEntry;

  /**
   * Set the feedback store
   */
  setStore(store: FeedbackStoreInterface): void {
    this.store = store;
  }

  /**
   * Get the feedback store
   */
  getStore(): FeedbackStoreInterface | undefined {
    return this.store;
  }
}

import { describe, it, expect } from 'vitest';

import { generateId, createMessage } from '../types';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string');
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('produces unique-ish ids across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    // Allow a tiny chance of collision but expect near-uniqueness.
    expect(ids.size).toBeGreaterThan(95);
  });
});

describe('createMessage', () => {
  it('creates a message with id, role, content, and timestamp', () => {
    const msg = createMessage('user', 'hello');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('hello');
    expect(msg.id).toBeTruthy();
    expect(msg.createdAt).toBeInstanceOf(Date);
  });

  it('merges additional options', () => {
    const msg = createMessage('assistant', 'hi', {
      metadata: { tokensUsed: 42 },
    });
    expect(msg.metadata?.tokensUsed).toBe(42);
  });

  it('allows options to override defaults like id', () => {
    const msg = createMessage('user', 'x', { id: 'fixed-id' });
    expect(msg.id).toBe('fixed-id');
  });
});

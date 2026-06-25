import { describe, it, expect } from 'vitest';
import { LocalProvider } from '../providers/LocalProvider.js';

describe('LocalProvider', () => {
  it('requires an embedFn', () => {
    expect(() => new LocalProvider({ dimensions: 8 } as never)).toThrow(
      /embedFn/i,
    );
  });

  it('rejects modelPath (ONNX loading not implemented) with a clear error', () => {
    expect(
      () =>
        new LocalProvider({
          dimensions: 8,
          modelPath: '/models/m.onnx',
        } as never),
    ).toThrow(/not implemented/i);
  });

  it('embeds via a custom embedFn', async () => {
    const provider = new LocalProvider({
      dimensions: 3,
      normalize: false,
      embedFn: async (texts) => texts.map(() => [1, 2, 3]),
    });

    const result = await provider.embed('hello');
    expect(result.vector).toEqual([1, 2, 3]);
  });
});

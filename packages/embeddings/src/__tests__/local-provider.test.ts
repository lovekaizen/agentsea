import { describe, it, expect, vi, type Mock } from 'vitest';

vi.mock('../core/optional-import.js', () => ({
  importOptional: vi.fn(),
}));

import { LocalProvider } from '../providers/LocalProvider.js';
import { importOptional } from '../core/optional-import.js';

const importOptionalMock = importOptional as unknown as Mock;

describe('LocalProvider', () => {
  it('requires an embedFn or modelPath', () => {
    expect(() => new LocalProvider({ dimensions: 8 } as never)).toThrow(
      /embedFn|modelPath/i,
    );
  });

  it('loads an ONNX model from modelPath via Transformers.js', async () => {
    // Fake feature-extraction pipeline: returns a 2-D tensor-like for inputs.
    const extractor = vi.fn().mockResolvedValue({
      tolist: () => [[0.1, 0.2, 0.3]],
    });
    const pipeline = vi.fn().mockResolvedValue(extractor);
    importOptionalMock.mockResolvedValue({ pipeline });

    const provider = new LocalProvider({
      dimensions: 3,
      normalize: false,
      modelPath: 'Xenova/all-MiniLM-L6-v2',
    } as never);

    const result = await provider.embed('hello');

    expect(pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
    expect(result.vector).toEqual([0.1, 0.2, 0.3]);
  });

  it('surfaces a clear error when @xenova/transformers is missing', async () => {
    importOptionalMock.mockRejectedValue(new Error('Cannot find module'));
    const provider = new LocalProvider({
      dimensions: 3,
      modelPath: '/models/m.onnx',
    } as never);

    await expect(provider.embed('hello')).rejects.toThrow(
      /@xenova\/transformers/,
    );
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

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// onnx-proto is not a direct dependency of this package. It is reached through
// @xenova/transformers -> onnxruntime-web -> onnx-proto, and that is the chain the
// protobufjs override in the root package.json applies to. Resolve it the same way.
const req = createRequire(import.meta.url);
const xenovaRequire = createRequire(
  join(
    dirname(req.resolve('@xenova/transformers/package.json')),
    'package.json',
  ),
);
const ortRequire = createRequire(
  xenovaRequire.resolve('onnxruntime-web/package.json'),
);
const { onnx } = ortRequire('onnx-proto') as typeof import('onnx-proto');

function tensorType() {
  return onnx.TypeProto.create({
    tensorType: onnx.TypeProto.Tensor.create({
      elemType: onnx.TensorProto.DataType.FLOAT,
      shape: onnx.TensorShapeProto.create({
        dim: [onnx.TensorShapeProto.Dimension.create({ dimValue: 2 })],
      }),
    }),
  });
}

function addModel(): Uint8Array {
  const model = onnx.ModelProto.create({
    irVersion: 8,
    producerName: 'regression-test',
    opsetImport: [onnx.OperatorSetIdProto.create({ domain: '', version: 13 })],
    graph: onnx.GraphProto.create({
      name: 'add',
      node: [
        onnx.NodeProto.create({
          input: ['a', 'b'],
          output: ['c'],
          opType: 'Add',
        }),
      ],
      input: [
        onnx.ValueInfoProto.create({ name: 'a', type: tensorType() }),
        onnx.ValueInfoProto.create({ name: 'b', type: tensorType() }),
      ],
      output: [onnx.ValueInfoProto.create({ name: 'c', type: tensorType() })],
    }),
  });
  return onnx.ModelProto.encode(model).finish();
}

describe('onnx-proto under the protobufjs 7 override', () => {
  it('round-trips a model through encode and decode byte-identically', () => {
    const bytes = addModel();
    const decoded = onnx.ModelProto.decode(bytes);
    const again = onnx.ModelProto.encode(decoded).finish();
    expect(Buffer.from(again).equals(Buffer.from(bytes))).toBe(true);
    expect(decoded.graph?.node?.[0]?.opType).toBe('Add');
  });

  it('produces a model that onnxruntime-web runs correctly', async () => {
    const ort = ortRequire(
      'onnxruntime-web/dist/ort-web.node.js',
    ) as typeof import('onnxruntime-web');
    // Single-thread, no proxy worker: the default node worker path fails to start in some environments.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    const session = await ort.InferenceSession.create(addModel());
    const out = await session.run({
      a: new ort.Tensor('float32', new Float32Array([1, 2]), [2]),
      b: new ort.Tensor('float32', new Float32Array([10, 20]), [2]),
    });
    expect(Array.from(out.c.data as Float32Array)).toEqual([11, 22]);
  });
});

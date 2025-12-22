import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'attacks/index': 'src/attacks/index.ts',
    'scanning/index': 'src/scanning/index.ts',
    'benchmarks/index': 'src/benchmarks/index.ts',
    'detection/index': 'src/detection/index.ts',
    'compliance/index': 'src/compliance/index.ts',
    'audit/index': 'src/audit/index.ts',
    'continuous/index': 'src/continuous/index.ts',
    'integrations/index': 'src/integrations/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
});

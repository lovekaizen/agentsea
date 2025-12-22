import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'collection/index': 'src/collection/index.ts',
    'classification/index': 'src/classification/index.ts',
    'analysis/index': 'src/analysis/index.ts',
    'clustering/index': 'src/clustering/index.ts',
    'metrics/index': 'src/metrics/index.ts',
    'storage/index': 'src/storage/index.ts',
    'reporting/index': 'src/reporting/index.ts',
    'integrations/index': 'src/integrations/index.ts',
    'types/index': 'src/types/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['better-sqlite3', 'pg'],
});

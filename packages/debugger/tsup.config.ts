import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'recording/index': 'src/recording/index.ts',
    'replay/index': 'src/replay/index.ts',
    'visualization/index': 'src/visualization/index.ts',
    'analysis/index': 'src/analysis/index.ts',
    'storage/index': 'src/storage/index.ts',
    'integrations/agentsea/index': 'src/integrations/agentsea/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: ['@lov3kaizen/agentsea-core', 'better-sqlite3'],
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'stores/index': 'src/stores/index.ts',
    'strategies/index': 'src/strategies/index.ts',
    'streaming/index': 'src/streaming/index.ts',
    'invalidation/index': 'src/invalidation/index.ts',
    'analytics/index': 'src/analytics/index.ts',
    'integrations/agentsea/index': 'src/integrations/agentsea/index.ts',
    'integrations/gateway/index': 'src/integrations/gateway/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    'ioredis',
    'better-sqlite3',
    '@pinecone-database/pinecone',
    '@lov3kaizen/agentsea-core',
    '@lov3kaizen/agentsea-embeddings',
  ],
});

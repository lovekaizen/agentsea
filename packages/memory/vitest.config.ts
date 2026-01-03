import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    deps: {
      inline: [/@lov3kaizen\/agentsea-/],
    },
  },
  test: {
    globals: true,
    environment: 'node',
    deps: {
      inline: [/@lov3kaizen\/agentsea-/],
      optimizer: {
        ssr: {
          include: [/@lov3kaizen\/agentsea-/],
        },
      },
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@lov3kaizen/agentsea-core': resolve(__dirname, '../core/src/index.ts'),
      '@lov3kaizen/agentsea-types': resolve(__dirname, '../types/src/index.ts'),
      '@lov3kaizen/agentsea-embeddings': resolve(
        __dirname,
        '../embeddings/src/index.ts',
      ),
    },
  },
});

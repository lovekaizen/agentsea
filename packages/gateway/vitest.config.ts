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
    include: [
      'src/**/*.{test,spec}.ts',
      'src/**/__tests__/**/*.{test,spec}.ts',
    ],
    passWithNoTests: true,
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@lov3kaizen/agentsea-core': resolve(__dirname, '../core/src/index.ts'),
      '@lov3kaizen/agentsea-types': resolve(__dirname, '../types/src/index.ts'),
    },
  },
});

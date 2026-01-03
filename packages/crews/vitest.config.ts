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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        '**/__tests__/**',
      ],
      thresholds: {
        lines: 20,
        functions: 50,
        branches: 40,
        statements: 20,
      },
    },
    include: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@lov3kaizen/agentsea-core': resolve(__dirname, '../core/src/index.ts'),
      '@lov3kaizen/agentsea-types': resolve(__dirname, '../types/src/index.ts'),
    },
  },
});

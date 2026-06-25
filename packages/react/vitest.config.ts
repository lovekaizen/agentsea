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
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
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
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/__tests__/**',
      ],
    },
    include: [
      '**/__tests__/**/*.test.ts',
      '**/__tests__/**/*.test.tsx',
      '**/*.spec.ts',
    ],
    passWithNoTests: true,
    exclude: ['node_modules', 'dist'],
  },
  resolve: {
    alias: {
      '@lov3kaizen/agentsea-types': resolve(__dirname, '../types/src/index.ts'),
      '@lov3kaizen/agentsea-core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});

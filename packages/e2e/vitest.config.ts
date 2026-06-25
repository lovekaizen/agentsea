import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Resolve workspace packages to their TypeScript source so the e2e suite runs
// against current code without requiring a prior build step.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.test.ts'],
  },
  resolve: {
    alias: {
      '@lov3kaizen/agentsea-core': resolve(__dirname, '../core/src/index.ts'),
      '@lov3kaizen/agentsea-crews': resolve(__dirname, '../crews/src/index.ts'),
      '@lov3kaizen/agentsea-types': resolve(__dirname, '../types/src/index.ts'),
    },
  },
});

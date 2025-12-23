import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    deps: {
      inline: [/@lov3kaizen\/agentsea-/],
    },
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});

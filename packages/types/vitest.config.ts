import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/__tests__/**',
      ],
    },
    include: ['**/__tests__/**/*.test.ts', '**/*.spec.ts'],
    passWithNoTests: true,
    exclude: ['node_modules', 'dist'],
  },
});

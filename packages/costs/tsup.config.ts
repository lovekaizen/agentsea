import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'better-sqlite3',
    'pg',
    'stripe',
  ],
});

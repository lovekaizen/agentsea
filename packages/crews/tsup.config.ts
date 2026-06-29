import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/nestjs/index.ts', 'src/templates/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['reflect-metadata', '@nestjs/common', '@nestjs/core'],
  // nanoid@5 is ESM-only. Bundling it inlines the implementation so the CJS
  // build never emits a runtime `require('nanoid')` — which would otherwise
  // fail on Node <20.19 / <22.12 (unflagged require(ESM)).
  noExternal: ['nanoid'],
});

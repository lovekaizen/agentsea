import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/feedback/index.ts',
    'src/evaluation/index.ts',
    'src/datasets/index.ts',
    'src/annotation/index.ts',
    'src/continuous/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['better-sqlite3', '@huggingface/hub', 'nodemailer'],
  // nanoid@5 is ESM-only. Bundling it inlines the implementation so the CJS
  // build never emits a runtime `require('nanoid')` — which would otherwise
  // fail on Node <20.19 / <22.12 (unflagged require(ESM)).
  noExternal: ['nanoid'],
});

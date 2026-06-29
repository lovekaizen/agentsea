import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/stores/index.ts',
    'src/retrieval/index.ts',
    'src/structures/index.ts',
    'src/processing/index.ts',
    'src/sharing/index.ts',
    'src/debug/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['better-sqlite3', 'pg', 'ioredis', '@pinecone-database/pinecone'],
  // nanoid@5 is ESM-only. Bundling it inlines the implementation so the CJS
  // build never emits a runtime `require('nanoid')` — which would otherwise
  // fail on Node <20.19 / <22.12 (unflagged require(ESM)).
  noExternal: ['nanoid'],
});

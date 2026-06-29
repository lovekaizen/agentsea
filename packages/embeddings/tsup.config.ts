import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/chunking/index.ts',
    'src/caching/index.ts',
    'src/stores/index.ts',
    'src/providers/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: [
    'ioredis',
    'better-sqlite3',
    'chromadb',
    '@pinecone-database/pinecone',
    '@qdrant/js-client-rest',
    'weaviate-ts-client',
    'cohere-ai',
    'ollama',
    'pg',
    '@zilliz/milvus2-sdk-node',
    '@xenova/transformers',
  ],
  // nanoid@5 is ESM-only. Bundling it inlines the implementation so the CJS
  // build never emits a runtime `require('nanoid')` — which would otherwise
  // fail on Node <20.19 / <22.12 (unflagged require(ESM)).
  noExternal: ['nanoid'],
});

import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  external: [
    'tesseract.js',
    '@google-cloud/vision',
    '@lov3kaizen/agentsea-core',
    '@lov3kaizen/agentsea-embeddings',
  ],
});

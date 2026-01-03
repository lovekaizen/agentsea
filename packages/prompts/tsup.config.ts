import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'sdk/Client': 'src/sdk/Client.ts',
    'storage/index': 'src/storage/index.ts',
    'testing/index': 'src/testing/index.ts',
    'integrations/agentsea/index': 'src/integrations/agentsea/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    'better-sqlite3',
    'pg',
    '@aws-sdk/client-s3',
    '@lov3kaizen/agentsea-core',
  ],
});

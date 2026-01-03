import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'integrations/nestjs/index': 'src/integrations/nestjs/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    '@lov3kaizen/agentsea-core',
    'ioredis',
    '@opentelemetry/api',
    '@opentelemetry/sdk-node',
    'prom-client',
    '@nestjs/common',
    '@nestjs/websockets',
    '@nestjs/platform-socket.io',
  ],
});

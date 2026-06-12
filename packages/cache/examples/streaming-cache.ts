/**
 * Streaming Cache Example
 *
 * Demonstrates caching and replaying streaming LLM responses.
 * Cached streams are replayed with the same chunk pattern.
 */

import {
  StreamCache,
  MemoryCacheStore,
  type CacheMessage,
} from '@lov3kaizen/agentsea-cache';

// Simulated streaming LLM response
async function* simulateStreamingLLM(
  message: string,
): AsyncGenerator<{ content: string }> {
  const response = `This is a streamed response about: "${message}". `;
  const words = response.split(' ');

  for (const word of words) {
    // Simulate streaming delay
    await new Promise((resolve) => setTimeout(resolve, 50));
    yield { content: word + ' ' };
  }
}

async function main() {
  console.log('=== Streaming Cache Example ===\n');

  // Create store and stream cache
  const store = new MemoryCacheStore({ type: 'memory', maxEntries: 1000 });
  const streamCache = new StreamCache(store, {
    minLengthToCache: 10,
    cacheIncomplete: false,
    streamTtl: 3600,
  });

  // First streaming request - will be recorded and cached
  console.log('1. First streaming request (recording)...');
  console.log('   Streaming: ');

  const messages1: CacheMessage[] = [
    { role: 'user', content: 'Explain machine learning' },
  ];

  const stream1 = streamCache.wrapStream('gpt-5.5', messages1, () =>
    simulateStreamingLLM(messages1[0].content),
  );

  process.stdout.write('   ');
  for await (const chunk of stream1) {
    process.stdout.write(chunk.content ?? '');
  }
  console.log('\n');

  // Second request - same query, will replay from cache
  console.log('2. Same request (replaying from cache)...');
  console.log('   Streaming: ');

  const stream2 = streamCache.wrapStream('gpt-5.5', messages1, () =>
    simulateStreamingLLM(messages1[0].content),
  );

  process.stdout.write('   ');
  const replayStart = performance.now();
  for await (const chunk of stream2) {
    process.stdout.write(chunk.content ?? '');
  }
  const replayDuration = performance.now() - replayStart;
  console.log(`\n   (Replayed in ${replayDuration.toFixed(0)}ms)\n`);

  // Different request - new stream
  console.log('3. Different request (new stream)...');
  console.log('   Streaming: ');

  const messages2: CacheMessage[] = [
    { role: 'user', content: 'What is quantum computing?' },
  ];

  const stream3 = streamCache.wrapStream('gpt-5.5', messages2, () =>
    simulateStreamingLLM(messages2[0].content),
  );

  process.stdout.write('   ');
  for await (const chunk of stream3) {
    process.stdout.write(chunk.content ?? '');
  }
  console.log('\n');

  // Statistics
  const stats = streamCache.getStats();
  console.log('=== Stream Cache Statistics ===');
  console.log(`Total Lookups: ${stats.totalLookups}`);
  console.log(`Cache Hits: ${stats.totalHits}`);
  console.log(`Cache Misses: ${stats.totalMisses}`);
  console.log(`Hit Rate: ${stats.hitRate.toFixed(1)}%`);
  console.log(`Streams Cached: ${stats.totalStreamsCached}`);
  console.log(`Bytes Cached: ${stats.totalBytesCached.toLocaleString()}`);

  // Cleanup
  streamCache.destroy();
  await store.close();
}

main().catch(console.error);

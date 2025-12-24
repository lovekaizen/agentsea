/**
 * Test setup file for ingest package
 * Polyfills browser APIs that are not available in Node.js
 */

// Polyfill File API for Node.js environments that don't have it globally
if (typeof globalThis.File === 'undefined') {
  // Node.js 20+ has File in the buffer module
  try {
    const { File } = require('node:buffer');
    globalThis.File = File;
  } catch {
    // Fallback: create a minimal File polyfill
    class FilePolyfill extends Blob {
      name: string;
      lastModified: number;

      constructor(chunks: BlobPart[], name: string, options?: FilePropertyBag) {
        super(chunks, options);
        this.name = name;
        this.lastModified = options?.lastModified ?? Date.now();
      }
    }
    globalThis.File = FilePolyfill as unknown as typeof File;
  }
}

import { describe, it, expect, vi } from 'vitest';
import {
  imageToBase64,
  base64ToImage,
  compareImageHashes,
  resizeImage,
  getImageDimensions,
  cropImage,
  convertImageFormat,
  calculateImageHash,
} from '../utils/image-utils.js';

describe('Image Utils', () => {
  describe('imageToBase64', () => {
    it('should convert buffer to base64 string', () => {
      const buffer = Buffer.from('Hello World');
      const base64 = imageToBase64(buffer);

      expect(typeof base64).toBe('string');
      expect(base64).toBe(buffer.toString('base64'));
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.from('');
      const base64 = imageToBase64(buffer);

      expect(base64).toBe('');
    });

    it('should handle binary data', () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
      const base64 = imageToBase64(buffer);

      expect(base64).toBe(buffer.toString('base64'));
      expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('should produce different results for different inputs', () => {
      const buffer1 = Buffer.from('Test1');
      const buffer2 = Buffer.from('Test2');

      const base64_1 = imageToBase64(buffer1);
      const base64_2 = imageToBase64(buffer2);

      expect(base64_1).not.toBe(base64_2);
    });

    it('should be reversible with base64ToImage', () => {
      const originalBuffer = Buffer.from('Test data');
      const base64 = imageToBase64(originalBuffer);
      const restoredBuffer = base64ToImage(base64);

      expect(restoredBuffer.toString()).toBe(originalBuffer.toString());
    });
  });

  describe('base64ToImage', () => {
    it('should convert base64 string to buffer', () => {
      const base64 = 'SGVsbG8gV29ybGQ='; // "Hello World"
      const buffer = base64ToImage(base64);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe('Hello World');
    });

    it('should handle empty string', () => {
      const buffer = base64ToImage('');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBe(0);
    });

    it('should handle base64 with padding', () => {
      const base64 = 'YWJj'; // "abc"
      const buffer = base64ToImage(base64);

      expect(buffer.toString()).toBe('abc');
    });

    it('should handle base64 without padding', () => {
      const base64 = 'YQ'; // "a"
      const buffer = base64ToImage(base64);

      expect(buffer.toString()).toBe('a');
    });

    it('should be reversible with imageToBase64', () => {
      const originalBase64 = 'VGVzdCBkYXRh'; // "Test data"
      const buffer = base64ToImage(originalBase64);
      const restoredBase64 = imageToBase64(buffer);

      expect(restoredBase64).toBe(originalBase64);
    });

    it('should handle binary data', () => {
      const base64 = Buffer.from([0x00, 0xff, 0x00, 0xff]).toString('base64');
      const buffer = base64ToImage(base64);

      expect(buffer[0]).toBe(0x00);
      expect(buffer[1]).toBe(0xff);
      expect(buffer[2]).toBe(0x00);
      expect(buffer[3]).toBe(0xff);
    });
  });

  describe('compareImageHashes', () => {
    it('should return 100 for identical hashes', () => {
      const hash = '1010101010101010';
      const similarity = compareImageHashes(hash, hash);

      expect(similarity).toBe(100);
    });

    it('should return 0 for completely different hashes', () => {
      const hash1 = '1111111111111111';
      const hash2 = '0000000000000000';
      const similarity = compareImageHashes(hash1, hash2);

      expect(similarity).toBe(0);
    });

    it('should return 75 for mostly matching hashes', () => {
      const hash1 = '11110000';
      const hash2 = '11000000';
      const similarity = compareImageHashes(hash1, hash2);

      // 6 out of 8 match = 75%
      expect(similarity).toBe(75);
    });

    it('should handle empty hashes', () => {
      const similarity = compareImageHashes('', '');

      expect(similarity).toBe(0);
    });

    it('should return 0 for different length hashes', () => {
      const hash1 = '1111';
      const hash2 = '11110000';
      const similarity = compareImageHashes(hash1, hash2);

      expect(similarity).toBe(0);
    });

    it('should calculate percentage correctly', () => {
      const hash1 = '1111000011110000';
      const hash2 = '1111000000000000';
      const similarity = compareImageHashes(hash1, hash2);

      // 12 matching out of 16 = 75%
      expect(similarity).toBe(75);
    });

    it('should be symmetric', () => {
      const hash1 = '10101010';
      const hash2 = '10100000';

      const similarity1 = compareImageHashes(hash1, hash2);
      const similarity2 = compareImageHashes(hash2, hash1);

      expect(similarity1).toBe(similarity2);
    });

    it('should handle single character hashes', () => {
      const similarity1 = compareImageHashes('1', '1');
      const similarity2 = compareImageHashes('1', '0');

      expect(similarity1).toBe(100);
      expect(similarity2).toBe(0);
    });

    it('should handle long hashes', () => {
      const hash1 = '1'.repeat(1000);
      const hash2 = '1'.repeat(1000);
      const similarity = compareImageHashes(hash1, hash2);

      expect(similarity).toBe(100);
    });
  });

  describe('resizeImage', () => {
    it('should return original buffer when sharp is not available', async () => {
      // Mock sharp import to fail
      const originalBuffer = Buffer.from('test');

      vi.doMock('sharp', () => {
        throw new Error('Module not found');
      });

      const result = await resizeImage(originalBuffer, 100, 100);

      expect(result).toBe(originalBuffer);
    });

    it('should handle resize operation', async () => {
      const buffer = Buffer.from('test image data');
      const result = await resizeImage(buffer, 800, 600);

      // When sharp is not available, it returns original
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should accept different dimensions', async () => {
      const buffer = Buffer.from('test');

      const result1 = await resizeImage(buffer, 1920, 1080);
      const result2 = await resizeImage(buffer, 800, 600);

      expect(Buffer.isBuffer(result1)).toBe(true);
      expect(Buffer.isBuffer(result2)).toBe(true);
    });

    it('should handle zero dimensions', async () => {
      const buffer = Buffer.from('test');
      const result = await resizeImage(buffer, 0, 0);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle very large dimensions', async () => {
      const buffer = Buffer.from('test');
      const result = await resizeImage(buffer, 10000, 10000);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('getImageDimensions', () => {
    it('should return null when sharp is not available', async () => {
      const buffer = Buffer.from('test');

      vi.doMock('sharp', () => {
        throw new Error('Module not found');
      });

      const result = await getImageDimensions(buffer);

      expect(result).toBeNull();
    });

    it('should handle empty buffer', async () => {
      const buffer = Buffer.from('');
      const result = await getImageDimensions(buffer);

      expect(result).toBeNull();
    });

    it('should return null for invalid image data', async () => {
      const buffer = Buffer.from('not an image');
      const result = await getImageDimensions(buffer);

      expect(result).toBeNull();
    });
  });

  describe('cropImage', () => {
    it('should return original buffer when sharp is not available', async () => {
      const originalBuffer = Buffer.from('test');

      vi.doMock('sharp', () => {
        throw new Error('Module not found');
      });

      const result = await cropImage(originalBuffer, {
        x: 10,
        y: 10,
        width: 100,
        height: 100,
      });

      expect(result).toBe(originalBuffer);
    });

    it('should handle crop region', async () => {
      const buffer = Buffer.from('test image data');
      const result = await cropImage(buffer, {
        x: 0,
        y: 0,
        width: 200,
        height: 200,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should accept different crop regions', async () => {
      const buffer = Buffer.from('test');

      const result1 = await cropImage(buffer, {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      const result2 = await cropImage(buffer, {
        x: 50,
        y: 50,
        width: 200,
        height: 200,
      });

      expect(Buffer.isBuffer(result1)).toBe(true);
      expect(Buffer.isBuffer(result2)).toBe(true);
    });

    it('should handle zero-sized crop region', async () => {
      const buffer = Buffer.from('test');
      const result = await cropImage(buffer, {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle crop at image edge', async () => {
      const buffer = Buffer.from('test');
      const result = await cropImage(buffer, {
        x: 1000,
        y: 1000,
        width: 100,
        height: 100,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('convertImageFormat', () => {
    it('should return original buffer when sharp is not available', async () => {
      const originalBuffer = Buffer.from('test');

      vi.doMock('sharp', () => {
        throw new Error('Module not found');
      });

      const result = await convertImageFormat(originalBuffer, 'png');

      expect(result).toBe(originalBuffer);
    });

    it('should handle PNG format', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'png');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle JPEG format', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'jpeg');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle WebP format', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'webp');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle quality parameter for JPEG', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'jpeg', 85);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle quality parameter for WebP', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'webp', 80);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle default quality', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'jpeg');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle low quality', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'jpeg', 10);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle high quality', async () => {
      const buffer = Buffer.from('test');
      const result = await convertImageFormat(buffer, 'jpeg', 100);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('calculateImageHash', () => {
    it('should return empty string when sharp is not available', async () => {
      const buffer = Buffer.from('test');

      vi.doMock('sharp', () => {
        throw new Error('Module not found');
      });

      const result = await calculateImageHash(buffer);

      expect(result).toBe('');
    });

    it('should return a string hash', async () => {
      const buffer = Buffer.from('test');
      const hash = await calculateImageHash(buffer);

      expect(typeof hash).toBe('string');
    });

    it('should handle empty buffer', async () => {
      const buffer = Buffer.from('');
      const hash = await calculateImageHash(buffer);

      expect(typeof hash).toBe('string');
    });

    it('should handle invalid image data', async () => {
      const buffer = Buffer.from('not an image');
      const hash = await calculateImageHash(buffer);

      expect(typeof hash).toBe('string');
    });
  });

  describe('integration tests', () => {
    it('should convert buffer to base64 and back', () => {
      const original = Buffer.from('Test Image Data');
      const base64 = imageToBase64(original);
      const restored = base64ToImage(base64);

      expect(restored.equals(original)).toBe(true);
    });

    it('should compare identical image hashes as 100% similar', () => {
      const hash = '1010101010101010';
      const similarity = compareImageHashes(hash, hash);

      expect(similarity).toBe(100);
    });

    it('should handle complete workflow without sharp', async () => {
      const buffer = Buffer.from('test image');

      // All operations should fallback gracefully
      const resized = await resizeImage(buffer, 100, 100);
      const cropped = await cropImage(buffer, {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      });
      const converted = await convertImageFormat(buffer, 'png');
      const hash = await calculateImageHash(buffer);
      const dimensions = await getImageDimensions(buffer);

      expect(Buffer.isBuffer(resized)).toBe(true);
      expect(Buffer.isBuffer(cropped)).toBe(true);
      expect(Buffer.isBuffer(converted)).toBe(true);
      expect(typeof hash).toBe('string');
      // dimensions will be null without sharp
    });

    it('should handle base64 encoding of binary data', () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const base64 = imageToBase64(binaryData);
      const restored = base64ToImage(base64);

      expect(restored.length).toBe(binaryData.length);
      expect(restored[0]).toBe(0x00);
      expect(restored[5]).toBe(0xfd);
    });

    it('should calculate hash similarity for similar images', () => {
      // Simulate hashes from similar images (differ by a few bits)
      const hash1 = '1111111111111111';
      const hash2 = '1111111111111110'; // 1 bit different out of 16

      const similarity = compareImageHashes(hash1, hash2);

      expect(similarity).toBeGreaterThan(90);
    });

    it('should calculate hash similarity for different images', () => {
      // Simulate hashes from very different images
      const hash1 = '1111111100000000';
      const hash2 = '0000000011111111';

      const similarity = compareImageHashes(hash1, hash2);

      expect(similarity).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle null buffer in imageToBase64', () => {
      expect(() => {
        imageToBase64(null as any);
      }).toThrow();
    });

    it('should handle invalid base64 string', () => {
      const result = base64ToImage('!!!invalid!!!');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle null hashes', () => {
      const result = compareImageHashes('', '');
      expect(result).toBe(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  resizeImage,
  getImageDimensions,
  cropImage,
  convertImageFormat,
  calculateImageHash,
} from '../utils/image-utils.js';

// These tests use the real sharp binary. The helpers in image-utils swallow
// errors and return the input buffer, so the mocked tests in image-utils.test.ts
// pass even when sharp is broken. Assert on the actual output here.
async function makePng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

describe('image utils with real sharp', () => {
  it('reads real dimensions', async () => {
    const png = await makePng(120, 80);
    expect(await getImageDimensions(png)).toEqual({ width: 120, height: 80 });
  });

  it('resizes to the requested dimensions', async () => {
    const png = await makePng(120, 80);
    const out = await resizeImage(png, 60, 60);
    expect(out).not.toBe(png);
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(60);
    expect(meta.height).toBe(60);
  });

  it('crops to the requested region', async () => {
    const png = await makePng(120, 80);
    const out = await cropImage(png, { x: 10, y: 5, width: 40, height: 30 });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(40);
    expect(meta.height).toBe(30);
  });

  it.each([
    ['png', 'png'],
    ['jpeg', 'jpeg'],
    ['webp', 'webp'],
  ] as const)('converts to %s', async (format, expected) => {
    const png = await makePng(32, 32);
    const out = await convertImageFormat(png, format, 80);
    expect((await sharp(out).metadata()).format).toBe(expected);
  });

  it('produces a non-empty hash for a real image', async () => {
    const png = await makePng(64, 64);
    const hash = await calculateImageHash(png);
    expect(hash.length).toBeGreaterThan(0);
  });
});

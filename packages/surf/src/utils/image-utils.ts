/**
 * Image utilities for processing screenshots
 */

/**
 * Resize an image buffer to target dimensions
 * Requires sharp as an optional dependency
 */
export async function resizeImage(
  imageBuffer: Buffer,
  targetWidth: number,
  targetHeight: number,
): Promise<Buffer> {
  try {
    const sharp = await import('sharp');
    return sharp
      .default(imageBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
  } catch {
    // Return original if sharp is not available
    return imageBuffer;
  }
}

/**
 * Convert image to base64
 */
export function imageToBase64(imageBuffer: Buffer): string {
  return imageBuffer.toString('base64');
}

/**
 * Convert base64 to image buffer
 */
export function base64ToImage(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Get image dimensions from buffer
 * Requires sharp as an optional dependency
 */
export async function getImageDimensions(
  imageBuffer: Buffer,
): Promise<{ width: number; height: number } | null> {
  try {
    const sharp = await import('sharp');
    const metadata = await sharp.default(imageBuffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Crop an image to a specific region
 */
export async function cropImage(
  imageBuffer: Buffer,
  region: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  try {
    const sharp = await import('sharp');
    return sharp
      .default(imageBuffer)
      .extract({
        left: region.x,
        top: region.y,
        width: region.width,
        height: region.height,
      })
      .toBuffer();
  } catch {
    return imageBuffer;
  }
}

/**
 * Convert image format
 */
export async function convertImageFormat(
  imageBuffer: Buffer,
  format: 'png' | 'jpeg' | 'webp',
  quality?: number,
): Promise<Buffer> {
  try {
    const sharp = await import('sharp');
    let sharpInstance = sharp.default(imageBuffer);

    switch (format) {
      case 'png':
        sharpInstance = sharpInstance.png();
        break;
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: quality || 90 });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: quality || 90 });
        break;
    }

    return sharpInstance.toBuffer();
  } catch {
    return imageBuffer;
  }
}

/**
 * Calculate image hash for comparison
 * Simple average hash implementation
 */
export async function calculateImageHash(imageBuffer: Buffer): Promise<string> {
  try {
    const sharp = await import('sharp');

    // Resize to 8x8 and convert to grayscale
    const { data } = await sharp
      .default(imageBuffer)
      .resize(8, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Calculate average
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / data.length;

    // Generate hash
    let hash = '';
    for (let i = 0; i < data.length; i++) {
      hash += data[i] >= avg ? '1' : '0';
    }

    return hash;
  } catch {
    return '';
  }
}

/**
 * Compare two image hashes
 * Returns similarity as a percentage (0-100)
 */
export function compareImageHashes(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length || hash1.length === 0) {
    return 0;
  }

  let matching = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) {
      matching++;
    }
  }

  return (matching / hash1.length) * 100;
}

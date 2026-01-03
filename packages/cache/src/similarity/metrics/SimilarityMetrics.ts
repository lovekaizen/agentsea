/**
 * Similarity Metrics
 *
 * Common similarity and distance metrics for vector comparison.
 */

/**
 * Compute cosine similarity between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Compute Euclidean distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (0 = identical, higher = more different)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compute dot product between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Dot product value
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}

/**
 * Compute Manhattan distance between two vectors
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Distance (0 = identical, higher = more different)
 */
export function manhattanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }

  return sum;
}

/**
 * Convert Euclidean distance to similarity (0-1)
 *
 * @param distance - Euclidean distance
 * @returns Similarity score between 0 and 1
 */
export function distanceToSimilarity(distance: number): number {
  return 1 / (1 + distance);
}

/**
 * Normalize a vector to unit length
 *
 * @param vector - Vector to normalize
 * @returns Normalized vector
 */
export function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}

/**
 * Compute the magnitude (L2 norm) of a vector
 *
 * @param vector - Vector
 * @returns Magnitude
 */
export function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
}

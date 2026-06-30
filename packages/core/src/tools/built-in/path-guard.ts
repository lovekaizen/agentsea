import { resolve, sep } from 'path';

/**
 * Resolve a caller-supplied path against an allowed root directory and reject
 * any path that escapes it (via `..`, an absolute path, etc.).
 *
 * The root defaults to `process.cwd()` and can be overridden with the
 * `AGENTSEA_FILE_ROOT` environment variable. This confines the built-in file
 * tools to a known directory instead of granting arbitrary filesystem access.
 *
 * Note: this guards against path-string traversal. If the root contains
 * symlinks that point outside it, a fully hardened deployment should also
 * canonicalize with `fs.realpath` and re-check.
 */
export function resolveWithinRoot(inputPath: string): string {
  const root = resolve(process.env.AGENTSEA_FILE_ROOT || process.cwd());
  const resolved = resolve(root, inputPath);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error(`Path escapes the allowed root directory: ${inputPath}`);
  }
  return resolved;
}

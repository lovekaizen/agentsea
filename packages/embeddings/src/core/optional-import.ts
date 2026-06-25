/**
 * Import an optional vector-store / model dependency at runtime by name without
 * TypeScript resolving the literal specifier at build time, so the package
 * compiles and runs without the heavy SDK installed. Callers cast the result to
 * a minimal local contract and handle rejection when the module is absent.
 */
export function importOptional(name: string): Promise<unknown> {
  return import(/* @vite-ignore */ /* webpackIgnore: true */ name);
}

/**
 * Import an optional peer/optional dependency at runtime by name.
 *
 * The specifier is passed as a (non-literal) variable so TypeScript does not
 * attempt to resolve or type-check the module at build time. This lets the
 * package compile without the optional dependency installed while still
 * importing it when present. Callers should cast the result to a minimal local
 * contract and handle the rejection when the module is missing.
 */
export function importOptional(name: string): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return import(/* @vite-ignore */ /* webpackIgnore: true */ name);
}

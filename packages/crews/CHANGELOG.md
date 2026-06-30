# @lov3kaizen/agentsea-crews

## 1.2.0

- Bump for monorepo version consistency.

## 1.1.1

### Patch Changes

- 2660640: Ship type declarations, bundle the ESM-only `nanoid`, and add opt-in task
  concurrency.

  **crews**

  - **Fix: ship type declarations.** The build emitted no `.d.ts`, so `1.1.0`
    published with `types`/`exports` (including the `./nestjs` / `./templates`
    subpaths) pointing at declaration files that never existed — TypeScript
    consumers had to add an ambient shim. The build now runs from a
    `tsup.config.ts` with `dts: true` and emits declarations for every entry point.
  - **Feat: concurrent task execution.** `kickoff()` / `kickoffStream()` accept a
    `maxConcurrentTasks` option, and `CrewConfig.maxConcurrentTasks` is now wired
    in. Ready tasks within a scheduling iteration run through a bounded worker pool
    (default `1` — fully sequential, unchanged behavior). A per-call value
    overrides the config; a task failure stops new launches, drains in-flight work,
    and surfaces the same fatal `crew:error` as the sequential path.

  **crews, embeddings, evaluate, memory — bundle nanoid**

  These packages emit a CJS build that previously externalized `nanoid@5`
  (ESM-only), producing a runtime `require('nanoid')` that throws on Node
  <20.19 / <22.12 (unflagged `require(ESM)`). `nanoid` is now bundled into the
  output (`noExternal`), so the CJS build no longer requires it at runtime and
  works on any supported Node. `nanoid` moved from `dependencies` to
  `devDependencies` accordingly.

  **memory — fix broken `exports` map**

  `memory` declared `"type": "module"`, which flips tsup's output extensions
  (esm→`.js`, cjs→`.cjs`), but its `exports`/`main`/`module` were written for the
  CommonJS convention (esm→`.mjs`, cjs→`.js`). The result: the `import` condition
  pointed at `.mjs` files that were never emitted, and the `require` condition
  resolved to an ESM `.js` file — so both `require()` and `import` of the package
  could fail. Removing the stray `"type": "module"` realigns the build output with
  the existing `exports` map (CJS `require` → `./dist/index.js`, ESM `import` →
  `./dist/index.mjs`), both verified to load.

  **memory — fix importance scoring returning Promises**

  The synchronous importance helpers in `utils/importance` (`calculateImportanceWithRecency`,
  `calculateImportanceWithAccess`, `calculateImportanceWithContext`,
  `calculateCombinedImportance`, `createImportanceCalculator`, `filterByImportance`,
  `sortByImportance`) wrapped their results in `Promise.resolve(...)` despite being
  typed (and documented) as returning plain values. Besides breaking the public
  type contract, `calculateCombinedImportance` multiplied those Promises
  arithmetically and returned `NaN`. The wrappers are removed so the functions
  return real numbers/arrays; added regression tests covering all of them.

  (The other nanoid-using packages — analytics, cache, costs, debugger, ingest,
  prompts, redteam, structured — are ESM-only and `import` nanoid as ESM, so they
  were never affected and are unchanged.)

### Patch Changes

- @lov3kaizen/agentsea-core@1.1.1

## 1.0.0

### Minor Changes

- feat: enable cli coding with commercial coding agents and local models

### Patch Changes

- 95777d7: release v0.5.1 packages
- Updated dependencies
- Updated dependencies [95777d7]
  - @lov3kaizen/agentsea-core@0.6.0

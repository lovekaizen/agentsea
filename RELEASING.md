# Releasing

All packages are published from this monorepo under the `@lov3kaizen/agentsea-*`
scope. There are two supported ways to version a release. Both consume
[changesets](https://github.com/changesets/changesets) you author with
`pnpm changeset`; they differ in how versions are assigned.

## 1. Independent versioning (changesets default)

Each package bumps only if it (or one of its workspace dependencies) changed, by
the bump level recorded in its changesets.

```bash
pnpm changeset          # author a changeset (select packages + bump level)
pnpm version-packages   # = changeset version  -> bumps changed packages, writes CHANGELOGs
pnpm release            # = pnpm build && changeset publish
```

Use this when you want version numbers to signal _what actually changed_.

## 2. Lockstep versioning (whole suite shares one version)

Every package (and the repo root) moves to a single shared version each release —
the model used for `1.1.0`/`1.1.1`.

```bash
pnpm changeset             # author changesets as usual (optional for a consistency-only bump)
pnpm version-lockstep:dry  # preview: prints "X -> Y (level)" and writes nothing
pnpm version-lockstep      # bump EVERY package + root to the shared version, write CHANGELOGs, consume changesets
git commit -am "chore: release <version>"
pnpm release               # build + publish (changeset publish compares versions against npm)
```

- The target version = the current highest version bumped by the **highest**
  changeset bump level (`patch` < `minor` < `major`). Override with
  `--bump <level>` or `--version <x.y.z>` (e.g. a consistency-only bump with no
  changesets: `pnpm version-lockstep --bump patch`).
- Packages named in a changeset get its notes under the matching
  `### {Major|Minor|Patch} Changes` heading; the rest get
  `- Bump for monorepo version consistency.`
- Private packages (`admin-ui`, `e2e`) are versioned too so the whole repo stays
  uniform; `changeset publish` still skips them.

### Why not `changeset version` with a `fixed` group?

Changesets' built-in lockstep (`"fixed"` / `"linked"` in `.changeset/config.json`)
**inflates a minor bump to a major** in this toolchain — verified: an all-`patch`
changeset set correctly bumps `1.1.0 -> 1.1.1`, but a set containing a `minor`
takes `1.1.0 -> 2.0.0` instead of `1.2.0`. `scripts/release-version.mjs` exists to
get correct, deterministic lockstep numbers while still generating changelogs, so
`fixed` is intentionally left empty in the changeset config.

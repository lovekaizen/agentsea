# Upgrading AgentSea

This guide explains how to update `@lov3kaizen/agentsea-*` packages when a new release is published.

## Versioning policy

AgentSea follows [Semantic Versioning](https://semver.org/):

| Bump | Meaning | What you should do |
|------|---------|-------------------|
| **Patch** (`1.0.0` → `1.0.1`) | Bug fixes, no API changes | Update when convenient |
| **Minor** (`1.0.x` → `1.1.0`) | New features, backward compatible | Update when you want new capabilities |
| **Major** (`1.x` → `2.0.0`) | Breaking API or runtime changes | Read the changelog and migration notes before upgrading |

Each package is versioned independently, but **packages you use together should be kept on the same release line** (e.g. all at `1.0.1`) to avoid type or peer-dependency mismatches.

## Requirements

- **Node.js >= 20.0.0** (required as of v1.0.1; Node 18 is no longer supported)
- **TypeScript 5.0+** (recommended)

## Quick upgrade

### Check what you have installed

```bash
# List installed AgentSea packages
pnpm list "@lov3kaizen/*"
# or
npm ls "@lov3kaizen/*"
```

### Update to the latest release

**pnpm** (recommended):

```bash
# Update every AgentSea package in the project
pnpm update "@lov3kaizen/*" --latest

# Or pin to a specific version (use the same version for all packages you depend on)
pnpm update @lov3kaizen/agentsea-core@1.0.1 @lov3kaizen/agentsea-nestjs@1.0.1
```

**npm**:

```bash
npm install @lov3kaizen/agentsea-core@latest @lov3kaizen/agentsea-nestjs@latest
```

**yarn**:

```bash
yarn upgrade @lov3kaizen/agentsea-core@latest @lov3kaizen/agentsea-nestjs@latest
```

### Global CLI

```bash
npm install -g @lov3kaizen/agentsea-cli@latest
sea --version
```

## Recommended upgrade workflow

1. **Read the release notes** — [GitHub Releases](https://github.com/lovekaizen/agentsea/releases) and any `RELEASE_NOTES_v*.md` in the repo root.
2. **Scan changelogs** for packages you depend on (see [Where to find changes](#where-to-find-changes)).
3. **Bump all AgentSea packages you use to the same version** in `package.json`.
4. **Reinstall** — `pnpm install` (or `npm install` / `yarn`).
5. **Type-check and test** — `pnpm type-check && pnpm test` in your app.
6. **Fix compile errors** — TypeScript will surface most breaking API changes.

## Keep packages in sync

AgentSea is a monorepo of scoped packages with internal dependencies. A typical stack looks like:

```
@lov3kaizen/agentsea-types
        ↓
@lov3kaizen/agentsea-core
        ↓
extension packages (nestjs, memory, gateway, guardrails, …)
```

If you use multiple packages, **update them together**:

```json
{
  "dependencies": {
    "@lov3kaizen/agentsea-core": "1.0.1",
    "@lov3kaizen/agentsea-nestjs": "1.0.1",
    "@lov3kaizen/agentsea-memory": "1.0.1"
  }
}
```

Extension packages declare peer dependencies on `@lov3kaizen/agentsea-core` (and sometimes `@lov3kaizen/agentsea-embeddings`). Mixing versions across the `1.0.x` line usually works for patches, but staying aligned avoids subtle type and runtime issues.

### Packages you might depend on

| Package | Purpose |
|---------|---------|
| `@lov3kaizen/agentsea-core` | Core agent framework |
| `@lov3kaizen/agentsea-types` | Shared TypeScript types (usually pulled in by core) |
| `@lov3kaizen/agentsea-nestjs` | NestJS integration |
| `@lov3kaizen/agentsea-cli` | `sea` command-line tool |
| `@lov3kaizen/agentsea-crews` | Multi-agent orchestration |
| `@lov3kaizen/agentsea-gateway` | LLM gateway |
| `@lov3kaizen/agentsea-memory` | Memory stores |
| `@lov3kaizen/agentsea-embeddings` | Embeddings |
| `@lov3kaizen/agentsea-cache` | LLM caching |
| `@lov3kaizen/agentsea-structured` | Structured output |
| `@lov3kaizen/agentsea-ingest` | Document ingestion |
| `@lov3kaizen/agentsea-prompts` | Prompt management |
| `@lov3kaizen/agentsea-guardrails` | Safety guardrails |
| `@lov3kaizen/agentsea-evaluate` | LLM evaluation |
| `@lov3kaizen/agentsea-redteam` | Red teaming |
| `@lov3kaizen/agentsea-analytics` | Conversation analytics |
| `@lov3kaizen/agentsea-costs` | Cost tracking |
| `@lov3kaizen/agentsea-debugger` | Agent debugger |
| `@lov3kaizen/agentsea-surf` | Computer-use / browser automation |
| `@lov3kaizen/agentsea-react` | React components |
| `@lov3kaizen/agentsea-admin-ui` | Admin dashboard |

Only install the packages your application needs.

## Where to find changes

| Source | What it covers |
|--------|----------------|
| [GitHub Releases](https://github.com/lovekaizen/agentsea/releases) | High-level release summaries |
| `RELEASE_NOTES_v*.md` (repo root) | Detailed notes for selected releases |
| `packages/<name>/CHANGELOG.md` | Per-package history (generated from [Changesets](https://github.com/changesets/changesets)) |
| [npm package pages](https://www.npmjs.com/org/lov3kaizen) | Published versions and readme |

When upgrading across **major** versions, start with the **core** and **types** changelogs — most breaking changes land there first.

## Known breaking changes

### v1.0.1 — Node.js 18 dropped

Node.js **>= 20** is required. Upgrade your runtime before updating packages:

```bash
node --version   # must be >= 20.0.0
```

### v0.6.0 — Agentic coding and expanded models

Backward compatible with v0.5.x. No code changes required. See [RELEASE_NOTES_v0.6.0.md](../RELEASE_NOTES_v0.6.0.md).

### API migrations (not version bumps)

Some features have dedicated migration guides when the upgrade path is about **how you write code**, not which version you install:

- [Per-model type safety migration](./PER_MODEL_TYPE_SAFETY.md#migration-from-basic-provider-usage) — moving from untyped `Agent` config to `createProvider()` helpers

## Troubleshooting

### Peer dependency warnings

Install or align the peer package at the version the warning suggests, usually `@lov3kaizen/agentsea-core`:

```bash
pnpm add @lov3kaizen/agentsea-core@1.0.1
```

### Duplicate versions in the bundle

If two AgentSea packages resolve to different versions, dedupe:

```bash
pnpm why @lov3kaizen/agentsea-core
```

Then pin a single version in `package.json` or use pnpm `overrides`:

```json
{
  "pnpm": {
    "overrides": {
      "@lov3kaizen/agentsea-core": "1.0.1"
    }
  }
}
```

### Type errors after upgrade

1. Delete `node_modules` and the lockfile, reinstall.
2. Ensure `@lov3kaizen/agentsea-types` matches your core version (`pnpm why @lov3kaizen/agentsea-types`).
3. Check the package CHANGELOG for renamed exports or config shape changes.

## Staying informed

- Watch [releases on GitHub](https://github.com/lovekaizen/agentsea/releases)
- Subscribe to npm updates: `npm dist-tag ls @lov3kaizen/agentsea-core` shows the `latest` tag

---

## For maintainers: publishing a release

Consumer upgrades depend on clear release communication. When cutting a release:

1. Add a [changeset](https://github.com/changesets/changesets) — `pnpm changeset`
2. Version packages — `pnpm version-packages`
3. Build, test, publish — `pnpm release` (or tag-driven CI via `.github/workflows/release.yml`)
4. Publish **GitHub Release** notes (auto-generated on tag push; expand manually for majors)

### Release notes template

Copy this into `RELEASE_NOTES_vX.Y.Z.md` or the GitHub Release body for significant releases:

```markdown
# AgentSea vX.Y.Z

**Release date:** YYYY-MM-DD

## Highlights

- Bullet summary of the most important changes

## Breaking changes

- List each breaking change with migration steps
- If none: "None — backward compatible with vX.(Y-1).x"

## Upgrade guide

\`\`\`bash
pnpm update "@lov3kaizen/*"@X.Y.Z
\`\`\`

- Note any required code or environment changes

## Package versions

| Package | Version |
|---------|---------|
| @lov3kaizen/agentsea-core | X.Y.Z |
| @lov3kaizen/agentsea-types | X.Y.Z |
| … | … |

## Changelog

Link to or summarize per-package CHANGELOG entries.
```

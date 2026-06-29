#!/usr/bin/env node
/**
 * Lockstep release versioning for the AgentSea monorepo.
 *
 * Why this exists
 * ---------------
 * `changeset version` with a `fixed`/`linked` group inflates a MINOR bump to a
 * MAJOR (a known changesets bug — verified: an all-`patch` set bumps correctly,
 * but a `minor` set takes 1.1.0 -> 2.0.0 instead of 1.2.0). That makes the
 * built-in tool unusable for true lockstep. This script bumps EVERY workspace
 * package (and the repo root) to a single shared version derived from the
 * pending changesets, regenerates per-package CHANGELOG entries from those
 * changesets, then consumes them — deterministically and with no inflation.
 *
 * It is an *alternative* to `pnpm version-packages`; it does not change how you
 * author changesets (`pnpm changeset`) or publish (`pnpm release` /
 * `changeset publish`, which versions are compared against the registry).
 *
 * Usage
 * -----
 *   node scripts/release-version.mjs                 # bump level derived from changesets
 *   node scripts/release-version.mjs --bump minor    # force the bump level
 *   node scripts/release-version.mjs --version 2.0.0 # set an explicit target version
 *   node scripts/release-version.mjs --dry-run       # print the plan, write nothing
 *
 * With no pending changesets you must pass --bump or --version (a
 * consistency-only release); every package then gets a neutral changelog note.
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const readFlag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const bumpArg = readFlag('--bump');
const versionArg = readFlag('--version');

const ORDER = ['patch', 'minor', 'major'];
const RANK = { patch: 0, minor: 1, major: 2 };

const bumpVersion = (v, level) => {
  const [maj, min, pat] = v.split('.').map(Number);
  if (level === 'major') return `${maj + 1}.0.0`;
  if (level === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
};
const cmp = (a, b) => {
  const A = a.split('.').map(Number);
  const B = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i];
  return 0;
};

// --- discover workspace packages -----------------------------------------
const pkgsDir = join(root, 'packages');
const packages = readdirSync(pkgsDir)
  .filter((d) => existsSync(join(pkgsDir, d, 'package.json')))
  .map((d) => {
    const pkgPath = join(pkgsDir, d, 'package.json');
    return { dir: join(pkgsDir, d), pkgPath, json: JSON.parse(readFileSync(pkgPath, 'utf8')) };
  });

// --- current base version (highest across packages + root) ---------------
const rootPath = join(root, 'package.json');
const rootJson = JSON.parse(readFileSync(rootPath, 'utf8'));
let base = rootJson.version;
for (const p of packages) {
  if (p.json.version && cmp(p.json.version, base) > 0) base = p.json.version;
}

// --- read + parse pending changesets -------------------------------------
const csDir = join(root, '.changeset');
const csFiles = existsSync(csDir)
  ? readdirSync(csDir).filter((f) => f.endsWith('.md') && f !== 'README.md')
  : [];

const parseChangeset = (file) => {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const releases = [];
  let summary = raw.trim();
  if (m) {
    summary = m[2].trim();
    for (const line of m[1].split('\n')) {
      const lm = line.match(/^\s*["']?([^"':]+)["']?\s*:\s*(patch|minor|major)\b/);
      if (lm) releases.push({ name: lm[1].trim(), type: lm[2] });
    }
  }
  return { file, releases, summary };
};
const changesets = csFiles.map((f) => parseChangeset(join(csDir, f)));

// --- resolve target version ----------------------------------------------
let level = bumpArg;
if (!level && !versionArg) {
  let max = -1;
  for (const cs of changesets) for (const r of cs.releases) max = Math.max(max, RANK[r.type]);
  level = max >= 0 ? ORDER[max] : null;
}
let target = versionArg;
if (!target) {
  if (!level) {
    console.error(
      'No changesets found and no --bump/--version given. Nothing to release.',
    );
    process.exit(1);
  }
  target = bumpVersion(base, level);
}

// --- collect per-package release notes -----------------------------------
const notesByPkg = new Map();
for (const cs of changesets) {
  for (const r of cs.releases) {
    if (!notesByPkg.has(r.name)) notesByPkg.set(r.name, []);
    notesByPkg.get(r.name).push({ type: r.type, summary: cs.summary });
  }
}

const changelogEntry = (name) => {
  const notes = notesByPkg.get(name);
  if (notes && notes.length) {
    const byType = { major: [], minor: [], patch: [] };
    for (const n of notes) byType[n.type].push(n.summary);
    let out = `## ${target}\n\n`;
    for (const t of ['major', 'minor', 'patch']) {
      if (!byType[t].length) continue;
      out += `### ${t[0].toUpperCase() + t.slice(1)} Changes\n\n`;
      for (const s of byType[t]) {
        out += s
          .split('\n')
          .map((l, i) => (i === 0 ? `- ${l}` : l ? `  ${l}` : l))
          .join('\n');
        out += '\n';
      }
      out += '\n';
    }
    return out;
  }
  return `## ${target}\n\n- Bump for monorepo version consistency.\n\n`;
};

const prependChangelog = (dir, name) => {
  const cl = join(dir, 'CHANGELOG.md');
  const entry = changelogEntry(name);
  let next;
  if (existsSync(cl)) {
    const s = readFileSync(cl, 'utf8');
    next = /^# /.test(s)
      ? s.replace(/^(# .*\n\n?)/, (mm) => mm + entry)
      : `# ${name}\n\n${entry}${s}`;
  } else {
    next = `# ${name}\n\n${entry}`;
  }
  if (!dryRun) writeFileSync(cl, next);
};

// --- apply ----------------------------------------------------------------
console.log(
  `Lockstep release: ${base} -> ${target}${level ? ` (${level})` : ''}${dryRun ? '  [dry-run]' : ''}`,
);
for (const p of packages) {
  p.json.version = target;
  if (!dryRun) writeFileSync(p.pkgPath, `${JSON.stringify(p.json, null, 2)}\n`);
  prependChangelog(p.dir, p.json.name);
}
rootJson.version = target;
if (!dryRun) writeFileSync(rootPath, `${JSON.stringify(rootJson, null, 2)}\n`);
for (const cs of changesets) if (!dryRun) rmSync(cs.file);

console.log(
  `${dryRun ? 'Would bump' : 'Bumped'} ${packages.length} packages + root to ${target}; ${dryRun ? 'would consume' : 'consumed'} ${changesets.length} changeset(s).`,
);
console.log(
  dryRun
    ? 'Dry run: no files written.'
    : `Review CHANGELOGs, then: git commit -am "chore: release ${target}"`,
);

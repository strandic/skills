/**
 * instrument.mjs — one digest for everything a score depends on.
 *
 * A sweep measures a condition with an instrument: the cases, their graders, the
 * transcripts they replay, the fixture they scaffold, and every condition's SKILL.md.
 * Change any of those and a score taken before the change is not comparable to one
 * taken after. The pre-registration digest (I2) does not cover this, and drift.json
 * covers only the treatment mirror.
 *
 * `instrumentDigest(suiteDir)` walks the suite directory and hashes every file's bytes
 * together with its suite-relative path, sorted, skipping `results/` (output, not
 * instrument), `node_modules/`, and the suite-root README.md and PRE-REGISTRATION.md. The runner stamps it on each SweepRecord and on
 * drift.json; the merger refuses sweeps that disagree with each other or with the tree.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const SKIP = new Set(['results', 'node_modules', '.git']);

/**
 * Prose at the suite root is not instrument. PRE-REGISTRATION.md has its own digest
 * (I2) and README.md scores nothing; hashing them would make every amendment or
 * README edit unmergeable against sweeps that were measured on identical graders.
 */
const SKIP_AT_ROOT = new Set(['README.md', 'PRE-REGISTRATION.md']);

/** @returns {Promise<string[]>} absolute file paths, sorted by suite-relative posix path */
export async function instrumentFiles(suiteDir) {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      if (dir === suiteDir && SKIP_AT_ROOT.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) out.push(p);
    }
  }
  await walk(suiteDir);
  return out.sort((a, b) => (rel(suiteDir, a) < rel(suiteDir, b) ? -1 : 1));
}

const rel = (root, p) => relative(root, p).split(sep).join('/');

/** sha256 hex over `<relpath>\0<bytes>\0` for every instrument file, in sorted order. */
export async function instrumentDigest(suiteDir) {
  const h = createHash('sha256');
  for (const p of await instrumentFiles(suiteDir)) {
    h.update(rel(suiteDir, p), 'utf8');
    h.update('\0');
    h.update(await readFile(p));
    h.update('\0');
  }
  return h.digest('hex');
}

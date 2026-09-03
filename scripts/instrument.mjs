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
 * instrument), `node_modules/`, the suite-root README.md and PRE-REGISTRATION.md, and
 * the `<uuid>.jsonl` transcripts the harness writes into a replay case's directory. The runner stamps it on each SweepRecord and on
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

/**
 * Harness output inside a case directory is not instrument either. Resuming a
 * `history_file` case writes `<sessionId>.jsonl` beside `history.jsonl` (harness-facts
 * #30), and the session id is the one planted in the transcript, so every replay run
 * REWRITES the same file. Hashing it made the 2026-09-03 sweep unmergeable against the
 * tree it was measured on: the digest at sweep start covered the previous run's copy.
 * `history.jsonl` itself is authored and stays in.
 */
const HARNESS_TRANSCRIPT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

/** @returns {Promise<string[]>} absolute file paths, sorted by suite-relative posix path */
export async function instrumentFiles(suiteDir) {
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      if (dir === suiteDir && SKIP_AT_ROOT.has(e.name)) continue;
      if (HARNESS_TRANSCRIPT.test(e.name)) continue;
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

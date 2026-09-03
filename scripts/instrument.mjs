/**
 * instrument.mjs — two digests for everything a score depends on.
 *
 * A sweep measures a condition with an instrument: the cases, their graders, the
 * transcripts they replay, the fixture they scaffold, and that condition's SKILL.md.
 * Change any of those and a score taken before the change is not comparable to one
 * taken after. The pre-registration digest (I2) does not cover this, and drift.json
 * covers only the treatment mirror.
 *
 * The instrument is split in two, because the two halves are shared differently:
 *
 *   `instrumentDigest(suiteDir)`         the SHARED half — every file under the suite
 *                                        except `conditions/`. Every sweep must agree on
 *                                        it, because every sweep measures against it.
 *   `conditionDigest(suiteDir, id)`      the PER-CONDITION half — `conditions/<id>/`
 *                                        and nothing else. Only the sweep of that
 *                                        condition measures against it.
 *
 * Before the split there was one digest over both halves, so adding a fourth condition
 * changed the digest and voided the three existing records: a one-sweep experiment cost
 * four sweeps. A sweep copies ONE condition into `_conditions/current`; the other
 * conditions' files are not part of what it measured, so they are not part of what it
 * is stamped with.
 *
 * Both digests hash every file's bytes together with its suite-relative path, sorted.
 * The shared one skips `results/` (output, not instrument), `node_modules/`, the
 * suite-root README.md and PRE-REGISTRATION.md, and the `<uuid>.jsonl` transcripts the
 * harness writes into a replay case's directory. The runner stamps both on each
 * SweepRecord, the shared one on drift.json; the merger refuses sweeps that disagree
 * with each other or with the tree (I2b).
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const SKIP = new Set(['results', 'node_modules', '.git']);

/** Where the conditions live, relative to the suite. The per-condition digest is over this. */
export const CONDITIONS_DIR = 'conditions';

/**
 * Prose at the suite root is not instrument. PRE-REGISTRATION.md has its own digest
 * (I2) and README.md scores nothing; hashing them would make every amendment or
 * README edit unmergeable against sweeps that were measured on identical graders.
 *
 * `conditions/` is instrument, but not SHARED instrument — see the module comment.
 */
const SKIP_AT_ROOT = new Set(['README.md', 'PRE-REGISTRATION.md', CONDITIONS_DIR]);

/**
 * Harness output inside a case directory is not instrument either. Resuming a
 * `history_file` case writes `<sessionId>.jsonl` beside `history.jsonl` (harness-facts
 * #30), and the session id is the one planted in the transcript, so every replay run
 * REWRITES the same file. Hashing it made the 2026-09-03 sweep unmergeable against the
 * tree it was measured on: the digest at sweep start covered the previous run's copy.
 * `history.jsonl` itself is authored and stays in.
 */
const HARNESS_TRANSCRIPT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jsonl$/;

const rel = (root, p) => relative(root, p).split(sep).join('/');

/**
 * Every file under `dir`, skipping what {@link SKIP} and {@link HARNESS_TRANSCRIPT} name,
 * and what {@link SKIP_AT_ROOT} names when `dir` is `root` itself. Sorted by path
 * relative to `root`, so two walks of the same tree hash the same bytes in the same
 * order whatever `readdir` returned.
 */
async function filesUnder(root, dir, skipAtRoot) {
  const out = [];
  async function walk(d) {
    const entries = await readdir(d, { withFileTypes: true });
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      if (d === root && skipAtRoot.has(e.name)) continue;
      if (HARNESS_TRANSCRIPT.test(e.name)) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) out.push(p);
    }
  }
  await walk(dir);
  return out.sort((a, b) => (rel(root, a) < rel(root, b) ? -1 : 1));
}

/** sha256 hex over `<relpath>\0<bytes>\0` for every listed file, in the order given. */
async function digestFiles(root, files) {
  const h = createHash('sha256');
  for (const p of files) {
    h.update(rel(root, p), 'utf8');
    h.update('\0');
    h.update(await readFile(p));
    h.update('\0');
  }
  return h.digest('hex');
}

/** @returns {Promise<string[]>} absolute paths of the SHARED instrument, sorted by suite-relative posix path */
export const instrumentFiles = (suiteDir) => filesUnder(suiteDir, suiteDir, SKIP_AT_ROOT);

/** The shared instrument: every case, grader, transcript and fixture — no condition. */
export async function instrumentDigest(suiteDir) {
  return digestFiles(suiteDir, await instrumentFiles(suiteDir));
}

/**
 * @returns {Promise<string[]>} absolute paths under `conditions/<id>/`, sorted by
 *   suite-relative posix path. Rejects (ENOENT) when the condition has no directory.
 */
export const conditionFiles = (suiteDir, conditionId) =>
  filesUnder(suiteDir, join(suiteDir, CONDITIONS_DIR, conditionId), new Set());

/**
 * The per-condition instrument: `conditions/<id>/` and nothing else. Paths are hashed
 * relative to the SUITE (`conditions/treatment/SKILL.md`), so two conditions with
 * byte-identical files still digest differently — they are different instruments,
 * because they are loaded under different ids.
 */
export async function conditionDigest(suiteDir, conditionId) {
  const files = await conditionFiles(suiteDir, conditionId);
  // A missing directory rejects above; an EMPTY one must not digest to the empty digest,
  // which every empty condition would share — a digest of nothing is not the digest of a
  // condition.
  if (files.length === 0) {
    const e = new Error(`conditions/${conditionId} holds no files — nothing to digest`);
    /** @type {any} */ (e).code = 'ENOENT';
    throw e;
  }
  return digestFiles(suiteDir, files);
}

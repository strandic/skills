#!/usr/bin/env node
/**
 * Regenerates the treatment condition from the shipped SKILL.md and fails on drift.
 * Signatures: ../scripts/interfaces.mjs § build-conditions
 *
 * Marker convention is documented in docs/plans/primer-evals/3-todos.md, so that
 * describing it here does not match the grep that enforces it.
 *
 * The mirror is the shipped text minus one frontmatter line and nothing else. It
 * carries no generated-by banner: a comment above the opening `---` would push the
 * frontmatter off line 1, and the model reaches for a skill by its description —
 * recon's Δ +1.00 depended on that description parsing. Drift is what tells a
 * reader the file is generated; a banner would only tell them twice.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** @import { ReadTextFile, WriteTextFile } from './interfaces.mjs' */

/* ── Handles: wired here, once. Nothing below this line touches fs. ─────────── */

/** @type {ReadTextFile} */
const readTextFile = (path) => readFile(path, 'utf8');

/** @type {WriteTextFile} */
const writeTextFile = async (path, contents) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
};

/* ── Where the two files live ──────────────────────────────────────────────── */

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Resolved from the script's own location rather than `process.cwd()`, so
 * `node scripts/build-conditions.mjs check` means the same thing from anywhere —
 * including from a git hook, whose cwd is not yours.
 */
export const paths = {
  shippedSkill: join(repoRoot, 'skills/seven-steps-primer/SKILL.md'),
  treatmentMirror: join(repoRoot, 'evals/seven-steps-primer/conditions/treatment/SKILL.md'),
};

/* ── Pure ──────────────────────────────────────────────────────────────────── */

const FLAG = 'disable-model-invocation';

/** A top-level key at column 0. Indented means nested, and nested is not the flag. */
const FLAG_LINE = new RegExp(`^${FLAG}[ \\t]*:`);

/** Lines with their terminators kept, so a join is byte-exact. */
const lines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

/**
 * Offsets of the frontmatter's interior — after the opening fence's newline, up to
 * the start of the closing fence. `null` when the file has no frontmatter, or opens
 * a fence it never closes: in both cases there is no frontmatter to edit, and the
 * safe reading of an unterminated fence is that the whole file is body.
 *
 * @param {string} text
 * @returns {{start: number, end: number}|null}
 */
function frontmatterSpan(text) {
  const opening = text.match(/^---[ \t]*\r?\n/);
  if (!opening) return null;
  const start = opening[0].length;
  let offset = start;
  for (const line of lines(text.slice(start))) {
    if (/^---[ \t]*\r?\n?$/.test(line)) return { start, end: offset };
    offset += line.length;
  }
  return null;
}

/**
 * StripModelInvocation — drop the `disable-model-invocation` line from frontmatter,
 * leave every other byte untouched.
 *
 * Deliberately narrow on all three axes, because the premise of the whole suite is
 * that the condition under test is the *shipped* text: any value is stripped (the
 * key is the flag, not `true`), only at column 0 inside the fence, and a mention
 * anywhere in the body survives — prose about the flag is part of the method.
 *
 * @param {string} skillMarkdown
 * @returns {string}
 */
export function stripModelInvocation(skillMarkdown) {
  const span = frontmatterSpan(skillMarkdown);
  if (!span) return skillMarkdown;
  const frontmatter = skillMarkdown.slice(span.start, span.end);
  const all = lines(frontmatter);
  const kept = all.filter((line) => !FLAG_LINE.test(line));
  if (kept.length === all.length) return skillMarkdown;
  return skillMarkdown.slice(0, span.start) + kept.join('') + skillMarkdown.slice(span.end);
}

/**
 * Numbered lines, without the empty element a trailing newline leaves behind — so
 * "line 12" means what a reader's editor says it means, and a file that merely ends
 * one line sooner reports as ending sooner rather than as a mismatch against ''.
 */
const numbered = (text) => {
  const split = text.split('\n');
  if (split.at(-1) === '') split.pop();
  return split;
};

const excerpt = (line) => {
  const trimmed = line.replace(/\r$/, '');
  return JSON.stringify(trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed);
};

/**
 * DetectDrift — first divergence as `reason`, or '' when equal.
 *
 * Fails closed on a missing or empty committed side: a mirror nobody can read is
 * not a mirror that agrees. Drift means every number measured after it describes a
 * version of the skill that no longer exists.
 *
 * @param {string} generated
 * @param {string} committed
 * @returns {{drifted: boolean, reason: string}}
 */
export function detectDrift(generated, committed) {
  if (typeof committed !== 'string' || committed.length === 0)
    return { drifted: true, reason: 'the committed mirror is missing or empty' };
  if (generated === committed) return { drifted: false, reason: '' };

  const g = numbered(generated);
  const c = numbered(committed);
  for (let i = 0; i < Math.max(g.length, c.length); i++) {
    if (g[i] === c[i]) continue;
    const at = `line ${i + 1}`;
    if (g[i] === undefined)
      return { drifted: true, reason: `${at}: the mirror runs on past the shipped skill — ${excerpt(c[i])}` };
    if (c[i] === undefined)
      return { drifted: true, reason: `${at}: the mirror ends before the shipped skill — expected ${excerpt(g[i])}` };
    return { drifted: true, reason: `${at}: expected ${excerpt(g[i])}, mirror has ${excerpt(c[i])}` };
  }
  // Every line agrees and the files still differ, so the difference is the final
  // newline — invisible in a diff, and a byte the harness reads all the same.
  return {
    drifted: true,
    reason: generated.endsWith('\n')
      ? 'the mirror is missing its trailing newline'
      : 'the mirror has a trailing newline the shipped skill does not',
  };
}

/* ── Effectful: thin enough to be correct by reading ───────────────────────── */

/**
 * @param {ReadTextFile} read
 * @param {{shippedSkill: string}} where
 * @returns {Promise<{generated: string, stripped: boolean}>}
 */
export async function buildTreatment(read, where) {
  const shipped = await read(where.shippedSkill);
  const generated = stripModelInvocation(shipped);
  return { generated, stripped: generated !== shipped };
}

/**
 * `generate` — read the shipped skill, strip, write the mirror.
 *
 * @param {ReadTextFile} read
 * @param {WriteTextFile} write
 * @param {{shippedSkill: string, treatmentMirror: string}} where
 * @returns {Promise<{bytes: number, stripped: boolean}>}
 */
export async function generate(read, write, where) {
  const { generated, stripped } = await buildTreatment(read, where);
  await write(where.treatmentMirror, generated);
  return { bytes: Buffer.byteLength(generated), stripped };
}

/**
 * `check` — regenerate in memory and compare against the committed file. Never
 * writes: CI has to be able to run this on a tree it is not allowed to change.
 *
 * @param {ReadTextFile} read
 * @param {{shippedSkill: string, treatmentMirror: string}} where
 * @returns {Promise<{drifted: boolean, reason: string, stripped: boolean}>}
 */
export async function check(read, where) {
  const { generated, stripped } = await buildTreatment(read, where);
  let committed;
  try {
    committed = await read(where.treatmentMirror);
  } catch {
    return { drifted: true, reason: `no mirror at ${where.treatmentMirror}`, stripped };
  }
  return { ...detectDrift(generated, committed), stripped };
}

/* ── Entry point ───────────────────────────────────────────────────────────── */

const USAGE = 'usage: build-conditions.mjs [generate|check]   (default: check)';

/** Someone moved the production frontmatter; the mirror is still faithful, so say so and carry on. */
const NO_FLAG = `warning: no \`${FLAG}\` line in the frontmatter — nothing to strip`;

const show = (path) => relative(repoRoot, path);

/**
 * `check` is the default so the safe path is the one you get by forgetting.
 *
 * @param {string[]} argv
 * @returns {Promise<number>} process exit code
 */
export async function main(argv) {
  const mode = argv.length === 0 ? 'check' : argv[0];
  if (argv.length > 1 || (mode !== 'generate' && mode !== 'check')) {
    console.error(USAGE);
    return 1;
  }

  if (mode === 'generate') {
    const { bytes, stripped } = await generate(readTextFile, writeTextFile, paths);
    if (!stripped) console.error(NO_FLAG);
    console.log(`wrote ${show(paths.treatmentMirror)} — ${bytes} bytes, flag ${stripped ? 'stripped' : 'absent'}`);
    return 0;
  }

  const { drifted, reason, stripped } = await check(readTextFile, paths);
  if (!stripped) console.error(NO_FLAG);
  if (!drifted) {
    console.log(`no drift — ${show(paths.treatmentMirror)} is ${show(paths.shippedSkill)} minus the flag`);
    return 0;
  }
  console.error(`DRIFT: ${show(paths.treatmentMirror)} is not ${show(paths.shippedSkill)} minus the flag`);
  console.error(`  ${reason}`);
  console.error('  regenerate with: node scripts/build-conditions.mjs generate');
  return 1;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) process.exitCode = await main(process.argv.slice(2));

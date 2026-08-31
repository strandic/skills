/**
 * Self-tests for the suite's own instruments. Zero dependencies.
 * `node --test scripts/test/*.test.mjs` — the trailing glob matters; a bare
 * directory is read as a module path and fails to load.
 *
 * **This file is where the suite is pointed at itself.** Everything else here tests a
 * function; this tests the *instrument* — the grader patterns that decide what a run
 * scored, the argv that decides whether an absence grader could have failed at all, and
 * the citations the whole design rests on. A silently-broken regex that matches
 * everything is the likeliest way this suite lies to us, and it lies in the flattering
 * direction, so the second half of every probe set — the text that must NOT match —
 * carries more weight than the first.
 *
 * Three things live here that live nowhere else, because the plan's `scripts/` layout
 * names four files and this is the only one under `test/`:
 *
 * - `collectGraderProbes` / `checkGraderProbe` (`interfaces.mjs`), implemented against
 *   the committed grader files rather than against a fixture of them;
 * - the wiring for I3, I5, I6 and I7 — pure predicates in `invariants.mjs`, connected
 *   here to real case files, the real README and the real git-committed prose;
 * - the harness-fact citations, re-checked against the CLI binary they were read out of.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  paths, discoverCases, frontmatter, buildEvalArgv, invocationFor,
} from '../run-evals.mjs';
import { mergeSweeps } from '../merge-results.mjs';
import * as inv from '../invariants.mjs';

const bad = (message) => { throw new Error(message); };

/** Real handles, read-only. Repo-relative in, absolute out — `SuitePaths` is relative. */
const abs = (p) => join(paths.repoRoot, p);
const readTextFile = (p) => readFile(abs(p), 'utf8');
const listDirectory = async (p) => {
  const entries = await readdir(abs(p), { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
};

/* ────────────────────────────────────────────────────────────────────────────
 * Caller-supplied expectations.
 *
 * Every count below is a ratchet, written down by hand and bumped deliberately. None
 * is derived from the data it judges, for the reason `invariants.mjs` opens with: a
 * check that both decides what it should find and confirms it found it passes loudly
 * and greenly over a suite that has silently stopped discovering anything.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Every grader file the suite ships, patterned or not. */
const EXPECTED_GRADERS = 27;

/** Of those, the ones carrying an authored pattern — the only ones a probe can test. */
const EXPECTED_PATTERNED_GRADERS = 11;

/**
 * Test files that declare no tests report `pass 1`; this is the floor that catches it.
 * Standing at 190 when it was written. Raise it when you add tests; lowering it is a
 * decision somebody has to make on purpose, which is the entire function of a ratchet.
 */
const MIN_DECLARED_TESTS = 188;

/**
 * The cases whose claim is *the source was not touched* — authored, never derived. A
 * check must not decide for itself what it is supposed to find.
 *
 * `triage-skip-oneliner` also makes an absence claim and is deliberately NOT here. Its
 * claim is that no ceremony was *created*, and `file_exists` sees created paths however
 * they were made — a `cat >` heredoc creates a file exactly as visibly as `Write` does.
 * I6 exists for the other gap, the one recon demonstrated: a tool-name grader cannot see
 * a `sed -i` over a file that already existed. Naming a case here that has no source to
 * leave alone would fail I6 for the wrong reason.
 */
const ABSENCE_CASES = ['gate-stop-step0', 'looks-trivial-is-structural'];

/** Exactly one diagnostic, and it must never reach a scored table (I7). */
const EXPECTED_CONTROL_CASES = 1;

/* ────────────────────────────────────────────────────────────────────────────
 * Reading a grader file.
 *
 * A purpose-built frontmatter reader rather than `run-evals.mjs`'s `yamlish`, and the
 * difference is one line: `yamlish` strips a trailing ` #…` comment from every value.
 * That is right for a case file and wrong for a grader, whose value may be a regex —
 * `(a|b) #\d+` would arrive truncated to `(a|b)` and match strictly more than it says.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A YAML scalar, unquoted. A double-quoted scalar carrying an escape YAML does not
 * define REFUSES rather than guessing: `"\s"` is not `\s` in YAML and is not `s`
 * either, and a pattern silently read either way stops meaning what it says.
 *
 * @param {string} value
 * @param {string} where
 * @returns {string}
 */
function unquote(value, where) {
  const v = value.trim();
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    const inner = v.slice(1, -1);
    return inner.replace(/\\(.)/g, (_, c) => {
      const known = { '\\': '\\', '"': '"', '/': '/', n: '\n', t: '\t', r: '\r', '0': '\0' };
      if (!(c in known)) bad(`${where}: \\${c} is not a YAML double-quoted escape — quote the ` +
        `value with ' instead, where a backslash is literal`);
      return known[c];
    });
  }
  return v;
}

/** `{ source: file, path: src/x.js }` → an object; anything else → null. */
function inlineMap(value) {
  const v = String(value ?? '').trim();
  if (!v.startsWith('{') || !v.endsWith('}')) return null;
  /** @type {Record<string,string>} */
  const out = {};
  for (const pair of v.slice(1, -1).split(',')) {
    const m = /^\s*([A-Za-z_][\w-]*)\s*:\s*(.*?)\s*$/.exec(pair);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

/**
 * Frontmatter as a flat record. Both a grader and a probe overlay are one key per line
 * — a nested block would be silently dropped, so it refuses instead.
 *
 * @param {string} text
 * @param {string} where
 * @returns {Record<string,string>}
 */
function flatFrontmatter(text, where) {
  const block = frontmatter(text);
  if (block === '') bad(`${where}: no frontmatter — nothing here declares what it is`);
  /** @type {Record<string,string>} */
  const out = {};
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^\s*(#|$)/.test(line)) continue;
    const m = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)$/.exec(line);
    if (!m) bad(`${where}: ${JSON.stringify(line)} is not a top-level key — this reader handles ` +
      'flat frontmatter, and reading a nested block as absent would drop the pattern');
    out[m[1]] = unquote(m[2], `${where} ${m[1]}`);
  }
  return out;
}

/** The same reader, plus the one key without which a grader grades nothing. */
function graderFrontmatter(text, where) {
  const meta = flatFrontmatter(text, where);
  if (!meta.type) bad(`${where}: no type`);
  return meta;
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A path glob as a regex source. `**` has to swallow zero directories as well as many,
 * or `**\/*.md` misses `PLAN.md` and a run that planned at the workspace root scores as
 * a run that did not plan.
 *
 * @param {string} glob
 * @returns {string}
 */
function globToRegExpSource(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*' && glob[i + 2] === '/') { out += '(?:[^/]+/)*'; i += 2; }
      else if (glob[i + 1] === '*') { out += '.*'; i += 1; }
      else out += '[^/]*';
    } else if (c === '?') out += '[^/]';
    else out += escapeRegExp(c);
  }
  return `${out}$`;
}

/**
 * The pattern a grader is asserting, as a regex source — or null where the grader has
 * none to assert.
 *
 * **Three dialects arrive as one field.** `GraderProbe.pattern` is typed as a regex
 * with regex `flags`, but the suite's authored graders carry a glob (`file_exists`) and
 * a literal (`match: contains`) as well. Both are translated here rather than given a
 * dialect field, so a probe leaving this function is exactly the declared shape and
 * `checkGraderProbe` stays a regex check with one branch.
 *
 * A grader with no pattern — an `llm` rubric, a bare `tool_used` count — is not
 * probeable and is excluded rather than failed: there is no text a rubric must not
 * match. That exclusion is what makes `EXPECTED_PATTERNED_GRADERS` a hand-written
 * number instead of a derived one.
 *
 * @param {Record<string,string>} meta
 * @param {string} where
 * @returns {{source: string, flags: string, dialect: string, authored: string}|null}
 */
function patternOf(meta, where) {
  const flags = meta.flags ?? '';
  switch (meta.type) {
    case 'regex':
      if (!meta.pattern) bad(`${where}: a regex grader with no pattern`);
      return meta.match === 'contains'
        ? { source: escapeRegExp(meta.pattern), flags, dialect: 'literal', authored: meta.pattern }
        : { source: meta.pattern, flags, dialect: 'regex', authored: meta.pattern };
    case 'file_exists':
      if (!meta.path) bad(`${where}: a file_exists grader with no path glob`);
      return { source: globToRegExpSource(meta.path), flags, dialect: 'glob', authored: meta.path };
    case 'tool_used':
      if (!meta.input_match) return null;
      return { source: meta.input_match, flags, dialect: 'regex', authored: meta.input_match };
    case 'llm':
      return null;
    default:
      return bad(`${where}: unknown grader type '${meta.type}'`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Probes.
 * ──────────────────────────────────────────────────────────────────────────── */

const FENCE = /^```probe-(match|no-match)[^\n]*\n([\s\S]*?)\n```[ \t]*$/gm;

/** Every fenced sample in a markdown body, split by polarity. */
function probeFences(markdown) {
  const mustMatch = [];
  const mustNotMatch = [];
  FENCE.lastIndex = 0;
  for (let m = FENCE.exec(markdown); m !== null; m = FENCE.exec(markdown))
    (m[1] === 'match' ? mustMatch : mustNotMatch).push(m[2]);
  return { mustMatch, mustNotMatch };
}

/**
 * CollectGraderProbes — every authored grader paired with the text that proves it
 * discriminates.
 *
 * Samples come from two places and are UNIONED, never overridden. Most live in a
 * `## Probes` section inside the grader file itself, beside the sentence explaining why
 * that negative is the one that matters — separating a probe from its argument is how
 * the argument stops being maintained. The rest live in `prompt-fixtures/`, which is
 * where real baseline output lands once a sweep has produced any: a harvested sample
 * must be able to arrive without an editor touching the authored rationale, and union
 * semantics mean an overlay can only ever make a grader stricter.
 *
 * @param {(path: string) => Promise<string>} read
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} list
 * @param {typeof paths} where
 * @returns {Promise<{graders: object[], probes: import('../types.mjs').GraderProbe[]}>}
 */
async function collectGraderProbes(read, list, where) {
  const specs = await discoverCases(read, list, where);
  /** @type {object[]} */
  const graders = [];

  for (const spec of specs) {
    const dir = `${where.suiteDir}/${spec.dir}/graders`;
    const entries = await list(dir).catch(() => null);
    if (entries === null)
      bad(`${spec.dir}: no graders/ directory — a case that grades nothing scores everything`);
    const files = entries.filter((e) => !e.isDirectory && e.name.endsWith('.md')).map((e) => e.name).sort();
    if (files.length === 0) bad(`${spec.dir}: graders/ is empty`);
    for (const file of files) {
      const graderId = `${spec.dir}/graders/${file}`;
      const text = await read(`${dir}/${file}`);
      const meta = graderFrontmatter(text, graderId);
      graders.push({
        graderId,
        caseName: spec.name,
        casePromptPath: `${where.suiteDir}/${spec.dir}/prompt.md`,
        text,
        meta,
        pattern: patternOf(meta, graderId),
        ...probeFences(text),
      });
    }
  }

  const byId = new Map(graders.map((g) => [g.graderId, g]));

  // The overlay. A file here that names no grader is an orphan — probes that test
  // nothing — so it refuses rather than being skipped. README.md is the one exception,
  // by name, because it is the document describing this format.
  const fixturesDir = `${where.suiteDir}/prompt-fixtures`;
  for (const entry of (await list(fixturesDir).catch(() => []))) {
    if (entry.isDirectory || !entry.name.endsWith('.md') || entry.name === 'README.md') continue;
    const at = `${fixturesDir}/${entry.name}`;
    const text = await read(at);
    const meta = flatFrontmatter(text, at);
    if (!meta.grader) bad(`${at}: no \`grader:\` key — a probe that names no grader tests nothing`);
    const target = byId.get(meta.grader);
    if (!target) bad(`${at}: names grader '${meta.grader}', which the suite does not define`);
    const { mustMatch, mustNotMatch } = probeFences(text);
    if (mustMatch.length === 0 && mustNotMatch.length === 0)
      bad(`${at}: declares a grader but carries no probe fences`);
    target.mustMatch.push(...mustMatch);
    target.mustNotMatch.push(...mustNotMatch);
  }

  const probes = graders
    .filter((g) => g.pattern !== null)
    .map((g) => ({
      graderId: g.graderId,
      pattern: g.pattern.source,
      flags: g.pattern.flags,
      mustMatch: g.mustMatch,
      mustNotMatch: g.mustNotMatch,
    }));

  return { graders, probes };
}

const excerpt = (s) => {
  const flat = String(s).replace(/\s+/g, ' ').trim();
  return flat.length <= 76 ? flat : `${flat.slice(0, 75)}…`;
};

const VALID_FLAGS = /^[dgimsuvy]*$/;
/**
 * A group that is only flags — `(?i)`, `(?im-s:`. At least one flag letter has to sit
 * between `(?` and the `)` or `:`, which is precisely what a non-capturing `(?:`, a
 * lookahead `(?=` / `(?!` and a named group `(?<` do not have.
 */
const INLINE_FLAGS = /\(\?[dgimsuvy]+(?:-[dgimsuvy]+)?[):]/;

/**
 * CheckGraderProbe — a `mustNotMatch` hit fails as loudly as a `mustMatch` miss.
 *
 * The asymmetry is the whole point. A pattern that misses a positive fails visibly on
 * the next sweep, because the case scores 0 and somebody asks why. A pattern that
 * matches everything scores 1 forever and nobody asks anything.
 *
 * An empty half is refused rather than skipped, for the reason every check in
 * `invariants.mjs` carries a non-emptiness assertion: a rule with nothing to test is
 * true, and reports itself as such.
 *
 * @param {import('../types.mjs').GraderProbe} probe
 * @returns {{ ok: boolean, failures: string[] }}
 */
function checkGraderProbe(probe) {
  /** @type {string[]} */
  const failures = [];
  const id = probe.graderId;

  if (!VALID_FLAGS.test(probe.flags ?? ''))
    failures.push(`${id}: flags ${JSON.stringify(probe.flags)} are not regex flags (d g i m s u v y)`);
  if (new Set(probe.flags ?? '').size !== (probe.flags ?? '').length)
    failures.push(`${id}: duplicated regex flag in ${JSON.stringify(probe.flags)}`);
  if (INLINE_FLAGS.test(probe.pattern))
    failures.push(`${id}: inline flag group in the pattern — put it in \`flags:\` where it is visible`);
  if ((probe.mustMatch ?? []).length === 0)
    failures.push(`${id}: no mustMatch samples — a pattern nothing has to satisfy is satisfied`);
  if ((probe.mustNotMatch ?? []).length === 0)
    failures.push(`${id}: no mustNotMatch samples — the half that catches an over-broad pattern`);
  if (failures.length > 0) return { ok: false, failures };

  const matches = (sample) => {
    // A fresh instance per sample: `g` and `y` carry lastIndex between calls, and a
    // probe set that passes only in order is not a probe set.
    try {
      return new RegExp(probe.pattern, probe.flags ?? '').test(sample);
    } catch (e) {
      failures.push(`${id}: pattern does not compile — ${e.message}`);
      return null;
    }
  };

  for (const sample of probe.mustMatch) {
    const hit = matches(sample);
    if (hit === null) break;
    if (!hit) failures.push(`${id}: MUST match, does not — ${excerpt(sample)}`);
  }
  for (const sample of probe.mustNotMatch) {
    const hit = matches(sample);
    if (hit === null) break;
    if (hit) failures.push(`${id}: MUST NOT match, does — ${excerpt(sample)}`);
  }
  return { ok: failures.length === 0, failures };
}

/* ────────────────────────────────────────────────────────────────────────────
 * The suite, collected once. Registration happens while the module evaluates, so every
 * per-probe test exists before the runner starts and a collection that found nothing
 * cannot present as a clean run.
 * ──────────────────────────────────────────────────────────────────────────── */

const { graders, probes } = await collectGraderProbes(readTextFile, listDirectory, paths);
const specs = await discoverCases(readTextFile, listDirectory, paths);

/* ── The runner's own defect ───────────────────────────────────────────────────
 *
 * A `.test.mjs` that declares no tests reports `pass 1`. This file did exactly that
 * until now, so the suite's own runner was passing vacuously — the same defect the
 * invariants are built against, one level up. Two floors close it: every test file must
 * declare at least one test, and the suite as a whole must declare at least
 * `MIN_DECLARED_TESTS`. The second catches the case the first cannot see — a file that
 * never loaded at all, because a bare `scripts/test` directory argument was read as a
 * module path and the glob quietly matched less than you thought.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Top-level `test(` calls. Loop-registered ones are counted at runtime, below. */
const declaredTests = (source) => (source.match(/^test(?:\.\w+)?\(/gm) ?? []).length;

test('every test file declares at least one test — an empty one reports `pass 1`', async () => {
  const entries = await listDirectory('scripts/test');
  const files = entries.filter((e) => !e.isDirectory && e.name.endsWith('.test.mjs')).map((e) => e.name);
  assert.ok(files.length >= 5, `only ${files.length} test files found — the glob matched less than the suite`);
  for (const name of files) {
    const declared = declaredTests(await readTextFile(`scripts/test/${name}`));
    assert.ok(declared > 0, `scripts/test/${name} declares no tests and would report \`pass 1\``);
  }
});

test('the suite declares at least the floor it declared last time', async () => {
  const entries = await listDirectory('scripts/test');
  let total = 0;
  for (const e of entries)
    if (!e.isDirectory && e.name.endsWith('.test.mjs'))
      total += declaredTests(await readTextFile(`scripts/test/${e.name}`));
  // A hand-written ratchet, bumped deliberately. Derived from the files it judges it
  // would agree with whatever it found, including nothing.
  assert.ok(total >= MIN_DECLARED_TESTS,
    `${total} statically declared tests, floor ${MIN_DECLARED_TESTS} — tests were removed or a file stopped loading`);
});

/* ── Discovery ─────────────────────────────────────────────────────────────── */

test('every case ships graders, and the suite ships the number it says it does', () => {
  assert.equal(graders.length, EXPECTED_GRADERS,
    `${graders.length} graders discovered, ${EXPECTED_GRADERS} expected — a directory moved, or one was added without a probe set`);
  for (const spec of specs)
    assert.ok(graders.some((g) => g.caseName === spec.name), `${spec.name}: no grader reached discovery`);
});

test('a rubric that quotes its prompt quotes the CURRENT one', async () => {
  // A judge grading a reply against a request that has been replaced fails correct
  // answers three votes to nil, and nothing about the output says why. It happened:
  // triage-decompose-epic's prompt was rewritten and its rubric kept quoting the old
  // one. The convention `The request was: "..."` makes the coupling checkable, so it is.
  let checked = 0;
  for (const g of graders) {
    const quoted = /The request was:\s*"([^"]{20,})"/.exec(g.text ?? '');
    if (!quoted) continue;
    const prompt = await readTextFile(g.casePromptPath).catch(() => '');
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    assert.ok(norm(prompt).includes(norm(quoted[1])),
      `${g.graderId} quotes a request that is not in ${g.caseName}/prompt.md — ` +
      'the rubric and the run are describing different work');
    checked++;
  }
  assert.ok(checked > 0, 'no rubric quotes its prompt — this check found nothing to check');
});

test('the patterned graders are the ones a probe can test, and there are the expected number', () => {
  assert.equal(probes.length, EXPECTED_PATTERNED_GRADERS,
    `${probes.length} patterned graders, ${EXPECTED_PATTERNED_GRADERS} expected`);
  const unpatterned = graders.filter((g) => g.pattern === null);
  for (const g of unpatterned)
    assert.ok(g.meta.type === 'llm' || (g.meta.type === 'tool_used' && !g.meta.input_match),
      `${g.graderId}: type ${g.meta.type} carries a pattern in every other case but lost it here`);
  assert.equal(graders.length - unpatterned.length, probes.length);
});

test('an unpatterned grader is unpatterned by TYPE, never by a dropped key', () => {
  for (const g of graders) {
    if (g.meta.type === 'regex') assert.ok(g.meta.pattern, `${g.graderId}: regex grader with no pattern`);
    if (g.meta.type === 'file_exists') assert.ok(g.meta.path, `${g.graderId}: file_exists grader with no path`);
    if (g.meta.type === 'llm') assert.ok(g.meta.focus, `${g.graderId}: llm grader with no focus`);
    if (g.meta.type === 'tool_used') assert.ok(g.meta.tool, `${g.graderId}: tool_used grader naming no tool`);
  }
});

/* ── One test per grader, so a failure names the grader ────────────────────── */

let registeredProbeTests = 0;
for (const probe of probes) {
  registeredProbeTests += 1;
  test(`probe · ${probe.graderId} discriminates`, () => {
    const { ok, failures } = checkGraderProbe(probe);
    assert.ok(ok, failures.join('\n         '));
  });
}

test('a test was registered for every probe, not for whatever survived a filter', () => {
  assert.equal(registeredProbeTests, probes.length);
  assert.equal(registeredProbeTests, EXPECTED_PATTERNED_GRADERS);
});

/* ── Do the committed samples have teeth? ──────────────────────────────────────
 *
 * A probe set can pass while asserting nothing: positives that any pattern matches,
 * negatives that any pattern misses. The two degenerate patterns settle it without
 * touching a file. Every grader's samples are held against `[\s\S]*`, which matches
 * everything, and against `(?!)`, which matches nothing — and each committed set has to
 * reject both. A grader that survives either is one whose probes are decoration.
 * ──────────────────────────────────────────────────────────────────────────── */

test('every committed mustNotMatch set rejects a pattern that matches everything', () => {
  for (const probe of probes) {
    const r = checkGraderProbe({ ...probe, pattern: '[\\s\\S]*', flags: '' });
    assert.equal(r.ok, false, `${probe.graderId}: its negatives do not catch an over-broad pattern`);
    assert.match(r.failures.join(' '), /MUST NOT match, does/);
  }
});

test('every committed mustMatch set rejects a pattern that matches nothing', () => {
  for (const probe of probes) {
    const r = checkGraderProbe({ ...probe, pattern: '(?!)', flags: '' });
    assert.equal(r.ok, false, `${probe.graderId}: its positives do not catch a dead pattern`);
    assert.match(r.failures.join(' '), /MUST match, does not/);
  }
});

/* ── The checker itself, since it is the thing being trusted ───────────────── */

const probeOf = (over) => ({
  graderId: 'synthetic/graders/x.md', pattern: 'a+', flags: '',
  mustMatch: ['aaa'], mustNotMatch: ['bbb'], ...over,
});

test('checkGraderProbe fails a mustNotMatch hit as loudly as a mustMatch miss', () => {
  const missed = checkGraderProbe(probeOf({ mustMatch: ['bbb'] }));
  const overmatched = checkGraderProbe(probeOf({ pattern: '.*', mustNotMatch: ['bbb'] }));
  assert.equal(missed.ok, false);
  assert.match(missed.failures.join(' '), /MUST match, does not/);
  assert.equal(overmatched.ok, false);
  assert.match(overmatched.failures.join(' '), /MUST NOT match, does/);
});

test('checkGraderProbe refuses a probe with an empty half rather than reporting it clean', () => {
  assert.equal(checkGraderProbe(probeOf({ mustMatch: [] })).ok, false);
  assert.equal(checkGraderProbe(probeOf({ mustNotMatch: [] })).ok, false);
  assert.match(checkGraderProbe(probeOf({ mustNotMatch: [] })).failures.join(' '), /over-broad/);
});

test('checkGraderProbe refuses flags that are not flags, and an inline flag group', () => {
  assert.equal(checkGraderProbe(probeOf({ flags: 'x' })).ok, false);
  assert.equal(checkGraderProbe(probeOf({ flags: 'ii' })).ok, false);
  assert.equal(checkGraderProbe(probeOf({ pattern: '(?i)a+' })).ok, false);
  assert.equal(checkGraderProbe(probeOf({ pattern: '(?:a)+' })).ok, true);
});

test('a stateful flag does not make the probe set order-dependent', () => {
  // `g` carries lastIndex between .test() calls on one instance, so a shared regex
  // reports the second identical sample as a miss. A fresh instance per sample is the
  // difference between a probe set and a probe set that passes once.
  assert.equal(checkGraderProbe(probeOf({ flags: 'g', mustMatch: ['aaa', 'aaa'] })).ok, true);
});

test('the glob translation matches zero directories as well as many', () => {
  const re = (glob) => new RegExp(globToRegExpSource(glob));
  assert.ok(re('**/*.md').test('PLAN.md'), 'a plan at the workspace root still counts as a plan');
  assert.ok(re('**/*.md').test('docs/plans/rate-limiting/0-plan.md'));
  assert.equal(re('**/*.md').test('docs/plans/rate-limiting/0-plan.txt'), false);
  assert.equal(re('**/*.md').test('src/middleware/index.js'), false);
});

test('a double-quoted YAML escape that YAML does not define is refused, not guessed', () => {
  assert.throws(() => unquote('"\\s+"', 'x'), /not a YAML double-quoted escape/);
  assert.equal(unquote("'\\s+'", 'x'), '\\s+');
});

/* ── The overlay, which has no committed files yet and still has to be sound ── */

test('a prompt-fixtures overlay unions into its grader and never replaces its samples', async () => {
  const overlay = [
    '---', 'grader: gate-stop-step0/graders/liveness.md', '---',
    'Harvested from the without column.', '',
    '```probe-no-match', 'Reading the middleware now, one moment', '```', '',
  ].join('\n');
  const read = async (p) => (p.endsWith('prompt-fixtures/harvested.md') ? overlay : readTextFile(p));
  const list = async (p) => (p.endsWith('prompt-fixtures')
    ? [{ name: 'README.md', isDirectory: false }, { name: 'harvested.md', isDirectory: false }]
    : listDirectory(p));

  const merged = await collectGraderProbes(read, list, paths);
  const before = probes.find((p) => p.graderId === 'gate-stop-step0/graders/liveness.md');
  const after = merged.probes.find((p) => p.graderId === 'gate-stop-step0/graders/liveness.md');
  assert.deepEqual(after.mustMatch, before.mustMatch, 'an overlay adds; it does not replace');
  assert.equal(after.mustNotMatch.length, before.mustNotMatch.length + 1);
  assert.equal(checkGraderProbe(after).ok, true);
});

test('an overlay naming no grader, or an unknown one, refuses rather than being skipped', async () => {
  const orphan = ['---', 'note: harvested', '---', '```probe-match', 'x', '```', ''].join('\n');
  const unknown = ['---', 'grader: nope/graders/nope.md', '---', '```probe-match', 'x', '```', ''].join('\n');
  const listOne = (name) => async (p) => (p.endsWith('prompt-fixtures')
    ? [{ name, isDirectory: false }] : listDirectory(p));
  // Intercept the overlay file and nothing else: a read that answered for every path
  // under prompt-fixtures/ would hand `case.yaml` back too, and discovery would report
  // the fixtures directory as a seventh case.
  const readOne = (name, text) => async (p) => (p.endsWith(`prompt-fixtures/${name}`) ? text : readTextFile(p));

  await assert.rejects(
    collectGraderProbes(readOne('orphan.md', orphan), listOne('orphan.md'), paths), /names no grader/);
  await assert.rejects(
    collectGraderProbes(readOne('ghost.md', unknown), listOne('ghost.md'), paths), /does not define/);
});

/* ── I5 — no grader ships without complete probes ──────────────────────────── */

test('I5 — every patterned grader carries both halves of a probe set', () => {
  const ids = probes.map((p) => p.graderId);
  assert.equal(ids.length, EXPECTED_PATTERNED_GRADERS, 'the grader list is supplied, not derived');
  const r = inv.i5GradersHaveCompleteProbes(probes, ids);
  assert.ok(r.ok, r.violations.join('\n         '));
});

test('I5 — a grader added without probes is a visible gap, not an untested one', () => {
  const r = inv.i5GradersHaveCompleteProbes(probes, [...probes.map((p) => p.graderId), 'new-case/graders/new.md']);
  assert.equal(r.ok, false);
  assert.match(r.violations.join(' '), /new-case\/graders\/new\.md: no probes/);
});

/* ── I6 — an absence claim needs content evidence ──────────────────────────── */

test('I6 — the source-absence cases rest on a {source: file} grader, not on tool names', () => {
  const cases = specs.map((spec) => ({
    name: spec.name,
    graders: graders.filter((g) => g.caseName === spec.name).map((g) => ({
      type: g.meta.type,
      tool: g.meta.tool,
      target: inlineMap(g.meta.target) ?? g.meta.target,
      focus: inlineMap(g.meta.focus) ?? g.meta.focus,
    })),
  }));
  for (const name of ABSENCE_CASES)
    assert.ok(cases.some((c) => c.name === name), `${name} is named as an absence case but did not discover`);
  const r = inv.i6AbsenceClaimsHaveContentEvidence(cases, ABSENCE_CASES);
  assert.ok(r.ok, r.violations.join('\n         '));
});

test('I6 — strip the content grader and the absence claim is refused', () => {
  const stripped = [{
    name: 'gate-stop-step0',
    graders: [{ type: 'tool_used', tool: 'Edit' }, { type: 'tool_used', tool: 'Write' }],
  }];
  const r = inv.i6AbsenceClaimsHaveContentEvidence(stripped, ['gate-stop-step0']);
  assert.equal(r.ok, false);
  assert.match(r.violations.join(' '), /rests on tool-name graders alone/);
});

/* ── I3 — the claim ceiling, read out of the ruling that set it ────────────── */

/** The D7 blockquote in `0-plan.md`. One copy in the repo; every check reads that one. */
function claimCeiling(planMarkdown) {
  const lines = planMarkdown.split('\n');
  const start = lines.findIndex((l) => /^>\s*With the primer loaded/.test(l));
  if (start < 0) bad('0-plan.md carries no claim-ceiling blockquote — D7 is the source of this sentence');
  const out = [];
  for (let i = start; i < lines.length && lines[i].startsWith('>'); i++) out.push(lines[i].replace(/^>\s?/, ''));
  return out.join(' ');
}

test('I3 — the claim ceiling sentence is present verbatim in the suite README', async () => {
  const ceiling = claimCeiling(await readTextFile('docs/plans/primer-evals/0-plan.md'));
  const readme = await readTextFile('evals/seven-steps-primer/README.md');
  const r = inv.i3ClaimCeilingIntact(readme, ceiling, {
    claimsSectionChanged: false, preRegistrationShaChanged: false,
  });
  assert.ok(r.ok, `${r.violations.join('; ')} — D7 fixes this sentence in 0-plan.md and ` +
    'evals/seven-steps-primer/README.md must carry it word for word');
});

test('I3 — a README that drops or paraphrases the sentence is refused', async () => {
  const ceiling = claimCeiling(await readTextFile('docs/plans/primer-evals/0-plan.md'));
  const diff = { claimsSectionChanged: false, preRegistrationShaChanged: false };
  assert.equal(inv.i3ClaimCeilingIntact('# Suite\n\nIt works.\n', ceiling, diff).ok, false);
  assert.equal(inv.i3ClaimCeilingIntact('', ceiling, diff).ok, false, 'a missing README is not an intact ceiling');
  assert.equal(inv.i3ClaimCeilingIntact(`x ${ceiling.replace('does not add', 'never adds')} y`, ceiling, diff).ok, false);
  assert.equal(inv.i3ClaimCeilingIntact(`x\n${ceiling.replace(/ /g, '\n')}\ny`, ceiling, diff).ok, true,
    'whitespace is insensitive; the words are not');
});

/* ── The argv, from the grader side ────────────────────────────────────────────
 *
 * `run-evals.test.mjs` pins this array as the runner's contract. It is pinned again
 * here for a different reason, and the reason is this file's subject: an absence grader
 * is VACUOUS unless the run could have done the thing it claims restraint from. The
 * grant is intersected in two places, so a case that lists `Bash` and an operator who
 * does not grant it produce a run that scores 1.00 on `Edit called 0x` because nothing
 * could have edited anything. That failure lives in the argv and shows up as a grader
 * result, which is why it is asserted from here as well as from there.
 * ──────────────────────────────────────────────────────────────────────────── */

test('BuildEvalArgv — the exact argv the suite will run, target first', () => {
  assert.deepEqual(buildEvalArgv(invocationFor('treatment', paths, specs)), [
    'plugin', 'eval', '.',
    '--eval-dir', 'evals/seven-steps-primer',
    '--ablation', 'with-without',
    '--runs', '5',
    '--model', 'sonnet',
    '--judge-model', 'opus',
    '--threshold', '0.6',
    '--scaffold',
    '--no-publish',
    '--tag', 'capability', 'core', 'gate', 'guardrail', 'scored', 'triage',
    '--allow-tools', 'Bash', 'Edit', 'Write',
    '--json',
  ]);
});

test('the mutation tools every absence grader names are actually granted on the command line', () => {
  const argv = buildEvalArgv(invocationFor('treatment', paths, specs));
  const granted = argv.slice(argv.indexOf('--allow-tools') + 1, argv.indexOf('--json'));
  // The harness auto-grants a read-only set; asking for those on the command line is
  // noise, and a grader naming one is not at risk of the vacuous pass this test exists
  // to catch. Only gated tools need an explicit grant.
  const AUTO_GRANTED = new Set(['Read', 'Glob', 'Grep', 'NotebookRead', 'Skill',
    'AskUserQuestion', 'Agent', 'TodoWrite']);
  const named = new Set(graders.filter((g) => g.meta.type === 'tool_used').map((g) => g.meta.tool));
  for (const tool of named)
    if (!AUTO_GRANTED.has(tool))
      assert.ok(granted.includes(tool),
        `${tool} is counted by an absence grader but never granted — the grader would pass vacuously`);
  assert.ok(granted.includes('Bash'),
    'Bash stays granted on purpose: restraint the run was incapable of is not restraint');
});

/* ── MergeSweeps — the replay case is capability evidence, by mechanism ─────── */

/** The registered directions, D6a. Four delta cases against three controls. */
const D6A = {
  'gate-stop-step0': { none: 1, oneliner: 1, placebo: 0 },
  'looks-trivial-is-structural': { none: 1, oneliner: 1, placebo: 1 },
  'triage-skip-oneliner': { none: 0, oneliner: 0, placebo: 0 },
  'triage-decompose-epic': { none: 1, oneliner: 1, placebo: 1 },
};

/** A pre-registration over the suite's REAL cases, so the merge classifies real names. */
function preRegistrationFromSpecs() {
  const expectedDirection = {};
  for (const [caseName, controls] of Object.entries(D6A))
    for (const [control, sign] of Object.entries(controls)) expectedDirection[`${caseName}/${control}`] = sign;
  return {
    conditions: ['treatment', 'oneliner', 'placebo'],
    cases: specs.map((s) => ({
      name: s.name, evidence: s.evidence, ablation: s.ablation,
      tags: s.tags, scored: s.scored, measures: '',
    })),
    expectedDirection,
    threshold: 0.6,
    subjectModel: 'sonnet',
    judgeModel: 'opus',
    runsPerCase: 5,
    claudeVersion: '2.1.245',
    publishAllConditions: true,
  };
}

const run = (score) => ({ score, passed: score === 1, turns: 3, costUsd: 0, judgeCostUsd: 0, error: null, skippedPaidGraders: false, graders: [] });

function sweepOver(condition, pre, score) {
  return {
    condition,
    exitCode: 0,
    document: {
      schemaVersion: 1, claudeVersion: '2.1.245', startedAt: '2026-08-28T00:00:00.000Z',
      costUsd: 0, partial: false,
      suite: { ablation: 'with-without', threshold: 0.6 },
      cases: pre.cases.map((c) => ({
        name: c.name, dir: c.name,
        arms: c.evidence === 'capability'
          ? { with: [run(score)] }
          : { with: [run(score)], without: [run(0.2)] },
        aggregates: { score, passRate: score },
      })),
    },
    stderrTail: '',
  };
}

test('MergeSweeps — the replay case lands in capabilityRows and reaches deltaRows never', () => {
  const pre = preRegistrationFromSpecs();
  const report = mergeSweeps(
    [sweepOver('treatment', pre, 0.8), sweepOver('oneliner', pre, 0.5), sweepOver('placebo', pre, 0.6)],
    pre,
    { suiteSha: 'x', preRegistrationSha: 'y', claudeVersion: '2.1.245', subjectModel: 'sonnet', judgeModel: 'opus', startedAt: '', runsPerCase: 5, costUsdEstimate: 0 },
  );
  assert.deepEqual(report.capabilityRows.map((r) => r.case), ['step3-markers-in-source'],
    'the replay case is capability evidence because a replayed transcript carries the plugin into both arms');
  assert.equal(report.deltaRows.some((r) => r.case === 'step3-markers-in-source'), false);
  assert.deepEqual(report.capabilityRows[0].contrasts, [], 'a number with no referent has no contrast');
  assert.equal(report.deltaRows.length, 4);
  const r = inv.i4EvidenceKindsNeverMixed(report, 4, 1);
  assert.ok(r.ok, r.violations.join('; '));
});

/* ── I7 — the diagnostic never reaches a headline ──────────────────────────── */

test('I7 — the control case is tagged, and no scored table contains it', () => {
  const controls = specs.filter((s) => s.tags.includes('control'));
  assert.equal(controls.length, EXPECTED_CONTROL_CASES,
    `${controls.length} control-tagged cases, ${EXPECTED_CONTROL_CASES} expected`);
  const pre = preRegistrationFromSpecs();
  const report = mergeSweeps(
    [sweepOver('treatment', pre, 0.8), sweepOver('oneliner', pre, 0.5), sweepOver('placebo', pre, 0.6)],
    pre,
    { suiteSha: 'x', preRegistrationSha: 'y', claudeVersion: '2.1.245', subjectModel: 'sonnet', judgeModel: 'opus', startedAt: '', runsPerCase: 5, costUsdEstimate: 0 },
  );
  const r = inv.i7ControlNeverInHeadline(report, specs);
  assert.ok(r.ok, r.violations.join('; '));
});

test('I7 — a control that leaked into a scored table is caught against the REAL specs', () => {
  const leaked = { deltaRows: [{ case: 'control-all-steps', evidence: 'delta', contrasts: [] }], capabilityRows: [] };
  const r = inv.i7ControlNeverInHeadline(leaked, specs);
  assert.equal(r.ok, false);
  assert.match(r.violations.join(' '), /control-all-steps is control-tagged/);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Harness facts — the citations, re-checked.
 *
 * `harness-facts.md` exists because there is no public documentation page for
 * `plugin eval`: the authoritative text ships inside the CLI binary, and every claim
 * carries a literal substring of its source so a reader can check it. A citation nobody
 * re-checks is a citation that quietly stops being true — the wording moves on a
 * release and the plan keeps asserting the old behaviour.
 *
 * **Which binary.** The pinned one. `harness-facts.md` names the version every claim was
 * read out of, `PreRegistration.claudeVersion` pins the same number, and I2 voids a run
 * whose report disagrees with it — so the version under test is a registered quantity,
 * not whatever happens to be installed. A newer install is surfaced as a diagnostic
 * naming the markers that moved, which is the re-verification prompt harness-facts asks
 * for, without turning somebody's `claude update` into a red suite.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Rows of any table carrying a `Marker` column: the claim number, its class, its marker. */
function harnessFactMarkers(markdown) {
  const rows = [];
  const lines = markdown.split('\n');
  let markerCol = -1;
  let classCol = -1;
  let width = 0;
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  for (const line of lines) {
    if (!line.trim().startsWith('|')) { markerCol = -1; continue; }
    const c = cells(line);
    if (c.includes('Marker')) { markerCol = c.indexOf('Marker'); classCol = c.indexOf('Class'); width = c.length; continue; }
    if (markerCol < 0) continue;
    if (c.every((x) => /^-+$/.test(x))) continue;
    if (c.length !== width) bad(`harness-facts.md: a row has ${c.length} cells, header has ${width} — ` +
      'a cell contains a pipe and this reader would mis-column it');
    const cell = c[markerCol];
    const span = /^``\s?([\s\S]+?)\s?``$/.exec(cell) ?? /^`([\s\S]+)`$/.exec(cell);
    if (!span) bad(`harness-facts.md: claim ${c[0]} has no code-span marker — a claim with no ` +
      'citation is the "verdicts without evidence" failure applied to our own design');
    rows.push({ claim: c[0], cls: classCol >= 0 ? c[classCol] : '', marker: span[1] });
  }
  return rows;
}

test('every harness fact carries a checkable marker, and none is UNVERIFIED', async () => {
  const md = await readTextFile('docs/plans/primer-evals/harness-facts.md');
  const markers = harnessFactMarkers(md);
  assert.ok(markers.length >= 15, `${markers.length} markers parsed — the table moved`);
  for (const m of markers) {
    assert.ok(m.marker.length >= 20, `claim ${m.claim}: marker ${JSON.stringify(m.marker)} is short ` +
      'enough to match by accident');
    assert.equal(m.cls.includes('UNVERIFIED'), false,
      `claim ${m.claim} is UNVERIFIED and must not be relied on until a run settles it`);
  }
  assert.match(md, /\*\*Pinned version:\*\* `\d+\.\d+\.\d+`/, 'harness-facts.md must pin the version it was read from');
});

const CLI_VERSIONS = join(homedir(), '.local', 'share', 'claude', 'versions');

/**
 * Return the markers that did NOT appear in the binary.
 *
 * Two passes, because the binary holds two kinds of text. Minified JS is plain ASCII and
 * `strings` streams it cheaply. The bundled reference has been a Bun asset stored as
 * **UTF-16LE since 2.1.246** — every other byte is 0x00, so `strings` emits nothing for
 * it and eleven citations silently "broke" while neither they nor the harness had moved.
 * A failing marker is first evidence that the bundling changed, not that a fact did.
 */
function unresolvedMarkers(bin, markers) {
  return new Promise((resolve, reject) => {
    const remaining = new Set(markers);
    const child = spawn('strings', ['-n', '20', bin], { stdio: ['ignore', 'pipe', 'ignore'] });
    let carry = '';
    child.on('error', reject);
    child.stdout.setEncoding('utf8');
    child.stdout.on('error', () => {});
    child.stdout.on('data', (chunk) => {
      const hay = carry + chunk;
      for (const m of remaining) if (hay.includes(m)) remaining.delete(m);
      if (remaining.size === 0) child.kill('SIGKILL');
      carry = hay.slice(-4096);
    });
    child.on('close', () => {
      if (remaining.size === 0) return resolve(remaining);
      // Second pass: decode the whole binary as UTF-16LE and look again.
      readFile(bin)
        .then((buf) => {
          const wide = buf.toString('utf16le');
          for (const m of remaining) if (wide.includes(m)) remaining.delete(m);
          resolve(remaining);
        })
        .catch(() => resolve(remaining));
    });
  });
}

test('every harness-fact marker still resolves against the pinned CLI binary', async (t) => {
  const md = await readTextFile('docs/plans/primer-evals/harness-facts.md');
  const pinned = /\*\*Pinned version:\*\* `(\d+\.\d+\.\d+)`/.exec(md)[1];
  const bin = join(CLI_VERSIONS, pinned);
  if (!(await stat(bin).then((s) => s.isFile()).catch(() => false)))
    return t.skip(`no ${bin} on this machine — the citations cannot be checked from here`);

  const markers = harnessFactMarkers(md).map((m) => m.marker);
  let missing;
  try {
    missing = await unresolvedMarkers(bin, markers);
  } catch (e) {
    return t.skip(`\`strings\` is unavailable here (${e.code ?? e.message})`);
  }
  assert.deepEqual([...missing], [],
    `these markers no longer resolve in ${pinned} — the wording moved, so re-read the claims ` +
    'rather than assuming they still hold');

  // Not a failure: a newer CLI is somebody's `claude update`, not a defect in this repo.
  // It IS the prompt to re-verify, so it is named loudly and with the drift attached.
  const installed = await readdir(CLI_VERSIONS).catch(() => []);
  const newest = installed.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort(compareVersions).pop();
  const series = (s) => s.split('.').slice(0, 2).join('.');
  if (newest && series(newest) !== series(pinned)) {
    const moved = await unresolvedMarkers(join(CLI_VERSIONS, newest), markers).catch(() => new Set());
    t.diagnostic(`harness-facts.md pins ${pinned}; ${newest} is installed — a MINOR or MAJOR ` +
      'bump, which voids a run under I2 and is the point at which this file must be re-verified. ' +
      (moved.size === 0
        ? 'Every marker still resolves there.'
        : `${moved.size}/${markers.length} markers do NOT resolve in ${newest}: ` +
          `${[...moved].map((m) => JSON.stringify(m.slice(0, 40))).join(', ')} — re-verify before pinning it.`));
  }
});

/** `2.1.9` sorts before `2.1.10`, which a lexicographic sort gets backwards. */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

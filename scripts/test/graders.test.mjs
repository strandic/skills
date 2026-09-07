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
import { readFile, readdir, stat, mkdtemp, mkdir, rm, copyFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { judgePrompt, readDefectLedger } from '../ledger.mjs';
import {
  paths, suitePathsFor, discoverCases, frontmatter, buildEvalArgv, invocationFor,
} from '../run-evals.mjs';
import { mergeSweeps, parsePreRegistration } from '../merge-results.mjs';
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

/**
 * Every suite, enumerated rather than listed: a suite is an `evals/<name>/` holding a
 * `PRE-REGISTRATION.md`, which is the same rule the runner's `--suite` applies. Listing
 * them would let a suite be added without a self-test and nobody would hear about it.
 */
const TIER1 = 'evals/seven-steps-primer';
const TIER2 = 'evals/seven-steps-primer-defects';

async function discoverSuites() {
  const found = [];
  for (const entry of await listDirectory('evals')) {
    if (!entry.isDirectory) continue;
    const dir = `evals/${entry.name}`;
    if (await readTextFile(`${dir}/PRE-REGISTRATION.md`).then(() => true).catch(() => false)) found.push(dir);
  }
  return found.sort();
}

/**
 * The hand-written expectations, PER SUITE. Every count here is a ratchet, bumped
 * deliberately and derived from nothing: a check that both decides what it should find
 * and confirms it found it passes loudly and greenly over a suite that has silently
 * stopped discovering anything.
 *
 * A suite with no entry here fails the first test below rather than being walked with
 * nothing to compare against.
 */
const RATCHETS = {
  [TIER1]: {
    // 26 since 2026-09-03: step3-markers-in-source's `skill-fired` was removed
    // (Amendment 6) — the replayed seed turn names the skill, so it fired under every
    // condition and scored the transcript, not the behaviour. The pre-registration's
    // grader table never counted it.
    graders: 26,
    patterned: 13,
    controlCases: 1,
    // The cases whose claim is *the source was not touched*. `null` for a suite that
    // makes no absence claim, which is not the same as an empty list: I6 refuses an
    // empty list by design, and passing one would be the vacuous pass in person.
    absenceCases: ['gate-stop-step0', 'looks-trivial-is-structural'],
    ceiling: {
      // Tier 1's ceiling is fixed by D7 of its plan and quoted in its README.
      source: 'plan',
      planPath: 'docs/plans/primer-evals/0-plan.md',
      anchor: /^>\s*With the primer loaded/,
      readme: 'evals/seven-steps-primer/README.md',
    },
  },
  [TIER2]: {
    // 12 `reported-<id>`, one per accepted defect, plus the three guards on the scored
    // case and the diagnostic's own liveness guard. No `surfaced-<id>`: that grader
    // belongs to the run-only class, and recon found the class empty (4-recon.md).
    graders: 16,
    // Only `service-started` carries an authored pattern. An `llm` rubric has none, and
    // an unanchored `tool_used` count has none either.
    patterned: 1,
    controlCases: 1,
    absenceCases: null,
    ceiling: {
      // This suite's ceiling is the registration's own `claimCeiling`, not its plan's
      // blockquote: the plan's D6 sentence was written before recon and superseded at
      // gate 4, while the registration is the file I2 and I8 digest and refuse edits to.
      // The anchor the plan named is asserted against that sentence all the same.
      source: 'registration',
      planPath: 'docs/plans/primer-evals/defect-injection/0-plan.md',
      anchor: /^Gates 0 to 3 are already cleared/,
      readme: 'evals/seven-steps-primer-defects/README.md',
    },
  },
};

const EXPECTED_GRADERS = RATCHETS[TIER1].graders;

/**
 * Of those, the ones carrying an authored pattern — the only ones a probe can test.
 * Bumped 11 -> 13 when `no-source-edits.md` gained a scoped `input_match` in both
 * `gate-stop-step0` and `looks-trivial-is-structural` (finding A3): unscoped, the
 * grader had no `input_match` and `patternOf` returned null for it (not counted); scoped
 * to match `no-source-writes.md`, it now carries a pattern a probe can test, in both
 * cases.
 */
const EXPECTED_PATTERNED_GRADERS = RATCHETS[TIER1].patterned;

/**
 * Test files that declare no tests report `pass 1`; this is the floor that catches it.
 * Standing at 190 when it was written. Raise it when you add tests; lowering it is a
 * decision somebody has to make on purpose, which is the entire function of a ratchet.
 *
 * Bumped 188 -> 191 for the three tests added below with the grader-leak fix: the
 * fixture binding for both `source-untouched` patterns, the linearity guard on them, and
 * the `llm`-body leak check.
 *
 * Bumped 191 -> 490 at step 6 of the defect-injection feature: the grader groups and
 * their floors, the suite resolver, the declared evidence rule, the two argv
 * pass-throughs, the ledger module, the second suite's walk and its fixture's health.
 */
const MIN_DECLARED_TESTS = 490;

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
const ABSENCE_CASES = RATCHETS[TIER1].absenceCases;

/** Exactly one diagnostic, and it must never reach a scored table (I7). */
const EXPECTED_CONTROL_CASES = RATCHETS[TIER1].controlCases;

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
 * **Two dialects arrive as one field.** `GraderProbe.pattern` is typed as a regex with
 * regex `flags`, but the suite's authored graders also carry a glob (`file_exists`).
 * Both are translated here rather than given a dialect field, so a probe leaving this
 * function is exactly the declared shape and `checkGraderProbe` stays a regex check
 * with one branch.
 *
 * **`match` is not a literal-vs-regex switch.** The bundled reference's grader table
 * (`type | frontmatter | body`) spells it out: for `type: regex`, `match:
 * contains|not_contains|count:N`, defaulting to `contains` — `pattern` is a regex in
 * every mode; `match` only picks how many hits the regex must produce, never how the
 * pattern text is read. An earlier version of this function read `match: contains` as
 * "the pattern is a literal, not a regex" and escaped it into one. That happened to
 * score identically to the correct regex reading for this suite's two `match: contains`
 * graders (`source-untouched.md` ×2), because `let hitsInWindow = 0;` contains no regex
 * metacharacter for escaping to change — the bug was live and untested, not absent. Only
 * `contains` is supported below; `not_contains`/`count:N` would need inverted or
 * counted probe semantics this self-test does not implement, so they are refused rather
 * than silently mis-checked.
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
      if (meta.match !== undefined && meta.match !== 'contains')
        bad(`${where}: match '${meta.match}' is not 'contains' — not_contains/count:N need probe semantics this self-test does not implement`);
      return { source: meta.pattern, flags, dialect: 'regex', authored: meta.pattern };
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

const SUITE_DIRS = await discoverSuites();

/** One collection per suite, gathered while the module evaluates. */
const suites = [];
for (const dir of SUITE_DIRS) {
  const suitePaths = suitePathsFor(dir);
  suites.push({
    dir,
    paths: suitePaths,
    ratchet: RATCHETS[dir],
    ...(await collectGraderProbes(readTextFile, listDirectory, suitePaths)),
    specs: await discoverCases(readTextFile, listDirectory, suitePaths),
  });
}

/** The first suite's, so every test written before there was a second one still reads. */
const { graders, probes } = suites.find((s) => s.dir === TIER1);
const specs = suites.find((s) => s.dir === TIER1).specs;

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
for (const suite of suites)
  for (const probe of suite.probes) {
    registeredProbeTests += 1;
    test(`probe · ${suite.dir}/${probe.graderId} discriminates`, () => {
      const { ok, failures } = checkGraderProbe(probe);
      assert.ok(ok, failures.join('\n         '));
    });
  }

test('a test was registered for every probe, not for whatever survived a filter', () => {
  const total = suites.reduce((n, s) => n + s.probes.length, 0);
  assert.equal(registeredProbeTests, total);
  assert.equal(total, Object.values(RATCHETS).reduce((n, r) => n + r.patterned, 0));
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
  for (const probe of suites.flatMap((s) => s.probes)) {
    const r = checkGraderProbe({ ...probe, pattern: '[\\s\\S]*', flags: '' });
    assert.equal(r.ok, false, `${probe.graderId}: its negatives do not catch an over-broad pattern`);
    assert.match(r.failures.join(' '), /MUST NOT match, does/);
  }
});

test('every committed mustMatch set rejects a pattern that matches nothing', () => {
  for (const probe of suites.flatMap((s) => s.probes)) {
    const r = checkGraderProbe({ ...probe, pattern: '(?!)', flags: '' });
    assert.equal(r.ok, false, `${probe.graderId}: its positives do not catch a dead pattern`);
    assert.match(r.failures.join(' '), /MUST match, does not/);
  }
});

/* ── The sentinel patterns, held against the file they are about ───────────────
 *
 * A probe excerpt is hand-written, so a `source-untouched` pattern can pass every probe
 * while no longer matching the real fixture — rename `MAX_REQUESTS` or reflow those
 * lines in `fixtures/notesvc/src/middleware/index.js` and both absence cases would score
 * 0 on every untouched run, in both arms, with the whole probe set still green. The
 * fixture is the thing the grader actually reads at run time, so it is the thing the
 * test reads too.
 *
 * The mutation list is the set of edits the two prompts can plausibly produce, taken
 * from the prompts themselves: `gate-stop-step0` asks to "Move it to per-user rate
 * limiting" (the Map-keyed rewrite), `looks-trivial-is-structural` reports "too many
 * requests" and asks someone to "sort that out" (the parameter tweaks its rubric exists
 * to reject), and the sibling `triage-skip-oneliner` is built on correcting `plese`.
 * Each one must break the pattern, or the grader reports "source untouched" over a real
 * edit.
 * ──────────────────────────────────────────────────────────────────────────── */

const FIXTURE_MIDDLEWARE = 'evals/seven-steps-primer/fixtures/notesvc/src/middleware/index.js';

/** One substitution, refusing to be a no-op — a mutation that changed nothing proves nothing. */
function mutate(text, from, to) {
  const at = text.indexOf(from);
  if (at < 0) bad(`${FIXTURE_MIDDLEWARE} no longer contains ${JSON.stringify(from)} — ` +
    'the fixture moved and the mutation this test is built on cannot be applied');
  if (text.indexOf(from, at + 1) >= 0) bad(`${JSON.stringify(from)} appears twice in the fixture — ` +
    'a mutation that lands in two places is not the edit this test is describing');
  return text.slice(0, at) + to + text.slice(at + from.length);
}

/** Every `source-untouched` grader, paired with its compiled pattern. */
const sentinels = ABSENCE_CASES.map((name) => {
  const graderId = `${name}/graders/source-untouched.md`;
  const g = graders.find((x) => x.graderId === graderId);
  if (!g) bad(`${graderId} did not discover — the absence cases are named by hand, so this is a move, not a rename`);
  if (g.pattern === null) bad(`${graderId} carries no pattern`);
  return { graderId, source: g.pattern.source, flags: g.pattern.flags };
});

/**
 * The five edits the two prompts can plausibly produce, keyed by name. Hoisted out of
 * the test below because the test after it measures the SAME five against the patterns
 * these replaced: two lists that drift apart would let a claim about how much the
 * sentinel gained be true of one list and false of the other.
 *
 * @param {string} fixture
 * @returns {Record<string, string>}
 */
const invitedEdits = (fixture) => ({
  'parameter tweak — the limit raised': mutate(fixture, 'const MAX_REQUESTS = 30;', 'const MAX_REQUESTS = 60;'),
  'parameter tweak — the window widened': mutate(fixture, 'const WINDOW_MS = 60_000;', 'const WINDOW_MS = 300_000;'),
  'parameter tweak — the comparison loosened': mutate(fixture, 'if (hitsInWindow > MAX_REQUESTS) {', 'if (hitsInWindow >= MAX_REQUESTS) {'),
  'the 429 message corrected': mutate(fixture, 'plese try again in a minute', 'please try again in a minute'),
  'the Map-keyed rewrite': mutate(
    mutate(fixture, 'let windowStartedAt = Date.now();\nlet hitsInWindow = 0;', 'const windows = new Map();'),
    'if (hitsInWindow > MAX_REQUESTS) {', 'if (bucket.hits > MAX_REQUESTS) {'),
});

test('the source-untouched patterns match the REAL fixture and break on every edit the prompts invite', async () => {
  const fixture = await readTextFile(FIXTURE_MIDDLEWARE);
  const mutations = invitedEdits(fixture);

  assert.equal(sentinels.length, ABSENCE_CASES.length);
  for (const s of sentinels) {
    const re = () => new RegExp(s.source, s.flags);
    assert.ok(re().test(fixture),
      `${s.graderId}: does not match ${FIXTURE_MIDDLEWARE} as it ships — every untouched run in ` +
      'BOTH arms would score 0 and every probe in this suite would still be green');
    for (const [what, mutated] of Object.entries(mutations)) {
      assert.notEqual(mutated, fixture, `${what}: the mutation is a no-op`);
      assert.equal(re().test(mutated), false,
        `${s.graderId}: still matches after ${what} — it would report "source untouched" over a real edit`);
    }
  }
});

/**
 * The two single-anchor sentinels this one replaced, kept only so the claim about what
 * the replacement bought can be measured instead of recalled. Both shipped as the whole
 * of `pattern` at some point: the 429 message is what `gate-stop-step0` and
 * `looks-trivial-is-structural` carried at HEAD, and the counter's declaration is what
 * round one of this review swapped in before the five-anchor form landed.
 */
const SUPERSEDED_SENTINELS = [
  { was: "HEAD's 429 message", pattern: 'plese try again in a minute', survives: [
    'parameter tweak — the limit raised',
    'parameter tweak — the window widened',
    'parameter tweak — the comparison loosened',
    'the Map-keyed rewrite',
  ] },
  { was: "round one's counter declaration", pattern: 'let hitsInWindow = 0;', survives: [
    'parameter tweak — the limit raised',
    'parameter tweak — the window widened',
    'parameter tweak — the comparison loosened',
    'the 429 message corrected',
  ] },
];

// WHY: the design notes in both `source-untouched.md` bodies justify five anchors by
// saying how many of these edits the single-anchor sentinels scored 1 on — a quantitative
// claim about the instrument that a reader has no way to check. A review already caught
// one of those counts stated wrong. Pinning the exact surviving SET (not the count: a
// count can be right about the wrong edits) makes the prose falsifiable here rather than
// in a sweep, and fails loudly if the fixture shifts under it.
test('the superseded single-anchor sentinels survive exactly the edits the design notes say they do', async () => {
  const fixture = await readTextFile(FIXTURE_MIDDLEWARE);
  const mutations = invitedEdits(fixture);

  for (const { was, pattern, survives } of SUPERSEDED_SENTINELS) {
    assert.ok(new RegExp(pattern).test(fixture),
      `${was}: does not match the untouched fixture, so it never was a sentinel — the fixture moved`);
    const actual = Object.entries(mutations)
      .filter(([, mutated]) => new RegExp(pattern).test(mutated))
      .map(([what]) => what);
    assert.deepEqual(actual.slice().sort(), survives.slice().sort(),
      `${was}: reports "source untouched" over ${actual.length} of ${Object.keys(mutations).length} ` +
      'edits, not the set recorded in the design notes');
  }
});

test('the source-untouched patterns stay linear on an adversarial input', () => {
  // The `A[\s\S]*B[\s\S]*C[\s\S]*D` form these replaced backtracked cubically when the
  // anchors repeat and the tail is absent: on this exact block it took 5 ms at 2 KB,
  // 72 ms at 4 KB, 334 ms at 6 KB and 1,034 ms at 8 KB, so ~8 s at the 16 KB below; the
  // PR review measured a wider block at 16 KB not finishing in 120 s. The lookahead form
  // does the same input in 0.2 ms. The harness reads up to 10 MiB at that path and has
  // no timeout around a grader, so a hang there is a hung sweep. The bound below is
  // ~4 orders of magnitude above the measured 0.2 ms: it catches a reintroduced nested
  // quantifier without being a benchmark that fails on a loaded machine.
  const block = 'const WINDOW_MS = 60_000;\nconst MAX_REQUESTS = 30;\n\nlet hitsInWindow = 0;\npadding\n';
  const adversarial = block.repeat(Math.ceil((16 * 1024) / block.length));
  assert.ok(adversarial.length >= 16 * 1024);
  for (const s of sentinels) {
    const started = process.hrtime.bigint();
    // Both calls the harness makes for `match: contains`: the `.test()` it branches on,
    // and the global `.match()` it runs first regardless of match mode.
    const hit = new RegExp(s.source, s.flags).test(adversarial);
    const g = s.flags.includes('g') ? s.flags : `${s.flags}g`;
    const all = adversarial.match(new RegExp(s.source, g)) ?? [];
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.equal(hit, false, `${s.graderId}: matched an input with no comparison and no 429 body`);
    assert.equal(all.length, 0);
    assert.ok(ms < 2000, `${s.graderId}: took ${ms.toFixed(0)} ms on 16 KB — a nested unbounded ` +
      'quantifier is back in the pattern');
  }
});

/* ── The judge reads the whole body, so the whole body must be criteria ─────────
 *
 * An `llm` (or `baseline`) grader's trimmed markdown body IS its `criteria`, and
 * `criteria` is interpolated straight into the judge prompt — harness-facts.md claims 40
 * and 41. There is no comment-stripping step, so `<!-- design notes -->` in a rubric is
 * not a fence: it is four more lines of prompt, and worked exemplars inside one invite a
 * judge to score by resemblance to a sample it was never meant to see. Design notes
 * belong in `<case>/<grader>.notes.md`, beside `graders/` and never inside it.
 * ──────────────────────────────────────────────────────────────────────────── */

const bodyOf = (text) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

test('no llm or baseline rubric carries anything the judge should not be reading', () => {
  const LEAKS = ['<!--', '## Probes', 'Why:', 'Phrasing:'];
  const rubrics = graders.filter((g) => g.meta.type === 'llm' || g.meta.type === 'baseline');
  assert.ok(rubrics.length >= 6, `${rubrics.length} llm/baseline graders found — the suite ships six`);
  for (const g of rubrics) {
    const body = bodyOf(g.text);
    assert.notEqual(body, g.text, `${g.graderId}: frontmatter did not strip — this check would be vacuous`);
    for (const leak of LEAKS)
      assert.equal(body.includes(leak), false,
        `${g.graderId}: its body contains ${JSON.stringify(leak)}, and the body is what the judge ` +
        'is handed as criteria — move it to the case\'s <grader>.notes.md sibling');
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

// C39: `patternOf` used to read `match: contains` as "pattern is a literal, not a
// regex" and escape it — wrong per the bundled reference's grader table, where `match`
// only picks contains/not_contains/count:N and `pattern` stays a regex throughout. The
// bug was invisible against the suite's real graders because `let hitsInWindow = 0;`
// (both `source-untouched.md` files) has no regex metacharacter for escaping to change.
// `foo.bar` does: escaped, `.` matches only a literal dot; as a regex, it matches any
// character, which is what the harness actually runs.
test('C39 — `match: contains` leaves `pattern` as a regex; it is not a literal escape', () => {
  const pattern = patternOf({ type: 'regex', pattern: 'foo.bar', match: 'contains' }, 'synthetic');
  assert.equal(pattern.source, 'foo.bar', 'the pattern must reach the regex compiler unescaped');
  const re = new RegExp(pattern.source, pattern.flags);
  assert.ok(re.test('xxfoo9barxx'),
    '`.` must match any character under `match: contains` — escaping it into a literal dot ' +
    'is the mis-translation C39 flagged, and it would fail this exact sample');
  assert.throws(() => patternOf({ type: 'regex', pattern: 'x', match: 'not_contains' }, 'synthetic'),
    /not 'contains'/, 'a match mode this self-test cannot verify must refuse, not silently pass through');
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

/**
 * A plan's claim-ceiling blockquote, from the line its anchor names. The anchor is a
 * parameter because the two suites' ceilings open on different words — and because a
 * check that looked for one hard-coded sentence would pass on a suite whose ceiling it
 * had never read.
 */
function claimCeiling(planMarkdown, anchor = /^>\s*With the primer loaded/, where = '0-plan.md') {
  const lines = planMarkdown.split('\n');
  const start = lines.findIndex((l) => anchor.test(l));
  if (start < 0) bad(`${where} carries no claim-ceiling blockquote matching ${anchor} — the plan is the ` +
    'source of this sentence');
  const out = [];
  for (let i = start; i < lines.length && lines[i].startsWith('>'); i++) out.push(lines[i].replace(/^>\s?/, ''));
  return out.join(' ');
}

/**
 * The sentence I3 holds a suite's README to. Tier 1 takes it from its plan, where D7
 * fixed it. The second suite takes it from its REGISTRATION, because that suite's plan
 * sentence was written before recon and superseded at gate 4 — and because the
 * registration is the file whose digest I2 checks and whose edits I8 refuses, which is a
 * stronger anchor than a document either can edit.
 */
async function ceilingFor(suite) {
  const { source, planPath, anchor } = suite.ratchet.ceiling;
  if (source === 'plan') return claimCeiling(await readTextFile(planPath), anchor, planPath);
  const registration = parsePreRegistration(await readTextFile(`${suite.dir}/PRE-REGISTRATION.md`));
  const ceiling = registration.claimCeiling;
  if (typeof ceiling !== 'string' || ceiling.trim() === '')
    bad(`${suite.dir}/PRE-REGISTRATION.md registers no claimCeiling — there is nothing to hold the README to`);
  assert.match(ceiling, anchor, `${suite.dir}: the registered ceiling does not open on the words the plan named`);
  return ceiling;
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

test('BuildEvalArgv — the exact argv of one per-case invocation, target first', () => {
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
  ]);
});

test('the mutation tools every absence grader names are actually granted on the command line', () => {
  const argv = buildEvalArgv(invocationFor('treatment', paths, specs));
  const granted = argv.slice(argv.indexOf('--allow-tools') + 1);
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
  // The pin lives outside the updater's cache on purpose (the cache is pruned), so both
  // homes are tried before this check gives up and skips.
  const candidates = [join(CLI_VERSIONS, pinned), join(homedir(), '.local', 'share', 'claude-pinned', pinned)];
  let bin = null;
  for (const path of candidates)
    if (await stat(path).then((s) => s.isFile()).catch(() => false)) { bin = path; break; }
  if (bin === null)
    return t.skip(`no pinned ${pinned} in ${candidates.join(' or ')} — the citations cannot be checked from here`);

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

/* ────────────────────────────────────────────────────────────────────────────
 * Every suite, walked.
 *
 * The suites are ENUMERATED — an `evals/<name>/` holding a PRE-REGISTRATION.md — and
 * then held against hand-written per-suite ratchets. Both halves matter: enumeration
 * means a suite cannot be added without a self-test, and the ratchets mean the self-test
 * cannot agree with whatever it happened to find.
 * ──────────────────────────────────────────────────────────────────────────── */

test('every suite in the tree is enumerated, and every enumerated suite has ratchets to be held to', () => {
  assert.deepEqual(SUITE_DIRS, [TIER1, TIER2],
    'a suite was added or moved; give it a RATCHETS entry before it can be swept');
  assert.deepEqual(Object.keys(RATCHETS).sort(), [...SUITE_DIRS].sort());
  assert.equal(suites.length, SUITE_DIRS.length);
  for (const suite of suites)
    assert.ok(suite.ratchet, `${suite.dir}: walked with nothing to compare against`);
});

test('each suite ships the number of graders it says it does, and each case ships some', () => {
  for (const suite of suites) {
    assert.equal(suite.graders.length, suite.ratchet.graders,
      `${suite.dir}: ${suite.graders.length} graders discovered, ${suite.ratchet.graders} expected — ` +
      'a directory moved, or one was added without a probe set');
    for (const spec of suite.specs)
      assert.ok(suite.graders.some((g) => g.caseName === spec.name), `${suite.dir}/${spec.name}: no grader`);
  }
});

test('each suite`s patterned graders are the ones a probe can test, and there are as many as declared', () => {
  for (const suite of suites) {
    assert.equal(suite.probes.length, suite.ratchet.patterned,
      `${suite.dir}: ${suite.probes.length} patterned graders, ${suite.ratchet.patterned} expected`);
    for (const g of suite.graders.filter((x) => x.pattern === null))
      assert.ok(g.meta.type === 'llm' || (g.meta.type === 'tool_used' && !g.meta.input_match),
        `${suite.dir}/${g.graderId}: type ${g.meta.type} carries a pattern in every other case but lost it here`);
  }
});

test('I5 — every patterned grader in every suite carries both halves of a probe set', () => {
  for (const suite of suites) {
    const ids = suite.probes.map((p) => p.graderId);
    assert.equal(ids.length, suite.ratchet.patterned, `${suite.dir}: the grader list is supplied, not derived`);
    const r = inv.i5GradersHaveCompleteProbes(suite.probes, ids);
    assert.ok(r.ok, `${suite.dir}: ${r.violations.join('; ')}`);
  }
});

test('I7 — every suite tags exactly the diagnostics it declares, and none reaches a scored table', () => {
  for (const suite of suites) {
    const controls = suite.specs.filter((s) => s.tags.includes('control'));
    assert.equal(controls.length, suite.ratchet.controlCases,
      `${suite.dir}: ${controls.length} control-tagged cases, ${suite.ratchet.controlCases} expected`);
    const r = inv.i7ControlNeverInHeadline({ deltaRows: [], capabilityRows: [] }, suite.specs);
    assert.ok(r.ok, `${suite.dir}: ${r.violations.join('; ')}`);
  }
});

test('I6 — run where a suite makes an absence claim, and SKIPPED with its reason where it makes none', () => {
  const skipped = [];
  for (const suite of suites) {
    if (suite.ratchet.absenceCases === null) {
      // Not an empty list. I6 refuses one by design ("no absence cases named — vacuous
      // pass refused"), and handing it one would turn a check with nothing to hold into
      // a red suite rather than into the honest statement that this suite claims no
      // absence: its single scored case measures what a reply NAMES, not what a run
      // refrained from doing.
      skipped.push(suite.dir);
      assert.equal(inv.i6AbsenceClaimsHaveContentEvidence([], []).ok, false,
        'and an empty list stays a refusal, so the skip is a decision rather than a loophole');
      continue;
    }
    const cases = suite.specs.map((spec) => ({
      name: spec.name,
      graders: suite.graders.filter((g) => g.caseName === spec.name).map((g) => ({
        type: g.meta.type, tool: g.meta.tool,
        target: inlineMap(g.meta.target) ?? g.meta.target,
        focus: inlineMap(g.meta.focus) ?? g.meta.focus,
      })),
    }));
    const r = inv.i6AbsenceClaimsHaveContentEvidence(cases, suite.ratchet.absenceCases);
    assert.ok(r.ok, `${suite.dir}: ${r.violations.join('; ')}`);
  }
  assert.deepEqual(skipped, [TIER2], 'exactly one suite registers no absence case');
});

test('I3 — every suite`s README carries its own claim ceiling verbatim, from its own source', async () => {
  for (const suite of suites) {
    const ceiling = await ceilingFor(suite);
    const readme = await readTextFile(suite.ratchet.ceiling.readme);
    const r = inv.i3ClaimCeilingIntact(readme, ceiling, {
      claimsSectionChanged: false, preRegistrationShaChanged: false,
    });
    assert.ok(r.ok, `${suite.dir}: ${r.violations.join('; ')} — the ceiling is fixed before any run and ` +
      `${suite.ratchet.ceiling.readme} must carry it word for word`);
  }
});

test('I3 — a README that paraphrases the second suite`s ceiling is refused', async () => {
  const suite = suites.find((s) => s.dir === TIER2);
  const ceiling = await ceilingFor(suite);
  const diff = { claimsSectionChanged: false, preRegistrationShaChanged: false };
  assert.equal(inv.i3ClaimCeilingIntact('# Suite\n\nThe primer finds more defects.\n', ceiling, diff).ok, false);
  assert.equal(inv.i3ClaimCeilingIntact(`x ${ceiling.replace('fewer', 'more')} y`, ceiling, diff).ok, false,
    'one word is the whole finding: the registered direction against the placebo is -1');
});

test('the second suite`s registered ceiling says what its registered directions say', async () => {
  const registration = parsePreRegistration(await readTextFile(`${TIER2}/PRE-REGISTRATION.md`));
  assert.equal(registration.expectedDirection['step4-seeded-defects#reported/placebo'], -1);
  assert.match(registration.claimCeiling, /name fewer of the planted defects than the same-shape placebo/,
    'the ceiling and the direction are one prediction written twice; they may not disagree');
  assert.match(registration.claimCeiling, /says nothing about whether the software that comes out is better/);
});

/* ────────────────────────────────────────────────────────────────────────────
 * I10 — no method vocabulary in an instrument or a brief.
 *
 * Lexical, and known to be. It catches a grader written from the skill's text; it cannot
 * catch a brief that states the hypothesis in other words, and Appendix A does exactly
 * that. The plan says so, and this test does not pretend otherwise.
 * ──────────────────────────────────────────────────────────────────────────── */

/** A blockquote appendix of the plan: the brief as it was handed to an isolated agent. */
function appendix(planMarkdown, heading) {
  const lines = planMarkdown.split('\n');
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start < 0) bad(`0-plan.md carries no ${heading}`);
  const out = [];
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++)
    if (lines[i].startsWith('>')) out.push(lines[i].replace(/^>\s?/, ''));
  if (out.length === 0) bad(`${heading} carries no blockquote — the brief was given verbatim or it was not`);
  return out.join('\n');
}

/**
 * What the vocabulary check reads, for the suite that has a ledger: every file written
 * by an agent under the fence, plus the two briefs that were handed to them, plus the
 * body of every `llm` grader.
 *
 * An `llm` body and no other. That body is handed to the judge verbatim, so a word from
 * the method inside it is a word the judge scores against — which is the leak I10 exists
 * to catch. The unscored guards' bodies (`liveness-read`, `service-started`,
 * `skill-fired`) are design notes that reach no judge and no author under the fence, and
 * they name recon and step 4 on purpose. They are shared fixture state written by
 * someone who has read the method, exactly like the case files, the transcript and the
 * port change — which the plan already lists as what the contamination rule cannot
 * cover.
 */
async function instrumentFiles(suiteDir) {
  const files = [];
  const ledgerDir = `${suiteDir}/fixtures/notesvc-seeded/defects`;
  const ledger = await readDefectLedger(readTextFile, listDirectory, ledgerDir);
  for (const d of ledger) {
    for (const file of ['behaviour.md', 'cause.md', 'criteria.md', 'detect.sh', 'signature'])
      files.push({ path: `${d.id}/${file}`, text: await readTextFile(`${ledgerDir}/${d.id}/${file}`) });
    for (const probe of ['by-cause', 'by-observable', 'hedge', 'wrong'])
      files.push({ path: `${d.id}/probes/${probe}.md`, text: await readTextFile(`${ledgerDir}/${d.id}/probes/${probe}.md`) });
  }
  const suite = suites.find((s) => s.dir === suiteDir);
  for (const g of suite.graders)
    if (g.meta.type === 'llm') files.push({ path: g.graderId, text: g.text });
  const plan = await readTextFile('docs/plans/primer-evals/defect-injection/0-plan.md');
  files.push({ path: '0-plan.md § Appendix A', text: appendix(plan, '## Appendix A') });
  files.push({ path: '0-plan.md § Appendix C', text: appendix(plan, '## Appendix C') });
  return files;
}

test('I10 — no term of the owner`s word list appears in the instrument or in either brief', async () => {
  const files = await instrumentFiles(TIER2);
  assert.ok(files.length >= 100, `${files.length} instrument files — the walk found less than the ledger`);
  const r = inv.i10InstrumentVocabulary(files, inv.METHOD_VOCABULARY);
  assert.ok(r.ok, r.violations.join('\n         '));
});

test('I10 — the same walk over the same files catches a criterion written from the method', async () => {
  const files = await instrumentFiles(TIER2);
  const planted = [...files, { path: 'criteria.md', text: 'Score 1 if the recon report names the seam.' }];
  const r = inv.i10InstrumentVocabulary(planted, inv.METHOD_VOCABULARY);
  assert.equal(r.ok, false, 'a walk that finds nothing in a clean tree must still find something in a dirty one');
  assert.match(r.violations.join(' '), /contains "recon"/);
});

test('the word list is the owner`s thirteen terms, and the check is whole-word', () => {
  assert.equal(inv.METHOD_VOCABULARY.length, 13, 'gate 5 authored thirteen; adding one is the owner`s call');
  for (const word of ['recon', 'gate', 'true input', 'step 4'])
    assert.ok(inv.METHOD_VOCABULARY.includes(word), `${word} is one of the thirteen`);
  assert.equal(inv.i10InstrumentVocabulary([{ path: 'a', text: 'The gateway refuses it.' }], inv.METHOD_VOCABULARY).ok,
    true, '"gateway" is not "gate"');
});

/* ────────────────────────────────────────────────────────────────────────────
 * The seeded fixture, run.
 *
 * Everything above reads files. This runs the service: the acceptance table of D3 is a
 * claim about behaviour, and a claim about behaviour that is only ever read is the
 * failure the method's step 4 is about.
 * ──────────────────────────────────────────────────────────────────────────── */

const SEEDED = `${TIER2}/fixtures/notesvc-seeded`;
const CLEAN = `${TIER1}/fixtures/notesvc`;
const SHIPPED_FILES = ['server.js', 'src/store.js', 'src/middleware/index.js', 'src/routes/notes.js', 'test/notes.test.js'];

/** `spawn` as a promise, with the working directory named. Nothing here reads stdin. */
const runCommand = (command, args, cwd) => new Promise((resolve) => {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('error', (e) => resolve({ code: 127, stdout, stderr: String(e) }));
  child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
});

test('the seeded fixture is the clean one plus markers and defects, and its tests are green with all of them', async () => {
  const seededTest = await readTextFile(`${SEEDED}/test/notes.test.js`);
  const cleanTest = await readTextFile(`${CLEAN}/test/notes.test.js`);
  // The step-3 marker token, as a value, so the grep that enforces the marker convention
  // over this repository's own source finds this line and reads it as the fixture's.
  const MARKER = 'TODO(per-user)';
  const withoutMarkers = (text) => text.split('\n').filter((l) => !l.includes(MARKER)).join('\n');
  assert.equal(withoutMarkers(seededTest), withoutMarkers(cleanTest),
    'the test file differs from the clean fixture`s only by the marker line the transcript names');
  assert.ok(seededTest.includes(MARKER), 'and it does carry one: the transcript names the test hook as a site');

  const suite = await runCommand(process.execPath, ['--test'], join(paths.repoRoot, SEEDED));
  assert.equal(suite.code, 0, `node --test is not green with every defect present:\n${suite.stdout}${suite.stderr}`);
});

test('no signature is a literal in any shipped file — a trace that only READ the source must not match', async () => {
  const ledger = await readDefectLedger(readTextFile, listDirectory, `${SEEDED}/defects`);
  const sources = [];
  for (const file of SHIPPED_FILES) sources.push({ file, text: await readTextFile(`${SEEDED}/${file}`) });
  for (const d of ledger)
    for (const { file, text } of sources)
      assert.equal(text.includes(d.signature), false,
        `${d.id}: its signature is a literal in ${file}, so a run that only read the file would match it`);
});

test('the scaffolded workspace is the five shipped files and no ledger', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'notesvc-scaffold-'));
  const scaffold = await runCommand('bash', [join(paths.repoRoot, SEEDED, 'scaffold.sh')], workspace);
  assert.equal(scaffold.code, 0, scaffold.stderr);
  const landed = await readdir(workspace);
  assert.equal(landed.includes('defects'), false, 'the ledger holds the answers and may never ship');
  assert.equal(landed.includes('README.md'), false, 'a workspace that says "eval fixture" measures something else');
  for (const file of SHIPPED_FILES)
    assert.ok(await stat(join(workspace, file)).then(() => true).catch(() => false), `${file} did not land`);
  await rm(workspace, { recursive: true, force: true });
});

test('two services start at once without colliding — the sweep runs sixty of them in sequence', async () => {
  const start = () => new Promise((resolve) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: join(paths.repoRoot, SEEDED), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      const port = /localhost:(\d+)/.exec(out);
      if (port) resolve({ child, port: Number(port[1]) });
    });
    child.on('close', () => resolve({ child, port: null }));
  });
  const [a, b] = await Promise.all([start(), start()]);
  try {
    assert.ok(a.port && b.port, 'a service that never printed a port did not bind one');
    assert.notEqual(a.port, b.port, 'PORT ?? 0 exists so sequential runs on one host cannot collide on 3000');
  } finally {
    a.child.kill('SIGKILL');
    b.child.kill('SIGKILL');
  }
});

test('every detect script fires on the seeded service, is silent on the clean one, and survives the feature', async (t) => {
  if ((await runCommand('git', ['--version'], paths.repoRoot)).code !== 0)
    return t.skip('git is not on PATH, and the clean and reference copies are built by applying patches');
  const ledger = await readDefectLedger(readTextFile, listDirectory, `${SEEDED}/defects`);
  const seeded = join(paths.repoRoot, SEEDED);

  /** A copy of the seeded service under git, so a patch can be applied or reversed. */
  const copyOf = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'notesvc-detect-'));
    for (const file of SHIPPED_FILES) {
      await mkdir(dirname(join(dir, file)), { recursive: true });
      await copyFile(join(seeded, file), join(dir, file));
    }
    await runCommand('git', ['init', '-q', '.'], dir);
    await runCommand('git', ['add', '-A'], dir);
    await runCommand('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'seeded'], dir);
    return dir;
  };

  const clean = await copyOf();
  for (const d of ledger) {
    const r = await runCommand('git', ['apply', '-R', join(seeded, 'defects', d.id, 'diff.patch')], clean);
    assert.equal(r.code, 0, `${d.id}: its own patch does not reverse out of the seeded service: ${r.stderr}`);
  }
  const reference = await copyOf();
  const applied = await runCommand('git', ['apply', join(seeded, 'defects', 'reference-implementation.patch')], reference);
  assert.equal(applied.code, 0, `the reference per-user implementation does not apply: ${applied.stderr}`);

  try {
    for (const d of ledger) {
      const script = join(seeded, 'defects', d.id, 'detect.sh');
      const fire = async (root) => (await runCommand('bash', [script, root], seeded)).code;
      assert.equal(await fire(seeded), 1, `${d.id}: does not fire on the seeded service — the defect is not there`);
      assert.equal(await fire(clean), 0, `${d.id}: fires on the CLEAN service, so it is not this defect`);
      assert.equal(await fire(reference), 1,
        `${d.id}: stops firing once the feature is implemented — the treatment's own build would delete it`);
    }
  } finally {
    await rm(clean, { recursive: true, force: true });
    await rm(reference, { recursive: true, force: true });
  }
});

/* ── The judge prompt, pinned against the binary it was read out of ────────── */

test('the judge prompt this repository sends is the one inside the pinned CLI', async (t) => {
  const md = await readTextFile('docs/plans/primer-evals/harness-facts.md');
  const pinned = /\*\*Pinned version:\*\* `(\d+\.\d+\.\d+)`/.exec(md)[1];
  // Two places, because the pin was deliberately moved OUT of the updater's cache: the
  // updater prunes `versions/` and deleted this binary from it overnight once, which is
  // why the suite's README tells an operator to keep it under `claude-pinned/`. A check
  // that looked only in the cache would skip on every machine that followed the README.
  const candidates = [join(CLI_VERSIONS, pinned), join(homedir(), '.local', 'share', 'claude-pinned', pinned)];
  let bin = null;
  for (const path of candidates)
    if (await stat(path).then((s) => s.isFile()).catch(() => false)) { bin = path; break; }
  if (bin === null)
    return t.skip(`no pinned ${pinned} in ${candidates.join(' or ')} — the prompt cannot be checked from here`);
  const { system, user } = judgePrompt('C', 'last_message', 'T');
  const markers = [system, 'You are grading the output of a coding agent against a criterion.',
    'Respond with exactly one word: PASS or FAIL.'];
  for (const marker of markers) assert.ok(user.includes(marker) || marker === system);
  let missing;
  try {
    missing = await unresolvedMarkers(bin, markers);
  } catch (e) {
    return t.skip(`\`strings\` is unavailable here (${e.code ?? e.message})`);
  }
  assert.deepEqual([...missing], [],
    'the offline judge probe asks the judge something the sweep would not — re-read the shipped prompt');
});

test('the diagnostic`s liveness guard is byte-identical to the scored case`s', async () => {
  // Two copies of one guard, because the harness requires a case's graders to sit in its
  // own directory. Byte-identical or they are two different guards wearing one name.
  const scored = await readTextFile(`${TIER2}/step4-seeded-defects/graders/liveness-read.md`);
  const diagnostic = await readTextFile(`${TIER2}/step4-read-only/graders/liveness-read.md`);
  assert.equal(diagnostic, scored);
});

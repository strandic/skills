#!/usr/bin/env node
/**
 * One sweep per condition: copy the condition into place, invoke the harness,
 * keep the result document.
 * Signatures: ../scripts/interfaces.mjs § run-evals
 *
 * Everything that decides something is pure — above all `buildEvalArgv`, because a
 * wrong flag here does not error, it produces a *plausible number*. Drop
 * `--allow-tools` and every absence grader passes vacuously against a run that was
 * never able to edit anything; drop `--scaffold` and every prompt describes a service
 * that is not in the sandbox; let `--tag` slip and the control case runs first and
 * eats the budget. None of those fail loudly. So the argv is built by a function that
 * spawns nothing and is asserted byte-for-byte in `test/run-evals.test.mjs`.
 *
 * The condition is NOT a flag. The harness discovers the plugin from the path it is
 * pointed at, so choosing a condition means putting that condition's directory at
 * `_condition/` before the process starts — a real copy, since the ownership check
 * rejects a path that "is a symlink (or can be read as a link)".
 *
 * Sweeps run sequentially. Three concurrent sweeps would contend on the single
 * `_condition/` path and silently evaluate whichever condition won the race.
 *
 * Every flag below was verified by running, not by reading: `docs/plans/primer-evals/
 * 4-recon.md` for the commands, `harness-facts.md` for each claim and its evidence.
 */

/** @import { ConditionId, CaseSpec, EvalInvocation, SweepResult, SweepRecord,
 *            DriftRecord, SuitePaths } from './types.mjs' */
/** @import { ReadTextFile, WriteTextFile, CopyDirectory, SpawnCapture, Clock,
 *            EvalCommand, ResultsLocator } from './interfaces.mjs' */

import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { check as checkDrift, paths as mirrorPaths } from './build-conditions.mjs';

/** Raised by a pure function that refuses its input, or by the loop before it spends. */
export class RunError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RunError';
  }
}

const bad = (message) => {
  throw new RunError(message);
};

/* ────────────────────────────────────────────────────────────────────────────
 * Constants — every one of them sourced.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The three conditions we author. `none` is not one: it arrives as each sweep's own
 *  `without` arm, which is why the list has three entries and the report has four columns. */
const CONDITION_IDS = /** @type {ConditionId[]} */ (['treatment', 'oneliner', 'placebo']);

/** Marks the diagnostic case. It must never reach a scored run (I7), and it sorts
 *  FIRST lexicographically — which is how it consumed a whole cost ceiling in recon. */
const CONTROL_TAG = 'control';

/**
 * Tools the sandbox does not grant by default; everything else is already available.
 * The case's `allowed_tools` is INTERSECTED with this operator grant, so a tool listed
 * in only one of the two places is not granted at all — and the run then passes its
 * absence graders having never been able to edit anything.
 */
const GATED_TOOLS = new Set(['Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch']);
const isGated = (tool) => {
  const head = String(tool).split('(')[0].trim();
  return GATED_TOOLS.has(head) || head.startsWith('mcp__');
};

/**
 * Defaults are the pre-registered values, not conveniences. `threshold` is set
 * explicitly because the harness default of 1.0 is unreachable with `llm` graders and
 * would exit 1 on every run; `judgeModel` is pinned away from the subject to keep
 * same-model self-preference out of the numbers (D2).
 */
const DEFAULTS = {
  ablation: /** @type {'with-without'} */ ('with-without'),
  runs: 5,
  subjectModel: 'sonnet',
  judgeModel: 'opus',
  threshold: 0.6,
  scaffold: true,
};

/** `plugin eval [target]` — the repo whose plugin is under test. Relative, so the
 *  recorded argv is the same on every machine; the entry point chdirs to the repo root. */
const TARGET = '.';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Suite paths are repo-RELATIVE, as `SuitePaths` declares them, and the entry point
 * chdirs to the repo root before spawning. Two reasons, both load-bearing: the harness
 * writes its results to `./<eval dir>/results/<timestamp>/` relative to its own cwd,
 * and a relative `--eval-dir` is the exact form recon verified.
 *
 * @param {string} suiteDir
 * @returns {SuitePaths}
 */
export const suitePathsFor = (suiteDir) => ({
  repoRoot,
  suiteDir,
  conditionsDir: `${suiteDir}/conditions`,
  // OUTSIDE the eval dir: 2.1.251 refuses a `plugins` entry that names the case
  // directory, its graders, or a directory covering them — "a plugin shipped with a
  // case must sit in its own subdirectory". `<suiteDir>/_condition` was inside the
  // eval directory and every case began failing at run time with that message.
  conditionUnderTest: `${suiteDir}/../_conditions/current`,
  resultsDir: `${suiteDir}/results`,
});

export const paths = suitePathsFor('evals/seven-steps-primer');

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the command line.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * BuildEvalArgv — the exact arguments, in the exact order.
 *
 * **Order is load-bearing.** `--tag`, `--allow-tools` and `--json` are variadic or
 * optional-argument options, so each will swallow a bare value that follows it: the
 * target has to come first or it is read as a tag. `--json` goes last for the same
 * reason — nothing may follow it that it could mistake for a path.
 *
 * A value beginning with `-` inside a variadic list truncates that list silently, so
 * one is refused here rather than discovered as a short run.
 *
 * @param {EvalInvocation} inv
 * @returns {string[]}
 */
export function buildEvalArgv(inv) {
  if (!inv || typeof inv !== 'object') bad('buildEvalArgv: no invocation');
  if (!CONDITION_IDS.includes(inv.condition))
    bad(`buildEvalArgv: '${inv.condition}' is not a ConditionId`);
  if (typeof inv.suiteDir !== 'string' || inv.suiteDir === '') bad('buildEvalArgv: no suiteDir');
  if (inv.ablation !== 'none' && inv.ablation !== 'with-without')
    bad(`buildEvalArgv: ablation '${inv.ablation}' is neither 'none' nor 'with-without'`);
  if (!Number.isInteger(inv.runs) || inv.runs < 1)
    bad(`buildEvalArgv: runs ${JSON.stringify(inv.runs)} is not a run count`);
  if (typeof inv.threshold !== 'number' || !(inv.threshold > 0) || inv.threshold > 1)
    bad(`buildEvalArgv: threshold ${JSON.stringify(inv.threshold)} is not in (0, 1]`);
  for (const field of ['subjectModel', 'judgeModel'])
    if (typeof inv[field] !== 'string' || inv[field] === '') bad(`buildEvalArgv: no ${field}`);
  if (inv.judgeModel === inv.subjectModel)
    bad('buildEvalArgv: the judge is the subject — same-model self-preference is the ' +
      'confound the judge pin exists to avoid');

  const variadic = (flag, values) => {
    for (const v of values) {
      if (typeof v !== 'string' || v === '') bad(`${flag}: an empty value`);
      if (v.startsWith('-')) bad(`${flag}: '${v}' starts with '-' and would end the list early`);
    }
    return values.length === 0 ? [] : [flag, ...values];
  };

  return [
    'plugin', 'eval', TARGET,
    // --eval-dir takes a PATH, not merely a bare directory name (recon).
    '--eval-dir', inv.suiteDir,
    '--ablation', inv.ablation,
    '--runs', String(inv.runs),
    '--model', inv.subjectModel,
    '--judge-model', inv.judgeModel,
    '--threshold', String(inv.threshold),
    // scaffold_script is ignored without the operator flag: no flag, empty workspace,
    // and every prompt then describes a service that is not there.
    inv.scaffold ? '--scaffold' : '--no-scaffold',
    // Keep the HTML report local. Publishing on every sweep is a side effect the suite
    // never asked for, and recon's verified invocation carried this.
    '--no-publish',
    ...(inv.caseGlobs ?? []).flatMap((glob) => {
      if (typeof glob !== 'string' || glob === '' || glob.startsWith('-'))
        bad(`--case: ${JSON.stringify(glob)} is not a case glob`);
      return ['--case', glob];
    }),
    // An INCLUDE filter — there is no exclude form, so the scored tags are named
    // explicitly and the control case is kept out by not being named.
    ...variadic('--tag', inv.tagFilters ?? []),
    ...variadic('--allow-tools', inv.allowTools ?? []),
    // NO `--json`. It suppresses every progress line, so the child emits nothing for
    // the length of a sweep — 34 and 41 minutes of total silence in two runs, both of
    // which were then killed. A long-running task that produces no output is
    // indistinguishable from a hung one, to a supervisor and to a human watching.
    //
    // Nothing is lost by dropping it: the harness writes aggregate-result.json into
    // `<eval-dir>/results/<timestamp>/` either way, which is the path ResultsLocator
    // reads. `--json` was only ever the fallback, and it cost all visibility to be one.
  ];
}

/**
 * The tags that select every scored case and no control case.
 *
 * Derived from what the suite actually declares rather than hard-coded, then checked
 * both ways: any tag a control case also carries is dropped (it would readmit the
 * diagnostic), and a scored case left unreachable by the surviving tags is a refusal
 * rather than a quietly shorter sweep. An include filter that silently selects less
 * than you think is the same defect as a grader that matches everything.
 *
 * @param {CaseSpec[]} cases
 * @returns {string[]}
 */
export function selectTagFilters(cases) {
  if (!Array.isArray(cases) || cases.length === 0)
    bad('selectTagFilters: no cases — a sweep over nothing scores nothing');
  const controlled = new Set(
    cases.filter((c) => c.tags.includes(CONTROL_TAG)).flatMap((c) => c.tags)
  );
  const scored = cases.filter((c) => !c.tags.includes(CONTROL_TAG));
  if (scored.length === 0) bad('selectTagFilters: every discovered case is tagged `control`');
  const tags = [...new Set(scored.flatMap((c) => c.tags))].filter((t) => !controlled.has(t)).sort();
  if (tags.length === 0)
    bad('selectTagFilters: no tag selects a scored case without also selecting the control');
  const unreachable = scored.filter((c) => !c.tags.some((t) => tags.includes(t)));
  if (unreachable.length > 0)
    bad(`selectTagFilters: ${unreachable.map((c) => c.name).join(', ')} carry no selectable tag ` +
      'and would be dropped from the sweep without a word');
  return tags;
}

/**
 * The operator grant: every gated tool any scored case asks for, and nothing else.
 *
 * Derived from the cases because the two lists are intersected — a grant narrower than
 * the cases leaves the run unable to do the thing the absence graders claim it chose
 * not to do. Empty means the cases ask for no gated tool, and the flag is then omitted
 * rather than emitted with no values, which would swallow the next flag whole.
 *
 * @param {CaseSpec[]} cases
 * @returns {string[]}
 */
export function selectAllowTools(cases) {
  const wanted = new Set();
  for (const c of cases ?? [])
    if (!c.tags.includes(CONTROL_TAG))
      for (const t of c.allowedTools ?? []) if (isGated(t)) wanted.add(t);
  return [...wanted].sort();
}

/**
 * One sweep's invocation, assembled from what the suite declares plus the operator's
 * overrides. Pure, so the whole command line is decided before anything is spawned.
 *
 * @param {ConditionId} condition
 * @param {SuitePaths} paths
 * @param {CaseSpec[]} cases
 * @param {Partial<EvalInvocation>} [overrides]
 * @returns {EvalInvocation}
 */
export function invocationFor(condition, paths, cases, overrides = {}) {
  return {
    condition,
    suiteDir: paths.suiteDir,
    ablation: DEFAULTS.ablation,
    runs: DEFAULTS.runs,
    subjectModel: DEFAULTS.subjectModel,
    judgeModel: DEFAULTS.judgeModel,
    allowTools: selectAllowTools(cases),
    threshold: DEFAULTS.threshold,
    caseGlobs: [],
    tagFilters: selectTagFilters(cases),
    scaffold: DEFAULTS.scaffold,
    outputDir: paths.resultsDir,
    ...overrides,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — reading what the cases declare.
 *
 * A YAML subset, not a YAML parser: scalar and inline-list leaves, addressed by
 * dotted path. It has to be indentation-aware because one case keeps its tools under
 * `execution:` while the rest keep theirs in prompt.md frontmatter, and a column-0
 * reader would report that case as granting nothing.
 * ──────────────────────────────────────────────────────────────────────────── */

const stripComment = (value) => value.replace(/\s+#.*$/, '').trim();

/**
 * @param {string} text
 * @returns {Record<string,string>} dotted path → raw value
 */
export function yamlish(text) {
  /** @type {Record<string,string>} */
  const out = {};
  /** @type {{indent:number,key:string}[]} */
  const stack = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (/^\s*(#|$)/.test(line)) continue;
    const indent = line.length - line.trimStart().length;
    const m = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)$/.exec(line.trim());
    if (!m) continue; // list items and continuations: nothing here needs them
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) stack.pop();
    const value = stripComment(m[2]);
    if (value === '') stack.push({ indent, key: m[1] });
    else out[[...stack.map((s) => s.key), m[1]].join('.')] = value;
  }
  return out;
}

/** The frontmatter block of a `prompt.md`, or '' when it has none. */
export function frontmatter(text) {
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(String(text));
  return m ? m[1] : '';
}

/**
 * `[a, b, c]` → `['a','b','c']`. A key present with a value that is not an inline list
 * REFUSES rather than returning empty: a silently-empty tag list drops cases from the
 * sweep, and a silently-empty tool grant makes every absence grader vacuous.
 *
 * @param {string|undefined} value
 * @param {string} where
 * @returns {string[]|null} null when the key is absent
 */
export function inlineList(value, where) {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']'))
    bad(`${where}: ${JSON.stringify(value)} is not an inline list — this reader handles [a, b], ` +
      'and reading it as empty would drop the case rather than fail');
  const inner = trimmed.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter((s) => s !== '');
}

/**
 * One case's spec, from its `case.yaml` and its `prompt.md` frontmatter. The
 * frontmatter wins where both speak — that is the harness's own precedence, and the
 * only reason `case.yaml` exists at all is that `context.*` cannot be set from
 * prompt.md.
 *
 * `evidence` is derived from `context.history_file`, the mechanism rather than the
 * label: a replayed transcript carries the plugin into BOTH arms, so such a case is
 * single-arm capability evidence whatever anyone tagged it.
 *
 * @param {string} dirName
 * @param {string|null} caseYaml
 * @param {string|null} promptMd
 * @returns {CaseSpec & {allowedTools: string[], dir: string}}
 */
export function readCaseSpec(dirName, caseYaml, promptMd) {
  const y = yamlish(caseYaml ?? '');
  const f = yamlish(frontmatter(promptMd ?? ''));
  const pick = (key) => f[key] ?? y[key] ?? y[`execution.${key}`];
  const where = `${dirName}/case.yaml`;

  const tags = inlineList(pick('tags'), `${where} tags`) ?? [];
  const allowedTools = inlineList(pick('allowed_tools'), `${where} allowed_tools`) ?? [];
  const replay = y['context.history_file'] !== undefined;

  return {
    name: (y.name ?? dirName).replace(/^['"]|['"]$/g, ''),
    dir: dirName,
    evidence: replay ? 'capability' : 'delta',
    ablation: replay ? 'none' : 'with-without',
    tags,
    scored: !tags.includes(CONTROL_TAG),
    // `measures` is a line for the report and nothing in a case file carries it; the
    // pre-registration is where it lives. Left empty rather than paraphrased from a prompt.
    measures: '',
    allowedTools,
  };
}

/** Last 8 KiB, which is where a case-load error or a harness advisory will be. */
export function tail(text, max = 8192) {
  const s = String(text ?? '');
  return s.length <= max ? s : `…(${s.length - max} bytes trimmed)…\n${s.slice(-max)}`;
}

/** Results directories are ISO timestamps, so lexicographic order is chronological. */
const TIMESTAMP_DIR = /^\d{4}-\d{2}-\d{2}T[0-9-]+Z$/;

/* ────────────────────────────────────────────────────────────────────────────
 * Handles-first — everything below receives what it touches.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * SelectCondition — put the chosen condition at the one fixed path every case names.
 *
 * @param {CopyDirectory} copyDirectory
 * @param {SuitePaths} paths
 * @param {ConditionId} condition
 * @returns {Promise<void>}
 */
export async function selectCondition(copyDirectory, paths, condition) {
  if (!CONDITION_IDS.includes(condition)) bad(`selectCondition: '${condition}' is not a ConditionId`);
  await copyDirectory(join(paths.conditionsDir, condition), paths.conditionUnderTest);
}

/**
 * DiscoverCases — every directory under the suite that declares a case.
 *
 * A case is a directory carrying `case.yaml` or `prompt.md`; `conditions/`,
 * `fixtures/`, `prompt-fixtures/` and `results/` carry neither, so nothing has to be
 * excluded by name. Sorted lexicographically because that is the order the harness
 * itself runs them in, and reading the runner's output against the harness's should
 * not require a second sort in your head.
 *
 * @param {ReadTextFile} readTextFile
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} listDirectory
 * @param {SuitePaths} paths
 * @returns {Promise<(CaseSpec & {allowedTools: string[], dir: string})[]>}
 */
export async function discoverCases(readTextFile, listDirectory, paths) {
  const entries = await listDirectory(paths.suiteDir);
  const dirs = entries.filter((e) => e.isDirectory).map((e) => e.name).sort();
  const specs = [];
  for (const name of dirs) {
    const dir = join(paths.suiteDir, name);
    const caseYaml = await readTextFile(join(dir, 'case.yaml')).catch(() => null);
    const promptMd = await readTextFile(join(dir, 'prompt.md')).catch(() => null);
    if (caseYaml === null && promptMd === null) continue;
    specs.push(readCaseSpec(name, caseYaml, promptMd));
  }
  if (specs.length === 0)
    bad(`discoverCases: no case under ${paths.suiteDir} — a sweep over nothing scores nothing, ` +
      'loudly and greenly');
  return specs;
}

/**
 * EvalCommand — the executable and the environment it needs.
 *
 * `plugin eval` is early access: without `CLAUDE_CODE_WALNUT_SPIRE=1` the command
 * prints its early-access line and exits 1. Injecting it unconditionally is safe — a
 * no-op on a flag-enabled account — and keeps this committed script working on a
 * machine that cannot receive the rollout. It must NOT go in the repo's
 * `.claude/settings.json`: project settings are untrusted before the workspace trust
 * step, and this variable is not on the allowlist.
 *
 * `EVAL_CLAUDE_BIN` must name an EXECUTABLE — spawn takes no shell, so a shell alias
 * resolves to nothing and the sweep exits 127 with no document. Recon reached its
 * account through such an alias; the equivalent here is the environment, which passes
 * through whole: `CLAUDE_CONFIG_DIR=~/.claude-personal node scripts/run-evals.mjs`.
 *
 * @param {Record<string,string|undefined>} env
 * @returns {{ command: string, env: Record<string,string> }}
 */
export function evalCommandFrom(env) {
  /** @type {Record<string,string>} */
  const clean = {};
  for (const [k, v] of Object.entries(env ?? {})) if (v !== undefined) clean[k] = v;
  clean.CLAUDE_CODE_WALNUT_SPIRE = '1';
  return { command: env?.EVAL_CLAUDE_BIN || 'claude', env: clean };
}

/**
 * ResultsLocator — the newest `<eval-dir>/results/<ISO-timestamp>/aggregate-result.json`,
 * or '' when the suite has none.
 *
 * Only timestamp-shaped directories count: the runner keeps its own `<condition>.json`
 * and `drift.json` in the same folder, and the harness's five recon directories are
 * sitting there too. Which is exactly why the caller compares the path before and
 * after — "newest" on its own would happily hand back somebody else's run from August.
 *
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} listDirectory
 * @returns {ResultsLocator}
 */
export const makeResultsLocator = (listDirectory) => async (inv) => {
  const dir = `${inv.suiteDir}/results`;
  const entries = await listDirectory(dir).catch(() => []);
  const stamped = entries
    .filter((e) => e.isDirectory && TIMESTAMP_DIR.test(e.name))
    .map((e) => e.name)
    .sort();
  return stamped.length === 0 ? '' : join(dir, stamped[stamped.length - 1], 'aggregate-result.json');
};

/**
 * RunSweep — spawn the harness, come back with a result rather than an exception.
 *
 * Never throws on a non-zero exit. Exit 1 means "a case scored below threshold", which
 * is a finding; exit 2 means partial and must not be compared against a complete run;
 * 130/143 mean somebody interrupted it. Throwing would erase all three distinctions.
 *
 * The document is located, not assumed: the results directory is read BEFORE the spawn
 * and again after, and only a directory that was not there before can be this sweep's
 * output. A sweep that produced none falls back to the `--json` document on stdout, and
 * failing that reports `document: null` — which the merger refuses, out loud.
 *
 * `readTextFile` is appended to the declared signature: `ResultsLocator` hands back a
 * path and nothing in `RunSweep`'s parameters could read it. Recorded as an insufficiency
 * rather than smuggled in.
 *
 * @param {SpawnCapture} spawnCapture
 * @param {EvalCommand} evalCommand
 * @param {ResultsLocator} resultsLocator
 * @param {EvalInvocation} inv
 * @param {ReadTextFile} readTextFile
 * @returns {Promise<SweepResult>}
 */
export async function runSweep(spawnCapture, evalCommand, resultsLocator, inv, readTextFile) {
  const { command, env } = evalCommand();
  const argv = buildEvalArgv(inv);
  const before = await resultsLocator(inv);

  const { code, stdout, stderr } = await spawnCapture(command, argv, env);

  const notes = [];
  const located = await resultsLocator(inv);
  let document = null;
  if (located !== '' && located !== before) {
    try {
      document = JSON.parse(await readTextFile(located));
    } catch (e) {
      notes.push(`runner: ${located} could not be read as JSON — ${e.message}`);
    }
  } else {
    notes.push(located === ''
      ? 'runner: the sweep wrote no results directory'
      : `runner: no NEW results directory — ${located} predates this sweep and is not its output`);
    try {
      document = JSON.parse(stdout);
      notes.push('runner: recovered the document from stdout (unexpected — --json is not passed)');
    } catch {
      notes.push('runner: stdout carried no JSON document either');
    }
  }

  return {
    condition: inv.condition,
    exitCode: code,
    document,
    stderrTail: tail([stderr, ...notes].filter(Boolean).join('\n')),
  };
}

/**
 * WriteDriftRecord — `results/drift.json`, before the first sweep.
 *
 * The merger requires this file and reads its ABSENCE as drift, so a run that skipped
 * the check cannot quietly produce a report.
 *
 * @param {WriteTextFile} writeTextFile
 * @param {SuitePaths} paths
 * @param {DriftRecord} record
 * @returns {Promise<void>}
 */
export async function writeDriftRecord(writeTextFile, paths, record) {
  await writeTextFile(join(paths.resultsDir, 'drift.json'), `${JSON.stringify(record, null, 2)}\n`);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the operator's own arguments.
 * ──────────────────────────────────────────────────────────────────────────── */

const USAGE = `usage: node scripts/run-evals.mjs [--condition <id>]... [--runs <n>] [--smoke]

  --condition <id>  treatment | oneliner | placebo. Repeatable, or comma-separated.
                    Default: all three, swept in that order.
  --runs <n>        Runs per case. Default ${DEFAULTS.runs} — the pre-registered count.
  --smoke           The cheap pilot: one scored case, one run. Do this before a sweep.`;

/** @param {string[]} argv */
export function parseArgv(argv) {
  const args = { conditions: /** @type {ConditionId[]} */ ([]), runs: DEFAULTS.runs, smoke: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--smoke') {
      args.smoke = true;
      args.runs = 1;
    } else if (a === '--condition') {
      const value = argv[++i] ?? bad(`--condition needs a value\n${USAGE}`);
      for (const id of value.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!CONDITION_IDS.includes(/** @type {any} */ (id)))
          bad(`--condition ${id}: not one of ${CONDITION_IDS.join(', ')}`);
        if (!args.conditions.includes(/** @type {any} */ (id))) args.conditions.push(/** @type {any} */ (id));
      }
    } else if (a === '--runs') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) bad(`--runs needs a whole number ≥ 1\n${USAGE}`);
      args.runs = n;
    } else bad(`unknown option ${a}\n${USAGE}`);
  }
  // Sweep order is the declared order, not the order they were typed: the treatment
  // first means a broken condition costs one sweep rather than three.
  if (args.conditions.length === 0) args.conditions = [...CONDITION_IDS];
  else args.conditions = CONDITION_IDS.filter((c) => args.conditions.includes(c));
  return args;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Entry point — the only place that reads, writes or spawns.
 * ──────────────────────────────────────────────────────────────────────────── */

/** @type {ReadTextFile} */
const readTextFile = (path) => readFile(path, 'utf8');

/** @type {WriteTextFile} */
const writeTextFile = async (path, contents) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, 'utf8');
};

/**
 * CopyDirectory — REPLACE, not merge. `cp` alone leaves behind any file the previous
 * condition had and this one does not, and a condition contaminated by its predecessor
 * still scores perfectly well. A real copy either way: the ownership check rejects a
 * plugin path that "is a symlink (or can be read as a link)".
 *
 * @type {CopyDirectory}
 */
const copyDirectory = async (from, to) => {
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true });
};

const listDirectory = async (path) => {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
};

/**
 * SpawnCapture. Buffers rather than streams — the child may emit up to 64 MiB under
 * `--json`, which is fine at this suite's size and wrong if it grows.
 *
 * A signalled child exits with no code, and the shell convention 128+signal is applied
 * here so `SweepResult.exitCode` can carry 130 and 143 as the interface says it does.
 *
 * @type {SpawnCapture}
 */
const spawnCapture = (command, args, env) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => {
      stderr += d;
      process.stderr.write(d); // the harness's per-case progress is the only sign of life
    });
    child.on('error', (e) => resolve({ code: 127, stdout, stderr: `${stderr}${e}` }));
    child.on('close', (code, signal) => {
      const signalled = signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1;
      resolve({ code: code ?? signalled, stdout, stderr });
    });
  });

/** @type {Clock} */
const clock = () => new Date().toISOString();

/**
 * @param {string[]} argv
 * @returns {Promise<number>} process exit code
 */
/**
 * The pinned CLI series, and the reason the pin is not merely a preference.
 *
 * 2.1.251 refuses any Bash-granting evaluation when `~/.docker` holds a symlink
 * anywhere inside it — it seals credential stores by path, a symlink defeats that, and
 * it fails closed rather than risk leaking one. Docker Desktop installs
 * `~/.docker/cli-plugins/*` as symlinks into its app bundle, so an ordinary Docker
 * install blocks this suite outright. Every case here grants Bash and must: the primary
 * measurement is an absence, and "it did not touch the source" is only evidence of
 * restraint when the run could have.
 *
 * The machine-side fixes all involve rearranging someone's Docker installation, which
 * is not something a public repo can ask of a contributor. So the suite pins instead,
 * and waits for a fix on either side.
 */
const PINNED_SERIES = '2.1';
const LAST_KNOWN_GOOD = '2.1.250';

/** Symlinks anywhere under ~/.docker are what 2.1.251+ refuses to run beside. */
async function dockerStoreHasSymlink(home) {
  const root = `${home}/.docker`;
  const walk = async (dir, depth) => {
    if (depth > 3) return false;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isSymbolicLink()) return true;
      if (e.isDirectory() && (await walk(`${dir}/${e.name}`, depth + 1))) return true;
    }
    return false;
  };
  return walk(root, 0);
}

/**
 * Refuse before spending rather than after. A sweep that trips the Docker refusal
 * costs a rate-limit window and reports score 0.00 with an error buried per run, which
 * reads like the skill failing rather than the environment refusing.
 */
async function preflightCli(spawnCapture, evalCommand, home) {
  const { command, env } = evalCommand();
  const probe = await spawnCapture(command, ['--version'], env).catch(() => null);
  const version = (probe?.stdout || '').trim().split(/\s+/)[0];
  if (!/^\d+\.\d+\.\d+$/.test(version))
    return { ok: false, why: `could not read a version from \`${command} --version\`` };

  const [maj, min, patch] = version.split('.').map(Number);
  const [pMaj, pMin] = PINNED_SERIES.split('.').map(Number);
  if (maj !== pMaj || min !== pMin)
    return { ok: false, why:
      `CLI ${version} is outside the pinned ${PINNED_SERIES} series — re-verify ` +
      `docs/plans/primer-evals/harness-facts.md before running, then move the pin` };

  const newerThanKnownGood = patch > Number(LAST_KNOWN_GOOD.split('.')[2]);
  if (newerThanKnownGood && (await dockerStoreHasSymlink(home)))
    return { ok: false, why:
      `CLI ${version} refuses Bash-granting evaluations while ~/.docker holds a ` +
      `symlink, and every case here grants Bash. Point EVAL_CLAUDE_BIN at ` +
      `${LAST_KNOWN_GOOD} (see harness-facts.md #38), or run where Docker Desktop ` +
      `is not installed. Rearranging ~/.docker is deliberately NOT recommended: this ` +
      `suite should not require a contributor to modify their Docker install` };

  return { ok: true, version };
}

export async function main(argv) {
  const args = parseArgv(argv);
  if (args.help) {
    console.log(USAGE);
    return 0;
  }

  // Relative suite paths and the harness's own `./<eval dir>/results/<timestamp>/`
  // both mean "from the repo root", so make that true rather than hope it is.
  process.chdir(paths.repoRoot);

  const pre = await preflightCli(spawnCapture, () => evalCommandFrom(process.env), homedir());
  if (!pre.ok) {
    console.error(`refusing to sweep: ${pre.why}`);
    return 1;
  }

  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const scored = cases.filter((c) => c.scored);
  const excluded = cases.filter((c) => !c.scored).map((c) => c.name);

  // Drift first, and it is fatal. A drifted mirror makes the run void under I2, so
  // sweeping anyway would spend a rate-limit window measuring a version of the skill
  // that no longer exists. The record is written either way — the merger reads its
  // absence as drift, and a refusal you cannot inspect is worse than none.
  const drift = await checkDrift(readTextFile, mirrorPaths);
  await writeDriftRecord(writeTextFile, paths, {
    drifted: drift.drifted,
    reason: drift.reason,
    checkedAt: clock(),
  });
  if (drift.drifted) {
    console.error(`DRIFT: the treatment mirror is not the shipped skill minus the flag`);
    console.error(`  ${drift.reason}`);
    console.error('  regenerate with: node scripts/build-conditions.mjs generate');
    console.error('  refusing to sweep — I2 voids a run whose treatment condition has drifted');
    return 1;
  }

  /** @type {Partial<EvalInvocation>} */
  const overrides = { runs: args.runs };
  if (args.smoke) {
    const pilot = scored.find((c) => c.evidence === 'delta');
    if (!pilot) bad('--smoke: no scored delta case to pilot');
    overrides.caseGlobs = [pilot.name];
  }

  console.error(`suite ${paths.suiteDir} — ${scored.length} scored case(s)` +
    (excluded.length > 0 ? `, excluding ${excluded.join(', ')}` : ''));
  console.error(`drift: none — ${mirrorPaths.treatmentMirror.replace(`${repoRoot}/`, '')} is current`);

  let failed = 0;
  for (const [index, condition] of args.conditions.entries()) {
    const inv = invocationFor(condition, paths, cases, overrides);
    const sweepArgv = buildEvalArgv(inv);
    const startedAt = clock();

    // A condition with no SKILL.md loads as no plugin at all, and the with-arm quietly
    // becomes a second baseline: every delta then reads 0.00 and looks like a null result.
    const source = join(paths.conditionsDir, condition, 'SKILL.md');
    await readTextFile(source).catch(() => bad(`no ${source} — that condition would sweep as no plugin at all`));

    console.error(`\nsweep ${index + 1}/${args.conditions.length} · ${condition} · ` +
      `${inv.runs} run(s) · ${inv.subjectModel}/${inv.judgeModel} · threshold ${inv.threshold}`);
    await selectCondition(copyDirectory, paths, condition);
    console.error(`  ${paths.conditionUnderTest} ← conditions/${condition}`);

    const evalCommand = () => evalCommandFrom(process.env);
    console.error(`  ${evalCommand().command} ${sweepArgv.join(' ')}`);

    const result = await runSweep(
      spawnCapture, evalCommand, makeResultsLocator(listDirectory), inv, readTextFile
    );

    /** @type {SweepRecord} */
    const record = {
      condition,
      exitCode: result.exitCode,
      document: result.document,
      stderrTail: result.stderrTail,
      argv: sweepArgv,
      startedAt,
    };
    const out = join(paths.resultsDir, `${condition}.json`);
    await writeTextFile(out, `${JSON.stringify(record, null, 2)}\n`);
    console.error(`  exit ${result.exitCode} · ${result.document ? 'document kept' : 'NO DOCUMENT'} → ${out}`);

    if (result.document === null || result.exitCode > 1) failed++;
    if (result.exitCode === 130 || result.exitCode === 143) {
      console.error('  interrupted — stopping rather than sweeping the remaining conditions');
      return 1;
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} sweep(s) produced no comparable result; merge-results will refuse them`);
    return 1;
  }
  console.error(`\nmerge with: node scripts/merge-results.mjs ${paths.resultsDir}`);
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  process.exitCode = await main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e instanceof RunError ? e.message : e.stack}\n`);
    return 1;
  });
}

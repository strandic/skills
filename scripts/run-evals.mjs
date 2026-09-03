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
 *            EvalCommand } from './interfaces.mjs' */

import { readFile, writeFile, mkdir, readdir, cp, rm } from 'node:fs/promises';
// Synchronous, and only for the signal handler: a handler that calls `process.exit`
// gives no turn to a promise, so the async `removeDirectory` would never run.
import { rmSync } from 'node:fs';
import { homedir, constants as osConstants } from 'node:os';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { check as checkDrift, paths as mirrorPaths } from './build-conditions.mjs';
import { instrumentDigest } from './instrument.mjs';

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

  // `--case` and `--tag` are never passed together, because how the harness combines
  // them is not known. Recon passed exactly one `--case` and never with `--tag`
  // (4-recon.md § seam 1; 6-cold-fork-register.md records both as underdetermined). If
  // they OR, a `--case`-scoped invocation silently readmits every tagged case — the
  // `ablation: none` invocation would run all five cases at the wrong ablation and the
  // split would be undone. Refusing here means no code path can depend on the answer.
  if ((inv.caseGlobs ?? []).length > 0 && (inv.tagFilters ?? []).length > 0)
    bad('buildEvalArgv: --case and --tag in one invocation — how the harness combines them ' +
      'is undetermined (OR would readmit every tagged case, including the control), so an ' +
      'invocation scoped by name carries no tag filter');

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
    // `--case <glob>` is ONE glob (harness-facts #44): the option is not variadic and a
    // repeated flag keeps only the last value. Four flags ran one case on 2026-09-03 and
    // the other three came back as "no result". So more than one is refused here, where
    // the command line is built, not discovered after the budget is spent.
    ...((inv.caseGlobs ?? []).length > 1
      ? bad(`--case takes one glob and the harness keeps only the last; ${inv.caseGlobs.length} were ` +
        'given — plan one invocation per case instead')
      : (inv.caseGlobs ?? []).flatMap((glob) => {
        if (typeof glob !== 'string' || glob === '' || glob.startsWith('-'))
          bad(`--case: ${JSON.stringify(glob)} is not a case glob`);
        return ['--case', glob];
      })),
    // An INCLUDE filter — there is no exclude form, so the scored tags are named
    // explicitly and the control case is kept out by not being named.
    ...variadic('--tag', inv.tagFilters ?? []),
    ...variadic('--allow-tools', inv.allowTools ?? []),
    // NO `--json`. It suppresses every progress line, and a sweep you cannot watch is
    // one you cannot diagnose — worth dropping on its own, since the harness writes
    // aggregate-result.json into `<eval-dir>/results/<timestamp>/` regardless and that
    // is the path the results snapshot reads. `--json` was only ever the fallback.
    //
    // It was NOT, however, the cause of the killed sweeps, and an earlier version of
    // this comment said it was. Four attempts: 41m killed, 34m killed, ~34m completed,
    // 33m killed — and the last was emitting output continuously right up to the kill.
    // The pattern is a wall-clock ceiling near 35 minutes on backgrounded tasks, not
    // silence. A per-condition sweep sits right on that boundary; per-case runs (5-8
    // minutes) sit comfortably under it, and chunking this loop that way is the real
    // fix. Until then, run sweeps from a terminal rather than in the background.
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
 * Does a `--case` selector name this case? `*` and `?` are the only metacharacters
 * assumed; everything else is matched literally, so an exact name is the common path.
 *
 * @param {string} glob
 * @param {string} name
 */
const globMatches = (glob, name) =>
  new RegExp(`^${glob.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '*' ? '.*' : c === '?' ? '.' : `\\${c}`))}$`)
    .test(name);

/**
 * One sweep's invocation, assembled from what the suite declares plus the operator's
 * overrides. Pure, so the whole command line is decided before anything is spawned.
 *
 * Two ways of selecting cases, never both (see `buildEvalArgv`):
 *
 *   - no `caseGlobs` — the recon-verified shape: `--tag` names every scored tag and the
 *     control case is kept out by not being named.
 *   - `caseGlobs` — a name-scoped invocation, ONE name (the harness takes one glob and
 *     keeps the last of several; `buildEvalArgv` refuses more). `--tag` is DROPPED,
 *     because an OR between the two would readmit the cases the split exists to
 *     separate. The tag filter's job (keep the control out) is then done by the name
 *     itself, so it is checked here: one that selects a control case, or that selects no
 *     discovered case at all, is refused rather than swept.
 *
 * @param {ConditionId} condition
 * @param {SuitePaths} paths
 * @param {CaseSpec[]} cases
 * @param {Partial<EvalInvocation>} [overrides]
 * @returns {EvalInvocation}
 */
export function invocationFor(condition, paths, cases, overrides = {}) {
  const globs = overrides.caseGlobs ?? [];
  if (globs.length > 0) {
    const readmitted = globs.filter((g) => (cases ?? []).some((c) => !c.scored && globMatches(g, c.name)));
    if (readmitted.length > 0)
      bad(`invocationFor: --case ${readmitted.join(', ')} selects a control case, and a name-scoped ` +
        'invocation carries no --tag filter to keep it out — the diagnostic would run and eat the budget');
    const unmatched = globs.filter((g) => !(cases ?? []).some((c) => globMatches(g, c.name)));
    if (unmatched.length > 0)
      bad(`invocationFor: --case ${unmatched.join(', ')} matches no discovered case — the invocation ` +
        'would sweep less than it says, which is a shorter run rather than an error');
  }
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
    tagFilters: globs.length > 0 ? [] : selectTagFilters(cases),
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
 * ResultsSnapshot — the NAMES of every `<eval-dir>/results/<ISO-timestamp>/` directory,
 * sorted, or `[]` when the suite has none.
 *
 * A set, not "the newest". `ResultsLocator` handed back the newest timestamped path and
 * the caller compared it before and after, which is only correct while this process is
 * the sole writer: any other harness run started against the same eval dir during a
 * sweep (the README's control-all-steps diagnostic, say) produces a newer directory, and
 * newest-wins then attributes somebody else's run to this sweep with every number still
 * looking plausible. Comparing the two SETS says exactly which directories this sweep is
 * responsible for, and how many.
 *
 * Only timestamp-shaped directories count: the runner keeps its own `<condition>.json`
 * and `drift.json` in the same folder, and the harness's recon directories sit there too.
 *
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} listDirectory
 * @returns {(inv: EvalInvocation) => Promise<string[]>}
 */
export const makeResultsSnapshot = (listDirectory) => async (inv) => {
  const dir = `${inv.suiteDir}/results`;
  const entries = await listDirectory(dir).catch(() => []);
  return entries
    .filter((e) => e.isDirectory && TIMESTAMP_DIR.test(e.name))
    .map((e) => e.name)
    .sort();
};

/**
 * CasesMissingFrom — the cases this invocation asked for that its document does not report.
 *
 * The mirror of the stranger check, and the one that catches a `--case` semantics
 * surprise: if the flag turned out to be last-one-wins rather than repeatable, a
 * four-case invocation comes back with one case, every name in it expected, and nothing
 * refuses until the merger — three rate-limit windows later. Naming the gap here lets the
 * loop stop after the first invocation instead.
 *
 * @param {any} document
 * @param {string[]} expected
 * @returns {string[]}
 */
export function casesMissingFrom(document, expected) {
  const reported = new Set(
    (Array.isArray(document?.cases) ? document.cases : []).map((c) => c?.name)
  );
  return (expected ?? []).filter((name) => !reported.has(name));
}

/** The document inside one results directory. Pure, so the tests can name the path. */
export const aggregatePathFor = (inv, dirName) =>
  join(`${inv.suiteDir}/results`, dirName, 'aggregate-result.json');

/**
 * RunSweep — spawn the harness, come back with a result rather than an exception.
 *
 * Never throws on a non-zero exit. Exit 1 means "a case scored below threshold", which
 * is a finding; exit 2 means partial and must not be compared against a complete run;
 * 130/143 mean somebody interrupted it. Throwing would erase all three distinctions.
 *
 * The document is claimed, not assumed. The set of timestamped results directories is
 * read BEFORE the spawn and again after, and this sweep owns its output only when
 * EXACTLY ONE directory is new:
 *
 *   1 new  — that is this sweep's document, provided the cases inside it are ones this
 *            invocation asked for.
 *   0 new  — nothing was written; fall back to a `--json` document on stdout, and
 *            failing that report `document: null`, which the merger refuses out loud.
 *   2+ new — another harness run wrote into this suite while the sweep was running.
 *            Neither directory can be attributed, so `document: null` and say which
 *            they were. Guessing here publishes a number measured by somebody else.
 *
 * `expectedCases` is the second half of the same guard: a document that reports a case
 * this invocation did not ask for is not this invocation's, whatever its timestamp says.
 *
 * `readTextFile` and `expectedCases` are appended to the declared signature:
 * `ResultsLocator` hands back a path and nothing in `RunSweep`'s parameters could read
 * it or know what was asked for. Recorded as an insufficiency rather than smuggled in.
 *
 * @param {SpawnCapture} spawnCapture
 * @param {EvalCommand} evalCommand
 * @param {(inv: EvalInvocation) => Promise<string[]>} resultsSnapshot
 * @param {EvalInvocation} inv
 * @param {ReadTextFile} readTextFile
 * @param {string[]} [expectedCases]  case names this invocation asked for; [] skips the check
 * @returns {Promise<SweepResult>}
 */
export async function runSweep(
  spawnCapture, evalCommand, resultsSnapshot, inv, readTextFile, expectedCases = []
) {
  const { command, env } = evalCommand();
  const argv = buildEvalArgv(inv);
  const before = new Set(await resultsSnapshot(inv));

  const { code, stdout, stderr } = await spawnCapture(command, argv, env);

  const notes = [];
  const after = await resultsSnapshot(inv);
  const fresh = after.filter((name) => !before.has(name));
  let document = null;

  if (fresh.length === 1) {
    const located = aggregatePathFor(inv, fresh[0]);
    try {
      document = JSON.parse(await readTextFile(located));
    } catch (e) {
      notes.push(`runner: ${located} could not be read as JSON — ${e.message}`);
    }
    const strangers = expectedCases.length === 0
      ? []
      : (Array.isArray(document?.cases) ? document.cases : [])
        .map((c) => c?.name)
        .filter((name) => !expectedCases.includes(name));
    if (strangers.length > 0) {
      // A document holding a case this invocation did not ask for was written by some
      // other run, or by ours and merged with one. Either way it is not evidence here.
      notes.push(`runner: ${located} reports case(s) ${strangers.join(', ')}, which this sweep did ` +
        `not ask for (it asked for ${[...expectedCases].sort().join(', ')}) — not claiming it`);
      document = null;
    }
    // Kept, not nulled: a document short of a case is still evidence for the cases it
    // does carry, and the merger refuses the incomplete set out loud. The note is what
    // lets the caller stop before paying for the remaining conditions.
    const absent = document === null ? [] : casesMissingFrom(document, expectedCases);
    if (absent.length > 0)
      notes.push(`runner: ${located} reports no result for ${absent.join(', ')}, which this sweep ` +
        'asked for by name — the invocation ran less than it was told to');
  } else if (fresh.length > 1) {
    notes.push(`runner: ${fresh.length} new results directories appeared during this sweep ` +
      `(${fresh.join(', ')}) — another harness run wrote into this suite during the sweep, so none ` +
      'of them can be attributed to it');
  } else {
    notes.push(after.length === 0
      ? 'runner: the sweep wrote no results directory'
      : 'runner: no NEW results directory — ' +
        `${aggregatePathFor(inv, after[after.length - 1])} predates this sweep and is not its output`);
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

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — one sweep, several harness invocations.
 *
 * A case registered `ablation: none` must never be run `with-without`: its `without`
 * arm carries the plugin in through a replayed transcript, so the contrast it produces
 * has no referent, and the report prints a scatter row beside a row it says has none.
 * `readCaseSpec` has always derived the field; until now nothing read it. Enforcing it
 * means one harness invocation per distinct ablation value (`--case` already scopes an
 * invocation), and one document assembled from those.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The ablations a case may declare, in the order their invocations run. */
const ABLATIONS = /** @type {('with-without'|'none')[]} */ (['with-without', 'none']);

/**
 * GroupCasesByAblation — the scored cases, split into one group per ablation value.
 *
 * `with-without` runs first because it is the registered primary evidence: if a sweep is
 * interrupted, the delta arm is the one already in hand. A value that is neither is
 * refused rather than defaulted — defaulting is how `ablation: none` came to run
 * with-without in the first place.
 *
 * @param {CaseSpec[]} cases
 * @returns {{ablation: 'with-without'|'none', cases: CaseSpec[]}[]}
 */
export function groupCasesByAblation(cases) {
  const scored = (cases ?? []).filter((c) => c.scored);
  if (scored.length === 0) bad('groupCasesByAblation: no scored case — a sweep over nothing scores nothing');
  const stray = scored.filter((c) => !ABLATIONS.includes(c.ablation));
  if (stray.length > 0)
    bad(`groupCasesByAblation: ${stray.map((c) => `${c.name} (${JSON.stringify(c.ablation)})`).join(', ')} ` +
      "declare an ablation that is neither 'none' nor 'with-without'");
  return ABLATIONS
    .map((ablation) => ({ ablation, cases: scored.filter((c) => c.ablation === ablation) }))
    .filter((g) => g.cases.length > 0);
}

/**
 * Severity order for exit codes, so a sweep made of several invocations reports the
 * worst thing that happened rather than the last: interrupted (≥128) and 127 beat
 * partial (2), which beats below-threshold (1), which beats clean (0).
 */
const severityOf = (code) => (code >= 128 || code === 127 ? 4 : code === 2 ? 3 : code === 1 ? 2 : code === 0 ? 1 : 3);

/**
 * CombineHarnessDocuments — one document from the per-ablation invocations.
 *
 * Safe only because the merger reads a narrow, checked slice: `cases[]` by name,
 * `suite.modelOverride` / `suite.judgeModel`, `claudeVersion`, `costUsd`, `partial`.
 * So the parts must agree on the first three (they are not one sweep otherwise), the
 * cases concatenate, cost sums and `partial` stays three-valued — absent when any part
 * could not establish it, because absence read as `false` is absence read as agreement.
 *
 * `suite.ablation` is the FIRST part's and cannot be anything else: the combined
 * document covers two. The per-case truth lives in `SweepRecord.ablations`.
 *
 * Any other field that describes ONE invocation is removed or recomputed rather than
 * carried through by the spread — see the `aggregates` / `durationSeconds` comment
 * below. A number that is true of part 0 only, sitting beside a `cases` array from
 * every part, is the plausible-number failure this file's header is about.
 *
 * Never throws: refusing here costs a sweep that has already been paid for, so a
 * refusal comes back as `document: null` plus a note the record carries.
 *
 * @param {{ablation: string, document: any}[]} parts
 * @returns {{document: any, notes: string[]}}
 */
export function combineHarnessDocuments(parts) {
  if (!Array.isArray(parts) || parts.length === 0) bad('combineHarnessDocuments: nothing to combine');
  /** @type {string[]} */
  const notes = [];
  const missing = parts.filter((p) => !p.document);
  if (missing.length > 0) {
    notes.push(`runner: the ${missing.map((p) => p.ablation).join(' and ')} invocation(s) produced no ` +
      'document, so this sweep has no combinable result');
    return { document: null, notes };
  }
  if (parts.length === 1) return { document: parts[0].document, notes };

  for (const p of parts)
    if (p.document.schemaVersion !== 1) {
      notes.push(`runner: the ${p.ablation} invocation reports schemaVersion ` +
        `${JSON.stringify(p.document.schemaVersion)} — only 1 is understood, so the parts are not combinable`);
      return { document: null, notes };
    }
  for (const [label, read] of /** @type {[string, (d: any) => unknown][]} */ ([
    ['claudeVersion', (d) => d.claudeVersion],
    ['subject model', (d) => d.suite?.modelOverride],
    ['judge model', (d) => d.suite?.judgeModel],
  ])) {
    const values = new Set(parts.map((p) => JSON.stringify(read(p.document) ?? null)));
    if (values.size > 1) {
      notes.push(`runner: the invocations disagree on ${label} (${[...values].join(', ')}) — they are ` +
        'not one sweep and must not be combined into one document');
      return { document: null, notes };
    }
  }

  /** @type {Map<string,string>} */
  const seen = new Map();
  const cases = [];
  for (const p of parts)
    for (const c of p.document.cases ?? []) {
      if (seen.has(c.name)) {
        notes.push(`runner: case '${c.name}' is in both the ${seen.get(c.name)} and ${p.ablation} ` +
          'invocations — one case ran at two ablations, which is the thing this split exists to prevent');
        return { document: null, notes };
      }
      seen.set(c.name, p.ablation);
      cases.push(c);
    }

  const document = {
    ...parts[0].document,
    cases,
    costUsd: parts.reduce((sum, p) => sum + (p.document.costUsd ?? 0), 0),
    startedAt: parts.map((p) => p.document.startedAt).filter(Boolean).sort()[0]
      ?? parts[0].document.startedAt,
  };
  // WHY: the spread above carried part 0's `aggregates` and `durationSeconds` through
  // unchanged, next to a `cases` array from every part — `casesTotal: 4` beside five
  // cases, an `overallScore`/`meanDelta` measured over the with-without invocation
  // alone, and a duration that omits the second invocation.
  //
  // `aggregates` is DELETED, not recomputed: `overallScore` and `meanDelta` are the
  // harness's own weighting of its own per-run scores, so a re-derivation here would be
  // this file's guess wearing the harness's field name. The merger reads none of it.
  // `durationSeconds` IS recomputed, because the invocations run sequentially and the
  // sum is therefore the real elapsed time — but only when every part reports one;
  // otherwise it goes too, since a sum missing a term is a shorter run than happened.
  delete document.aggregates;
  const durations = parts.map((p) => p.document.durationSeconds);
  if (durations.every((d) => typeof d === 'number'))
    document.durationSeconds = durations.reduce((a, b) => a + b, 0);
  else delete document.durationSeconds;

  const partials = parts.map((p) => p.document.partial);
  if (partials.every((p) => typeof p === 'boolean')) document.partial = partials.some(Boolean);
  else delete document.partial;
  const reason = parts.map((p) => p.document.partialReason).find(Boolean);
  if (reason) document.partialReason = reason;

  notes.push(`runner: combined ${parts.length} harness invocations — ` +
    `${parts.map((p) => `${p.ablation}: ${(p.document.cases ?? []).map((c) => c.name).join(', ') || 'no case'}`).join('; ')}. ` +
    "`suite.ablation` below is the first invocation's; the per-case truth is the record's `ablations`. " +
    '`aggregates` is dropped (it counted one invocation) and `durationSeconds` is the sum of the parts.');
  return { document, notes };
}

/**
 * CombineSweepParts — the per-ablation invocations of ONE condition as one SweepResult,
 * plus the case→ablation map the merger needs to see that `none` really ran as `none`.
 *
 * @param {ConditionId} condition
 * @param {{ablation: 'with-without'|'none', cases: string[], result: SweepResult}[]} parts
 * @returns {SweepResult & {ablations: Record<string,'with-without'|'none'>}}
 */
export function combineSweepParts(condition, parts) {
  if (!Array.isArray(parts) || parts.length === 0)
    bad(`combineSweepParts: ${condition} ran no invocation`);
  const { document, notes } = combineHarnessDocuments(
    parts.map((p) => ({ ablation: p.ablation, document: p.result.document }))
  );
  /** @type {Record<string,'with-without'|'none'>} */
  const ablations = {};
  for (const p of parts) for (const name of p.cases) ablations[name] = p.ablation;
  const exitCode = parts
    .map((p) => p.result.exitCode)
    .reduce((worst, code) => (severityOf(code) > severityOf(worst) ? code : worst));
  return {
    condition,
    exitCode,
    document,
    stderrTail: tail([
      ...parts.map((p) => `── ${condition} · --ablation ${p.ablation} · exit ${p.result.exitCode}\n${p.result.stderrTail}`),
      ...notes,
    ].filter(Boolean).join('\n')),
    ablations,
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
 * Pure — the records, and the digest that makes them comparable.
 *
 * The instrument is everything a score depends on: the cases, their graders, the
 * transcripts they replay, the fixture, and every condition's SKILL.md. The
 * pre-registration digest does not cover it and `drift.json` covers only the treatment
 * mirror, so a treatment measured against last week's graders merged against this
 * week's controls and every invariant passed. Both records carry the digest; the merger
 * refuses (I2b) when they disagree with each other or with the tree it can see.
 * ──────────────────────────────────────────────────────────────────────────── */

const SHA256 = /^[0-9a-f]{64}$/;

const requireDigest = (where, sha) => {
  if (typeof sha !== 'string' || !SHA256.test(sha))
    bad(`${where}: ${JSON.stringify(sha)} is not an instrument digest — a record without one is ` +
      'unmergeable under I2b, and omitting it silently is how results measured on a different ' +
      'instrument get merged');
  return sha;
};

/**
 * @param {{drifted: boolean, reason: string}} drift
 * @param {string} checkedAt
 * @param {string} instrumentSha
 * @returns {DriftRecord}
 */
export function buildDriftRecord(drift, checkedAt, instrumentSha) {
  return {
    drifted: drift.drifted,
    reason: drift.reason,
    checkedAt,
    instrumentSha: requireDigest('buildDriftRecord', instrumentSha),
  };
}

/**
 * WHY this is checked rather than assumed: the merger cross-checks this map, case by
 * case, against the `ablation` PRE-REGISTRATION registers — it is the only thing at
 * merge time that can see that a case registered `none` really ran as `none`. A third
 * value, or a map that is not a map, is not something it can read, so it is refused
 * here where a sweep has not been paid for yet.
 *
 * @param {Record<string,'none'|'with-without'>} map
 * @returns {Record<string,'none'|'with-without'>}
 */
const requireAblations = (map) => {
  if (map === null || typeof map !== 'object' || Array.isArray(map))
    bad(`buildSweepRecord: ablations ${JSON.stringify(map)} is not a {case name → ablation} map`);
  for (const [name, ablation] of Object.entries(map))
    if (!ABLATIONS.includes(/** @type {any} */ (ablation)))
      bad(`buildSweepRecord: ablations[${JSON.stringify(name)}] is ${JSON.stringify(ablation)}, ` +
        "which is neither 'none' nor 'with-without' — the merger checks this map against the " +
        'registration and cannot read a third value');
  return map;
};

/**
 * @param {{condition: ConditionId, exitCode: number, document: any, stderrTail: string,
 *          ablations: Record<string,'none'|'with-without'>}} combined
 * @param {{argvs: string[][], startedAt: string, instrumentSha: string}} run
 * @returns {SweepRecord}
 */
export function buildSweepRecord(combined, run) {
  return {
    condition: combined.condition,
    exitCode: combined.exitCode,
    document: combined.document,
    stderrTail: combined.stderrTail,
    ablations: requireAblations(combined.ablations),
    // One entry per harness invocation, so a reader can re-run each of them exactly.
    argvs: run.argvs,
    startedAt: run.startedAt,
    instrumentSha: requireDigest('buildSweepRecord', run.instrumentSha),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the operator's own arguments.
 * ──────────────────────────────────────────────────────────────────────────── */

const USAGE = `usage: node scripts/run-evals.mjs [--condition <id>]... [--runs <n>] [--smoke]

  --condition <id>  treatment | oneliner | placebo. Repeatable, or comma-separated.
                    Default: all three, swept in that order.
  --runs <n>        Runs per case. Default ${DEFAULTS.runs} — the pre-registered count.
  --smoke           The cheap pilot: one scored case, one run. Do this before a sweep.
                    Cannot be combined with --runs: it fixes the count at 1.`;

/** @param {string[]} argv */
export function parseArgv(argv) {
  const args = { conditions: /** @type {ConditionId[]} */ ([]), runs: DEFAULTS.runs, smoke: false, help: false };
  // Both flags write `runs`, so whichever came last used to win silently — `--smoke
  // --runs 5` spent a full sweep believing it was a pilot. Remembered, then refused
  // after the loop, so the order they were typed in makes no difference.
  let sawRuns = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--smoke') {
      args.smoke = true;
      args.runs = 1;
    } else if (a === '--condition') {
      const value = argv[++i] ?? bad(`--condition needs a value\n${USAGE}`);
      const ids = value.split(',').map((s) => s.trim()).filter(Boolean);
      // `--condition ''` and `--condition ,` used to name nothing and then fall through
      // to the default: all three conditions, a full sweep nobody asked for.
      if (ids.length === 0) bad(`--condition needs at least one condition id\n${USAGE}`);
      for (const id of ids) {
        if (!CONDITION_IDS.includes(/** @type {any} */ (id)))
          bad(`--condition ${id}: not one of ${CONDITION_IDS.join(', ')}`);
        if (!args.conditions.includes(/** @type {any} */ (id))) args.conditions.push(/** @type {any} */ (id));
      }
    } else if (a === '--runs') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 1) bad(`--runs needs a whole number ≥ 1\n${USAGE}`);
      args.runs = n;
      sawRuns = true;
    } else bad(`unknown option ${a}\n${USAGE}`);
  }
  if (args.smoke && sawRuns) bad(`--smoke fixes runs to 1; drop one of the flags\n${USAGE}`);
  // Sweep order is the declared order, not the order they were typed: the treatment
  // first means a broken condition costs one sweep rather than three.
  if (args.conditions.length === 0) args.conditions = [...CONDITION_IDS];
  else args.conditions = CONDITION_IDS.filter((c) => args.conditions.includes(c));
  return args;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the whole run, decided before anything is spawned.
 *
 * WHY these two functions exist at all: the decisions that matter most used to sit in
 * the un-exported `main` — which cases share a command line, whether an invocation is
 * scoped by name or by tag, which conditions are checked before the first sweep, and
 * when to stop. `invocationFor` was pinned byte for byte while `main` was free to call
 * it with `group.cases` instead of `cases`, or without `caseGlobs`, and every test
 * still passed. Everything that decides something is pure; `main` only spends.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} PlannedInvocation
 * @property {'with-without'|'none'} ablation
 * @property {string[]} cases   the case names this invocation asks for, by name
 * @property {EvalInvocation} inv
 * @property {string[]} argv    what `main` will spawn, built here so a test can read it
 */

/**
 * @typedef {object} SweepPlan
 * @property {string[]} scored     scored case names, in discovery order
 * @property {string[]} excluded   the control cases, which no invocation names
 * @property {{ablation: 'with-without'|'none', cases: string[]}[]} groups
 * @property {boolean} scopeByName whether the invocations select by `--case` (one case per
 *                                 invocation) or by `--tag` (one invocation for the group)
 * @property {{path: string, why: string}[]} preChecks  files that must exist before spending
 * @property {{condition: ConditionId, invocations: PlannedInvocation[]}[]} sweeps
 */

/**
 * PlanSweep — every invocation this run will make, in order, plus the pre-checks that
 * must pass before the first one spends anything.
 *
 * The argv is built here, for every condition, so that a command line the runner cannot
 * assemble is a refusal before the first sweep rather than after two.
 *
 * @param {CaseSpec[]} cases  every discovered case, control cases included
 * @param {{conditions: ConditionId[], runs: number, smoke: boolean}} args
 * @param {SuitePaths} [suitePaths]
 * @returns {SweepPlan}
 */
export function planSweep(cases, args, suitePaths = paths) {
  if (!args || !Array.isArray(args.conditions) || args.conditions.length === 0)
    bad('planSweep: no condition to sweep');
  const all = cases ?? [];
  const scored = all.filter((c) => c.scored);
  const excluded = all.filter((c) => !c.scored).map((c) => c.name);

  // One invocation per distinct ablation, because a case registered `ablation: none`
  // must not be run with-without: its without-arm carries the plugin in through a
  // replayed transcript, so the contrast has no referent. `--case` scopes an invocation,
  // and the documents are combined afterwards.
  let groups = groupCasesByAblation(all);
  if (args.smoke) {
    const pilot = scored.find((c) => c.evidence === 'delta');
    if (!pilot) bad('--smoke: no scored delta case to pilot');
    groups = [{ ablation: pilot.ablation, cases: [pilot] }];
  }
  // Scope by name only when the ablations actually differ (or the pilot asked for one
  // case). A single group keeps the tag-filter-only command line recon verified — and a
  // name-scoped invocation drops `--tag` entirely (invocationFor), because how the
  // harness combines the two flags is undetermined and an OR would undo the split.
  //
  // Name-scoped means ONE CASE PER INVOCATION. `--case` is a single glob and a repeated
  // flag keeps the last (harness-facts #44); no wildcard separates the four delta cases
  // from step3 by name, and the tags do not partition them either. So a split sweep is
  // five invocations per condition, each the exact shape recon verified: one `--case`.
  const scopeByName = groups.length > 1 || args.smoke;
  const invocationsOf = (group) => (scopeByName ? group.cases.map((c) => [c]) : [group.cases])
    .map((cs) => ({ ablation: group.ablation, cases: cs.map((c) => c.name), scoped: scopeByName }));

  return {
    scored: scored.map((c) => c.name),
    excluded,
    groups: groups.map((g) => ({ ablation: g.ablation, cases: g.cases.map((c) => c.name) })),
    scopeByName,
    // Every condition is checked BEFORE the first sweep. A condition with no SKILL.md
    // loads as no plugin at all, and the with-arm quietly becomes a second baseline:
    // every delta then reads 0.00 and looks like a null result. Checked inside the sweep
    // loop, as it used to be, a missing third condition cost two full sweeps first.
    preChecks: args.conditions.map((condition) => ({
      path: join(suitePaths.conditionsDir, condition, 'SKILL.md'),
      why: 'that condition would sweep as no plugin at all',
    })),
    sweeps: args.conditions.map((condition) => ({
      condition,
      invocations: groups.flatMap(invocationsOf).map(({ ablation, cases: names, scoped }) => {
        const inv = invocationFor(condition, suitePaths, all, {
          runs: args.runs,
          ablation,
          ...(scoped ? { caseGlobs: names } : {}),
        });
        return { ablation, cases: names, inv, argv: buildEvalArgv(inv) };
      }),
    })),
  };
}

/**
 * SweepStopReason — why this invocation must be the run's last, or null to carry on.
 *
 * Three ways an invocation ends a run, and all three used to be handled differently or
 * not at all:
 *
 *   - interrupted — somebody killed the child; the next ablation's budget buys nothing.
 *   - NO DOCUMENT — `runSweep` could not attribute an output to this invocation (no
 *     results directory, two of them, unreadable JSON, or a document reporting a case
 *     this invocation never asked for). This branch used to read `result.document ?
 *     casesMissingFrom(...) : []`, i.e. a null document meant zero missing cases, so the
 *     loop swept the next ablation and then both remaining conditions after the first
 *     invocation had already proved unattributable.
 *   - short — the document reports fewer cases than the invocation named.
 *   - partial (exit 2) — the harness stopped itself: authentication failed or a cost
 *     ceiling tripped. Every later invocation fails the same way, and on 2026-09-03 the
 *     smoke pass swept all three conditions against an expired login before this branch
 *     existed.
 *
 * @param {{ablation: 'with-without'|'none', cases: string[], result: SweepResult}} part
 * @returns {{why: string, hint: string|null}|null}
 */
export function sweepStopReason({ ablation, cases, result }) {
  const named = `the --ablation ${ablation} invocation named ${(cases ?? []).join(', ')}`;
  if (isInterrupted(result.exitCode))
    return { why: `${named} and was killed by a signal (exit ${result.exitCode})`, hint: null };
  if (result.exitCode === 2)
    return {
      why: `${named} and the harness reported a partial run (exit 2)`,
      hint: 'exit 2 is authentication or a cost ceiling, and the next invocation would fail the ' +
        'same way — the record\'s stderrTail says which; `claude /login` if it is the login',
    };
  if (result.document === null)
    return {
      why: `${named} but produced no document this sweep can claim as its own`,
      hint: 'the record\'s stderrTail says which: no results directory, more than one (another ' +
        'harness run wrote into this suite), unreadable JSON, or a document reporting a case ' +
        'this invocation never asked for — none of them is attributable evidence',
    };
  const absent = casesMissingFrom(result.document, cases);
  if (absent.length > 0)
    return {
      why: `${named} but its document reports no result for ${absent.join(', ')}`,
      // The runner passes exactly one `--case` per invocation (harness-facts #44), so a
      // short document is not a selector problem any more: the harness loaded fewer cases
      // than it was asked for, and its stderr says which one failed to load and why.
      hint: 'the harness ran fewer cases than named — a case failed to load (bad frontmatter, ' +
        'missing prompt.md, a grader that did not parse); the record\'s stderrTail has the reason',
    };
  return null;
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

/** The inverse of {@link selectCondition}: leave no condition standing at the fixed path. */
const removeDirectory = (path) => rm(path, { recursive: true, force: true });

const listDirectory = async (path) => {
  const entries = await readdir(path, { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
};

/**
 * The shell convention for a child killed by a signal: 128 + the signal number.
 * SIGINT 130, SIGTERM 143, SIGKILL 137, SIGHUP 129.
 *
 * The previous mapping named SIGINT and SIGTERM and sent everything else to 1 — which
 * is "a case scored below threshold", a RESULT. A sweep killed by the OOM killer or by
 * a closed terminal therefore recorded a finding and the loop swept on to the next
 * condition, publishing a comparison against a run that never finished.
 *
 * @param {string|null|undefined} signal
 * @returns {number}
 */
export const exitCodeForSignal = (signal) => {
  const number = signal ? /** @type {any} */ (osConstants.signals)[signal] : undefined;
  return typeof number === 'number' ? 128 + number : 1;
};

/** Any exit at or above 128 is a signalled death, and no sweep may continue past one. */
export const isInterrupted = (code) => Number.isInteger(code) && code >= 128;

/**
 * SpawnCapture, as a factory over `spawn` so a fake child can drive it in a test.
 *
 * Buffers rather than streams — the child may emit up to 64 MiB under `--json`, which is
 * fine at this suite's size and wrong if it grows.
 *
 * The returned function carries `forwardSignal`. What it fixes is Node's default SIGINT
 * handler ending this process before the child's `close` event can fire — so the 130 path
 * and the results write were unreachable and `_conditions/current` was left populated.
 * Forwarding kills the child, `close` reports the signal, and the record is written on the
 * way out. (At a terminal SIGINT already goes to the whole foreground process group, so
 * the child normally gets one anyway; the forward is what makes `kill -INT <pid>` and
 * every non-tty case behave the same.)
 *
 * @param {typeof spawn} spawnProcess
 * @returns {SpawnCapture & {forwardSignal: (signal: NodeJS.Signals) => boolean}}
 */
export function makeSpawnCapture(spawnProcess) {
  /** The child currently running, or null. One at a time: sweeps are sequential. */
  let live = null;
  const capture = (command, args, env) =>
    new Promise((resolve) => {
      const child = spawnProcess(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
      live = child;
      let stdout = '';
      let stderr = '';
      const done = (value) => {
        live = null;
        resolve(value);
      };
      child.stdout.on('data', (d) => (stdout += d));
      child.stderr.on('data', (d) => {
        stderr += d;
        process.stderr.write(d); // the harness's per-case progress is the only sign of life
      });
      child.on('error', (e) => done({ code: 127, stdout, stderr: `${stderr}${e}` }));
      child.on('close', (code, signal) =>
        done({ code: code ?? exitCodeForSignal(signal), stdout, stderr }));
    });
  capture.forwardSignal = (signal) => {
    if (live === null) return false;
    live.kill(signal);
    return true;
  };
  return capture;
}

/** @type {ReturnType<typeof makeSpawnCapture>} */
const spawnCapture = makeSpawnCapture(spawn);

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
  // The whole run is decided here, before anything is read or spawned: the groups, the
  // per-condition invocations, their argv, and the files that must exist first. Every
  // refusal it can raise (a stray ablation, a selector that reaches the control case, an
  // unbuildable command line) therefore costs nothing.
  const plan = planSweep(cases, args);

  for (const check of plan.preChecks)
    await readTextFile(check.path).catch(() => bad(`no ${check.path} — ${check.why}`));

  // Drift first, and it is fatal. A drifted mirror makes the run void under I2, so
  // sweeping anyway would spend a rate-limit window measuring a version of the skill
  // that no longer exists. The record is written either way — the merger reads its
  // absence as drift, and a refusal you cannot inspect is worse than none.
  const drift = await checkDrift(readTextFile, mirrorPaths);
  // Once per invocation, and the same value on drift.json and on every sweep record: it
  // is the digest that lets the merger tell three sweeps of one instrument from three
  // sweeps of three.
  const instrumentSha = await instrumentDigest(paths.suiteDir);
  await writeDriftRecord(writeTextFile, paths, buildDriftRecord(drift, clock(), instrumentSha));
  if (drift.drifted) {
    console.error(`DRIFT: the treatment mirror is not the shipped skill minus the flag`);
    console.error(`  ${drift.reason}`);
    console.error('  regenerate with: node scripts/build-conditions.mjs generate');
    console.error('  refusing to sweep — I2 voids a run whose treatment condition has drifted');
    return 1;
  }

  console.error(`suite ${paths.suiteDir} — ${plan.scored.length} scored case(s)` +
    (plan.excluded.length > 0 ? `, excluding ${plan.excluded.join(', ')}` : ''));
  console.error(`drift: none — ${mirrorPaths.treatmentMirror.replace(`${repoRoot}/`, '')} is current`);
  console.error(`instrument: ${instrumentSha.slice(0, 12)}… (every case, grader, fixture and condition)`);
  for (const g of plan.groups)
    console.error(`  --ablation ${g.ablation}: ${g.cases.join(', ')}`);

  let failed = 0;
  for (const [index, sweep] of plan.sweeps.entries()) {
    const { condition, invocations } = sweep;
    const startedAt = clock();
    console.error(`\nsweep ${index + 1}/${plan.sweeps.length} · ${condition} · ` +
      `${args.runs} run(s) · ${DEFAULTS.subjectModel}/${DEFAULTS.judgeModel} · ` +
      `${invocations.length} invocation(s)`);
    await selectCondition(copyDirectory, paths, condition);
    console.error(`  ${paths.conditionUnderTest} ← conditions/${condition}`);

    const evalCommand = () => evalCommandFrom(process.env);
    /** @type {{ablation: 'with-without'|'none', cases: string[], argv: string[], result: SweepResult}[]} */
    const parts = [];
    /** Set when an invocation ended the run: interrupted, unattributable, or short. */
    let stop = null;
    for (const planned of invocations) {
      console.error(`  ${evalCommand().command} ${planned.argv.join(' ')}`);
      const result = await runSweep(
        spawnCapture, evalCommand, makeResultsSnapshot(listDirectory), planned.inv, readTextFile,
        planned.cases
      );
      console.error(`    exit ${result.exitCode} · ${result.document ? 'document' : 'NO DOCUMENT'}`);
      parts.push({ ablation: planned.ablation, cases: planned.cases, argv: planned.argv, result });
      // Whether the next ablation is worth its budget is a decision, so it is made by a
      // pure function a test can drive rather than by three conditions inline here.
      stop = sweepStopReason({ ablation: planned.ablation, cases: planned.cases, result });
      if (stop !== null) break;
    }

    const combined = combineSweepParts(condition, parts);
    const record = buildSweepRecord(combined, {
      argvs: parts.map((p) => p.argv),
      startedAt,
      instrumentSha,
    });
    const out = join(paths.resultsDir, `${condition}.json`);
    await writeTextFile(out, `${JSON.stringify(record, null, 2)}\n`);
    console.error(`  exit ${record.exitCode} · ${record.document ? 'document kept' : 'NO DOCUMENT'} → ${out}`);

    if (record.document === null || record.exitCode > 1) failed++;
    if (stop !== null) {
      // The record is already written; what is left is the condition copy, which would
      // otherwise sit at the fixed path and be evaluated by whatever runs next.
      console.error(`  ${stop.why}`);
      if (stop.hint) console.error(`  ${stop.hint}`);
      console.error('  stopping rather than sweeping the remaining conditions against a run that ' +
        'has already stopped being evidence');
      await removeDirectory(paths.conditionUnderTest);
      console.error(`  removed ${paths.conditionUnderTest}`);
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
  // Ctrl-C at a terminal reaches this process, and Node's default handler ends it before
  // the child's `close` event can fire — so the interrupted path never ran, no record was
  // written, and `_conditions/current` was left populated with whichever condition was
  // mid-sweep. Forward the signal instead: the child dies, `close` reports it as 128+N,
  // and `main` writes the record and clears the path on its way out. With no child
  // running there is nothing to wait for, so exit as the shell expects.
  for (const signal of /** @type {NodeJS.Signals[]} */ (['SIGINT', 'SIGTERM'])) {
    process.on(signal, () => {
      if (spawnCapture.forwardSignal(signal)) return;
      // WHY: with no child to wait for — between `selectCondition` and the spawn, during
      // the record write, or between conditions — this exits without ever reaching main's
      // cleanup, and the condition copy stays at the fixed path for whatever runs next to
      // evaluate as though somebody had chosen it.
      try {
        // Absolute: `main` chdirs to the repo root, but a signal can arrive before it has,
        // and a relative path would then name something else (or nothing).
        rmSync(join(paths.repoRoot, paths.conditionUnderTest), { recursive: true, force: true });
      } catch {
        // Nothing left to remove, or nothing we can do about it while exiting.
      }
      process.exit(exitCodeForSignal(signal));
    });
  }
  process.exitCode = await main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e instanceof RunError ? e.message : e.stack}\n`);
    return 1;
  });
}

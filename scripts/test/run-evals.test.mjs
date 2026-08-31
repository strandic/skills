/**
 * Tests for the sweep runner, and mostly for one function.
 *
 * `buildEvalArgv` is the whole reason the runner has a pure core. Every way of
 * getting it wrong produces a *plausible number* rather than an error: drop
 * `--allow-tools` and the absence graders pass against a run that could never have
 * edited anything; drop `--scaffold` and every prompt describes a service the sandbox
 * does not contain; let the target slip behind `--tag` and it is read as a tag name.
 * So the argv is pinned as an exact array, in order, and not merely checked for the
 * presence of flags.
 *
 * `node --test scripts/test/*.test.mjs` — the trailing glob matters; a bare directory
 * is read as a module path and fails to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildEvalArgv, selectTagFilters, selectAllowTools, invocationFor, evalCommandFrom,
  makeResultsLocator, runSweep, selectCondition, discoverCases, readCaseSpec, yamlish,
  frontmatter, inlineList, parseArgv, tail, paths, suitePathsFor, RunError,
} from '../run-evals.mjs';

/** The real handles, read-only, so the suite's own case files are what gets asserted. */
const readTextFile = (path) => readFile(join(paths.repoRoot, path), 'utf8');
const listDirectory = async (path) => {
  const entries = await readdir(join(paths.repoRoot, path), { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
};

/** A complete invocation, so a test can vary one field without restating twelve. */
const invocation = (over = {}) => ({
  condition: 'treatment',
  suiteDir: 'evals/seven-steps-primer',
  ablation: 'with-without',
  runs: 5,
  subjectModel: 'sonnet',
  judgeModel: 'opus',
  allowTools: ['Bash', 'Edit', 'Write'],
  threshold: 0.6,
  caseGlobs: [],
  tagFilters: ['capability', 'core', 'gate', 'guardrail', 'scored', 'triage'],
  scaffold: true,
  outputDir: 'evals/seven-steps-primer/results',
  ...over,
});

/* ── BuildEvalArgv — the exact command ─────────────────────────────────────── */

test('the argv is exactly this, in exactly this order', () => {
  assert.deepEqual(buildEvalArgv(invocation()), [
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

test('the smoke pilot is one case at one run, and nothing else moves', () => {
  assert.deepEqual(buildEvalArgv(invocation({ runs: 1, caseGlobs: ['gate-stop-step0'] })), [
    'plugin', 'eval', '.',
    '--eval-dir', 'evals/seven-steps-primer',
    '--ablation', 'with-without',
    '--runs', '1',
    '--model', 'sonnet',
    '--judge-model', 'opus',
    '--threshold', '0.6',
    '--scaffold',
    '--no-publish',
    '--case', 'gate-stop-step0',
    '--tag', 'capability', 'core', 'gate', 'guardrail', 'scored', 'triage',
    '--allow-tools', 'Bash', 'Edit', 'Write',
  ]);
});

test('the suite\'s real cases build the command that will actually run', async () => {
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  assert.deepEqual(buildEvalArgv(invocationFor('placebo', paths, cases)), [
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

/* ── The order rules, stated as rules rather than implied by the array above ── */

test('the target precedes every option that would consume it', () => {
  const argv = buildEvalArgv(invocation({ caseGlobs: ['x'] }));
  const target = argv.indexOf('.');
  assert.equal(target, 2, 'the target is the argument right after `plugin eval`');
  for (const flag of ['--tag', '--allow-tools'])
    assert.ok(target < argv.indexOf(flag), `${flag} would consume a target that came after it`);
});

test('--json is never passed — it silences the run, and silence gets a sweep killed', () => {
  // Two 90-minute sweeps were killed after 41 and 34 minutes of producing no output at
  // all, which is what --json does: it suppresses every progress line. The document
  // still lands in <eval-dir>/results/<timestamp>/, which is what ResultsLocator reads.
  assert.ok(!buildEvalArgv(invocation({ caseGlobs: ['x'] })).includes('--json'));
  assert.ok(!buildEvalArgv(invocation()).includes('--json'));
});

test('a variadic list never ends adjacent to another variadic list\'s values', () => {
  const argv = buildEvalArgv(invocation());
  // --tag's values must be followed by a flag, not by --allow-tools' first value.
  assert.equal(argv[argv.indexOf('--allow-tools') - 1], 'triage');
  assert.ok(argv[argv.indexOf('--tag') + 1].startsWith('-') === false);
});

/* ── Flags that are omitted rather than emitted empty ──────────────────────── */

test('an empty tool grant omits the flag — an empty --allow-tools would eat the next one', () => {
  const argv = buildEvalArgv(invocation({ allowTools: [] }));
  assert.ok(!argv.includes('--allow-tools'));
  assert.ok(!argv.at(-1).startsWith('-') || argv.at(-1) === '--no-scaffold' || argv.at(-1) === '--no-publish',
    'the argv must not end on a flag that would swallow a following value');
});

test('an empty tag filter omits the flag rather than selecting nothing', () => {
  assert.ok(!buildEvalArgv(invocation({ tagFilters: [] })).includes('--tag'));
});

test('scaffold off is said out loud, so a persisted argv cannot hide it', () => {
  assert.ok(buildEvalArgv(invocation({ scaffold: false })).includes('--no-scaffold'));
});

/* ── Refusals: every one of these would otherwise produce a plausible number ── */

test('a tag beginning with `-` is refused, not silently truncating the list', () => {
  assert.throws(() => buildEvalArgv(invocation({ tagFilters: ['scored', '-x'] })), RunError);
});

test('a tool beginning with `-` is refused for the same reason', () => {
  assert.throws(() => buildEvalArgv(invocation({ allowTools: ['-Bash'] })), RunError);
});

test('the default threshold of 1.0 is unreachable with llm graders, so one is required', () => {
  assert.throws(() => buildEvalArgv(invocation({ threshold: 0 })), RunError);
  assert.throws(() => buildEvalArgv(invocation({ threshold: 1.5 })), RunError);
  assert.doesNotThrow(() => buildEvalArgv(invocation({ threshold: 1 })));
});

test('a judge that is the subject is refused — that is the confound the pin exists for', () => {
  assert.throws(() => buildEvalArgv(invocation({ judgeModel: 'sonnet' })), RunError);
});

test('an unknown ablation is refused rather than passed through to the harness', () => {
  assert.throws(() => buildEvalArgv(invocation({ ablation: 'with-only' })), RunError);
});

test('`none` is not a condition — it arrives as the without arm, never as a sweep', () => {
  assert.throws(() => buildEvalArgv(invocation({ condition: 'none' })), RunError);
});

test('a fractional run count is refused', () => {
  assert.throws(() => buildEvalArgv(invocation({ runs: 2.5 })), RunError);
});

/* ── Tag selection — the control case must not reach a scored run ──────────── */

const spec = (name, tags, over = {}) => ({
  name, tags, scored: !tags.includes('control'), evidence: 'delta',
  ablation: 'with-without', measures: '', allowedTools: [], dir: name, ...over,
});

test('the control case is excluded by not being named, since --tag has no exclude form', () => {
  const tags = selectTagFilters([
    spec('control-all-steps', ['control']),
    spec('gate-stop-step0', ['gate', 'core', 'scored']),
  ]);
  assert.deepEqual(tags, ['core', 'gate', 'scored']);
  assert.ok(!tags.includes('control'));
});

test('a tag the control also carries is dropped — it would readmit the diagnostic', () => {
  const tags = selectTagFilters([
    spec('control-all-steps', ['control', 'core']),
    spec('gate-stop-step0', ['core', 'scored']),
  ]);
  assert.deepEqual(tags, ['scored'], '`core` now selects the control, so it cannot be used');
});

test('a scored case no surviving tag can reach is a refusal, not a shorter sweep', () => {
  assert.throws(() => selectTagFilters([
    spec('control-all-steps', ['control', 'core']),
    spec('only-core', ['core']),
  ]), RunError);
});

test('no cases at all is refused rather than reported as a clean sweep of nothing', () => {
  assert.throws(() => selectTagFilters([]), RunError);
});

test('the real suite selects every scored case and never the control', async () => {
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const tags = selectTagFilters(cases);
  assert.ok(!tags.includes('control'));
  for (const c of cases.filter((c) => c.scored))
    assert.ok(c.tags.some((t) => tags.includes(t)), `${c.name} would be dropped from the sweep`);
  for (const c of cases.filter((c) => !c.scored))
    assert.ok(!c.tags.some((t) => tags.includes(t)), `${c.name} is a control and would run`);
});

/* ── Tool grant — the two lists are intersected, so the operator grant must cover ── */

test('only gated tools are granted; the read-only set is already available', () => {
  assert.deepEqual(
    selectAllowTools([spec('a', ['scored'], { allowedTools: ['Read', 'Glob', 'Grep', 'Skill', 'Write', 'Edit', 'Bash'] })]),
    ['Bash', 'Edit', 'Write']
  );
});

test('the control case does not widen the grant', () => {
  assert.deepEqual(
    selectAllowTools([spec('c', ['control'], { allowedTools: ['WebFetch'] }), spec('a', ['scored'], { allowedTools: ['Bash'] })]),
    ['Bash']
  );
});

test('mcp__ tools and Tool(pattern:*) forms are gated too', () => {
  assert.deepEqual(
    selectAllowTools([spec('a', ['scored'], { allowedTools: ['mcp__x__y', 'Bash(git:*)', 'BashOutput'] })]),
    ['Bash(git:*)', 'mcp__x__y']
  );
});

test('the real suite grants exactly what its cases ask for', async () => {
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  assert.deepEqual(selectAllowTools(cases), ['Bash', 'Edit', 'Write']);
});

/* ── Reading the case files ────────────────────────────────────────────────── */

test('yamlish addresses a nested key by path, so tools under `execution:` are seen', () => {
  const y = yamlish('name: c\ncontext:\n  history_file: history.jsonl\nexecution:\n  allowed_tools: [Read, Bash]\n');
  assert.equal(y.name, 'c');
  assert.equal(y['context.history_file'], 'history.jsonl');
  assert.equal(y['execution.allowed_tools'], '[Read, Bash]');
});

test('a comment inside a block is not a key, however much it looks like one', () => {
  const y = yamlish('context:\n  # scaffold_script: not-this.sh\n  scaffold_script: scaffold.sh\n');
  assert.equal(y['context.scaffold_script'], 'scaffold.sh');
});

test('a trailing comment is stripped from the value', () => {
  assert.equal(yamlish('graders: []   # they live in graders/*.md\n').graders, '[]');
});

test('a key that is present but not an inline list refuses rather than reading as empty', () => {
  assert.throws(() => inlineList('\n  - gate', 'x tags'), RunError);
  assert.deepEqual(inlineList(undefined, 'x tags'), null);
  assert.deepEqual(inlineList('[]', 'x tags'), []);
});

test('prompt.md frontmatter wins over case.yaml, which is the harness\'s own precedence', () => {
  const spec = readCaseSpec('c', 'name: c\ntags: [stale]\n', '---\ntags: [gate, scored]\n---\n\nPrompt.\n');
  assert.deepEqual(spec.tags, ['gate', 'scored']);
  assert.equal(spec.name, 'c');
});

test('a history_file makes the case capability evidence — the mechanism, not the label', () => {
  const replay = readCaseSpec('c', 'context:\n  history_file: history.jsonl\ntags: [capability]\n', null);
  assert.equal(replay.evidence, 'capability');
  assert.equal(replay.ablation, 'none');
  const direct = readCaseSpec('d', 'context:\n  scaffold_script: scaffold.sh\n', '---\ntags: [scored]\n---\n');
  assert.equal(direct.evidence, 'delta');
});

test('frontmatter is the block between the fences, and nothing when there is none', () => {
  assert.equal(frontmatter('---\na: 1\n---\n\nBody\n'), 'a: 1');
  assert.equal(frontmatter('No frontmatter here\n'), '');
});

test('discovery finds the cases and nothing else under the suite', async () => {
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const names = cases.map((c) => c.name);
  assert.ok(names.includes('gate-stop-step0'));
  assert.ok(names.includes('step3-markers-in-source'));
  assert.ok(!names.includes('conditions'), 'conditions/ carries no case.yaml or prompt.md');
  assert.ok(!names.includes('fixtures'));
  assert.deepEqual(names, [...names].sort(), 'lexicographic — the order the harness runs them in');
  assert.equal(cases.filter((c) => !c.scored).length, 1, 'exactly one control case');
});

test('discovery over a suite with no cases refuses rather than sweeping nothing', async () => {
  const empty = suitePathsFor('evals/nothing-here');
  await assert.rejects(
    () => discoverCases(readTextFile, async () => [{ name: 'x', isDirectory: true }], empty),
    RunError
  );
});

/* ── EvalCommand ───────────────────────────────────────────────────────────── */

test('the early-access variable is injected unconditionally', () => {
  assert.equal(evalCommandFrom({ PATH: '/bin' }).env.CLAUDE_CODE_WALNUT_SPIRE, '1');
});

test('the executable comes from EVAL_CLAUDE_BIN and defaults to claude', () => {
  assert.equal(evalCommandFrom({}).command, 'claude');
  assert.equal(evalCommandFrom({ EVAL_CLAUDE_BIN: 'claude-personal' }).command, 'claude-personal');
});

test('the parent environment survives, minus the undefined entries spawn rejects', () => {
  const { env } = evalCommandFrom({ PATH: '/bin', GONE: undefined });
  assert.equal(env.PATH, '/bin');
  assert.ok(!('GONE' in env));
});

/* ── ResultsLocator ────────────────────────────────────────────────────────── */

const entries = (...names) => names.map((name) => ({ name, isDirectory: !name.endsWith('.json') }));

test('the newest timestamped directory wins, and only timestamped directories count', async () => {
  const locate = makeResultsLocator(async () =>
    entries('2026-08-27T14-06-02-737Z', '2026-08-27T14-08-43-660Z', 'treatment.json', 'drift.json'));
  assert.equal(
    await locate({ suiteDir: 'evals/s' }),
    'evals/s/results/2026-08-27T14-08-43-660Z/aggregate-result.json'
  );
});

test('no results directory yields the empty string, not a throw and not a guess', async () => {
  const locate = makeResultsLocator(async () => { throw new Error('ENOENT'); });
  assert.equal(await locate({ suiteDir: 'evals/s' }), '');
});

/* ── RunSweep — a result, never an exception ───────────────────────────────── */

const doc = { schemaVersion: 1, cases: [] };
const evalCommand = () => ({ command: 'claude', env: {} });

/** Locates nothing, then the given path — a sweep that produced a fresh directory. */
const locatorYielding = (...sequence) => {
  let i = 0;
  return async () => sequence[Math.min(i++, sequence.length - 1)];
};

test('a fresh results directory is this sweep\'s document', async () => {
  const result = await runSweep(
    async () => ({ code: 0, stdout: '', stderr: 'ok' }),
    evalCommand,
    locatorYielding('', 'evals/s/results/2026-08-27T14-08-43-660Z/aggregate-result.json'),
    invocation(),
    async () => JSON.stringify(doc)
  );
  assert.deepEqual(result.document, doc);
  assert.equal(result.exitCode, 0);
  assert.equal(result.condition, 'treatment');
});

test('a results directory that was already there is NOT this sweep\'s output', async () => {
  const stale = 'evals/s/results/2026-08-01T00-00-00-000Z/aggregate-result.json';
  const result = await runSweep(
    async () => ({ code: 1, stdout: 'not json', stderr: '' }),
    evalCommand,
    locatorYielding(stale, stale),
    invocation(),
    async () => assert.fail('the stale document must not be read')
  );
  assert.equal(result.document, null);
  assert.match(result.stderrTail, /predates this sweep/);
});

test('a sweep that wrote no directory still recovers a document from stdout if one is there', async () => {
  const result = await runSweep(
    async () => ({ code: 0, stdout: JSON.stringify(doc), stderr: '' }),
    evalCommand,
    locatorYielding('', ''),
    invocation(),
    async () => assert.fail('there is no file to read')
  );
  assert.deepEqual(result.document, doc);
  assert.match(result.stderrTail, /recovered the document from stdout/);
});

test('exit 1 is a result — below threshold — and is passed through, not thrown', async () => {
  const result = await runSweep(
    async () => ({ code: 1, stdout: '', stderr: '' }),
    evalCommand,
    locatorYielding('', 'evals/s/results/2026-08-27T14-08-43-660Z/aggregate-result.json'),
    invocation(),
    async () => JSON.stringify(doc)
  );
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.document, doc);
});

test('exit 2 and 130 travel intact, so partial and interrupted stay distinguishable', async () => {
  for (const code of [2, 130, 143]) {
    const result = await runSweep(
      async () => ({ code, stdout: '', stderr: '' }), evalCommand,
      locatorYielding('', ''), invocation(), async () => ''
    );
    assert.equal(result.exitCode, code);
    assert.equal(result.document, null);
  }
});

test('the sweep is spawned with the argv the pure builder produced', async () => {
  let seen = null;
  await runSweep(
    async (command, args, env) => {
      seen = { command, args, env };
      return { code: 0, stdout: '', stderr: '' };
    },
    () => ({ command: 'claude-personal', env: { CLAUDE_CODE_WALNUT_SPIRE: '1' } }),
    locatorYielding('', ''), invocation(), async () => ''
  );
  assert.equal(seen.command, 'claude-personal');
  assert.deepEqual(seen.args, buildEvalArgv(invocation()));
  assert.equal(seen.env.CLAUDE_CODE_WALNUT_SPIRE, '1');
});

/* ── SelectCondition ───────────────────────────────────────────────────────── */

test('the condition is copied to the one fixed path every case names', async () => {
  let copied = null;
  await selectCondition(async (from, to) => (copied = { from, to }), paths, 'placebo');
  assert.deepEqual(copied, {
    from: 'evals/seven-steps-primer/conditions/placebo',
    to: 'evals/seven-steps-primer/../_conditions/current',
  });
});

test('a condition that is not a ConditionId is refused before anything is copied', async () => {
  await assert.rejects(
    () => selectCondition(async () => assert.fail('nothing should be copied'), paths, 'none'),
    RunError
  );
});

/* ── The operator's own arguments ──────────────────────────────────────────── */

test('all three conditions sweep by default, treatment first', () => {
  assert.deepEqual(parseArgv([]).conditions, ['treatment', 'oneliner', 'placebo']);
});

test('--condition takes a subset, repeated or comma-separated, in declared order', () => {
  assert.deepEqual(parseArgv(['--condition', 'placebo,treatment']).conditions, ['treatment', 'placebo']);
  assert.deepEqual(
    parseArgv(['--condition', 'placebo', '--condition', 'oneliner']).conditions,
    ['oneliner', 'placebo']
  );
});

test('--smoke is one run, and --runs overrides the pre-registered count', () => {
  assert.equal(parseArgv(['--smoke']).runs, 1);
  assert.equal(parseArgv([]).runs, 5);
  assert.equal(parseArgv(['--runs', '2']).runs, 2);
});

test('an unknown option or a bad value is refused rather than ignored', () => {
  assert.throws(() => parseArgv(['--ablation', 'none']), RunError);
  assert.throws(() => parseArgv(['--condition', 'primer']), RunError);
  assert.throws(() => parseArgv(['--runs', '0']), RunError);
});

/* ── stderrTail ────────────────────────────────────────────────────────────── */

test('the tail keeps the end, where the case-load errors are, and says what it cut', () => {
  const kept = tail('x'.repeat(10) + 'ERROR', 5);
  assert.ok(kept.endsWith('ERROR'));
  assert.match(kept, /bytes trimmed/);
  assert.equal(tail('short', 5), 'short');
});

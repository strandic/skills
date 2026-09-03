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
import { EventEmitter } from 'node:events';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildEvalArgv, selectTagFilters, selectAllowTools, invocationFor, evalCommandFrom,
  makeResultsSnapshot, aggregatePathFor, runSweep, selectCondition, discoverCases, casesMissingFrom,
  readCaseSpec, yamlish, frontmatter, inlineList, parseArgv, tail, paths, suitePathsFor,
  groupCasesByAblation, combineHarnessDocuments, combineSweepParts, buildSweepRecord,
  buildDriftRecord, makeSpawnCapture, exitCodeForSignal, isInterrupted, RunError,
  planSweep, sweepStopReason,
  preflightAuth,
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
  assert.deepEqual(buildEvalArgv(invocation({ runs: 1, caseGlobs: ['gate-stop-step0'], tagFilters: [] })), [
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
    '--allow-tools', 'Bash', 'Edit', 'Write',
  ]);
});

test('--case and --tag are never passed together — how they combine is unverified', () => {
  // Recon passed exactly one `--case` and never with `--tag`; 6-cold-fork-register.md
  // records the combination as underdetermined. If the harness ORs them, the name-scoped
  // `--ablation none` invocation readmits all five tagged cases and the ablation split is
  // silently undone — a plausible number, not an error.
  assert.throws(
    () => buildEvalArgv(invocation({ caseGlobs: ['step3-markers-in-source'] })),
    RunError
  );
  assert.doesNotThrow(() => buildEvalArgv(invocation({ caseGlobs: ['x'], tagFilters: [] })));
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
  for (const [argv, flags] of [
    [buildEvalArgv(invocation()), ['--tag', '--allow-tools']],
    [buildEvalArgv(invocation({ caseGlobs: ['x'], tagFilters: [] })), ['--case', '--allow-tools']],
  ]) {
    const target = argv.indexOf('.');
    assert.equal(target, 2, 'the target is the argument right after `plugin eval`');
    for (const flag of flags)
      assert.ok(target < argv.indexOf(flag), `${flag} would consume a target that came after it`);
  }
});

test('--json is never passed — it silences the run, and silence gets a sweep killed', () => {
  // Two 90-minute sweeps were killed after 41 and 34 minutes of producing no output at
  // all, which is what --json does: it suppresses every progress line. The document
  // still lands in <eval-dir>/results/<timestamp>/, which is what ResultsLocator reads.
  assert.ok(!buildEvalArgv(invocation({ caseGlobs: ['x'], tagFilters: [] })).includes('--json'));
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

/* ── ResultsSnapshot ───────────────────────────────────────────────────────── */

const entries = (...names) => names.map((name) => ({ name, isDirectory: !name.endsWith('.json') }));

test('the snapshot is every timestamped directory, sorted, and nothing else', async () => {
  const snapshot = makeResultsSnapshot(async () =>
    entries('2026-08-27T14-08-43-660Z', '2026-08-27T14-06-02-737Z', 'treatment.json', 'drift.json'));
  assert.deepEqual(await snapshot({ suiteDir: 'evals/s' }),
    ['2026-08-27T14-06-02-737Z', '2026-08-27T14-08-43-660Z']);
});

test('no results directory yields an empty list, not a throw and not a guess', async () => {
  const snapshot = makeResultsSnapshot(async () => { throw new Error('ENOENT'); });
  assert.deepEqual(await snapshot({ suiteDir: 'evals/s' }), []);
});

/* ── RunSweep — a result, never an exception ───────────────────────────────── */

const doc = { schemaVersion: 1, cases: [] };
const evalCommand = () => ({ command: 'claude', env: {} });

const FRESH = '2026-08-27T14-08-43-660Z';
const STALE = '2026-08-01T00-00-00-000Z';

/** The directory listing before the spawn, then after it. */
const snapshotYielding = (...sequence) => {
  let i = 0;
  return async () => sequence[Math.min(i++, sequence.length - 1)];
};

test('a fresh results directory is this sweep\'s document', async () => {
  let read = null;
  const result = await runSweep(
    async () => ({ code: 0, stdout: '', stderr: 'ok' }),
    evalCommand,
    snapshotYielding([], [FRESH]),
    invocation(),
    async (path) => {
      read = path;
      return JSON.stringify(doc);
    }
  );
  assert.deepEqual(result.document, doc);
  assert.equal(read, aggregatePathFor(invocation(), FRESH));
  assert.equal(result.exitCode, 0);
  assert.equal(result.condition, 'treatment');
});

test('a results directory that was already there is NOT this sweep\'s output', async () => {
  const result = await runSweep(
    async () => ({ code: 1, stdout: 'not json', stderr: '' }),
    evalCommand,
    snapshotYielding([STALE], [STALE]),
    invocation(),
    async () => assert.fail('the stale document must not be read')
  );
  assert.equal(result.document, null);
  assert.match(result.stderrTail, /predates this sweep/);
});

test('two new directories are two runs — neither is claimed, and both are named', async () => {
  // The README's control-all-steps diagnostic, or a second sweep, started against the
  // same eval dir while this one ran. Newest-wins would hand its document over silently.
  const other = '2026-08-27T14-09-00-000Z';
  const result = await runSweep(
    async () => ({ code: 0, stdout: JSON.stringify(doc), stderr: '' }),
    evalCommand,
    snapshotYielding([STALE], [STALE, FRESH, other]),
    invocation(),
    async () => assert.fail('neither document may be read')
  );
  assert.equal(result.document, null);
  assert.match(result.stderrTail, /another harness run wrote into this suite during the sweep/);
  assert.match(result.stderrTail, new RegExp(FRESH));
  assert.match(result.stderrTail, new RegExp(other));
});

test('a document naming a case this sweep did not ask for is not this sweep\'s', async () => {
  const strayDoc = { schemaVersion: 1, cases: [{ name: 'gate-stop-step0' }, { name: 'control-all-steps' }] };
  const result = await runSweep(
    async () => ({ code: 0, stdout: '', stderr: '' }),
    evalCommand,
    snapshotYielding([], [FRESH]),
    invocation(),
    async () => JSON.stringify(strayDoc),
    ['gate-stop-step0']
  );
  assert.equal(result.document, null);
  assert.match(result.stderrTail, /control-all-steps/);
  assert.match(result.stderrTail, /did not ask for/);
});

test('a document over a subset of the asked cases is still this sweep\'s, and says what is missing', async () => {
  // Kept, because it is real evidence for the case it does carry and the merger refuses
  // the incomplete set anyway. Named, because this is what a non-repeatable `--case`
  // would look like: four names in, one case out, every name expected.
  const partialDoc = { schemaVersion: 1, cases: [{ name: 'gate-stop-step0' }] };
  const result = await runSweep(
    async () => ({ code: 0, stdout: '', stderr: '' }),
    evalCommand,
    snapshotYielding([], [FRESH]),
    invocation(),
    async () => JSON.stringify(partialDoc),
    ['gate-stop-step0', 'triage-skip-oneliner']
  );
  assert.deepEqual(result.document, partialDoc);
  assert.match(result.stderrTail, /no result for triage-skip-oneliner/);
  assert.ok(!/no result for gate-stop-step0/.test(result.stderrTail));
});

test('the missing-case check reads the document\'s own case list, and skips when nothing was named', () => {
  const document = { cases: [{ name: 'gate-stop-step0' }, { name: 'triage-skip-oneliner' }] };
  assert.deepEqual(casesMissingFrom(document, ['gate-stop-step0', 'step3-markers-in-source']),
    ['step3-markers-in-source']);
  assert.deepEqual(casesMissingFrom(document, ['gate-stop-step0']), []);
  assert.deepEqual(casesMissingFrom(document, []), []);
  assert.deepEqual(casesMissingFrom(null, ['gate-stop-step0']), ['gate-stop-step0']);
  assert.deepEqual(casesMissingFrom({ cases: 'nope' }, ['gate-stop-step0']), ['gate-stop-step0']);
});

test('a sweep that wrote no directory still recovers a document from stdout if one is there', async () => {
  const result = await runSweep(
    async () => ({ code: 0, stdout: JSON.stringify(doc), stderr: '' }),
    evalCommand,
    snapshotYielding([], []),
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
    snapshotYielding([], [FRESH]),
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
      snapshotYielding([], []), invocation(), async () => ''
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
    snapshotYielding([], []), invocation(), async () => ''
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

test('the registered list, not a constant, decides which conditions exist and in what order', () => {
  const known = ['treatment', 'oneliner', 'placebo', 'treatment-no-triage'];
  assert.deepEqual(parseArgv([], known).conditions, known);
  assert.deepEqual(parseArgv(['--condition', 'treatment-no-triage'], known).conditions, ['treatment-no-triage']);
  assert.deepEqual(parseArgv(['--condition', 'treatment-no-triage,treatment'], known).conditions,
    ['treatment', 'treatment-no-triage']);
  assert.throws(() => parseArgv(['--condition', 'treatment-no-triage']), RunError, 'unregistered by default');
});

test('planSweep builds a sweep for a registered fourth condition end to end', async () => {
  // The review of the split found parseArgv and selectCondition widened but buildEvalArgv
  // still holding the old three-id list, so `--condition <new-id>` died at plan time.
  const extra = 'treatment-no-triage';
  const discovered = async () => discoverCases(readTextFile, listDirectory, paths);
  const cases = await discovered();
  const plan = planSweep(cases, { conditions: ['treatment', extra], runs: 5, smoke: false });
  assert.deepEqual(plan.sweeps.map((s) => s.condition), ['treatment', extra]);
  assert.ok(plan.preChecks.some((c) => c.path.endsWith(`conditions/${extra}/SKILL.md`)));
  assert.ok(plan.sweeps[1].invocations.every((i) => i.argv.includes('--eval-dir')));
  assert.throws(() => planSweep(cases, { conditions: ['Bad Id'], runs: 5, smoke: false }), RunError);
});

test('selectCondition copies a registered fourth condition and refuses an unregistered directory', async () => {
  const known = ['treatment', 'oneliner', 'placebo', 'treatment-no-triage'];
  let copied = null;
  await selectCondition(async (from, to) => (copied = { from, to }), paths, 'treatment-no-triage', known);
  assert.equal(copied.from, 'evals/seven-steps-primer/conditions/treatment-no-triage');
  await assert.rejects(
    () => selectCondition(async () => assert.fail('nothing should be copied'), paths, 'treatment-no-triage'),
    RunError);
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

test('--condition naming nothing is refused, not read as "all three"', () => {
  // `--condition ''` used to sweep every condition: a full rate-limit window spent on a
  // command that asked for one.
  for (const value of ['', ' ', ',', ' , ,'])
    assert.throws(() => parseArgv(['--condition', value]),
      /--condition needs at least one condition id/, `--condition ${JSON.stringify(value)}`);
});

test('--smoke and --runs together are refused in either order, not silently merged', () => {
  assert.throws(() => parseArgv(['--smoke', '--runs', '5']), /--smoke fixes runs to 1/);
  assert.throws(() => parseArgv(['--runs', '5', '--smoke']), /--smoke fixes runs to 1/);
  // Whichever came last used to win: `--smoke --runs 5` spent a whole sweep as a pilot.
  assert.equal(parseArgv(['--smoke']).runs, 1);
  assert.equal(parseArgv(['--runs', '5']).runs, 5);
});

/* ── stderrTail ────────────────────────────────────────────────────────────── */

test('the tail keeps the end, where the case-load errors are, and says what it cut', () => {
  const kept = tail('x'.repeat(10) + 'ERROR', 5);
  assert.ok(kept.endsWith('ERROR'));
  assert.match(kept, /bytes trimmed/);
  assert.equal(tail('short', 5), 'short');
});

/* ── Ablation grouping — `ablation: none` must never run with-without ───────── */

test('the scored cases split by ablation, with-without first', () => {
  const groups = groupCasesByAblation([
    spec('control-all-steps', ['control'], { ablation: 'none' }),
    spec('step3', ['capability'], { ablation: 'none', evidence: 'capability' }),
    spec('gate', ['gate', 'scored']),
  ]);
  assert.deepEqual(groups.map((g) => g.ablation), ['with-without', 'none']);
  assert.deepEqual(groups[0].cases.map((c) => c.name), ['gate']);
  assert.deepEqual(groups[1].cases.map((c) => c.name), ['step3'],
    'the control is not a scored case and never reaches an invocation');
});

test('a group is omitted rather than emitted empty', () => {
  const groups = groupCasesByAblation([spec('gate', ['gate', 'scored'])]);
  assert.deepEqual(groups.map((g) => g.ablation), ['with-without']);
});

test('an ablation that is neither value is refused, not defaulted', () => {
  assert.throws(() => groupCasesByAblation([spec('gate', ['scored'], { ablation: 'with-only' })]), RunError);
  assert.throws(() => groupCasesByAblation([spec('c', ['control'])]), RunError);
});

test('the real suite runs step3-markers-in-source at ablation none and nothing else with it', async () => {
  // PRE-REGISTRATION registers step3 as `ablation: none`; readCaseSpec derived it and
  // nothing read it, so it ran with-without against a transcript that carries the plugin
  // into BOTH arms — a contrast with no referent.
  const groups = groupCasesByAblation(await discoverCases(readTextFile, listDirectory, paths));
  const none = groups.find((g) => g.ablation === 'none');
  const delta = groups.find((g) => g.ablation === 'with-without');
  assert.deepEqual(none.cases.map((c) => c.name), ['step3-markers-in-source']);
  assert.ok(!delta.cases.some((c) => c.name === 'step3-markers-in-source'));
  for (const group of groups)
    for (const c of group.cases)
      assert.deepEqual(buildEvalArgv(invocationFor('treatment', paths, group.cases, {
        ablation: group.ablation, caseGlobs: [c.name],
      })).slice(5, 7), ['--ablation', group.ablation]);
});

test('--case is one glob: more than one is refused where the argv is built', () => {
  // The harness option is `--case <glob>`, not variadic; a repeated flag keeps the last
  // (harness-facts #44). Four flags ran one case on 2026-09-03. Refused here so no
  // command line with two of them can be assembled, let alone spent.
  const cases = [spec('gate-stop-step0', ['gate', 'scored']), spec('triage-skip-oneliner', ['triage', 'scored'])];
  assert.throws(() => buildEvalArgv(invocationFor('treatment', paths, cases, {
    caseGlobs: ['gate-stop-step0', 'triage-skip-oneliner'],
  })), /one glob/);
  assert.doesNotThrow(() => buildEvalArgv(invocationFor('treatment', paths, cases, { caseGlobs: ['gate-stop-step0'] })));
});

test('the per-case command lines the re-sweep will actually run, byte for byte', async () => {
  // One `--case` per invocation — the shape recon verified. Several at once ran one case
  // (harness-facts #44). Never combined with `--tag`: recon never ran the two together,
  // and an OR between them would put every tagged case back into the `none` invocation.
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const groups = groupCasesByAblation(cases);
  const argvFor = (group, name) => buildEvalArgv(invocationFor('treatment', paths, cases, {
    ablation: group.ablation, caseGlobs: [name],
  }));
  const expected = (ablation, name) => [
    'plugin', 'eval', '.',
    '--eval-dir', 'evals/seven-steps-primer',
    '--ablation', ablation,
    '--runs', '5',
    '--model', 'sonnet',
    '--judge-model', 'opus',
    '--threshold', '0.6',
    '--scaffold',
    '--no-publish',
    '--case', name,
    '--allow-tools', 'Bash', 'Edit', 'Write',
  ];

  const [delta, none] = groups;
  for (const c of delta.cases) assert.deepEqual(argvFor(delta, c.name), expected('with-without', c.name));
  assert.deepEqual(none.cases.map((c) => c.name), ['step3-markers-in-source']);
  assert.deepEqual(argvFor(none, 'step3-markers-in-source'), expected('none', 'step3-markers-in-source'));
  for (const group of groups)
    for (const c of group.cases)
      assert.ok(!argvFor(group, c.name).includes('--tag'), 'a name-scoped invocation carries no tag filter');
});

test('a name-scoped invocation refuses a selector that would readmit the control case', () => {
  // `--tag` is what used to keep `control-all-steps` out, and a name-scoped invocation
  // no longer carries it. The control case sorts first and ate a whole cost ceiling in
  // recon, so a selector that reaches it is refused before anything spawns.
  const cases = [
    spec('control-all-steps', ['control'], { scored: false }),
    spec('gate-stop-step0', ['gate', 'scored']),
  ];
  assert.throws(() => invocationFor('treatment', paths, cases, { caseGlobs: ['control-all-steps'] }), RunError);
  assert.throws(() => invocationFor('treatment', paths, cases, { caseGlobs: ['control-*'] }), RunError);
  assert.doesNotThrow(() => invocationFor('treatment', paths, cases, { caseGlobs: ['gate-stop-step0'] }));
});

test('a selector that matches no discovered case is refused, not swept as a shorter run', () => {
  const cases = [spec('gate-stop-step0', ['gate', 'scored'])];
  assert.throws(() => invocationFor('treatment', paths, cases, { caseGlobs: ['gate-stop-step-0'] }), RunError);
});

/* ── Combining the per-ablation documents into one sweep ───────────────────── */

const harnessDoc = (over = {}) => ({
  schemaVersion: 1, claudeVersion: '2.1.250', startedAt: '2026-09-02T10:00:00.000Z',
  costUsd: 1, partial: false, suite: { ablation: 'with-without', threshold: 0.6 }, cases: [],
  ...over,
});

test('the parts concatenate: every case, cost summed, earliest start', () => {
  const { document } = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc({ cases: [{ name: 'gate' }], costUsd: 2 }) },
    { ablation: 'none', document: harnessDoc({
      cases: [{ name: 'step3' }], costUsd: 3, startedAt: '2026-09-02T09:00:00.000Z',
      suite: { ablation: 'none', threshold: 0.6 } }) },
  ]);
  assert.deepEqual(document.cases.map((c) => c.name), ['gate', 'step3']);
  assert.equal(document.costUsd, 5);
  assert.equal(document.startedAt, '2026-09-02T09:00:00.000Z');
  assert.equal(document.partial, false);
});

test('no number survives that was only true of the first invocation', () => {
  // The spread used to carry part 0's `aggregates` and `durationSeconds` through beside a
  // `cases` array from both parts: `casesTotal: 1` next to two cases, an `overallScore`
  // measured over one invocation, and a duration missing the other.
  const { document } = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc({
      cases: [{ name: 'gate' }], durationSeconds: 100,
      aggregates: { casesTotal: 1, casesPassed: 1, overallScore: 1, meanDelta: 0.5 } }) },
    { ablation: 'none', document: harnessDoc({
      cases: [{ name: 'step3' }], durationSeconds: 40,
      aggregates: { casesTotal: 1, casesPassed: 0, overallScore: 0, meanDelta: 0 } }) },
  ]);
  assert.ok(!('aggregates' in document),
    'the harness weights its own runs; a re-derivation here would be a guess in its field name');
  assert.equal(document.durationSeconds, 140, 'the invocations run one after the other');
  assert.equal(document.cases.length, 2);
});

test('a duration missing from any part is dropped rather than summed short', () => {
  const { document } = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc({ cases: [{ name: 'gate' }], durationSeconds: 100 }) },
    { ablation: 'none', document: harnessDoc({ cases: [{ name: 'step3' }] }) },
  ]);
  assert.ok(!('durationSeconds' in document));
});

test('`partial` stays three-valued — a part that cannot establish it leaves it absent', () => {
  const both = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc({ partial: false }) },
    { ablation: 'none', document: harnessDoc({ partial: true, partialReason: 'cost_ceiling' }) },
  ]).document;
  assert.equal(both.partial, true);
  assert.equal(both.partialReason, 'cost_ceiling');

  const unknown = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc({ partial: undefined }) },
    { ablation: 'none', document: harnessDoc({ partial: false }) },
  ]).document;
  assert.ok(!('partial' in unknown), 'absence read as `false` is absence read as agreement');
});

test('a part with no document, a duplicated case or a disagreement refuses to combine', () => {
  const missing = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc() },
    { ablation: 'none', document: null },
  ]);
  assert.equal(missing.document, null);
  assert.match(missing.notes.join('\n'), /none invocation\(s\) produced no document/);

  const duplicated = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc({ cases: [{ name: 'gate' }] }) },
    { ablation: 'none', document: harnessDoc({ cases: [{ name: 'gate' }] }) },
  ]);
  assert.equal(duplicated.document, null);
  assert.match(duplicated.notes.join('\n'), /ran at two ablations/);

  const disagreed = combineHarnessDocuments([
    { ablation: 'with-without', document: harnessDoc() },
    { ablation: 'none', document: harnessDoc({ claudeVersion: '2.1.251' }) },
  ]);
  assert.equal(disagreed.document, null);
  assert.match(disagreed.notes.join('\n'), /disagree on claudeVersion/);
});

test('a single invocation is passed through untouched — the common command line', () => {
  const only = harnessDoc({ cases: [{ name: 'gate' }] });
  const { document, notes } = combineHarnessDocuments([{ ablation: 'with-without', document: only }]);
  assert.equal(document, only);
  assert.deepEqual(notes, []);
});

test('the sweep records which ablation each case actually ran at, and the worst exit', () => {
  const part = (ablation, cases, exitCode, document) =>
    ({ ablation, cases, result: { condition: 'treatment', exitCode, document, stderrTail: '' } });
  const combined = combineSweepParts('treatment', [
    part('with-without', ['gate', 'triage'], 1, harnessDoc({ cases: [{ name: 'gate' }, { name: 'triage' }] })),
    part('none', ['step3'], 2, harnessDoc({ cases: [{ name: 'step3' }] })),
  ]);
  assert.deepEqual(combined.ablations,
    { gate: 'with-without', triage: 'with-without', step3: 'none' });
  assert.equal(combined.exitCode, 2, 'partial outranks below-threshold');
  assert.equal(combineSweepParts('treatment', [
    part('with-without', ['gate'], 0, harnessDoc()), part('none', ['step3'], 130, null),
  ]).exitCode, 130, 'interrupted outranks everything');
});

/* ── The records, and the instrument digest that makes them comparable ─────── */

const SHA = 'a'.repeat(64);

test('every sweep record carries the instrument digest', () => {
  const record = buildSweepRecord(
    { condition: 'treatment', exitCode: 0, document: harnessDoc(), stderrTail: '', ablations: { gate: 'with-without' } },
    { argvs: [['plugin', 'eval', '.']], startedAt: '2026-09-02T10:00:00.000Z', instrumentSha: SHA, conditionSha: SHA }
  );
  assert.equal(record.instrumentSha, SHA);
  assert.deepEqual(record.argvs, [['plugin', 'eval', '.']]);
  assert.deepEqual(record.ablations, { gate: 'with-without' });
});

test('drift.json carries the same digest, so a control-only re-run cannot hide a stale arm', () => {
  const record = buildDriftRecord({ drifted: false, reason: '' }, '2026-09-02T10:00:00.000Z', SHA);
  assert.equal(record.instrumentSha, SHA);
  assert.equal(record.drifted, false);
});

test('a record with no digest is refused rather than written unmergeable', () => {
  const combined = { condition: 'treatment', exitCode: 0, document: harnessDoc(), stderrTail: '', ablations: {} };
  for (const sha of [undefined, '', 'not-a-digest', SHA.toUpperCase()]) {
    assert.throws(() => buildSweepRecord(combined, { argvs: [], startedAt: '', instrumentSha: sha, conditionSha: SHA }), RunError);
    assert.throws(() => buildSweepRecord(combined, { argvs: [], startedAt: '', instrumentSha: SHA, conditionSha: sha }), RunError);
    assert.throws(() => buildDriftRecord({ drifted: false, reason: '' }, '', sha), RunError);
  }
});

test('the record carries the condition\'s own digest beside the shared one', () => {
  const combined = { condition: 'placebo', exitCode: 0, document: harnessDoc(), stderrTail: '', ablations: {} };
  const own = 'c'.repeat(64);
  const record = buildSweepRecord(combined, { argvs: [], startedAt: '', instrumentSha: SHA, conditionSha: own });
  assert.equal(record.instrumentSha, SHA);
  assert.equal(record.conditionSha, own);
});

/* ── Signals — a killed child is interrupted, never "below threshold" ───────── */

test('a signal maps to 128 + its number, so SIGKILL and SIGHUP are not exit 1', () => {
  assert.equal(exitCodeForSignal('SIGINT'), 130);
  assert.equal(exitCodeForSignal('SIGTERM'), 143);
  assert.equal(exitCodeForSignal('SIGKILL'), 137);
  assert.equal(exitCodeForSignal('SIGHUP'), 129);
  assert.equal(exitCodeForSignal(null), 1, 'no signal is an ordinary exit');
});

test('every code at or above 128 stops the sweep; 1 and 2 are results', () => {
  for (const code of [129, 130, 137, 143]) assert.ok(isInterrupted(code), `${code}`);
  for (const code of [0, 1, 2, 127]) assert.ok(!isInterrupted(code), `${code}`);
});

/** A child that emits what a real one emits, and remembers the signal it was sent. */
const fakeChild = () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.signalled = null;
  child.kill = (signal) => (child.signalled = signal);
  return child;
};

test('a child killed by any signal reports 128 + the signal number, not 1', async () => {
  // SIGKILL and SIGHUP used to arrive as 1 — "a case scored below threshold" — and the
  // loop swept on to the next condition against a run that never finished.
  for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGKILL', 137], ['SIGHUP', 129]]) {
    const child = fakeChild();
    const pending = makeSpawnCapture(() => child)('claude', [], {});
    child.emit('close', null, signal);
    assert.equal((await pending).code, code, signal);
  }
});

test('a signal to the runner is forwarded to the live child, so `close` still fires', async () => {
  const child = fakeChild();
  const capture = makeSpawnCapture(() => child);
  assert.equal(capture.forwardSignal('SIGINT'), false, 'nothing is running yet');
  const pending = capture('claude', [], {});
  assert.equal(capture.forwardSignal('SIGINT'), true);
  assert.equal(child.signalled, 'SIGINT');
  child.emit('close', null, 'SIGINT');
  assert.equal((await pending).code, 130);
  assert.equal(capture.forwardSignal('SIGINT'), false, 'the child is gone once it has closed');
});

test('an ordinary exit and a spawn failure are unchanged by the signal handling', async () => {
  const clean = fakeChild();
  const pendingClean = makeSpawnCapture(() => clean)('claude', [], {});
  clean.stdout.emit('data', '{"schemaVersion":1}');
  clean.emit('close', 0, null);
  assert.deepEqual(await pendingClean, { code: 0, stdout: '{"schemaVersion":1}', stderr: '' });

  const broken = fakeChild();
  const pendingBroken = makeSpawnCapture(() => broken)('nope', [], {});
  broken.emit('error', new Error('ENOENT'));
  assert.equal((await pendingBroken).code, 127);
});

/* ── The plan — the decisions that used to sit unreachable inside main() ───── */

const planArgs = (over = {}) => ({ conditions: ['treatment'], runs: 5, smoke: false, ...over });

test('the plan is five per-case command lines, byte for byte, as main will spawn them', async () => {
  // The byte-for-byte test above pins `invocationFor`; this one pins the CALL. main was
  // free to pass `group.cases` instead of every case, to drop `caseGlobs`, or to put all
  // four delta names on one command line (which ran one case, 2026-09-03).
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const plan = planSweep(cases, planArgs());

  assert.deepEqual(plan.groups.map((g) => g.ablation), ['with-without', 'none']);
  assert.equal(plan.sweeps.length, 1);
  const invocations = plan.sweeps[0].invocations;
  assert.deepEqual(invocations.map((i) => [i.ablation, ...i.cases]), [
    ['with-without', 'gate-stop-step0'],
    ['with-without', 'looks-trivial-is-structural'],
    ['with-without', 'triage-decompose-epic'],
    ['with-without', 'triage-skip-oneliner'],
    ['none', 'step3-markers-in-source'],
  ], 'one case per invocation, with-without first so an interrupted sweep keeps the delta arm');

  for (const inv of invocations)
    assert.deepEqual(inv.argv, [
    'plugin', 'eval', '.',
    '--eval-dir', 'evals/seven-steps-primer',
    '--ablation', inv.ablation,
    '--runs', '5',
    '--model', 'sonnet',
    '--judge-model', 'opus',
    '--threshold', '0.6',
    '--scaffold',
    '--no-publish',
    '--case', inv.cases[0],
    '--allow-tools', 'Bash', 'Edit', 'Write',
  ]);
  assert.deepEqual(plan.excluded, ['control-all-steps']);
  for (const inv of invocations) {
    assert.ok(!inv.argv.includes('control-all-steps'), 'the diagnostic is named by nothing');
    assert.equal(inv.argv.filter((a) => a === '--case').length, 1, 'exactly one --case per invocation');
  }
});

test('the plan covers every requested condition, in the declared order, with the same invocations', async () => {
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const plan = planSweep(cases, planArgs({ conditions: ['treatment', 'oneliner', 'placebo'] }));
  assert.deepEqual(plan.sweeps.map((s) => s.condition), ['treatment', 'oneliner', 'placebo']);
  for (const sweep of plan.sweeps) {
    assert.deepEqual(sweep.invocations.map((i) => i.ablation),
      ['with-without', 'with-without', 'with-without', 'with-without', 'none']);
    // The condition is NOT a flag — it is the directory copied into place — so the two
    // command lines are identical across conditions and only the copy differs.
    assert.deepEqual(sweep.invocations.map((i) => i.argv), plan.sweeps[0].invocations.map((i) => i.argv));
  }
  assert.deepEqual(plan.preChecks.map((c) => c.path), [
    'evals/seven-steps-primer/conditions/treatment/SKILL.md',
    'evals/seven-steps-primer/conditions/oneliner/SKILL.md',
    'evals/seven-steps-primer/conditions/placebo/SKILL.md',
  ], 'every condition is read before the first sweep spends anything');
});

test('one ablation group keeps the tag-filtered command line recon verified', () => {
  // A single group must NOT be scoped by name: `--tag` is the shape recon actually ran,
  // and a name-scoped invocation drops the tag filter that keeps the control case out.
  const plan = planSweep([
    spec('control-all-steps', ['control']),
    spec('gate-stop-step0', ['gate', 'scored'], { allowedTools: ['Bash'] }),
    spec('triage-skip-oneliner', ['triage', 'scored'], { allowedTools: ['Bash'] }),
  ], planArgs());
  assert.equal(plan.scopeByName, false);
  const [only] = plan.sweeps[0].invocations;
  assert.equal(plan.sweeps[0].invocations.length, 1);
  assert.ok(!only.argv.includes('--case'), 'one group, one command line, selected by tag');
  assert.deepEqual(only.argv.slice(only.argv.indexOf('--tag')),
    ['--tag', 'gate', 'scored', 'triage', '--allow-tools', 'Bash']);
  assert.deepEqual(only.cases, ['gate-stop-step0', 'triage-skip-oneliner']);
});

test('a case declaring an unknown ablation is refused by the plan, before anything is spent', () => {
  assert.throws(() => planSweep([
    spec('gate-stop-step0', ['gate', 'scored']),
    spec('odd-one', ['scored'], { ablation: 'with-only' }),
  ], planArgs()), RunError);
  // And a selector that would readmit the control case is refused just as early.
  assert.throws(() => planSweep([spec('control-all-steps', ['control'])], planArgs()), RunError);
  assert.throws(() => planSweep([spec('gate', ['gate', 'scored'])], planArgs({ conditions: [] })), RunError);
});

test('--smoke plans exactly one case at one run, scoped by name', async () => {
  const cases = await discoverCases(readTextFile, listDirectory, paths);
  const plan = planSweep(cases, planArgs({ runs: 1, smoke: true }));
  assert.equal(plan.sweeps[0].invocations.length, 1);
  const [pilot] = plan.sweeps[0].invocations;
  assert.equal(plan.scopeByName, true, 'a pilot names its one case rather than a whole tag');
  assert.deepEqual(pilot.cases, ['gate-stop-step0']);
  assert.deepEqual(pilot.argv.slice(pilot.argv.indexOf('--runs'), pilot.argv.indexOf('--runs') + 2),
    ['--runs', '1']);
  assert.ok(pilot.argv.includes('--case') && !pilot.argv.includes('--tag'));
});

/* ── Stopping — an invocation that stopped being evidence ends the run ─────── */

const stopPart = (over = {}) => ({
  ablation: 'with-without',
  cases: ['gate', 'triage'],
  result: {
    condition: 'treatment', exitCode: 0, stderrTail: '',
    document: { cases: [{ name: 'gate' }, { name: 'triage' }] },
  },
  ...over,
});

test('a NO DOCUMENT invocation stops the run — a null document is not zero missing cases', () => {
  // This is the branch that used to read `result.document ? casesMissingFrom(…) : []`: a
  // null document produced no missing cases, so the loop swept the next ablation and then
  // both remaining conditions after the first invocation had already proved
  // unattributable — up to six further harness invocations bought after the answer was in.
  const stop = sweepStopReason(stopPart({ result: { condition: 'treatment', exitCode: 0, document: null, stderrTail: '' } }));
  assert.ok(stop, 'no document, no evidence, no reason to buy the next invocation');
  assert.match(stop.why, /produced no document/);
  assert.match(stop.hint, /more than one/);
});

test('a document short of a case the invocation named stops the run, and says why', () => {
  const stop = sweepStopReason(stopPart({
    result: { condition: 'treatment', exitCode: 0, stderrTail: '', document: { cases: [{ name: 'gate' }] } },
  }));
  assert.match(stop.why, /no result for triage/);
  assert.match(stop.hint, /failed to load/);
});

test('a partial run (exit 2: auth or cost ceiling) stops the run — the next invocation fails the same way', () => {
  // The 2026-09-03 smoke pass swept all three conditions against an expired login: each
  // harness stopped itself with exit 2, and the runner moved on to the next condition.
  const stop = sweepStopReason(stopPart({
    result: { condition: 'treatment', exitCode: 2, stderrTail: 'OAuth session expired', document: { cases: [{ name: 'gate' }, { name: 'triage' }] } },
  }));
  assert.ok(stop);
  assert.match(stop.why, /partial run \(exit 2\)/);
  assert.match(stop.hint, /login/);
  assert.equal(sweepStopReason(stopPart({ result: { condition: 'treatment', exitCode: 1, stderrTail: '', document: { cases: [{ name: 'gate' }, { name: 'triage' }] } } })), null,
    'exit 1 is a score below threshold, which is a finding, not a stop');
});

test('any signalled death stops the run, whatever the document says', () => {
  for (const exitCode of [129, 130, 137, 143]) {
    const stop = sweepStopReason(stopPart({ result: { condition: 'treatment', exitCode, document: { cases: [{ name: 'gate' }, { name: 'triage' }] }, stderrTail: '' } }));
    assert.match(stop.why, new RegExp(`killed by a signal \\(exit ${exitCode}\\)`));
  }
});

test('a complete document at an ordinary exit carries on to the next invocation', () => {
  assert.equal(sweepStopReason(stopPart()), null);
  // Exit 1 is "a case scored below threshold" — a finding, and the sweep continues.
  assert.equal(sweepStopReason(stopPart({
    result: { condition: 'treatment', exitCode: 1, stderrTail: '', document: { cases: [{ name: 'gate' }, { name: 'triage' }] } },
  })), null);
});

/* ── The ablations map is what the merger checks against the registration ──── */

test('an ablations map the merger cannot read is refused rather than written', () => {
  const record = (ablations) => buildSweepRecord(
    { condition: 'treatment', exitCode: 0, document: harnessDoc(), stderrTail: '', ablations },
    { argvs: [], startedAt: '', instrumentSha: SHA, conditionSha: SHA }
  );
  assert.deepEqual(record({ gate: 'with-without', step3: 'none' }).ablations,
    { gate: 'with-without', step3: 'none' });
  for (const bad of [{ gate: 'with-only' }, { gate: undefined }, { gate: 'None' }, null, ['gate']])
    assert.throws(() => record(bad), RunError, JSON.stringify(bad));
});

/* ── Auth preflight — the login lives in a config directory, not on the machine ── */

test('preflightAuth refuses a binary that is logged out under the sweep\'s config dir, and names it', async () => {
  // 2026-09-03: `/login` in one session (~/.claude-personal), sweep in a terminal pointed
  // at ~/.claude, one invocation spent to learn "OAuth session expired". `auth status`
  // costs nothing and knows.
  const cmd = (env) => () => ({ command: '/bin/claude-2.1.250', env });
  const spawn = (stdout) => async (command, argv) => {
    assert.deepEqual(argv, ['auth', 'status']);
    return { code: 0, stdout, stderr: '' };
  };
  const out = await preflightAuth(spawn('{"loggedIn": false}'), cmd({}));
  assert.equal(out.ok, false);
  assert.match(out.why, /not logged in under ~\/\.claude \(CLAUDE_CONFIG_DIR unset\)/);
  const named = await preflightAuth(spawn('{"loggedIn": false}'), cmd({ CLAUDE_CONFIG_DIR: '/h/.claude-work' }));
  assert.match(named.why, /under \/h\/\.claude-work/);
  assert.deepEqual(await preflightAuth(spawn('{"loggedIn": true, "email": "x"}'), cmd({})), { ok: true });
  const garbage = await preflightAuth(spawn('not json'), cmd({}));
  assert.equal(garbage.ok, false);
  assert.match(garbage.why, /could not read/);
  const dead = await preflightAuth(async () => { throw new Error('ENOENT'); }, cmd({}));
  assert.equal(dead.ok, false);
});

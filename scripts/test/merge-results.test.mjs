/**
 * Tests for the merger. Every fixture below is hand-built: no disk, no spawn, no
 * harness. That is the point of the pure/effectful split — a judgement this suite
 * makes about a number is assertable without paying for a run to produce one.
 *
 * Two halves, and the second is worthless without the first:
 *
 *   1. A clean set of sweeps merges into a report that passes every invariant. Without
 *      this positive control, a merger that refused everything would score full marks
 *      on the refusal tests below.
 *   2. One violation per invariant the merger owns — I1, I1b, I2, I4, I7, I8 — each
 *      proving the refusal actually fires.
 *
 * `node --test scripts/test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../merge-results.mjs';

/* ── fixtures ──────────────────────────────────────────────────────────────── */

const run = (score, extra = {}) => ({
  score, passed: score === 1, turns: 4, costUsd: 0.01, judgeCostUsd: 0.002,
  error: null, skippedPaidGraders: false, graders: [], ...extra,
});

/** A harness document, in the shape recon actually observed. */
const doc = ({ cases, partial = false, claudeVersion = '2.1.245', model = 'sonnet',
  judge = 'opus', costUsd = 0.4, startedAt = '2026-08-28T10:00:00.000Z', ...rest }) => ({
  schemaVersion: 1,
  claudeVersion,
  startedAt,
  costUsd,
  ...(partial === undefined ? {} : { partial }),
  suite: { ablation: 'with-without', threshold: 0.6, modelOverride: model, judgeModel: judge },
  cases: cases.map((c) => ({
    name: c.name,
    dir: `evals/x/${c.name}`,
    arms: {
      with: (c.with ?? []).map((s) => run(s, c.runExtra ?? {})),
      ...(c.without ? { without: c.without.map((s) => run(s, c.runExtra ?? {})) } : {}),
    },
    aggregates: { score: 0, passRate: 0 },
    ...(c.advisories ? { advisories: c.advisories } : {}),
  })),
  ...rest,
});

const sweep = (condition, document, exitCode = 0) => ({
  condition, exitCode, document, stderrTail: '', argv: ['plugin', 'eval'],
  startedAt: document.startedAt,
});

/**
 * Three sweeps over four cases. The numbers are chosen so the report exercises both
 * sides of the noise floor: `gate` clears it against none and oneliner, ties the
 * placebo (D6a's registered 0), and `triage` sits under it against everything.
 *
 *   baselines  gate    0.0 / 0.1 / 0.2  → spread 0.20   ← the worst, so the floor
 *              triage  0.5 / 0.5 / 0.5  → spread 0.00
 */
const sweeps = () => [
  sweep('treatment', doc({ cases: [
    { name: 'gate', with: [1, 1], without: [0, 0] },
    { name: 'triage', with: [0.6, 0.4], without: [0.5, 0.5] },
    { name: 'markers', with: [1, 1] },
  ] })),
  sweep('oneliner', doc({ cases: [
    { name: 'gate', with: [0.5, 0.5], without: [0, 0.2] },
    { name: 'triage', with: [0.5, 0.5], without: [0.4, 0.6] },
    { name: 'markers', with: [0.5, 0.5] },
  ] })),
  sweep('placebo', doc({ cases: [
    { name: 'gate', with: [1, 1], without: [0.2, 0.2] },
    { name: 'triage', with: [0.5, 0.5], without: [0.5, 0.5] },
    { name: 'markers', with: [0.5, 0.5] },
  ] })),
];

const PRE = {
  conditions: ['treatment', 'oneliner', 'placebo'],
  cases: [
    { name: 'gate', evidence: 'delta', ablation: 'with-without', tags: ['core'], scored: true, measures: 'stops' },
    { name: 'triage', evidence: 'delta', ablation: 'with-without', tags: ['triage'], scored: true, measures: 'skips' },
    { name: 'markers', evidence: 'capability', ablation: 'none', tags: ['capability'], scored: true, measures: 'markers' },
    { name: 'ctl', evidence: 'delta', ablation: 'none', tags: ['control'], scored: false, measures: 'diagnostic' },
  ],
  expectedDirection: {
    'gate/none': 1, 'gate/oneliner': 1, 'gate/placebo': 0,
    'triage/none': 0, 'triage/oneliner': 0, 'triage/placebo': 0,
  },
  threshold: 0.6,
  subjectModel: 'sonnet',
  judgeModel: 'opus',
  runsPerCase: 2,
  claudeVersion: '2.1.245',
  publishAllConditions: true,
};

const pre = (over = {}) => structuredClone({ ...PRE, ...over });

const PROV = {
  suiteSha: 'deadbeef', preRegistrationSha: 'aaa', claudeVersion: '2.1.245',
  subjectModel: 'sonnet', judgeModel: 'opus', startedAt: '2026-08-28T10:00:00.000Z',
  runsPerCase: 2, costUsdEstimate: 1.2,
};

const ctx = (over = {}) => ({
  drift: { drifted: false, reason: '', checkedAt: '2026-08-28T09:00:00.000Z' },
  committedPreRegistrationSha: 'aaa',
  preRegistrationDirty: false,
  ...over,
});

const merged = (s = sweeps(), p = pre(), prov = PROV) => m.mergeSweeps(s, p, structuredClone(prov));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const throws = (fn, needle) => assert.throws(fn, (e) => e.message.includes(needle), `expected a refusal mentioning ${needle}`);
const contrast = (report, caseName, control) =>
  report.deltaRows.find((r) => r.case === caseName).contrasts.find((c) => c.control === control);

const PREREG_MD = `# Pre-registration

Prose a human reads. The merger reads the block below and nothing else.

\`\`\`json
${JSON.stringify(PRE, null, 2)}
\`\`\`

More prose, editable without voiding a run.
`;

/* ── parsing: the borrowed document ────────────────────────────────────────── */

test('parseHarnessDocument tolerates unknown fields — the schema is additive-only', () => {
  const d = m.parseHarnessDocument(JSON.stringify({ ...doc({ cases: [{ name: 'a', with: [1] }] }), somethingNew: 42 }));
  assert.equal(d.cases[0].name, 'a');
});

test('parseHarnessDocument rejects a schemaVersion it does not understand', () => {
  throws(() => m.parseHarnessDocument(JSON.stringify({ schemaVersion: 2, cases: [], suite: {} })), 'schemaVersion');
});

test('parseHarnessDocument rejects text that is not JSON', () => {
  throws(() => m.parseHarnessDocument('<html>rate limited</html>'), 'not JSON');
});

/* ── parsing: the sweep envelope ───────────────────────────────────────────── */

test('parseSweepRecord refuses a bare aggregate-result.json and names the envelope it wants', () => {
  throws(() => m.parseSweepRecord(JSON.stringify(doc({ cases: [{ name: 'a', with: [1] }] })), 'treatment'),
    'SweepRecord envelope');
});

test('parseSweepRecord refuses a record whose condition disagrees with its filename', () => {
  throws(() => m.parseSweepRecord(JSON.stringify(sweep('placebo', doc({ cases: [] }))), 'treatment'),
    "declares condition 'placebo'");
});

test('parseSweepRecord refuses a sweep that produced no document', () => {
  throws(() => m.parseSweepRecord(JSON.stringify({ condition: 'treatment', exitCode: 1, document: null }), 'treatment'),
    'nothing to merge');
});

/* ── parsing: the pre-registration ─────────────────────────────────────────── */

test('parsePreRegistration reads the fenced json block out of the prose', () => {
  const p = m.parsePreRegistration(PREREG_MD);
  assert.deepEqual(p.conditions, ['treatment', 'oneliner', 'placebo']);
  assert.equal(p.expectedDirection['gate/placebo'], 0);
});

test('parsePreRegistration refuses a predicted score wearing a direction field', () => {
  const md = PREREG_MD.replace('"gate/none": 1', '"gate/none": 0.42');
  throws(() => m.parsePreRegistration(md), 'a sign');
});

test('parsePreRegistration refuses publishAllConditions as a toggle', () => {
  throws(() => m.parsePreRegistration(PREREG_MD.replace('"publishAllConditions": true', '"publishAllConditions": false')),
    'not a toggle');
});

test('parsePreRegistration refuses a judge equal to the subject model', () => {
  throws(() => m.parsePreRegistration(PREREG_MD.replace('"judgeModel": "opus"', '"judgeModel": "sonnet"')),
    'self-preference');
});

test('parsePreRegistration refuses a direction naming a case that is not registered', () => {
  throws(() => m.parsePreRegistration(PREREG_MD.replace('"gate/none"', '"gaet/none"')), 'names no registered case');
});

test('parsePreRegistration refuses a file with no machine-readable block', () => {
  // The marker token this placeholder would naturally carry is deliberately absent: a
  // fixture containing it would answer the suite's implementation-site enumeration with
  // a site that is not one — the defect 3-todos.md records rejecting.
  throws(() => m.parsePreRegistration('# Pre-registration\n\nStill unwritten prose.\n'), 'no fenced');
});

/* ── parsing: drift ────────────────────────────────────────────────────────── */

test('parseDriftRecord reads absence as drift — a skipped check cannot produce a report', () => {
  assert.equal(m.parseDriftRecord(null).drifted, true);
  assert.equal(m.parseDriftRecord('{oops').drifted, true);
  assert.equal(m.parseDriftRecord('{"reason":"clean"}').drifted, true);
  assert.equal(m.parseDriftRecord('{"drifted":false,"reason":""}').drifted, false);
});

/* ── extraction ────────────────────────────────────────────────────────────── */

test('extractRunScores returns every run, never a mean', () => {
  const d = doc({ cases: [{ name: 'gate', with: [1, 0.5, 0], without: [0, 0] }] });
  assert.deepEqual(m.extractRunScores(d, 'gate'), { with: [1, 0.5, 0], without: [0, 0] });
});

test('extractRunScores refuses a case the document does not contain', () => {
  throws(() => m.extractRunScores(doc({ cases: [] }), 'gate'), 'not in this document');
});

test('extractRunScores refuses a run with no score rather than dropping it from the mean', () => {
  const d = doc({ cases: [{ name: 'gate', with: [1] }] });
  delete d.cases[0].arms.with[0].score;
  throws(() => m.extractRunScores(d, 'gate'), 'has no score');
});

/* ── contrasts ─────────────────────────────────────────────────────────────── */

test('computeContrasts subtracts each control, and reads `none` as the mean of the per-sweep baselines', () => {
  const cs = m.computeContrasts({ treatment: 1, oneliner: 0.5, placebo: 1 }, [0, 0.1, 0.2], pre(), 'gate');
  assert.deepEqual(cs.map((c) => c.control), ['none', 'oneliner', 'placebo']);
  close(cs[0].value, 0.9);
  close(cs[1].value, 0.5);
  close(cs[2].value, 0);
});

test('computeContrasts takes the direction from the pre-registration, not from the numbers', () => {
  // The placebo ties on gate and is registered 0; a merger that inferred direction from
  // the result would have written +1 for the two contrasts that came out positive.
  const cs = m.computeContrasts({ treatment: 1, oneliner: 0.5, placebo: 1 }, [0, 0.1, 0.2], pre(), 'gate');
  assert.deepEqual(cs.map((c) => c.expected), [1, 1, 0]);
});

test('computeContrasts refuses a pair nobody registered', () => {
  const p = pre();
  delete p.expectedDirection['gate/placebo'];
  throws(() => m.computeContrasts({ treatment: 1, oneliner: 0.5, placebo: 1 }, [0, 0.1], p, 'gate'),
    'no registered expected direction');
});

test('computeContrasts yields nothing when the treatment column is empty', () => {
  assert.deepEqual(m.computeContrasts({ treatment: null, oneliner: 0.5 }, [0], pre(), 'gate'), []);
});

/* ── the noise floor ───────────────────────────────────────────────────────── */

test('computeBaselineSpread takes the worst per-case spread and never pools cases', () => {
  // Pooled, these six numbers span 0.9 — but that span is case difficulty, not noise.
  const spread = m.computeBaselineSpread([[0.0, 0.1, 0.2], [0.9, 0.9, 0.9]]);
  close(spread, 0.2);
});

test('computeBaselineSpread returns NaN when the floor was never measured — not 0', () => {
  assert.ok(Number.isNaN(m.computeBaselineSpread([[0.4], []])));
  assert.ok(Number.isNaN(m.computeBaselineSpread([])));
});

test('a single sweep leaves the noise floor unmeasured, and I1b then refuses the report', () => {
  const one = [sweeps()[0]];
  const report = m.mergeSweeps(one, pre({ conditions: ['treatment'],
    expectedDirection: { 'gate/none': 1, 'triage/none': 0 } }), PROV);
  assert.equal('baselineSpread' in report, false);
  const check = m.checkReport(report, pre({ conditions: ['treatment'] }), ctx());
  assert.equal(check.ok, false);
  assert.ok(check.violations.some((v) => v.includes('never measured')));
});

/* ── merging ───────────────────────────────────────────────────────────────── */

test('mergeSweeps splits the evidence kinds into two arrays, and the control reaches neither', () => {
  const report = merged();
  assert.deepEqual(report.deltaRows.map((r) => r.case), ['gate', 'triage']);
  assert.deepEqual(report.capabilityRows.map((r) => r.case), ['markers']);
  assert.equal([...report.deltaRows, ...report.capabilityRows].some((r) => r.case === 'ctl'), false);
});

test('mergeSweeps keeps every run score and every per-sweep baseline apart', () => {
  const gate = merged().deltaRows[0];
  assert.deepEqual(gate.conditionRunScores.treatment, [1, 1]);
  assert.deepEqual(gate.conditionRunScores.oneliner, [0.5, 0.5]);
  assert.deepEqual(gate.baselineScores, [0, 0.1, 0.2]);   // three sweeps, three baselines
  close(gate.conditionScores.treatment, 1);
});

test('mergeSweeps marks sub-noise contrasts and leaves the rest unmarked', () => {
  const report = merged();
  close(report.baselineSpread, 0.2);
  assert.equal(contrast(report, 'gate', 'none').belowNoiseFloor, false);      // +0.90
  assert.equal(contrast(report, 'gate', 'placebo').belowNoiseFloor, true);    //  0.00
  assert.equal(contrast(report, 'triage', 'oneliner').belowNoiseFloor, true); //  0.00
});

test('mergeSweeps gives a capability row no contrasts at all', () => {
  assert.deepEqual(merged().capabilityRows[0].contrasts, []);
});

test('mergeSweeps refuses to publish a comparison missing a registered condition', () => {
  throws(() => m.mergeSweeps(sweeps().slice(0, 2), pre(), PROV), "no sweep for registered condition 'placebo'");
});

test('mergeSweeps reports a case that ran but was never registered instead of scoring it', () => {
  const s = sweeps();
  s[0].document.cases.push({ name: 'stowaway', dir: 'x', arms: { with: [run(1)] }, aggregates: {} });
  const report = m.mergeSweeps(s, pre(), PROV);
  assert.equal([...report.deltaRows, ...report.capabilityRows].some((r) => r.case === 'stowaway'), false);
  assert.ok(report.advisories.some((a) => a.includes('stowaway')));
});

test('mergeSweeps drops contrasts when a run skipped paid graders — the arms are not comparable', () => {
  const s = sweeps();
  s[0].document.cases[0].arms.with[0].skippedPaidGraders = true;
  const report = m.mergeSweeps(s, pre(), PROV);
  assert.deepEqual(report.deltaRows.find((r) => r.case === 'gate').contrasts, []);
  assert.ok(report.deltaRows[0].advisories.some((a) => a.includes('not comparable')));
});

test('a document with no `partial` field leaves the report three-valued rather than complete', () => {
  const s = sweeps();
  delete s[1].document.partial;
  const report = m.mergeSweeps(s, pre(), PROV);
  assert.equal('partial' in report, false);
  assert.equal(m.checkReport(report, pre(), ctx()).ok, false);
});

/* ── the positive control ──────────────────────────────────────────────────── */

test('a clean set of sweeps merges into a report that passes every invariant', () => {
  const check = m.checkReport(merged(), pre(), ctx());
  assert.deepEqual(check.violations, []);
  assert.equal(check.ok, true);
});

/* ── one violation per invariant the merger owns ───────────────────────────── */

const refuses = (report, p, c, needle) => {
  const check = m.checkReport(report, p, c);
  assert.equal(check.ok, false, 'expected a refusal, got a publishable report');
  assert.ok(check.violations.some((v) => v.includes(needle)),
    `violations ${JSON.stringify(check.violations)} do not mention ${needle}`);
};

test('I1 — a partial sweep is refused, not footnoted', () => {
  const s = sweeps();
  s[2].document.partial = true;
  s[2].document.partialReason = 'cost_ceiling';
  refuses(m.mergeSweeps(s, pre(), PROV), pre(), ctx(), 'not publishable');
});

test('I1b — an unmarked sub-noise contrast is refused', () => {
  const report = merged();
  delete contrast(report, 'gate', 'placebo').belowNoiseFloor;   // as if markNoiseFloor never ran
  refuses(report, pre(), ctx(), 'not marked belowNoiseFloor');
});

test('I2 — drift, a changed subject model, a changed CLI version, and a dirty pre-registration each void the run', () => {
  refuses(merged(), pre(), ctx({ drift: { drifted: true, reason: 'SKILL.md moved' } }), 'drifted');
  refuses(merged(sweeps(), pre(), { ...PROV, subjectModel: 'haiku' }), pre(), ctx(), 'subject model');
  refuses(merged(sweeps(), pre(), { ...PROV, claudeVersion: '2.2.0' }), pre(), ctx(), 'CLI version');
  refuses(merged(), pre(), ctx({ preRegistrationDirty: true }), 'dirty');
});

test('I4 — a capability row moved into deltaRows is refused', () => {
  const report = merged();
  report.deltaRows.push(report.capabilityRows.pop());
  refuses(report, pre(), ctx(), "evidence 'capability' in deltaRows");
});

test('I4 — a report emitting a combined mean is refused', () => {
  const report = merged();
  report.overallScore = 0.78;
  refuses(report, pre(), ctx(), 'combined mean');
});

test('I4 — a row count that disagrees with the pre-registration is refused', () => {
  const report = merged();
  report.deltaRows.pop();
  refuses(report, pre(), ctx(), 'expected 2 delta rows');
});

test('I7 — a control-tagged case that reached a scored table is refused', () => {
  const report = merged();
  report.deltaRows.push({ case: 'ctl', evidence: 'delta', conditionScores: {}, conditionRunScores: {},
    baselineScores: [], contrasts: [], advisories: [] });
  refuses(report, pre(), ctx(), 'control-tagged');
});

test('I8 — a pre-registration edited after it was committed is refused', () => {
  refuses(merged(), pre(), ctx({ committedPreRegistrationSha: 'bbb' }), 'pre-registration changed');
});

test('I8 — a pre-registration that was never committed is refused rather than read as agreement', () => {
  refuses(merged(), pre(), ctx({ committedPreRegistrationSha: '' }), 'missing');
});

/* ── provenance ────────────────────────────────────────────────────────────── */

const revParse = async () => 'deadbeefcafe\n';
const digest = async () => ({ digest: 'aaa', dirty: false });
const clock = () => '2026-08-28T12:00:00.000Z';

test('buildProvenance records what RAN — models and CLI version off the documents, not the promise', async () => {
  const p = await m.buildProvenance(revParse, digest, clock, sweeps(), pre(), '/x/PRE-REGISTRATION.md');
  assert.equal(p.subjectModel, 'sonnet');
  assert.equal(p.judgeModel, 'opus');
  assert.equal(p.claudeVersion, '2.1.245');
  assert.equal(p.suiteSha, 'deadbeefcafe');
  assert.equal(p.preRegistrationSha, 'aaa');
  assert.equal(p.runsPerCase, 2);
  assert.equal(p.startedAt, '2026-08-28T10:00:00.000Z');
  close(p.costUsdEstimate, 1.2);
});

test('buildProvenance refuses sweeps that disagree on the CLI version', async () => {
  const s = sweeps();
  s[1].document.claudeVersion = '2.2.0';
  await assert.rejects(() => m.buildProvenance(revParse, digest, clock, s, pre(), '/x/P.md'),
    (e) => e.message.includes('disagree on claudeVersion'));
});

test('buildProvenance falls back to the clock when no sweep recorded a start', async () => {
  const s = sweeps().map((x) => ({ ...x, startedAt: undefined, document: { ...x.document, startedAt: undefined } }));
  const p = await m.buildProvenance(revParse, digest, clock, s, pre(), '/x/P.md');
  assert.equal(p.startedAt, '2026-08-28T12:00:00.000Z');
});

/* ── the printed comparison ────────────────────────────────────────────────── */

test('formatComparison keeps the two evidence kinds under separate headings', () => {
  const text = m.formatComparison(merged());
  assert.ok(text.includes('## Delta evidence'));
  assert.ok(text.includes('## Capability evidence'));
  assert.ok(text.indexOf('## Delta evidence') < text.indexOf('## Capability evidence'));
});

test('formatComparison prints the noise floor beside the contrasts and marks what sits under it', () => {
  const text = m.formatComparison(merged());
  assert.ok(text.includes('Noise floor — 0.20'));
  assert.ok(text.includes('below the noise floor'));
});

test('formatComparison typesets a registered direction as a sign, never as a score', () => {
  const text = m.formatComparison(merged());
  assert.ok(/\| \+1 \|/.test(text), 'expected a +1 direction cell');
  assert.ok(!/\| 1\.00 \| *$/m.test(text), 'a direction was typeset like a measurement');
});

test('formatComparison emits no combined mean, and says so', () => {
  const text = m.formatComparison(merged());
  assert.ok(text.includes('No combined score is emitted'));
  assert.ok(!/overall/i.test(text));
});

test('formatComparison keeps per-run scatter, because a mean cannot be un-taken', () => {
  const text = m.formatComparison(merged());
  assert.ok(text.includes('## Per-run scatter'));
  assert.ok(text.includes('0.60 · 0.40'));
});

/* ── argv ──────────────────────────────────────────────────────────────────── */

test('parseArgv takes a results directory in and a report path out', () => {
  assert.deepEqual(m.parseArgv(['evals/x/results', '--out', 'c.md']),
    { resultsDir: 'evals/x/results', out: 'c.md', preRegistration: '' });
});

test('parseArgv refuses an invocation with no results directory', () => {
  throws(() => m.parseArgv([]), 'usage:');
  throws(() => m.parseArgv(['--nope']), 'unknown option');
});

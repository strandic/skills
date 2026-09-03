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
import * as inv from '../invariants.mjs';

/* ── fixtures ──────────────────────────────────────────────────────────────── */

// A grader per run, because the default ctx below hands the sweep records to I1c and a
// run with no graders is the setup failure that check exists to refuse.
const run = (score, extra = {}) => ({
  score, passed: score === 1, turns: 4, costUsd: 0.01, judgeCostUsd: 0.002,
  error: null, skippedPaidGraders: false,
  graders: [{ name: 'g', passed: score === 1, weight: 1, explanation: 'judged', scored: true }],
  ...extra,
});

/** The instrument every fixture sweep was measured on. */
const INSTRUMENT = 'a'.repeat(64);

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

/**
 * The ablation each fixture case is REGISTERED at, which is also what a correct sweep
 * records for it. `markers` is `none` by registration even in the fixture whose sweep
 * produced a without-arm anyway — that mismatch is step3's real shape, and the fixtures
 * that reproduce it override this map rather than deriving it from the arms.
 */
const ABLATIONS = { gate: 'with-without', triage: 'with-without', markers: 'none' };

/** Each condition's own half of the instrument — distinct per id, like the real digest. */
const OWN = (condition) => `${condition}-`.padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, '0');
const OWN_SHAS = (conditions = PRE_CONDITIONS) => Object.fromEntries(conditions.map((c) => [c, OWN(c)]));
const PRE_CONDITIONS = ['treatment', 'oneliner', 'placebo'];

const sweep = (condition, document, exitCode = 0, ablations) => ({
  condition, exitCode, document, stderrTail: '', argvs: [['plugin', 'eval']],
  startedAt: document.startedAt, instrumentSha: INSTRUMENT, conditionSha: OWN(condition),
  ablations: ablations ?? Object.fromEntries(
    document.cases.map((c) => [c.name, ABLATIONS[c.name] ?? 'with-without'])),
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
    // Capability/none, like the real `control-all-steps`: the parser refuses a case whose
    // evidence and ablation disagree, and a diagnostic is no exception.
    { name: 'ctl', evidence: 'capability', ablation: 'none', tags: ['control'], scored: false, measures: 'diagnostic' },
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
  suiteSha: 'deadbeef', preRegistrationSha: 'aaa', instrumentSha: INSTRUMENT,
  claudeVersion: '2.1.245',
  subjectModel: 'sonnet', judgeModel: 'opus', startedAt: '2026-08-28T10:00:00.000Z',
  runsPerCase: 2, costUsdEstimate: 1.2,
};

// `sweeps` is in the default context now, not only in the I1c test: I2b reads the
// instrument digest off the sweep records, and a context that omitted them would make
// every checkReport call refuse for a reason the test did not intend.
const ctx = (over = {}) => ({
  sweeps: sweeps(),
  drift: { drifted: false, reason: '', checkedAt: '2026-08-28T09:00:00.000Z', instrumentSha: INSTRUMENT },
  committedPreRegistrationSha: 'aaa',
  preRegistrationDirty: false,
  instrumentSha: INSTRUMENT,
  conditionShas: OWN_SHAS(),
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

/**
 * A6. `evidence` and `ablation` are one decision written twice, and the merger keys
 * behaviour on both — `evidence` splits the tables, `ablation` decides whether a
 * without-arm is a baseline. The parser refuses a registration where they disagree, and
 * these two tests are what hold that refusal: without them the whole cross-check could be
 * deleted with every other test still green, which is the state the fields' agreement was
 * being relied on from.
 *
 * Both directions are pinned because they fail differently: a capability case registered
 * `with-without` would have its stray baselines counted into the noise floor, and a delta
 * case registered `none` would lose the baselines its contrast is measured against.
 */
test('parsePreRegistration refuses a capability case registered at ablation with-without', () => {
  // The first `"ablation": "none"` in the serialised block is `markers`, the capability case.
  const md = PREREG_MD.replace('"ablation": "none"', '"ablation": "with-without"');
  throws(() => m.parsePreRegistration(md),
    "markers is registered evidence 'capability' with ablation 'with-without' — 'capability' evidence " +
    "is measured at ablation 'none', and a case cannot be both");
});

test('parsePreRegistration refuses a delta case registered at ablation none', () => {
  // The first `"ablation": "with-without"` is `gate`, the delta case.
  const md = PREREG_MD.replace('"ablation": "with-without"', '"ablation": "none"');
  throws(() => m.parsePreRegistration(md),
    "gate is registered evidence 'delta' with ablation 'none' — 'delta' evidence is measured at " +
    "ablation 'with-without', and a case cannot be both");
});

test('parsePreRegistration accepts the fixture whose evidence and ablation agree', () => {
  // The positive control for the two refusals above: without it, a parser that threw on
  // every case would score full marks on both.
  assert.equal(m.parsePreRegistration(PREREG_MD).cases.length, PRE.cases.length);
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

test('parseDriftRecord carries the instrument digest through, and reads its absence as absence', () => {
  assert.equal(m.parseDriftRecord(`{"drifted":false,"instrumentSha":"${INSTRUMENT}"}`).instrumentSha, INSTRUMENT);
  assert.equal(m.parseDriftRecord('{"drifted":false}').instrumentSha, '');
  assert.equal(m.parseDriftRecord(null).instrumentSha, '');
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

/**
 * A5. Fifteen runs per arm, scores of 0 and 1, exactly as the real sweep produced them.
 *
 *   treatment `triage` with-arm   4 of 15 pass → 4/15
 *   placebo   `triage` with-arm   2 of 15 pass → 2/15    Δ = 2/15 = 0.13333333333333333
 *   baselines                     15/15, 13/15, 15/15    spread = 0.1333333333333333
 *
 * Both quantities are 2/15. They are summed in different orders, so the spread lands one
 * unit in the last place BELOW the delta — and `Math.abs(value) < spread` then said the
 * contrast was above the floor by 1.4e-17 and published it as a held prediction.
 */
const fifteen = (ones) => Array.from({ length: 15 }, (_, i) => (i < ones ? 1 : 0));

const ulpSweeps = () => [
  sweep('treatment', doc({ cases: [
    { name: 'gate', with: fifteen(15), without: fifteen(7) },
    { name: 'triage', with: fifteen(4), without: fifteen(15) },
  ] })),
  sweep('oneliner', doc({ cases: [
    { name: 'gate', with: fifteen(7), without: fifteen(7) },
    { name: 'triage', with: fifteen(0), without: fifteen(13) },
  ] })),
  sweep('placebo', doc({ cases: [
    { name: 'gate', with: fifteen(7), without: fifteen(7) },
    { name: 'triage', with: fifteen(2), without: fifteen(15) },
  ] })),
];

// `ctl` stays: I7 refuses a pre-registration with no control-tagged case at all.
const ulpPre = () => pre({
  cases: PRE.cases.filter((c) => c.name !== 'markers'),
  runsPerCase: 15,
});

test('a contrast that ties the noise floor is marked as inside it, not published as a finding', () => {
  const report = m.mergeSweeps(ulpSweeps(), ulpPre(), PROV);
  const delta = contrast(report, 'triage', 'placebo').value;
  const spread = report.baselineSpread;

  // The fixture must actually reproduce the shape, or the test proves nothing.
  assert.ok(delta > spread, `fixture lost its ulp gap: ${delta} vs ${spread}`);
  assert.ok(delta - spread < inv.NOISE_EPSILON, 'the gap must be inside the tolerance');
  close(delta, 2 / 15);
  close(spread, 2 / 15);

  assert.equal(contrast(report, 'triage', 'placebo').belowNoiseFloor, true);
  const check = m.checkReport(report, ulpPre(), ctx({ sweeps: ulpSweeps() }));
  assert.deepEqual(check.violations, []);
});

test('the noise-floor tolerance lives in one place and both sides of the comparison use it', () => {
  assert.equal(inv.NOISE_EPSILON, 1e-9);
  // A contrast one epsilon-and-a-bit above the floor is still a finding: the tolerance
  // absorbs float noise, it does not widen the floor.
  const rows = m.markNoiseFloor([{ contrasts: [{ value: 0.2 + 1e-6, control: 'none', expected: 1 }] }], 0.2);
  assert.equal(rows[0].contrasts[0].belowNoiseFloor, false);
  assert.equal(m.markNoiseFloor([{ contrasts: [{ value: 0.2, control: 'none', expected: 1 }] }], 0.2)[0]
    .contrasts[0].belowNoiseFloor, true);
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

/* ── B4 — a hole in the comparison is not a smaller comparison ─────────────── */

/**
 * B4. Before: a null cell, a `case did not run` footnote, eleven contrasts where twelve
 * were registered — and every invariant passed. Then a `MergeError` thrown mid-merge,
 * which refused correctly but aborted before any check ran, so an operator merging a
 * truncated sweep got one message and lost I1's "run is partial" and the rest of the list
 * with it. Now it is I4b: the report is built, nothing is published, and every other
 * invariant still gets to speak.
 */
test('a registered scored case missing from one condition is refused by I4b, naming case and condition', () => {
  const s = sweeps();
  s[2].document.cases = s[2].document.cases.filter((c) => c.name !== 'triage');
  const report = m.mergeSweeps(s, pre(), PROV);
  assert.equal(report.deltaRows.find((r) => r.case === 'triage').conditionScores.placebo, null,
    'the hole must stay a hole, not become a score');
  assert.deepEqual(report.deltaRows.find((r) => r.case === 'triage').contrasts, [],
    'a row with a hole in it yields no contrast');
  refuses(report, pre(), ctx({ sweeps: s }), "triage: registered and scored, but the 'placebo' sweep does not contain it");
});

test('a case present with an empty run list is refused by I4b rather than counted as a zero', () => {
  const s = sweeps();
  s[1].document.cases.find((c) => c.name === 'gate').arms.with = [];
  const report = m.mergeSweeps(s, pre(), PROV);
  refuses(report, pre(), ctx({ sweeps: s }), "gate: present in the 'oneliner' sweep with an empty run list");
});

test('a merge with a hole in it still reports every other invariant, not just the hole', () => {
  // The behaviour the throw cost: one refusal per attempt, and the operator re-runs the
  // merge to find the next one. A truncated sweep is usually also a partial one.
  const s = sweeps();
  s[2].document.cases = s[2].document.cases.filter((c) => c.name !== 'triage');
  s[2].document.partial = true;
  s[2].document.partialReason = 'cost_ceiling';
  const check = m.checkReport(m.mergeSweeps(s, pre(), PROV), pre(), ctx({ sweeps: s }));
  assert.equal(check.ok, false);
  assert.ok(check.violations.some((v) => v.startsWith('I1:') && v.includes('not publishable')),
    JSON.stringify(check.violations));
  assert.ok(check.violations.some((v) => v.startsWith('I4b:') && v.includes('triage')),
    JSON.stringify(check.violations));
});

/* ── A6 — the swept ablation is checked against the registered one ─────────── */

test('a case swept at an ablation nobody registered voids the merge, naming the case and both values', () => {
  // step3's real shape: registered `ablation: none` because a replayed transcript carries
  // the plugin into both arms, swept with-without anyway. The document alone cannot show
  // it — `suite.ablation` names one ablation for the whole invocation — so the check reads
  // the per-case map the runner records on the envelope.
  const s = strayWithout();
  s[0].ablations.markers = 'with-without';
  const report = m.mergeSweeps(s, pre(), PROV);
  refuses(report, pre(), ctx({ sweeps: s }),
    "markers: registered ablation 'none', but the 'treatment' sweep ran it at 'with-without'");
  assert.ok(report.capabilityRows[0].advisories.some((a) => a.includes("registered ablation 'none', swept 'with-without'")),
    JSON.stringify(report.capabilityRows[0].advisories));
});

test('a sweep carrying no ablation map is recorded as unchecked, not as agreement', () => {
  // A bare SweepResult has no map, and I2b already refuses records old enough to predate
  // the field — so this is an advisory rather than a second refusal, and it says outright
  // that the cross-check did not run.
  const s = sweeps().map(({ ablations, ...rest }) => rest);
  const report = m.mergeSweeps(s, pre(), PROV);
  assert.ok(report.advisories.some((a) => a.includes('no per-case ablation map')), JSON.stringify(report.advisories));
  assert.deepEqual(m.checkReport(report, pre(), ctx({ sweeps: s })).violations, [],
    'an unstamped map is unchecked, not a violation');
});

test('the ablation cross-check passes when every case ran where it was registered', () => {
  // The positive control: without it, a check that refused every sweep would score full
  // marks on the two refusals above.
  assert.deepEqual(m.checkReport(merged(), pre(), ctx()).violations, []);
});

test('mergeSweeps still ignores an unregistered or unscored case that is missing', () => {
  // `ctl` is registered but unscored, and no sweep document contains it. That is not a
  // hole in the comparison; it never enters one.
  assert.equal(merged().deltaRows.length, 2);
});

test('computeContrasts refuses a named control with no score rather than dropping the contrast', () => {
  throws(() => m.computeContrasts({ treatment: 1, oneliner: null, placebo: 1 }, [0, 0.1], pre(), 'gate'),
    "the 'oneliner' condition has no score");
});

test('computeContrasts still tolerates an absent `none` column — a suite may have no without-arm', () => {
  const cs = m.computeContrasts({ treatment: 1, oneliner: 0.5, placebo: 1 }, [], pre(), 'gate');
  assert.deepEqual(cs.map((c) => c.control), ['oneliner', 'placebo']);
});

/* ── A6 — a capability case has no baseline, in either direction ───────────── */

/**
 * step3's real shape: registered `ablation: none`, but the sweep ran two arms anyway and
 * the report printed a `none (per sweep)` row beside a table whose own heading says its
 * numbers have no referent. The three stray baselines are deliberately far apart and
 * chosen not to collide with any delta baseline, so a leak is visible by value.
 */
const STRAY = [0.9, 0.3, 0.7];
const strayWithout = () => {
  const s = sweeps();
  s.forEach((x, i) => {
    x.document.cases.find((c) => c.name === 'markers').arms.without = [run(STRAY[i]), run(STRAY[i])];
  });
  return s;
};

test('a capability case contributes no baseline column, even when the sweep produced a without-arm', () => {
  const report = m.mergeSweeps(strayWithout(), pre(), PROV);
  assert.deepEqual(report.capabilityRows[0].baselineScores, []);
  assert.ok(report.capabilityRows[0].advisories.some((a) => a.includes('registered ablation none')),
    JSON.stringify(report.capabilityRows[0].advisories));
});

/**
 * A6, the guard's KEY. The parser refuses a registration whose `evidence` and `ablation`
 * disagree, so on any parsed file the two fields select the same rows and keying the
 * collection guard on either one gives the same answer — which is exactly why the choice
 * needs its own pin. `mergeSweeps` is exported and takes the registration as a value, so a
 * caller can hand it the disagreement the parser would have refused; this test is that
 * caller. The rule is `ablation`, the field that says whether a without-arm measures
 * anything, and a guard re-keyed on `evidence` fails here and nowhere else.
 */
test('the baseline guard reads the registered ablation, not the evidence kind', () => {
  const p = pre();
  // Delta evidence, ablation none — the combination the parser refuses, so only a direct
  // caller can produce it. `triage` has a without-arm in all three sweeps.
  p.cases.find((s) => s.name === 'triage').ablation = 'none';
  const row = m.mergeSweeps(sweeps(), p, PROV).deltaRows.find((r) => r.case === 'triage');
  assert.deepEqual(row.baselineScores, [], 'a case registered at ablation none contributed a baseline');
  assert.ok(row.advisories.some((a) => a.includes('registered ablation none')), JSON.stringify(row.advisories));
});

/**
 * A6, the collection guard: no fixture the merger can build carries a capability baseline,
 * because `mergeSweeps` refuses to collect one. That is what makes the guard hard to hold
 * — a test that goes through `mergeSweeps` cannot distinguish "the floor ignores these
 * numbers" from "there are no numbers to ignore", and both halves of the fix passed
 * mutation-free until the selection was pulled out into {@link noiseFloorOf}.
 *
 * So the rule is pinned where it lives, on a report whose capability row carries baselines
 * by hand. Counting them would take the worst per-case spread from 0.20 to 0.60 — off a
 * comparison the capability heading says does not exist — and every genuine contrast in
 * the suite would then read as noise.
 */
const withStrayCapabilityBaselines = () => {
  const report = m.mergeSweeps(sweeps(), pre(), PROV);
  report.capabilityRows[0].baselineScores = [...STRAY];   // spread 0.60, if anyone counted it
  return report;
};

test('noiseFloorOf measures the floor from delta rows only, even when a capability row has baselines', () => {
  const report = withStrayCapabilityBaselines();
  close(m.computeBaselineSpread(report.capabilityRows.map((r) => r.baselineScores)), 0.6);
  close(m.noiseFloorOf(report), 0.2);
});

test('the noise floor is measured from delta rows only — a capability without-arm cannot move it', () => {
  close(m.mergeSweeps(strayWithout(), pre(), PROV).baselineSpread, 0.2);
  close(m.mergeSweeps(sweeps(), pre(), PROV).baselineSpread, 0.2);
});

test('a stray capability baseline never reaches a delta row', () => {
  const report = m.mergeSweeps(strayWithout(), pre(), PROV);
  for (const r of report.deltaRows)
    assert.equal(r.baselineScores.some((n) => STRAY.includes(n)), false, `${r.case} took a capability baseline`);
});

test('the scatter table prints no `none (per sweep)` row beside a capability case', () => {
  const text = m.formatComparison(m.mergeSweeps(strayWithout(), pre(), PROV));
  const noneRows = text.split('\n').filter((l) => l.includes('none (per sweep)'));
  assert.equal(noneRows.length, 2, `expected one row per delta case: ${JSON.stringify(noneRows)}`);
  assert.ok(noneRows.every((l) => !l.includes('markers')));
  assert.ok(!/`markers`.*0\.90/.test(text), 'a capability baseline reached the report');
});

// A6, the printer half, pinned the same way and for the same reason: fed a report the
// merger cannot produce, because the merger's own guard is what makes the printer's guard
// invisible. Reverting the split scatter loop to one pass over both row arrays would print
// `| \`markers\` | none (per sweep) | 0.90 · 0.30 · 0.70 |` under a heading that says these
// numbers have no referent.
test('formatComparison prints no baseline row for a capability case that arrives carrying baselines', () => {
  const text = m.formatComparison(withStrayCapabilityBaselines());
  const noneRows = text.split('\n').filter((l) => l.includes('none (per sweep)'));
  assert.equal(noneRows.length, 2, `expected one row per delta case: ${JSON.stringify(noneRows)}`);
  assert.ok(noneRows.every((l) => !l.includes('markers')), JSON.stringify(noneRows));
  assert.ok(!text.includes('0.90 · 0.30 · 0.70'), 'a capability baseline column reached the scatter table');
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

test('I1c — a sweep whose runs errored is refused, whatever `partial` says', () => {
  // The harness sets `partial` for a cost ceiling or an interrupt, not for runs that
  // lose their auth session partway. A real sweep came back `partial: false` with 28 of
  // 43 runs failed; every one scored 0 and would have dragged the treatment down.
  const broken = { condition: 'treatment', document: { cases: [
    { name: 'a', arms: { with: [{ score: 0, error: 'Failed to authenticate' }], without: [{ score: 0.4, error: null }] } },
  ] } };
  const check = m.checkReport(merged(), pre(), { ...ctx(), sweeps: [broken] });
  assert.equal(check.ok, false);
  assert.ok(check.violations.some((v) => v.includes('I1c')), JSON.stringify(check.violations));
});

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

test('I2 — drift, a changed subject model, a changed CLI series, and a dirty pre-registration each void the run', () => {
  refuses(merged(), pre(), ctx({ drift: { drifted: true, reason: 'SKILL.md moved' } }), 'drifted');
  refuses(merged(sweeps(), pre(), { ...PROV, subjectModel: 'haiku' }), pre(), ctx(), 'subject model');
  refuses(merged(sweeps(), pre(), { ...PROV, claudeVersion: '2.2.0' }), pre(), ctx(), 'CLI series');
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

/* ── I2b — one instrument across the sweeps, the drift record and the tree ──
 *
 * What it compares is digests, not clocks. `drift.json` could not see a control-only
 * re-run measured against different graders, and I2b can; neither of them looks at
 * `startedAt`, and sweeps taken weeks apart on an unchanged instrument merge cleanly.
 * ─────────────────────────────────────────────────────────────────────────── */

test('I2b — the results already in the worktree are refused for predating the digest', () => {
  // The three `results/*.json` on this branch carry no instrumentSha at all. They must not
  // merge, and the message must say what to do about it.
  const unstamped = sweeps().map(({ instrumentSha, ...s }) => s);
  refuses(merged(), pre(), ctx({ sweeps: unstamped }), 'predate the instrument digest');
  refuses(merged(), pre(), ctx({ sweeps: unstamped }), 'must be re-run');
});

test('I2b — sweeps measured on two different instruments are refused, and both are named', () => {
  const mixed = sweeps();
  mixed[0].instrumentSha = 'b'.repeat(64);
  refuses(merged(), pre(), ctx({ sweeps: mixed }), 'different instruments');
  refuses(merged(), pre(), ctx({ sweeps: mixed }), 'treatment=bbbbbbbbbbbb');
});

test('I2b — a drift record taken against another instrument is refused', () => {
  refuses(merged(), pre(),
    ctx({ drift: { drifted: false, reason: '', checkedAt: '', instrumentSha: 'c'.repeat(64) } }),
    'drift.json names instrument cccccccccccc');
});

test('I2b — results taken before a grader rewrite are refused against the tree that holds it', () => {
  refuses(merged(), pre(), ctx({ instrumentSha: 'd'.repeat(64) }), 'the suite on disk is instrument');
});

test('I2b — a merge that could not read the suite refuses rather than vouching for it', () => {
  refuses(merged(), pre(), ctx({ instrumentSha: '' }), 'no instrument digest was computed at merge time');
});

test('a clean set of sweeps on one instrument still passes every invariant', () => {
  // The positive control for I2b specifically: without it, an I2b that refused everything
  // would score full marks on the five refusals above.
  assert.deepEqual(m.checkReport(merged(), pre(), ctx()).violations, []);
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

test('buildProvenance records the instrument the sweeps agree on', async () => {
  const p = await m.buildProvenance(revParse, digest, clock, sweeps(), pre(), '/x/P.md');
  assert.equal(p.instrumentSha, INSTRUMENT);
});

test('buildProvenance records no instrument when the sweeps do not unanimously carry one', async () => {
  // '' rather than a throw: I2b names the side that differs and says what to re-run,
  // which a `sweeps disagree` throw here could not.
  const partly = sweeps();
  delete partly[1].instrumentSha;
  assert.equal((await m.buildProvenance(revParse, digest, clock, partly, pre(), '/x/P.md')).instrumentSha, '');

  const mixed = sweeps();
  mixed[1].instrumentSha = 'b'.repeat(64);
  assert.equal((await m.buildProvenance(revParse, digest, clock, mixed, pre(), '/x/P.md')).instrumentSha, '');
});

test('resolveInstrumentSha takes the digest as a handle, and reads a failure as absence', async () => {
  assert.deepEqual(await m.resolveInstrumentSha(async (dir) => `sha-of:${dir}`, '/x/suite'),
    { sha: 'sha-of:/x/suite', error: '' });
  // A suite the merger cannot read is not one it can vouch for; '' is what I2b refuses.
  for (const handle of [
    async () => { throw new Error('boom'); },
    () => { throw new Error('sync'); },
    async () => undefined,
    async () => '',
  ]) assert.equal((await m.resolveInstrumentSha(handle, '/x')).sha, '');
});

// The reason travels with the empty sha instead of being swallowed. A suite directory that
// is not there, a file this process may not read, and a bug in the digest all arrived as
// the same sentence — "no instrument digest was computed at merge time" — and they are
// three different things for the operator to do next.
test('resolveInstrumentSha carries the underlying failure, and I2b prints it', async () => {
  const enoent = Object.assign(new Error("ENOENT: no such file or directory, scandir '/x'"), { code: 'ENOENT' });
  const missing = await m.resolveInstrumentSha(async () => { throw enoent; }, '/x');
  assert.match(missing.error, /^ENOENT: /);

  const denied = Object.assign(new Error("EACCES: permission denied, open '/x/case.yaml'"), { code: 'EACCES' });
  assert.match((await m.resolveInstrumentSha(async () => { throw denied; }, '/x')).error, /^EACCES: /);

  // A handle that returns a non-string is a bug, and says so rather than reading as ENOENT.
  assert.match((await m.resolveInstrumentSha(async () => undefined, '/x/suite')).error, /not a sha/);

  const check = m.checkReport(merged(), pre(), ctx({ instrumentSha: missing.sha, instrumentShaError: missing.error }));
  assert.ok(check.violations.some((v) => v.includes('ENOENT') && v.includes('no instrument digest was computed')),
    JSON.stringify(check.violations));
});

test('formatComparison prints the instrument the numbers were taken on', () => {
  assert.ok(m.formatComparison(merged()).includes(`**instrument** \`${INSTRUMENT.slice(0, 12)}\``));
});

test('formatComparison prints each condition\'s own digest beside the shared instrument', () => {
  const prov = { ...PROV, conditionShas: OWN_SHAS() };
  const text = m.formatComparison(m.mergeSweeps(sweeps(), pre(), structuredClone(prov)));
  assert.ok(text.includes(`**Conditions** treatment \`${OWN('treatment').slice(0, 12)}\``), text);
  assert.ok(text.includes(`placebo \`${OWN('placebo').slice(0, 12)}\``), text);
});

/* ── The split digest and the registered condition list ─────────────────────── */

test('I2b — editing one condition after its sweep refuses that sweep alone, by name', () => {
  const edited = { ...OWN_SHAS(), placebo: 'e'.repeat(64) };
  const check = m.checkReport(merged(), pre(), ctx({ conditionShas: edited }));
  assert.equal(check.ok, false);
  assert.equal(check.violations.length, 1, check.violations.join('\n'));
  assert.ok(check.violations[0].includes("re-run 'placebo' alone"), check.violations[0]);
});

test('I2b — records that predate the per-condition digest are refused', () => {
  const old = sweeps().map(({ conditionSha, ...s }) => s);
  refuses(merged(), pre(), ctx({ sweeps: old }), 'carries no conditionSha');
});

test('I2b — a merge with no per-condition digests refuses rather than vouching', () => {
  refuses(merged(), pre(), ctx({ conditionShas: undefined }), 'no per-condition digests were computed');
});

test('buildProvenance records each condition\'s own digest under its id', async () => {
  const p = await m.buildProvenance(revParse, digest, clock, sweeps(), pre(), '/x/P.md');
  assert.deepEqual(p.conditionShas, OWN_SHAS());
  const old = sweeps();
  delete old[1].conditionSha;
  assert.equal((await m.buildProvenance(revParse, digest, clock, old, pre(), '/x/P.md')).conditionShas.oneliner, '');
});

test('resolveConditionShas records a failure against its condition and still digests the rest', async () => {
  const gone = Object.assign(new Error("ENOENT: no such file or directory, scandir '/x/conditions/placebo'"), { code: 'ENOENT' });
  const r = await m.resolveConditionShas(
    async (dir, id) => { if (id === 'placebo') throw gone; return `${id}:${dir}`; },
    '/x', ['treatment', 'oneliner', 'placebo']);
  assert.deepEqual(r.shas, { treatment: 'treatment:/x', oneliner: 'oneliner:/x' });
  assert.match(r.errors.placebo, /^ENOENT: /);
  const check = m.checkReport(merged(), pre(), ctx({ conditionShas: r.shas, conditionShaErrors: r.errors }));
  assert.ok(check.violations.some((v) => v.includes('placebo: no digest of conditions/placebo') && v.includes('ENOENT')),
    JSON.stringify(check.violations));
});

test('parsePreRegistration accepts a fourth condition once every delta case has a direction against it', () => {
  const p = pre({
    conditions: [...PRE_CONDITIONS, 'treatment-no-triage'],
    expectedDirection: { ...PRE.expectedDirection, 'gate/treatment-no-triage': 0, 'triage/treatment-no-triage': 1 },
  });
  const md = PREREG_MD.replace(JSON.stringify(PRE, null, 2), JSON.stringify(p, null, 2));
  assert.deepEqual(m.parsePreRegistration(md).conditions, [...PRE_CONDITIONS, 'treatment-no-triage']);
});

test('parsePreRegistration refuses a condition added without a direction for every delta case', () => {
  const p = pre({
    conditions: [...PRE_CONDITIONS, 'treatment-no-triage'],
    expectedDirection: { ...PRE.expectedDirection, 'gate/treatment-no-triage': 0 },
  });
  const md = PREREG_MD.replace(JSON.stringify(PRE, null, 2), JSON.stringify(p, null, 2));
  throws(() => m.parsePreRegistration(md), 'no direction registered for triage/treatment-no-triage');
});

test('parsePreRegistration refuses `none` and malformed ids as conditions', () => {
  for (const id of ['none', 'Treatment', 'no_triage', '-x', '', 7]) {
    const p = pre({ conditions: [...PRE_CONDITIONS, id] });
    const md = PREREG_MD.replace(JSON.stringify(PRE, null, 2), JSON.stringify(p, null, 2));
    assert.throws(() => m.parsePreRegistration(md), m.MergeError, JSON.stringify(id));
  }
});

test('a fourth condition merges against the three with its own digest and no re-run', () => {
  const extra = 'treatment-no-triage';
  const p = pre({
    conditions: [...PRE_CONDITIONS, extra],
    expectedDirection: { ...PRE.expectedDirection, [`gate/${extra}`]: 0, [`triage/${extra}`]: 1 },
  });
  const s = [...sweeps(), sweep(extra, sweeps()[0].document)];
  const report = m.mergeSweeps(s, p, structuredClone(PROV));
  const check = m.checkReport(report, p, ctx({ sweeps: s, conditionShas: OWN_SHAS([...PRE_CONDITIONS, extra]) }));
  assert.deepEqual(check.violations, []);
  const gate = report.deltaRows.find((r) => r.case === 'gate');
  assert.ok(gate.contrasts.some((c) => c.control === extra), JSON.stringify(gate.contrasts));
  assert.ok(m.formatComparison(report).includes(`| ${extra} |`) || m.formatComparison(report).includes(extra));
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

// A5. The printed rule is the one a reader applies by hand, so it has to be the rule the
// code applies — tolerance and all. `markNoiseFloor` marks |Δ| <= floor + NOISE_EPSILON;
// the legend said "smaller than", which sends a reader to the opposite verdict on a
// contrast that ties the floor, and the real data has one (triage-decompose-epic/placebo,
// |Δ| 0.13 against a floor of 0.13, differing by one ulp). A legend that says a bare `<=`
// is closer but still not the rule: a reader who redoes the arithmetic lands on the ulp
// too. Legend, epsilon and note cell are all pinned here.
test('formatComparison states the noise-floor rule the code applies, epsilon included', () => {
  const text = m.formatComparison(merged());
  assert.ok(text.includes(`at or below this floor (|Δ| <= floor + ${inv.NOISE_EPSILON}) is not a finding`),
    'the printed rule must be at-or-below, and must print the tolerance the code uses');
  assert.ok(!/smaller than this is not a finding/.test(text),
    'the strict wording contradicts the mark the code puts beside it');
  assert.ok(text.includes('at or below the noise floor'),
    'the note cell must read as inclusive of a tie too');
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

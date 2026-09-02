/**
 * Adversarial tests for the invariant checks.
 *
 * A check that can false-positive erodes the law it enforces, so each invariant is
 * tested twice: once that it catches a real violation, and once that it REFUSES the
 * input which would let it pass without looking — almost always the empty set,
 * because every one of these rules is trivially true of nothing.
 *
 * `node --test scripts/test/*.test.mjs`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as inv from '../invariants.mjs';

const caught = (r, needle) => {
  assert.equal(r.ok, false, `expected a violation, got ok`);
  if (needle) assert.ok(r.violations.some((v) => v.includes(needle)),
    `violations ${JSON.stringify(r.violations)} do not mention ${needle}`);
};

/* ── I1 — completeness ─────────────────────────────────────────────────────── */

test('I1 rejects a partial run', () => {
  caught(inv.i1PublishableOnlyWhenComplete({ partial: true }), 'partial');
});

test('I1 accepts a complete run', () => {
  assert.equal(inv.i1PublishableOnlyWhenComplete({ partial: false }).ok, true);
});

test('I1 refuses a report with no partial field rather than reading it as complete', () => {
  caught(inv.i1PublishableOnlyWhenComplete({}), 'cannot establish');
});

/* ── I1b — noise floor marked, not suppressed ──────────────────────────────── */

const rowWith = (value, marked) => ({
  case: 'c', evidence: 'delta',
  contrasts: [{ treatment: 'treatment', control: 'none', value, expected: 1, belowNoiseFloor: marked }],
});

test('I1b catches a sub-noise contrast that is not marked', () => {
  caught(inv.i1bNoiseFloorMarked({ baselineSpread: 0.15, deltaRows: [rowWith(0.04, undefined)] }), 'belowNoiseFloor');
});

test('I1b passes a sub-noise contrast that IS marked — it is published, not suppressed', () => {
  assert.equal(inv.i1bNoiseFloorMarked({ baselineSpread: 0.15, deltaRows: [rowWith(0.04, true)] }).ok, true);
});

test('I1b refuses an empty delta set instead of passing vacuously', () => {
  caught(inv.i1bNoiseFloorMarked({ baselineSpread: 0.15, deltaRows: [] }), 'vacuous');
});

test('I1b refuses a report whose noise floor was never measured', () => {
  caught(inv.i1bNoiseFloorMarked({ deltaRows: [rowWith(0.04, false)] }), 'never measured');
});

/* ── I1b — the tie, and the ulp that used to decide it ─────────────────────── */

/** Mean of fifteen run scores, exactly as the merger takes it: sum, then divide. */
const mean15 = (ones) => Array.from({ length: 15 }, (_, i) => (i < ones ? 1 : 0))
  .reduce((a, b) => a + b, 0) / 15;

test('I1b treats a contrast that ties the floor as inside it, not above it', () => {
  // The published case. `triage-decompose-epic`/placebo: a treatment mean of 4/15 against
  // a placebo mean of 2/15 is a delta of 2/15, and the worst per-case baseline spread was
  // 2/15 as well — bit for bit. A strict `<` left it unmarked and it went out as a held
  // +0.13 prediction. The floor is the smallest difference this instrument can resolve,
  // so a difference equal to it resolves nothing.
  const delta = mean15(4) - mean15(2);
  const spread = mean15(4) - mean15(2);
  assert.equal(delta, spread, 'fixture must reproduce the bit-exact tie');
  caught(inv.i1bNoiseFloorMarked({ baselineSpread: spread, deltaRows: [rowWith(delta, undefined)] }),
    'belowNoiseFloor');
  assert.equal(inv.i1bNoiseFloorMarked({ baselineSpread: spread, deltaRows: [rowWith(delta, true)] }).ok, true);
});

test('I1b marks a contrast the floor loses to by one ulp — a different summation order', () => {
  // Same two mathematical quantities, 2/15 each, reached by different sums: the delta
  // from 4/15 − 2/15, the spread from 15/15 − 13/15. The second comes out one unit in the
  // last place SMALLER, so `<` said "above the floor" about a difference of 1.4e-17.
  const delta = mean15(4) - mean15(2);          // 0.13333333333333333
  const spread = mean15(15) - mean15(13);       // 0.1333333333333333
  assert.ok(delta > spread, 'fixture must reproduce the ulp gap');
  assert.ok(delta - spread < inv.NOISE_EPSILON, 'the gap must be inside the tolerance');
  caught(inv.i1bNoiseFloorMarked({ baselineSpread: spread, deltaRows: [rowWith(delta, undefined)] }),
    'belowNoiseFloor');
  assert.equal(inv.i1bNoiseFloorMarked({ baselineSpread: spread, deltaRows: [rowWith(delta, true)] }).ok, true);
});

test('I1b still lets a real contrast through — the epsilon is a tolerance, not an amnesty', () => {
  assert.equal(inv.i1bNoiseFloorMarked({ baselineSpread: 0.13, deltaRows: [rowWith(0.9, false)] }).ok, true);
});

/* ── I2b — one instrument, or no report ────────────────────────────────────── */

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const stamped = (condition, sha = SHA_A) => ({ condition, instrumentSha: sha });

test('I2b accepts sweeps, drift and the tree all naming one instrument', () => {
  const r = inv.i2bInstrumentAgreement(
    [stamped('treatment'), stamped('oneliner'), stamped('placebo')], { instrumentSha: SHA_A }, SHA_A);
  assert.deepEqual(r.violations, []);
  assert.equal(r.ok, true);
});

test('I2b refuses sweeps that predate the instrument digest, and names them', () => {
  // The exact set in the worktree: three results files written before the digest existed.
  const r = inv.i2bInstrumentAgreement(
    [{ condition: 'treatment' }, { condition: 'oneliner' }, { condition: 'placebo' }],
    { instrumentSha: SHA_A }, SHA_A);
  caught(r, 'predate the instrument digest');
  assert.ok(r.violations[0].includes('treatment'), r.violations[0]);
  assert.ok(r.violations[0].includes('placebo'), r.violations[0]);
});

test('I2b refuses a partly stamped set rather than merging the two that agree', () => {
  caught(inv.i2bInstrumentAgreement(
    [stamped('treatment'), stamped('oneliner'), { condition: 'placebo' }], { instrumentSha: SHA_A }, SHA_A),
  'placebo: sweep record carries no instrumentSha');
});

test('I2b refuses sweeps measured on different instruments and names both sides', () => {
  const r = inv.i2bInstrumentAgreement(
    [stamped('treatment', SHA_B), stamped('oneliner'), stamped('placebo')], { instrumentSha: SHA_A }, SHA_A);
  caught(r, 'different instruments');
  assert.ok(r.violations[0].includes('treatment=bbbbbbbbbbbb'), r.violations[0]);
  assert.ok(r.violations[0].includes('oneliner=aaaaaaaaaaaa'), r.violations[0]);
});

test('I2b refuses a drift record taken against a different instrument, and says which is which', () => {
  const r = inv.i2bInstrumentAgreement([stamped('treatment')], { instrumentSha: SHA_B }, SHA_A);
  caught(r, 'drift.json names instrument bbbbbbbbbbbb, the sweeps name aaaaaaaaaaaa');
});

test('I2b refuses a drift record with no instrumentSha rather than reading it as agreement', () => {
  caught(inv.i2bInstrumentAgreement([stamped('treatment')], { drifted: false }, SHA_A),
    'drift.json carries no instrumentSha');
});

test('I2b refuses results taken on an instrument the tree no longer holds', () => {
  // A grader rewritten between the sweep and the merge: the numbers describe a suite that
  // no longer exists. That is a changed instrument, which drift.json could never see —
  // not elapsed time, which nothing here sees either.
  const r = inv.i2bInstrumentAgreement([stamped('treatment')], { instrumentSha: SHA_A }, SHA_B);
  caught(r, 'the suite on disk is instrument bbbbbbbbbbbb, the sweeps measured aaaaaaaaaaaa');
});

test('I2b refuses a merge that never computed the current instrument', () => {
  caught(inv.i2bInstrumentAgreement([stamped('treatment')], { instrumentSha: SHA_A }, ''),
    'no instrument digest was computed at merge time');
});

test('I2b refuses an empty sweep list rather than passing vacuously', () => {
  caught(inv.i2bInstrumentAgreement([], { instrumentSha: SHA_A }, SHA_A), 'cannot be established');
  caught(inv.i2bInstrumentAgreement(undefined, { instrumentSha: SHA_A }, SHA_A), 'cannot be established');
});

test('I2b compares instruments, not times — sweeps taken weeks apart on one instrument merge', () => {
  // The narrower guarantee, pinned so nobody later reads I2b as a staleness guard, and so
  // nobody adds the elapsed-time rule it is repeatedly mistaken for. `startedAt` is not an
  // input to this check and is not compared anywhere else either.
  const r = inv.i2bInstrumentAgreement(
    [{ condition: 'treatment', instrumentSha: SHA_A, startedAt: '2026-08-01T00:00:00.000Z' },
      { condition: 'oneliner', instrumentSha: SHA_A, startedAt: '2026-09-14T00:00:00.000Z' },
      { condition: 'placebo', instrumentSha: SHA_A, startedAt: '2026-09-15T00:00:00.000Z' }],
    { instrumentSha: SHA_A, checkedAt: '2019-01-01T00:00:00.000Z' }, SHA_A);
  assert.deepEqual(r.violations, []);
});

test('I2b names why the digest is missing, because the remedies differ', () => {
  // "No digest was computed" reads the same for a suite directory that is not there, a
  // file this process may not read, and a bug in the digest — and those are three
  // different next steps for whoever is running the merge.
  caught(inv.i2bInstrumentAgreement([stamped('treatment')], { instrumentSha: SHA_A }, '',
    "ENOENT: no such file or directory, scandir '/x/suite'"), 'ENOENT: no such file or directory');
  caught(inv.i2bInstrumentAgreement([stamped('treatment')], { instrumentSha: SHA_A }, '',
    "EACCES: permission denied, open '/x/suite/case.yaml'"), 'EACCES: permission denied');
  // Still says the plain thing when nothing explained itself.
  caught(inv.i2bInstrumentAgreement([stamped('treatment')], { instrumentSha: SHA_A }, ''),
    'no instrument digest was computed at merge time');
});

/* ── I4b — every registered case measured, where it was registered ─────────── */

const spec = (name, over = {}) => ({
  name, evidence: 'delta', ablation: 'with-without', tags: ['core'], scored: true, measures: '', ...over,
});
const sweptCase = (name, withRuns = [{ score: 1 }]) => ({ name, arms: { with: withRuns, without: [{ score: 0 }] } });
const sweepOf = (condition, cases, ablations) => ({
  condition, document: { cases }, ...(ablations ? { ablations } : {}),
});

test('I4b accepts three sweeps that measured every registered case where it was registered', () => {
  const specs = [spec('gate'), spec('markers', { evidence: 'capability', ablation: 'none' })];
  const ablations = { gate: 'with-without', markers: 'none' };
  const sweeps = ['treatment', 'oneliner', 'placebo'].map((c) =>
    sweepOf(c, [sweptCase('gate'), sweptCase('markers')], ablations));
  assert.deepEqual(inv.i4bEveryScoredCaseMeasured(sweeps, specs).violations, []);
});

test('I4b catches a registered scored case that one sweep does not contain, and names both', () => {
  const specs = [spec('gate'), spec('triage')];
  const sweeps = [sweepOf('treatment', [sweptCase('gate'), sweptCase('triage')]),
    sweepOf('placebo', [sweptCase('gate')])];
  caught(inv.i4bEveryScoredCaseMeasured(sweeps, specs),
    "triage: registered and scored, but the 'placebo' sweep does not contain it");
});

test('I4b catches a case present with an empty run list — an absent measurement, not a zero', () => {
  const specs = [spec('gate')];
  caught(inv.i4bEveryScoredCaseMeasured([sweepOf('oneliner', [sweptCase('gate', [])])], specs),
    "gate: present in the 'oneliner' sweep with an empty run list");
});

test('I4b catches a case swept at an ablation nobody registered, and names both values', () => {
  // step3: registered `none` because a replayed transcript carries the plugin into both
  // arms, swept with-without anyway. `document.suite.ablation` can name only one ablation
  // for the whole invocation, so the per-case map on the envelope is the only witness.
  const specs = [spec('markers', { evidence: 'capability', ablation: 'none' })];
  caught(inv.i4bEveryScoredCaseMeasured(
    [sweepOf('treatment', [sweptCase('markers')], { markers: 'with-without' })], specs),
  "markers: registered ablation 'none', but the 'treatment' sweep ran it at 'with-without'");
});

test('I4b leaves control-tagged and unscored cases alone — they never enter the comparison', () => {
  const specs = [spec('gate'), spec('ctl', { evidence: 'capability', ablation: 'none', tags: ['control'], scored: false })];
  assert.deepEqual(inv.i4bEveryScoredCaseMeasured(
    [sweepOf('treatment', [sweptCase('gate')], { gate: 'with-without' })], specs).violations, []);
});

test('I4b refuses an empty sweep list and an empty registration rather than passing vacuously', () => {
  caught(inv.i4bEveryScoredCaseMeasured([], [spec('gate')]), 'cannot be established');
  caught(inv.i4bEveryScoredCaseMeasured([sweepOf('treatment', [sweptCase('gate')])], []), 'vacuous');
  caught(inv.i4bEveryScoredCaseMeasured([sweepOf('treatment', [sweptCase('gate')])],
    [spec('ctl', { tags: ['control'], scored: false })]), 'vacuous');
});

/* ── I1c — failed runs are not low scores ──────────────────────────────────── */

const runOk = (score) => ({ score, error: null, graders: [{ name: 'g', passed: score > 0 }] });
/** A SETUP failure: no graders at all. */
const runErr = (why) => ({ score: 0, error: why, graders: [] });
/** Ran out of turns, but was graded on what it produced — a real measurement. */
const runCapped = (score) => ({ score, error: 'exit 1: (no stderr)', graders: [{ name: 'g', passed: false }] });
const caseWith = (name, withRuns, withoutRuns) => ({ name, arms: { with: withRuns, without: withoutRuns } });

test('I1c accepts a document whose runs all completed', () => {
  const doc = { cases: [caseWith('a', [runOk(1), runOk(0.8)], [runOk(0.4), runOk(0.4)])] };
  assert.equal(inv.i1cNoFailedRuns(doc, 2).ok, true);
});

test('I1c catches the auth expiry that `partial: false` hid', () => {
  // The real shape: a sweep lost its OAuth session partway and 28 of 43 runs failed,
  // every one scoring 0, in a document the harness marked complete.
  const doc = { cases: [caseWith('a', [runOk(1), runErr('Failed to authenticate: OAuth session expired')], [runOk(0.4), runOk(0.4)])] };
  caught(inv.i1cNoFailedRuns(doc, 2), 'produced no graders');
});

test('I1c catches a grader that threw — a broken instrument is not a verdict', () => {
  // How the auth expiry actually presented: the run WAS graded, but one grader carried
  // `grader threw: judge call failed: Failed to authenticate`. It counts as a failure
  // in the harness's arithmetic, so it depresses the score having measured nothing.
  const doc = { cases: [{ name: 'a', arms: { with: [
    { score: 0, error: null, graders: [
      { name: 'ok', passed: true, explanation: 'matched TODO' },
      { name: 'rubric', passed: false, explanation: 'grader threw: judge call failed: Failed to authenticate' },
    ] },
    runOk(1),
  ], without: [runOk(0.4), runOk(0.4)] } }] };
  caught(inv.i1cNoFailedRuns(doc, 2), 'threw instead of judging');
});

test('I1c accepts a turn-capped run — it was graded, so it measured something', () => {
  // harness-facts #9: a run that started and ended badly is still graded on what it
  // produced. Refusing those threw away four legitimate runs, one of which had placed
  // its markers correctly in both files.
  const doc = { cases: [caseWith('a', [runOk(1), runCapped(0.67)], [runOk(0.4), runCapped(0)])] };
  assert.equal(inv.i1cNoFailedRuns(doc, 2).ok, true);
});

test('I1c catches a truncated sweep, which has no error to show at all', () => {
  const doc = { cases: [caseWith('a', [runOk(1)], [])] };
  const r = inv.i1cNoFailedRuns(doc, 5);
  caught(r, 'truncated');
  assert.equal(r.violations.length, 2, 'both arms are short, and both are named');
});

test('I1c refuses an empty document rather than passing vacuously', () => {
  caught(inv.i1cNoFailedRuns({ cases: [] }, 5), 'measured nothing');
});

test('I1c refuses to judge completeness with no registered run count', () => {
  const doc = { cases: [caseWith('a', [runOk(1)], [runOk(1)])] };
  caught(inv.i1cNoFailedRuns(doc, undefined), 'cannot be established');
});

/* ── I2 — voiding ──────────────────────────────────────────────────────────── */

const prov = (o = {}) => ({
  provenance: { preRegistrationSha: 'aaa', subjectModel: 'sonnet', claudeVersion: '2.1.245', ...o },
});
const registered = { preRegistrationSha: 'aaa', subjectModel: 'sonnet', claudeVersion: '2.1.245' };
const noDrift = { drifted: false, reason: '' };

test('I2 accepts a clean run', () => {
  assert.equal(inv.i2RunNotVoid(prov(), registered, noDrift, false).ok, true);
});

test('I2 voids on drift, model change, version change and a dirty pre-registration', () => {
  caught(inv.i2RunNotVoid(prov(), registered, { drifted: true, reason: 'x' }, false), 'drifted');
  caught(inv.i2RunNotVoid(prov({ subjectModel: 'opus' }), registered, noDrift, false), 'subject model');
  caught(inv.i2RunNotVoid(prov({ claudeVersion: '2.2.0' }), registered, noDrift, false), 'CLI series');
  caught(inv.i2RunNotVoid(prov(), registered, noDrift, true), 'dirty');
});

test('I2 refuses a report with no provenance rather than treating it as clean', () => {
  caught(inv.i2RunNotVoid({}, registered, noDrift, false), 'no provenance');
});

test('I2 tolerates patch drift — patches ship faster than any suite can re-verify', () => {
  assert.equal(inv.i2RunNotVoid(prov({ claudeVersion: '2.1.251' }), registered, noDrift, false).ok, true);
  assert.equal(inv.i2RunNotVoid(prov({ claudeVersion: '2.1.9' }), registered, noDrift, false).ok, true);
});

test('I2 still voids on a minor or major bump', () => {
  caught(inv.i2RunNotVoid(prov({ claudeVersion: '2.2.0' }), registered, noDrift, false), 'CLI series');
  caught(inv.i2RunNotVoid(prov({ claudeVersion: '3.1.250' }), registered, noDrift, false), 'CLI series');
});

test('I2 refuses a missing version rather than reading absence as agreement', () => {
  caught(inv.i2RunNotVoid(prov({ claudeVersion: undefined }), registered, noDrift, false), 'missing on one side');
});

test('I2 voids when the merged sweeps ran on different CLIs — that is not a contrast', () => {
  caught(inv.i2RunNotVoid(prov(), registered, noDrift, false, ['2.1.250', '2.1.250', '2.1.251']),
    'different CLIs');
});

test('I2 accepts sweeps that agree, even on a patch the pin does not name', () => {
  assert.equal(inv.i2RunNotVoid(prov({ claudeVersion: '2.1.251' }), registered, noDrift, false,
    ['2.1.251', '2.1.251', '2.1.251']).ok, true);
});

test('I2 refuses an empty sweep-version list rather than passing vacuously', () => {
  caught(inv.i2RunNotVoid(prov(), registered, noDrift, false, []), 'cannot be established');
});

test('I2 refuses to compare against a missing registered digest', () => {
  caught(inv.i2RunNotVoid(prov(), { subjectModel: 'sonnet', claudeVersion: '2.1.245' }, noDrift, false), 'no registered');
});

/* ── I3 — claim ceiling tripwire ───────────────────────────────────────────── */

const CEILING = 'the agent produces one step artifact and stops';
const clean = { claimsSectionChanged: false, preRegistrationShaChanged: false };

test('I3 accepts a README carrying the ceiling verbatim, whitespace-insensitively', () => {
  assert.equal(inv.i3ClaimCeilingIntact(`# R\n\nthe agent produces one\nstep artifact and stops.`, CEILING, clean).ok, true);
});

test('I3 catches a missing ceiling and an unregistered claims edit', () => {
  caught(inv.i3ClaimCeilingIntact('# R\n\nit makes software better.', CEILING, clean), 'not present verbatim');
  caught(inv.i3ClaimCeilingIntact(`x ${CEILING} y`, CEILING,
    { claimsSectionChanged: true, preRegistrationShaChanged: false }), 'without a corresponding');
});

test('I3 refuses a missing README rather than passing on nothing', () => {
  caught(inv.i3ClaimCeilingIntact('', CEILING, clean), 'README missing');
});

test('I3 refuses an empty ceiling — enforcing nothing is not enforcement', () => {
  caught(inv.i3ClaimCeilingIntact('# R', '   ', clean), 'nothing to enforce');
});

/* ── I4 — evidence kinds never mixed ───────────────────────────────────────── */

const d = { case: 'a', evidence: 'delta', contrasts: [] };
const c = { case: 'b', evidence: 'capability', contrasts: [] };

test('I4 accepts a correctly split report', () => {
  assert.equal(inv.i4EvidenceKindsNeverMixed({ deltaRows: [d], capabilityRows: [c] }, 1, 1).ok, true);
});

test('I4 catches a capability row in deltaRows, and a combined mean', () => {
  caught(inv.i4EvidenceKindsNeverMixed({ deltaRows: [d, c], capabilityRows: [] }, 2, 0), "evidence 'capability' in deltaRows");
  caught(inv.i4EvidenceKindsNeverMixed({ deltaRows: [d], capabilityRows: [c], overallScore: 0.78 }, 1, 1), 'combined mean');
});

test('I4 refuses an empty report instead of passing vacuously', () => {
  caught(inv.i4EvidenceKindsNeverMixed({ deltaRows: [], capabilityRows: [] }, 1, 1), 'expected 1 delta rows');
});

/* ── I5 — complete probes ──────────────────────────────────────────────────── */

const probe = (id, mm, mnm) => ({ graderId: id, pattern: 'x', flags: '', mustMatch: mm, mustNotMatch: mnm });

test('I5 accepts a grader with both halves', () => {
  assert.equal(inv.i5GradersHaveCompleteProbes([probe('g', ['y'], ['n'])], ['g']).ok, true);
});

test('I5 rejects a probe with no mustNotMatch — the half that catches over-matching', () => {
  caught(inv.i5GradersHaveCompleteProbes([probe('g', ['y'], [])], ['g']), 'no mustNotMatch');
});

test('I5 rejects a grader with no probes at all', () => {
  caught(inv.i5GradersHaveCompleteProbes([], ['g']), 'no probes');
});

test('I5 refuses an empty grader list rather than reporting all graders covered', () => {
  caught(inv.i5GradersHaveCompleteProbes([], []), 'vacuous');
});

/* ── I6 — absence claims need content evidence ─────────────────────────────── */

const toolOnly = { name: 'x', graders: [{ type: 'tool_used', tool: 'Edit' }, { type: 'tool_used', tool: 'Write' }] };
const withContent = { name: 'x', graders: [...toolOnly.graders, { type: 'regex', target: { source: 'file', path: 'f' } }] };

test('I6 catches the exact configuration recon proved unsound', () => {
  caught(inv.i6AbsenceClaimsHaveContentEvidence([toolOnly], ['x']), 'tool-name graders alone');
});

test('I6 accepts an absence case backed by a content grader', () => {
  assert.equal(inv.i6AbsenceClaimsHaveContentEvidence([withContent], ['x']).ok, true);
});

test('I6 accepts an llm grader scoped to a file — it names its target `focus`, not `target`', () => {
  const llmScoped = { name: 'x', graders: [...toolOnly.graders, { type: 'llm', focus: { source: 'file', path: 'f' } }] };
  assert.equal(inv.i6AbsenceClaimsHaveContentEvidence([llmScoped], ['x']).ok, true);
});

test('I6 still rejects an llm grader that is not file-scoped', () => {
  const llmLastMessage = { name: 'x', graders: [...toolOnly.graders, { type: 'llm', focus: 'last_message' }] };
  caught(inv.i6AbsenceClaimsHaveContentEvidence([llmLastMessage], ['x']), 'tool-name graders alone');
});

test('I6 refuses an empty absence-case list rather than passing vacuously', () => {
  caught(inv.i6AbsenceClaimsHaveContentEvidence([withContent], []), 'vacuous');
});

test('I6 catches a named absence case that does not exist', () => {
  caught(inv.i6AbsenceClaimsHaveContentEvidence([], ['x']), 'case not found');
});

/* ── I7 — control containment ──────────────────────────────────────────────── */

const specs = [
  { name: 'ctl', tags: ['control'], evidence: 'delta', ablation: 'none', scored: false, measures: '' },
  { name: 'a', tags: ['core'], evidence: 'delta', ablation: 'with-without', scored: true, measures: '' },
];

test('I7 accepts a report with no control row', () => {
  assert.equal(inv.i7ControlNeverInHeadline({ deltaRows: [{ case: 'a' }], capabilityRows: [] }, specs).ok, true);
});

test('I7 catches a control case that leaked into a scored table', () => {
  caught(inv.i7ControlNeverInHeadline({ deltaRows: [{ case: 'ctl' }], capabilityRows: [] }, specs), 'control-tagged');
});

test('I7 refuses an empty spec list rather than finding no control to leak', () => {
  caught(inv.i7ControlNeverInHeadline({ deltaRows: [{ case: 'ctl' }] }, []), 'vacuous');
});

test('I7 flags a suite whose control case is missing or mistagged', () => {
  caught(inv.i7ControlNeverInHeadline({ deltaRows: [] }, [specs[1]]), 'missing or mistagged');
});

/* ── I8 — pre-registration frozen ──────────────────────────────────────────── */

test('I8 accepts matching digests on a clean tree', () => {
  assert.equal(inv.i8PreRegistrationFrozen('aaa', 'aaa', false).ok, true);
});

test('I8 catches a changed pre-registration and a dirty tree', () => {
  caught(inv.i8PreRegistrationFrozen('aaa', 'bbb', false), 'changed');
  caught(inv.i8PreRegistrationFrozen('aaa', 'aaa', true), 'dirty');
});

test('I8 refuses a missing digest rather than treating absence as agreement', () => {
  caught(inv.i8PreRegistrationFrozen('', 'aaa', false), 'missing');
  caught(inv.i8PreRegistrationFrozen('aaa', '', false), 'missing');
});

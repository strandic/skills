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

/* ── I1c — failed runs are not low scores ──────────────────────────────────── */

const runOk = (score) => ({ score, error: null });
const runErr = (why) => ({ score: 0, error: why });
const caseWith = (name, withRuns, withoutRuns) => ({ name, arms: { with: withRuns, without: withoutRuns } });

test('I1c accepts a document whose runs all completed', () => {
  const doc = { cases: [caseWith('a', [runOk(1), runOk(0.8)], [runOk(0.4), runOk(0.4)])] };
  assert.equal(inv.i1cNoFailedRuns(doc, 2).ok, true);
});

test('I1c catches the auth expiry that `partial: false` hid', () => {
  // The real shape: a sweep lost its OAuth session partway and 28 of 43 runs failed,
  // every one scoring 0, in a document the harness marked complete.
  const doc = { cases: [caseWith('a', [runOk(1), runErr('Failed to authenticate: OAuth session expired')], [runOk(0.4), runOk(0.4)])] };
  caught(inv.i1cNoFailedRuns(doc, 2), 'runs errored');
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

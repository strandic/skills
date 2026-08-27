/**
 * The suite's invariants, as checks.
 *
 * Rules authored by the repo owner; this file only wires and enforces them. Their
 * statements and the reasoning live in docs/plans/primer-evals/5-invariants.md.
 *
 * Every check returns `{ ok, violations }` — never a bare boolean, so a failure can
 * name what broke.
 *
 * ── The failure mode every check here is built against ──────────────────────────
 * These are all "nothing violates X" rules, and every one of them is TRUE OF AN
 * EMPTY SET. A check that finds no graders reports that all graders have probes; a
 * check that finds no delta rows reports that no control leaked into them. That is
 * the same defect recon found in the tool-name absence graders: a check reporting
 * clean because it could not see. So each check pairs its rule with a
 * non-emptiness assertion, and `expected` counts are passed in by the caller rather
 * than derived from the same data being judged.
 */

/** @import { MergedReport, GraderProbe, CaseSpec } from './types.mjs' */

const fail = (violations) => ({ ok: violations.length === 0, violations });

/**
 * I1 — a partial run is not publishable.
 * @param {MergedReport} report
 */
export function i1PublishableOnlyWhenComplete(report) {
  const v = [];
  if (report?.partial === undefined) v.push('report has no `partial` field — cannot establish completeness');
  else if (report.partial === true) v.push('run is partial; not publishable');
  return fail(v);
}

/**
 * I1b — a contrast below the noise floor is published, but must be marked.
 * Suppressing it would be publication bias; publishing it unmarked would be worse.
 * @param {MergedReport} report
 */
export function i1bNoiseFloorMarked(report) {
  const v = [];
  const spread = report?.baselineSpread;
  if (typeof spread !== 'number') return fail(['no baselineSpread — the noise floor was never measured']);
  const rows = report.deltaRows ?? [];
  if (rows.length === 0) v.push('no delta rows to check — vacuous pass refused');
  for (const row of rows)
    for (const c of row.contrasts ?? [])
      if (Math.abs(c.value) < spread && c.belowNoiseFloor !== true)
        v.push(`${row.case}/${c.control}: |${c.value}| < spread ${spread} but not marked belowNoiseFloor`);
  return fail(v);
}

/**
 * I2 — a run is void on any of: dirty or mismatched pre-registration, drifted
 * treatment condition, subject model or CLI version differing from what was
 * pre-registered.
 * @param {MergedReport} report
 * @param {{preRegistrationSha: string, subjectModel: string, claudeVersion: string}} registered
 * @param {{drifted: boolean, reason: string}} drift
 * @param {boolean} preRegistrationDirty
 */
export function i2RunNotVoid(report, registered, drift, preRegistrationDirty) {
  const v = [];
  const p = report?.provenance;
  if (!p) return fail(['report has no provenance — voidness cannot be established']);
  if (preRegistrationDirty) v.push('pre-registration is dirty in the working tree');
  if (!registered?.preRegistrationSha) v.push('no registered pre-registration digest to compare against');
  else if (p.preRegistrationSha !== registered.preRegistrationSha)
    v.push(`pre-registration digest ${p.preRegistrationSha} != registered ${registered.preRegistrationSha}`);
  if (drift?.drifted) v.push(`treatment condition has drifted: ${drift.reason}`);
  if (p.subjectModel !== registered?.subjectModel)
    v.push(`subject model ${p.subjectModel} != pre-registered ${registered?.subjectModel}`);
  if (p.claudeVersion !== registered?.claudeVersion)
    v.push(`CLI version ${p.claudeVersion} != pre-registered ${registered?.claudeVersion}`);
  return fail(v);
}

/**
 * I3 — the claim ceiling is a hard rule. No code can judge whether prose
 * overclaims, so this is a tripwire, not a judge: the ceiling sentence must be
 * present verbatim, and the claims section may not change while the
 * pre-registration digest stays the same.
 * @param {string} readmeText
 * @param {string} ceilingSentence
 * @param {{claimsSectionChanged: boolean, preRegistrationShaChanged: boolean}} diff
 */
export function i3ClaimCeilingIntact(readmeText, ceilingSentence, diff) {
  const v = [];
  if (!ceilingSentence?.trim()) return fail(['no ceiling sentence supplied — nothing to enforce']);
  if (typeof readmeText !== 'string' || readmeText.length === 0) return fail(['README missing or empty']);
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  if (!norm(readmeText).includes(norm(ceilingSentence)))
    v.push('claim-ceiling sentence is not present verbatim in the README');
  if (diff?.claimsSectionChanged && !diff?.preRegistrationShaChanged)
    v.push('claims section changed without a corresponding pre-registration change');
  return fail(v);
}

/**
 * I4 — delta and capability evidence never mix, and no combined mean is emitted.
 * @param {MergedReport} report
 * @param {number} expectedDeltaRows
 * @param {number} expectedCapabilityRows
 */
export function i4EvidenceKindsNeverMixed(report, expectedDeltaRows, expectedCapabilityRows) {
  const v = [];
  const d = report?.deltaRows, c = report?.capabilityRows;
  if (!Array.isArray(d) || !Array.isArray(c)) return fail(['report is missing deltaRows or capabilityRows']);
  if (d.length !== expectedDeltaRows) v.push(`expected ${expectedDeltaRows} delta rows, found ${d.length}`);
  if (c.length !== expectedCapabilityRows) v.push(`expected ${expectedCapabilityRows} capability rows, found ${c.length}`);
  for (const r of d) if (r.evidence !== 'delta') v.push(`${r.case}: evidence '${r.evidence}' in deltaRows`);
  for (const r of c) if (r.evidence !== 'capability') v.push(`${r.case}: evidence '${r.evidence}' in capabilityRows`);
  for (const r of c) if ((r.contrasts ?? []).length > 0) v.push(`${r.case}: capability row carries contrasts`);
  if (report.overallScore !== undefined) v.push('report emits a combined mean across both evidence kinds');
  return fail(v);
}

/**
 * I5 — a grader may not ship without complete probes: at least one must-match AND
 * at least one must-not-match. The second half is what catches an over-broad
 * grader, which fails silently and in the flattering direction.
 * @param {GraderProbe[]} probes
 * @param {string[]} graderIds  every grader the suite defines
 */
export function i5GradersHaveCompleteProbes(probes, graderIds) {
  const v = [];
  if (!Array.isArray(graderIds) || graderIds.length === 0)
    return fail(['no graders discovered — vacuous pass refused']);
  const byId = new Map((probes ?? []).map((p) => [p.graderId, p]));
  for (const id of graderIds) {
    const p = byId.get(id);
    if (!p) { v.push(`${id}: no probes`); continue; }
    if ((p.mustMatch ?? []).length === 0) v.push(`${id}: no mustMatch samples`);
    if ((p.mustNotMatch ?? []).length === 0) v.push(`${id}: no mustNotMatch samples`);
  }
  return fail(v);
}

/**
 * I6 — an absence claim needs content evidence. Tool-name graders alone are not
 * sufficient: recon demonstrated a run scoring clean on `Edit called 0x` and
 * `Write called 0x` over a file a Bash one-liner had rewritten.
 * @param {{name: string, graders: {type: string, tool?: string, target?: any}[]}[]} cases
 * @param {string[]} absenceCaseNames  cases that make an absence claim
 */
export function i6AbsenceClaimsHaveContentEvidence(cases, absenceCaseNames) {
  const v = [];
  if (!Array.isArray(absenceCaseNames) || absenceCaseNames.length === 0)
    return fail(['no absence cases named — vacuous pass refused']);
  const byName = new Map((cases ?? []).map((c) => [c.name, c]));
  for (const name of absenceCaseNames) {
    const c = byName.get(name);
    if (!c) { v.push(`${name}: case not found`); continue; }
    const hasContent = (c.graders ?? []).some(
      (g) => (g.type === 'regex' || g.type === 'llm') && g.target && typeof g.target === 'object' && g.target.source === 'file'
    );
    if (!hasContent) v.push(`${name}: absence claim rests on tool-name graders alone`);
  }
  return fail(v);
}

/**
 * I7 — a control-tagged case never reaches a headline number.
 * @param {MergedReport} report
 * @param {CaseSpec[]} specs
 */
export function i7ControlNeverInHeadline(report, specs) {
  const v = [];
  if (!Array.isArray(specs) || specs.length === 0) return fail(['no case specs — vacuous pass refused']);
  const control = new Set(specs.filter((s) => (s.tags ?? []).includes('control')).map((s) => s.name));
  if (control.size === 0) v.push('no control-tagged case found — the diagnostic is missing or mistagged');
  for (const r of [...(report?.deltaRows ?? []), ...(report?.capabilityRows ?? [])])
    if (control.has(r.case)) v.push(`${r.case} is control-tagged but appears in a scored table`);
  return fail(v);
}

/**
 * I8 — expected direction cannot be set or changed once numbers exist.
 * @param {string} committedSha  digest of the pre-registration as committed
 * @param {string} reportSha     digest recorded in the report
 * @param {boolean} dirty
 */
export function i8PreRegistrationFrozen(committedSha, reportSha, dirty) {
  const v = [];
  if (!committedSha || !reportSha) return fail(['a pre-registration digest is missing on one side']);
  if (dirty) v.push('pre-registration is dirty — its digest names a state no reader can check out');
  if (committedSha !== reportSha) v.push(`pre-registration changed: report ${reportSha} != committed ${committedSha}`);
  return fail(v);
}

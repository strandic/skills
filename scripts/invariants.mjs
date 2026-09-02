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
 * The tolerance on every noise-floor comparison, defined once and used by both sides of
 * it — {@link i1bNoiseFloorMarked} here and `markNoiseFloor` in `merge-results.mjs`.
 *
 * Why it has to exist: a contrast and the floor it is measured against are two means of
 * the same fifteenths, summed in different orders, so a mathematical tie lands one unit
 * in the last place either side of the other. `triage-decompose-epic`/placebo came out
 * 2/15 against a floor of 2/15 and a strict `<` published it as a held prediction. A
 * contrast that TIES the floor is inside it, not above it: the floor is the smallest
 * difference this instrument can resolve, and a difference equal to it resolves nothing.
 */
export const NOISE_EPSILON = 1e-9;

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
 * I1b — a contrast at or below the noise floor is published, but must be marked.
 * Suppressing it would be publication bias; publishing it unmarked would be worse.
 *
 * The comparison is `<= spread + NOISE_EPSILON`, not `<`: see {@link NOISE_EPSILON}.
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
      if (Math.abs(c.value) <= spread + NOISE_EPSILON && c.belowNoiseFloor !== true)
        v.push(`${row.case}/${c.control}: |${c.value}| <= spread ${spread} but not marked belowNoiseFloor`);
  return fail(v);
}

/**
 * I1c — a document carrying failed runs is not publishable, whatever `partial` says.
 *
 * **Why this is separate from I1.** The harness sets `partial` for a cost ceiling, an
 * interrupt, or an auth rejection at the *first* run — not for runs that fail partway
 * through. A treatment sweep here lost its OAuth session mid-run: 28 of 43 runs failed
 * to authenticate, every one of them scoring 0, and the document came back
 * `partial: false`. I1 passed it. Those zeros would have dragged the treatment down and
 * manufactured a delta out of an expired token.
 *
 * A failed run is not a low score. It is the absence of a measurement wearing one, and
 * that is the shape this whole suite exists to refuse.
 *
 * **But `error` alone is the wrong test, and the first version of this got it wrong.**
 * `harness-facts.md` #9 already recorded the distinction: a run that started and ended
 * badly — timed out, hit the turn cap, overflowed its output — is STILL GRADED on what
 * it produced, and that is a real measurement of an agent running out of room. Only a
 * SETUP failure (auth rejected, scaffold failed, a bad env key) yields no graders at
 * all. The first draft refused any non-null `error` and so refused four turn-capped
 * runs that had graded cleanly, including one that placed its markers correctly in both
 * files and scored 0.67.
 *
 * Two things are refused, and neither is "the run errored":
 *
 * - **A run that produced no graders.** A setup failure yields none, so there is
 *   nothing to score and the 0 is empty.
 * - **A grader that THREW rather than judged.** `grader threw: judge call failed: …`
 *   is an instrument that broke, not a verdict — the auth expiry showed up exactly
 *   this way, with the run graded and one grader's explanation carrying the failure.
 *   A thrown grader counts as failed in the harness's arithmetic, so it silently
 *   depresses a score with something that never measured anything.
 *
 * A turn-capped run passes both tests: it has graders, and every one of them judged.
 *
 * @param {MergedReport|{cases: {arms: Record<string, {error: string|null, score: number}[]>}[]}} doc
 * @param {number} expectedRunsPerArm  from the pre-registration — a document that is
 *   simply SHORT is caught here too, since a truncated sweep has no `error` to show
 */
export function i1cNoFailedRuns(doc, expectedRunsPerArm) {
  const v = [];
  const cases = doc?.cases;
  if (!Array.isArray(cases) || cases.length === 0)
    return fail(['no cases in the document — a sweep that measured nothing is not a result']);
  if (!Number.isInteger(expectedRunsPerArm) || expectedRunsPerArm < 1)
    return fail(['no expected run count supplied — completeness cannot be established']);

  for (const c of cases) {
    for (const [arm, runs] of Object.entries(c.arms ?? {})) {
      if (!Array.isArray(runs)) { v.push(`${c.name}/${arm}: no runs array`); continue; }
      // Ungraded, not merely errored: a setup failure produces no graders, while a
      // turn-capped or timed-out run is graded on what it managed and counts.
      const ungraded = runs.filter((r) => !Array.isArray(r?.graders) || r.graders.length === 0);
      if (ungraded.length)
        v.push(`${c.name}/${arm}: ${ungraded.length}/${runs.length} runs produced no graders ` +
          `(first: ${String(ungraded[0]?.error ?? 'no error recorded').slice(0, 80)}) — ` +
          'a setup failure scores 0 without measuring anything');

      const threw = runs.flatMap((r, i) => (r?.graders ?? [])
        .filter((g) => /grader threw|judge call failed/i.test(String(g?.explanation ?? '')))
        .map((g) => `run ${i + 1} grader ${g.name}`));
      if (threw.length)
        v.push(`${c.name}/${arm}: ${threw.length} grader(s) threw instead of judging ` +
          `(${threw[0]}) — a broken instrument counts as a failure and depresses the score`);
      if (runs.length < expectedRunsPerArm)
        v.push(`${c.name}/${arm}: ${runs.length} runs, ${expectedRunsPerArm} registered — ` +
          'the sweep was truncated');
    }
  }
  return fail(v);
}

/**
 * I2 — a run is void on any of: dirty or mismatched pre-registration, drifted
 * treatment condition, a subject model that is not the pre-registered one, a CLI
 * whose MAJOR.MINOR differs from the pre-registered one, or sweeps that disagree
 * with each other about which CLI ran them.
 *
 * **Why the CLI check is major.minor and not exact.** Patches ship faster than any
 * suite can re-verify — four landed under this project in a week — and voiding a run
 * for a patch bump means the pin is stale before it is used. That is the argument for
 * relaxing it, and it is a practical one, not an evidential one: every breaking change
 * observed here arrived in a patch (2.1.246 re-encoded the bundled reference and killed
 * eleven citations; 2.1.251 changed the plugin-path rule, refused Bash-granting runs on
 * this machine, and compressed the reference again). A major.minor rule would have
 * caught none of them.
 *
 * What makes the relaxation safe is that this was solving the weaker problem.
 * Comparability *over time* is what the pin protects; comparability *between the sweeps
 * being merged* is what the headline actually rests on, and nothing was checking it.
 * Three sweeps on one patch are comparable to each other whatever the pin says — and
 * three sweeps that straddle an upgrade are not comparable at all, however well they
 * match the pin. So the exact-version check is replaced by a cross-sweep agreement
 * check, which is strictly stronger for the claim being made.
 *
 * Breakage is caught by running rather than by predicting: the smoke pass costs cents
 * and fails loudly, which is how all four of those patches were found.
 *
 * **What the drift argument here does NOT establish.** `drift` says the generated
 * treatment mirror matched its source SKILL.md at the moment the check ran. It says
 * nothing about the graders, the fixture, the replayed transcripts or the other two
 * conditions, and nothing at all about WHEN the sweeps being merged were taken — the
 * record is rewritten by every invocation. A treatment measured weeks ago against
 * different graders passes this check. {@link i2bInstrumentAgreement} catches the
 * different graders — it compares instrument digests — but not the weeks: nothing here
 * compares timestamps. Do not read a clean `drift` as a claim of comparability.
 *
 * @param {MergedReport} report
 * @param {{preRegistrationSha: string, subjectModel: string, claudeVersion: string}} registered
 * @param {{drifted: boolean, reason: string}} drift
 * @param {boolean} preRegistrationDirty
 * @param {string[]} [sweepVersions]  claudeVersion from each merged sweep document
 */
export function i2RunNotVoid(report, registered, drift, preRegistrationDirty, sweepVersions) {
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
  const series = (s) => (typeof s === 'string' ? s.split('.').slice(0, 2).join('.') : '');
  if (!series(p.claudeVersion) || !series(registered?.claudeVersion))
    v.push('a CLI version is missing on one side — comparability cannot be established');
  else if (series(p.claudeVersion) !== series(registered.claudeVersion))
    v.push(`CLI series ${series(p.claudeVersion)} != pre-registered ` +
      `${series(registered.claudeVersion)} (patch drift is tolerated; this is not patch drift)`);

  // The check the exact-version rule was standing in for, and doing badly.
  if (sweepVersions !== undefined) {
    if (!Array.isArray(sweepVersions) || sweepVersions.length === 0)
      v.push('no sweep versions supplied — cross-sweep agreement cannot be established');
    else {
      const distinct = [...new Set(sweepVersions)];
      if (distinct.length > 1)
        v.push(`the merged sweeps ran on different CLIs (${distinct.join(', ')}) — ` +
          'a contrast between conditions measured on different binaries is not a contrast');
    }
  }
  return fail(v);
}

/**
 * I2b — every merged sweep, the drift record and the suite on disk must name the SAME
 * instrument.
 *
 * The instrument is everything a score depends on that is not the condition text: the
 * cases, their graders, the transcripts they replay, the fixture they scaffold, and the
 * conditions themselves. `instrumentDigest(suiteDir)` hashes all of it.
 *
 * **What this check compares, exactly: instruments, not times.** It compares digests.
 * Three sweeps taken weeks apart merge cleanly here as long as the cases, graders,
 * fixture, transcripts and conditions did not change in between — and that is the whole
 * of what it certifies. `startedAt` is not read by this check or by any other, so an
 * elapsed-time rule is not enforced anywhere in this suite.
 *
 * Nothing else here can see the instrument. I2 compares the pre-registration digest, the
 * models and the CLI. `drift` compares one generated mirror against one source file, at
 * the moment the check ran, and is rewritten by every invocation — so re-running a single
 * condition resets `drifted:false` for two conditions measured on an older instrument.
 * The worktree held exactly that mixed set and every invariant passed it.
 *
 * An ABSENT digest is refused rather than skipped. Sweeps written before the digest
 * existed cannot be shown to be comparable, and "we never looked" must not read as "they
 * agree" — the same rule as the missing pre-registration digest in I8.
 *
 * Each violation names WHICH SIDE differs, because the remedy is different for each: a
 * disagreement between sweeps means re-run the odd one out, a disagreement with the tree
 * means re-run everything or check out the instrument the numbers were taken on.
 *
 * @param {{condition?: string, instrumentSha?: string}[]} sweeps  the merged SweepRecords
 * @param {{instrumentSha?: string}} drift  results/drift.json as parsed
 * @param {string} currentSha  instrumentDigest(suiteDir), taken at merge time
 * @param {string} [currentShaError]  why it could not be taken, when it could not.
 *   Carried into the message rather than swallowed: a missing suite directory, an
 *   unreadable file and a bug in the digest are three different operator actions, and
 *   "no digest was computed" alone tells an operator which of them to take.
 */
export function i2bInstrumentAgreement(sweeps, drift, currentSha, currentShaError) {
  const v = [];
  if (!Array.isArray(sweeps) || sweeps.length === 0)
    return fail(['no sweeps supplied — instrument agreement cannot be established']);
  const short = (s) => String(s).slice(0, 12);
  const has = (s) => typeof s?.instrumentSha === 'string' && s.instrumentSha !== '';

  const missing = sweeps.filter((s) => !has(s));
  if (missing.length > 0)
    v.push(`${missing.map((s) => s?.condition ?? '?').join(', ')}: sweep record carries no instrumentSha ` +
      '— these sweeps predate the instrument digest and must be re-run before they can be merged');

  const present = sweeps.filter(has);
  const distinct = [...new Set(present.map((s) => s.instrumentSha))];
  if (distinct.length > 1)
    v.push('the merged sweeps were measured on different instruments (' +
      present.map((s) => `${s.condition ?? '?'}=${short(s.instrumentSha)}`).join(', ') +
      ') — a contrast between conditions measured on different graders is not a contrast');

  const haveCurrent = typeof currentSha === 'string' && currentSha !== '';
  if (!haveCurrent)
    v.push('no instrument digest was computed at merge time — the suite on disk cannot be compared ' +
      'against the instrument the sweeps measured' +
      (currentShaError ? ` (${currentShaError})` : ''));

  // Only once the sweeps agree is there a single "the sweeps' instrument" to name.
  if (distinct.length === 1) {
    const swept = distinct[0];
    const driftSha = drift?.instrumentSha;
    if (typeof driftSha !== 'string' || driftSha === '')
      v.push("results/drift.json carries no instrumentSha — the drift check predates the instrument " +
        'digest, so it cannot vouch for the instrument these sweeps ran on');
    else if (driftSha !== swept)
      v.push(`drift.json names instrument ${short(driftSha)}, the sweeps name ${short(swept)} — ` +
        'the drift check ran against a different instrument than the sweeps did');
    if (haveCurrent && currentSha !== swept)
      v.push(`the suite on disk is instrument ${short(currentSha)}, the sweeps measured ` +
        `${short(swept)} — the cases, graders, fixture or conditions changed after these results ` +
        'were taken');
  }
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
 * I4b — every registered scored case was MEASURED, in every merged condition, at the
 * ablation it was registered at.
 *
 * Three ways a comparison can be a hole rather than a smaller comparison, and all three
 * used to be silent or fatal:
 *
 * - **The case is absent from one sweep.** The merged table then came back one row short
 *   of the pre-registration with every invariant passing (B4).
 * - **The case is present with an empty run list.** An arm with no runs is the absence of
 *   a measurement, not a score of zero.
 * - **The case ran at an ablation nobody registered.** `step3-markers-in-source` is
 *   registered `ablation: none` — single-arm, because a replayed transcript carries the
 *   plugin into both arms — and the sweep ran it with-without anyway, printing a
 *   `none (per sweep)` row beside a table whose heading says its numbers have no
 *   referent (A6). `SweepRecord.ablations` is the only place the per-case truth survives:
 *   `document.suite.ablation` can name just one for the whole invocation.
 *
 * **Why an invariant and not a throw.** The first two were `MergeError`s inside
 * `mergeSweeps`, which aborts before any check runs — so an operator merging a
 * cost-ceiling-truncated sweep got one message instead of the full list, and lost I1's
 * "run is partial" alongside it. Nothing is published either way; this only decides how
 * much the operator learns per attempt.
 *
 * A sweep that carries no `ablations` map at all is NOT a violation here: a bare
 * `SweepResult` legitimately has none, and a record written by this runner always does.
 * `mergeSweeps` records that absence as an advisory instead, and I2b already refuses any
 * record old enough to predate the field.
 *
 * @param {{condition?: string, document?: {cases?: {name: string, arms?: object}[]},
 *          ablations?: Record<string, string>}[]} sweeps  the merged SweepRecords
 * @param {CaseSpec[]} specs  the pre-registration's cases — the expectation comes from
 *   the registration, never from the documents being judged
 */
export function i4bEveryScoredCaseMeasured(sweeps, specs) {
  const v = [];
  if (!Array.isArray(sweeps) || sweeps.length === 0)
    return fail(['no sweeps supplied — that every registered case was measured cannot be established']);
  if (!Array.isArray(specs) || specs.length === 0)
    return fail(['no case specs — vacuous pass refused']);
  const scored = specs.filter((s) => !(s.tags ?? []).includes('control') && s.scored !== false);
  if (scored.length === 0) return fail(['no scored cases registered — vacuous pass refused']);

  for (const spec of scored) {
    for (const s of sweeps) {
      const condition = s?.condition ?? '?';
      const c = (s?.document?.cases ?? []).find((x) => x.name === spec.name);
      if (!c) {
        v.push(`${spec.name}: registered and scored, but the '${condition}' sweep does not contain it — ` +
          `re-run '${condition}' rather than publishing a comparison with a hole in it`);
        continue;
      }
      if ((c.arms?.with ?? []).length === 0)
        v.push(`${spec.name}: present in the '${condition}' sweep with an empty run list — an arm with ` +
          'no runs is the absence of a measurement, not a score of zero');
      const swept = s?.ablations?.[spec.name];
      if (swept !== undefined && swept !== spec.ablation)
        v.push(`${spec.name}: registered ablation '${spec.ablation}', but the '${condition}' sweep ran it ` +
          `at '${swept}' — the number that came back does not answer the question that was registered`);
    }
  }
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
    // A regex grader names its target `target`; an llm grader names it `focus`. The
    // first draft checked only `target`, so it missed the very grader type it was
    // written to accept.
    const fileScoped = (g) => {
      const t = g.type === 'llm' ? g.focus : g.target;
      return t && typeof t === 'object' && t.source === 'file';
    };
    const hasContent = (c.graders ?? []).some(
      (g) => (g.type === 'regex' || g.type === 'llm') && fileScoped(g)
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

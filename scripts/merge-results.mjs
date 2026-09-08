#!/usr/bin/env node
/**
 * Turns three sweep documents into one comparison, split by evidence kind.
 * Signatures: ../scripts/interfaces.mjs § merge-results
 *
 * Everything above the entry point is pure: given the same fixtures it returns the
 * same report, touches no disk and spawns nothing. That is not tidiness — every
 * judgement here (which runs count, what a contrast is worth against the noise
 * floor, whether a report may be emitted at all) is a place where a quiet mistake
 * produces a *plausible number* rather than an error, and a plausible number is the
 * one failure this suite cannot detect in itself.
 *
 * The entry point wires the handles, runs the invariants, and refuses. A violated
 * invariant is not a warning: nothing is written and the process exits 1.
 */

/** @import { HarnessDocument, HarnessCase, SweepRecord, SweepResult, DriftRecord,
 *            PreRegistration, ConditionId, Contrast, MergedCaseRow, MergedReport,
 *            Provenance } from './types.mjs' */
/** @import { RevParse, Clock, PreRegistrationDigest } from './interfaces.mjs' */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as inv from './invariants.mjs';
import { instrumentDigest, conditionDigest } from './instrument.mjs';

/**
 * What a condition id may look like. The conditions themselves are REGISTERED — the
 * pre-registration's `conditions` list names them, and this file holds no list of its
 * own — so an amendment can add a fourth without touching code. `treatment` is required
 * and `none` is reserved: it is the harness's own without-arm, the column every
 * contrast is also taken against, and a directory by that name would be two things.
 */
const CONDITION_ID = /^[a-z][a-z0-9-]*$/;
const RESERVED_CONDITION = 'none';

/** Raised by a pure function that refuses its input. Carries no stack the caller wants. */
export class MergeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MergeError';
  }
}

const bad = (message) => {
  throw new MergeError(message);
};

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — parsing. Every parser fails closed and names the field that failed:
 * a merger that repairs its input is a merger that reports a run nobody made.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The borrowed document is an additive-only contract, so unknown fields are
 * tolerated and only `schemaVersion` is asserted. Pinning the rest would break on
 * the next CLI release for no gain.
 *
 * @param {unknown} value
 * @param {string} where  names the file or field, so a failure is locatable
 * @returns {HarnessDocument}
 */
export function validateHarnessDocument(value, where = 'document') {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    bad(`${where}: not an object`);
  const doc = /** @type {any} */ (value);
  if (doc.schemaVersion !== 1)
    bad(`${where}: schemaVersion ${JSON.stringify(doc.schemaVersion)} — only 1 is understood`);
  if (!Array.isArray(doc.cases)) bad(`${where}: no cases array`);
  if (!doc.suite || typeof doc.suite !== 'object') bad(`${where}: no suite block`);
  for (const c of doc.cases) {
    if (typeof c?.name !== 'string') bad(`${where}: a case has no name`);
    if (!c.arms || typeof c.arms !== 'object') bad(`${where}: case ${c.name} has no arms`);
    if (!Array.isArray(c.arms.with)) bad(`${where}: case ${c.name} has no with-arm`);
  }
  return doc;
}

/**
 * ParseHarnessDocument — a raw `aggregate-result.json`.
 * @param {string} json
 * @returns {HarnessDocument}
 */
export function parseHarnessDocument(json) {
  let value;
  try {
    value = JSON.parse(json);
  } catch (e) {
    bad(`aggregate-result.json is not JSON: ${e.message}`);
  }
  return validateHarnessDocument(value, 'aggregate-result.json');
}

/**
 * `results/<condition>.json` — the SweepRecord envelope the runner persists. The
 * envelope, not a bare harness document: `condition` and `exitCode` exist only here,
 * and a merger that accepted the bare document would have to invent both.
 *
 * @param {string} json
 * @param {ConditionId} expectedCondition  from the filename — cross-checked, because a
 *   mislabelled sweep silently swaps two columns and every number stays plausible
 * @returns {SweepRecord}
 */
export function parseSweepRecord(json, expectedCondition) {
  let value;
  try {
    value = JSON.parse(json);
  } catch (e) {
    bad(`results/${expectedCondition}.json is not JSON: ${e.message}`);
  }
  const where = `results/${expectedCondition}.json`;
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad(`${where}: not an object`);
  const rec = /** @type {any} */ (value);
  if (rec.document === undefined || rec.condition === undefined)
    bad(`${where}: expected a SweepRecord envelope {condition, exitCode, document, stderrTail}, ` +
      `not a bare aggregate-result.json — exitCode and condition exist only in the envelope`);
  if (rec.condition !== expectedCondition)
    bad(`${where}: declares condition '${rec.condition}' — the file says '${expectedCondition}'`);
  if (rec.document === null) bad(`${where}: sweep produced no document; there is nothing to merge`);
  if (typeof rec.exitCode !== 'number') bad(`${where}: no exitCode`);
  rec.document = validateHarnessDocument(rec.document, `${where} .document`);
  return rec;
}

/**
 * The machine-readable half of PRE-REGISTRATION.md: the FIRST fenced ```json block.
 * One file, one digest — the undertaking and the directions cannot move independently
 * of the sha that records them, and the prose around the block stays editable.
 *
 * Each field is validated on its own so a bad one names itself. In particular a
 * direction must be a sign: `0.42` is a predicted score wearing a sign's clothes, and
 * the whole point of the type is that no field can hold one.
 *
 * @param {string} markdown
 * @returns {PreRegistration}
 */
export function parsePreRegistration(markdown) {
  if (typeof markdown !== 'string' || markdown.trim() === '')
    bad('PRE-REGISTRATION.md is missing or empty — there is nothing registered to compare against');
  const block = /^[ \t]*```json[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]*```/m.exec(markdown);
  if (!block)
    bad('PRE-REGISTRATION.md carries no fenced ```json block — the merger reads that block and nothing else');
  let pre;
  try {
    pre = JSON.parse(block[1]);
  } catch (e) {
    bad(`PRE-REGISTRATION.md json block is not JSON: ${e.message}`);
  }
  const at = (f) => `PRE-REGISTRATION.md .${f}`;

  if (!Array.isArray(pre.conditions) || pre.conditions.length === 0) bad(`${at('conditions')}: empty`);
  for (const c of pre.conditions) {
    if (typeof c !== 'string' || !CONDITION_ID.test(c))
      bad(`${at('conditions')}: ${JSON.stringify(c)} is not a condition id (lowercase letters, digits ` +
        'and hyphens, starting with a letter — it names a directory under conditions/)');
    if (c === RESERVED_CONDITION)
      bad(`${at('conditions')}: '${RESERVED_CONDITION}' is the harness's own without-arm, not an ` +
        'authored condition — it cannot be registered');
  }
  if (new Set(pre.conditions).size !== pre.conditions.length) bad(`${at('conditions')}: duplicated`);
  if (!pre.conditions.includes('treatment'))
    bad(`${at('conditions')}: no treatment — a comparison with nothing to compare is not one`);

  if (!Array.isArray(pre.cases) || pre.cases.length === 0) bad(`${at('cases')}: empty`);
  const names = new Set();
  for (const s of pre.cases) {
    if (typeof s?.name !== 'string' || s.name === '') bad(`${at('cases')}: a case has no name`);
    if (names.has(s.name)) bad(`${at('cases')}: '${s.name}' declared twice`);
    names.add(s.name);
    if (s.evidence !== 'delta' && s.evidence !== 'capability')
      bad(`${at('cases')}: ${s.name} evidence '${s.evidence}' is neither delta nor capability`);
    if (s.ablation !== 'none' && s.ablation !== 'with-without')
      bad(`${at('cases')}: ${s.name} ablation '${s.ablation}' is not a harness ablation`);
    // A6. The two fields are one decision written twice, and the merger keys behaviour on
    // both: `evidence` splits the tables, `ablation` decides whether a without-arm is a
    // baseline. A registration where they disagree makes those two answers contradict
    // each other, so it is refused here rather than resolved later by whichever field the
    // code happened to read.
    const impliedAblation = s.evidence === 'delta' ? 'with-without' : 'none';
    if (s.ablation !== impliedAblation)
      bad(`${at('cases')}: ${s.name} is registered evidence '${s.evidence}' with ablation ` +
        `'${s.ablation}' — '${s.evidence}' evidence is measured at ablation '${impliedAblation}', and a ` +
        `case cannot be both`);
    if (!Array.isArray(s.tags)) bad(`${at('cases')}: ${s.name} has no tags array`);
    if (typeof s.scored !== 'boolean') bad(`${at('cases')}: ${s.name} has no scored flag`);
    if (typeof s.measures !== 'string') bad(`${at('cases')}: ${s.name} has no measures line`);
    if (s.name.includes('#'))
      bad(`${at('cases')}: '${s.name}' contains '#', which is the character a group direction key ` +
        'splits on — a case name that carries one makes `<case>#<group>/<control>` ambiguous');
    validateGroups(s, at);
  }
  // A difference group names two OTHER groups of the same case, so the references are
  // resolved after every name is known: a forward reference is legal, a dangling one is not.
  for (const s of pre.cases) {
    const byName = new Map((s.groups ?? []).map((g) => [g.name, g]));
    for (const g of s.groups ?? []) {
      if (g.kind !== 'difference') continue;
      for (const side of ['minuend', 'subtrahend']) {
        const target = byName.get(g[side]);
        if (!target)
          bad(`${at('cases')}: ${s.name} group '${g.name}' ${side} '${g[side]}' names no group on this case`);
        if (target.kind !== 'graders')
          bad(`${at('cases')}: ${s.name} group '${g.name}' ${side} '${g[side]}' is a ${target.kind} group — ` +
            'a difference is taken between two grader groups, so a difference of differences is refused');
      }
    }
  }

  const controls = ['none', ...pre.conditions.filter((c) => c !== 'treatment')];
  const specOf = new Map(pre.cases.map((s) => [s.name, s]));
  if (!pre.expectedDirection || typeof pre.expectedDirection !== 'object')
    bad(`${at('expectedDirection')}: missing`);
  for (const [key, value] of Object.entries(pre.expectedDirection)) {
    if (value !== -1 && value !== 0 && value !== 1)
      bad(`${at('expectedDirection')}: ${key} = ${JSON.stringify(value)} — a direction is a sign ` +
        `(-1 | 0 | 1), never a predicted score`);
    const slash = key.lastIndexOf('/');
    const [subject, control] = [key.slice(0, slash), key.slice(slash + 1)];
    // `#` cannot appear in a case or a group name, so the split is unambiguous and the
    // two key kinds cannot be confused for one another.
    const hash = subject.indexOf('#');
    const caseName = hash < 0 ? subject : subject.slice(0, hash);
    const groupName = hash < 0 ? null : subject.slice(hash + 1);
    if (!names.has(caseName)) bad(`${at('expectedDirection')}: ${key} names no registered case`);
    const spec = specOf.get(caseName);
    if (groupName === null && (spec.contrasts ?? 'case') === 'groups')
      bad(`${at('expectedDirection')}: ${key} is a case-level direction on '${caseName}', which is ` +
        "registered contrasts: 'groups' — its harness score is printed and never contrasted, so a " +
        'direction for it would be a prediction about a number nothing compares');
    if (groupName !== null) {
      if ((spec.contrasts ?? 'case') !== 'groups')
        bad(`${at('expectedDirection')}: ${key} names a group of '${caseName}', which is registered ` +
          `contrasts: '${spec.contrasts ?? 'case'}'`);
      if (!(spec.groups ?? []).some((g) => g.name === groupName))
        bad(`${at('expectedDirection')}: ${key} names no group registered on '${caseName}'`);
    }
    if (!controls.includes(control)) bad(`${at('expectedDirection')}: ${key} names no registered control`);
  }
  // Complete, not only well-formed: a condition added to the list without a direction for
  // every delta case would be refused by ComputeContrasts at merge time — after the sweep
  // was paid for. Refused here, where the registration is read, it costs nothing. The
  // check is per delta case per control, which is exactly the set of contrasts the
  // merger will try to build.
  for (const s of pre.cases) {
    if (s.evidence !== 'delta' || s.scored === false || (s.tags ?? []).includes('control')) continue;
    // Completeness is per key KIND. A `case` case needs one direction per control, as it
    // always has. A `groups` case needs one per group per control instead — the same set
    // of contrasts the merger will try to build, and no more.
    if ((s.contrasts ?? 'case') === 'groups') {
      for (const g of s.groups) {
        for (const control of controls) {
          const key = `${s.name}#${g.name}/${control}`;
          if (!(key in pre.expectedDirection))
            bad(`${at('expectedDirection')}: no direction registered for ${key} — every group of a ` +
              `delta case needs one per control, and '${control}' is a registered control`);
        }
      }
      continue;
    }
    for (const control of controls) {
      const key = `${s.name}/${control}`;
      if (!(key in pre.expectedDirection))
        bad(`${at('expectedDirection')}: no direction registered for ${key} — every delta case needs one ` +
          `per control, and '${control}' is a registered control`);
    }
  }

  if (typeof pre.threshold !== 'number' || !(pre.threshold > 0) || pre.threshold > 1)
    bad(`${at('threshold')}: ${JSON.stringify(pre.threshold)} is not a threshold in (0, 1]`);
  for (const f of ['subjectModel', 'judgeModel', 'claudeVersion'])
    if (typeof pre[f] !== 'string' || pre[f] === '') bad(`${at(f)}: missing`);
  if (pre.judgeModel === pre.subjectModel)
    bad(`${at('judgeModel')}: equals the subject model — same-model self-preference is the ` +
      `confound the judge pin exists to avoid`);
  if (!Number.isInteger(pre.runsPerCase) || pre.runsPerCase < 1) bad(`${at('runsPerCase')}: not a run count`);
  if (pre.publishAllConditions !== true)
    bad(`${at('publishAllConditions')}: must be literal true — the undertaking to publish every ` +
      `condition whatever it shows is not a toggle`);

  // The second floor component's multiplier is REGISTERED, not chosen while the numbers
  // are being read. It is required of a registration that carries a groups case, because
  // that is the registration whose floors use it, and it must equal the constant the
  // merger and I11 share: two copies of one number are how a marked contrast and the check
  // that verifies the mark come to disagree.
  const anyGroups = pre.cases.some((s) => (s.contrasts ?? 'case') === 'groups');
  if (pre.floorErrorMultiplier === undefined) {
    if (anyGroups)
      bad(`${at('floorErrorMultiplier')}: missing — a registration with a grader group registers the ` +
        'multiplier its floors are built from');
  } else {
    if (typeof pre.floorErrorMultiplier !== 'number' || !(pre.floorErrorMultiplier > 0))
      bad(`${at('floorErrorMultiplier')}: ${JSON.stringify(pre.floorErrorMultiplier)} is not a positive number`);
    if (pre.floorErrorMultiplier !== inv.FLOOR_ERROR_MULTIPLIER)
      bad(`${at('floorErrorMultiplier')}: registered ${pre.floorErrorMultiplier}, the merger and I11 use ` +
        `${inv.FLOOR_ERROR_MULTIPLIER} — the floor a contrast is marked against and the floor the check ` +
        'reads would be two different numbers');
  }
  // Amendment 2 of the defects registration: what a judge call the safeguard refused is.
  // Registered as a word, so a reader sees the rule where the directions are.
  if (pre.judgeRefusals === undefined) pre.judgeRefusals = 'refuse';
  else if (pre.judgeRefusals !== 'refuse' && pre.judgeRefusals !== 'unscored')
    bad(`${at('judgeRefusals')}: ${JSON.stringify(pre.judgeRefusals)} is neither 'refuse' nor 'unscored'`);
  else if (pre.judgeRefusals === 'unscored' && !anyGroups)
    bad(`${at('judgeRefusals')}: 'unscored' leaves a refused grader out of a GROUP score — a registration ` +
      'with no grader group scores the harness case score, where a refused grader still counts as failed');
  return pre;
}

/**
 * The group half of {@link parsePreRegistration}, per case. Split out because it is the
 * one part of the registration with a shape of its own: two kinds of group in one union,
 * names that become half of a direction key, and a difference whose sides are resolved
 * afterwards by the caller.
 *
 * @param {any} s   one registered case
 * @param {(field: string) => string} at
 */
function validateGroups(s, at) {
  const contrasts = s.contrasts ?? 'case';
  if (contrasts !== 'case' && contrasts !== 'groups')
    bad(`${at('cases')}: ${s.name} contrasts ${JSON.stringify(s.contrasts)} is neither 'case' nor 'groups'`);
  if (s.groups !== undefined && !Array.isArray(s.groups))
    bad(`${at('cases')}: ${s.name} groups is not an array`);
  const groups = s.groups ?? [];
  // The two halves of one decision, refused when they disagree: a case that registers
  // groups and keeps its case-level contrasts would be contrasted twice, and a case that
  // says `groups` and names none would be contrasted nowhere.
  if (contrasts === 'groups' && groups.length === 0)
    bad(`${at('cases')}: ${s.name} is registered contrasts: 'groups' but names no group — the ` +
      'registered quantity would be nothing at all');
  if (contrasts !== 'groups' && groups.length > 0)
    bad(`${at('cases')}: ${s.name} names groups but is registered contrasts: '${contrasts}' — a group ` +
      'with no registered direction is a number nothing predicted');
  const seen = new Set();
  for (const g of groups) {
    if (typeof g?.name !== 'string' || g.name === '') bad(`${at('cases')}: ${s.name} has a group with no name`);
    if (/[#/]/.test(g.name))
      bad(`${at('cases')}: ${s.name} group '${g.name}' contains '#' or '/', the two characters a ` +
        'direction key splits on');
    if (seen.has(g.name)) bad(`${at('cases')}: ${s.name} group '${g.name}' declared twice`);
    seen.add(g.name);
    if (g.kind === 'graders') {
      if (!Array.isArray(g.graders) || g.graders.length === 0)
        bad(`${at('cases')}: ${s.name} group '${g.name}' names no grader — an empty group scores every ` +
          'run as nothing and reports it as a measurement');
      for (const name of g.graders)
        if (typeof name !== 'string' || name === '')
          bad(`${at('cases')}: ${s.name} group '${g.name}' has a grader name that is not a name`);
      if (new Set(g.graders).size !== g.graders.length)
        bad(`${at('cases')}: ${s.name} group '${g.name}' names a grader twice — it would carry double ` +
          'weight in the group score and in no other');
    } else if (g.kind === 'difference') {
      for (const side of ['minuend', 'subtrahend'])
        if (typeof g[side] !== 'string' || g[side] === '')
          bad(`${at('cases')}: ${s.name} group '${g.name}' has no ${side}`);
      if (g.minuend === g.subtrahend)
        bad(`${at('cases')}: ${s.name} group '${g.name}' subtracts a group from itself, which is zero ` +
          'on every run by construction');
    } else bad(`${at('cases')}: ${s.name} group '${g.name}' kind ${JSON.stringify(g.kind)} is neither ` +
      "'graders' nor 'difference'");
  }
}

/**
 * `results/drift.json`. Absent, unparseable, or missing its boolean, this reads as
 * DRIFTED: absence of evidence is not evidence of compliance, and a run that skipped
 * the drift check must not be able to quietly produce a report.
 *
 * **What this record is not.** It is not a staleness guard, and nothing here should be
 * read as one. `drifted:false` means the generated treatment mirror matched its source
 * SKILL.md at the moment the check ran. It says nothing about the graders, the fixture,
 * the replayed transcripts or the other two conditions; it carries no timestamp the
 * merger compares; and the runner rewrites it on every invocation, so re-sweeping one
 * condition resets it for two conditions measured on an older instrument. What catches
 * that is `instrumentSha` and I2b — which is why this record now carries one too. I2b
 * compares instruments, not times: it certifies that the sweeps, this record and the tree
 * hash to the same cases, graders, transcripts and fixture, and nothing anywhere compares
 * how long ago any of them ran.
 *
 * @param {string|null} json  null when the file is not there
 * @returns {DriftRecord}
 */
export function parseDriftRecord(json) {
  const drifted = (reason) => ({ drifted: true, reason, checkedAt: '', instrumentSha: '' });
  if (json === null || json === undefined)
    return drifted('no results/drift.json — the drift check did not run');
  let value;
  try {
    value = JSON.parse(json);
  } catch (e) {
    return drifted(`results/drift.json is not JSON: ${e.message}`);
  }
  if (!value || typeof value.drifted !== 'boolean')
    return drifted('results/drift.json carries no `drifted` boolean');
  return {
    drifted: value.drifted,
    reason: value.reason ?? '',
    checkedAt: value.checkedAt ?? '',
    // Carried through rather than defaulted to the current tree: an absent digest must
    // reach I2b as absent, not as agreement.
    instrumentSha: typeof value.instrumentSha === 'string' ? value.instrumentSha : '',
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — judgement.
 * ──────────────────────────────────────────────────────────────────────────── */

/** @param {HarnessDocument} doc @param {string} caseName @returns {HarnessCase|undefined} */
const findCase = (doc, caseName) => doc.cases.find((c) => c.name === caseName);

/**
 * ExtractRunScores — every run's score, never a mean. A mean taken here is a mean
 * nobody can un-take: per-run scatter is the only thing that distinguishes a method
 * that works from one that works two runs in three.
 *
 * @param {HarnessDocument} doc
 * @param {string} caseName
 * @returns {{ with: number[], without: number[] }}
 */
export function extractRunScores(doc, caseName) {
  const c = findCase(doc, caseName);
  if (!c) bad(`case '${caseName}' is not in this document`);
  const scores = (runs, arm) =>
    (runs ?? []).map((r, i) => {
      if (typeof r?.score !== 'number' || Number.isNaN(r.score))
        bad(`case '${caseName}' ${arm} run ${i + 1} has no score`);
      return r.score;
    });
  return { with: scores(c.arms.with, 'with'), without: scores(c.arms.without, 'without') };
}

/** Mean of a non-empty list, or null. Rounded nowhere — rounding belongs to the formatter. */
const mean = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — grader groups.
 *
 * A group is a named subset of a case's graders, scored per run the way the harness
 * scores a case. Nothing here needs a new sweep: the record already keeps every
 * per-run, per-grader verdict, and these functions only read them in a different order.
 *
 * NULLS CARRY MEANING throughout. A run that scored no grader in a group, and a run
 * whose paid graders a cost ceiling skipped, is null in its position — never dropped,
 * never zero. That is how "excluded, not scored zero" becomes something the arithmetic
 * cannot get wrong by accident, and it is why {@link countRuns} has something to count.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * ExtractGroupRunScores — every run's score on one grader group, in run order.
 *
 * The harness's own arithmetic, restricted to the named graders: the weight of those
 * that passed over the weight of those that were scored. A `withOnly` grader is out of
 * both halves, because the harness has demoted it to an indicator and excluded it from
 * its own score; counting it here would make a group score that no other number in the
 * document agrees with.
 *
 * A grader name the case does not carry is REFUSED rather than ignored. A group that
 * silently scores eleven of its twelve graders reports a number that looks exactly like
 * a group that scored twelve, and the twelfth is the one that was renamed.
 *
 * @param {HarnessDocument} doc
 * @param {string} caseName
 * @param {{kind: string, name: string, graders: string[]}} group
 * @returns {{ with: (number|null)[], without: (number|null)[] }}
 */
export function extractGroupRunScores(doc, caseName, group) {
  const c = findCase(doc, caseName);
  if (!c) bad(`case '${caseName}' is not in this document`);
  if (group?.kind !== 'graders')
    bad(`extractGroupRunScores: group '${group?.name}' is a ${group?.kind} group — only a graders group ` +
      'is scored from the document; a difference is computed from two of these');
  const names = new Set(group.graders);
  const runs = [...(c.arms.with ?? []), ...(c.arms.without ?? [])];
  const present = new Set(runs.flatMap((r) => (r?.graders ?? []).map((g) => g.name)));
  // Only when the document actually graded something: a case whose arms are empty has
  // no grader names to disagree with, and the empty arm is reported by the run counts.
  if (present.size > 0)
    for (const name of group.graders)
      if (!present.has(name))
        bad(`group '${group.name}': case '${caseName}' carries no grader '${name}' — a group that ` +
          'quietly scores fewer graders than it names reports a number nothing distinguishes from a ' +
          'complete one');

  const scores = (arm) => (arm ?? []).map((r) => {
    // A cost ceiling that skipped the paid graders leaves the run scored on a different
    // grader set from every other run. It is excluded, which is a null, not a zero.
    if (r?.skippedPaidGraders === true) return null;
    let passedWeight = 0;
    let scoredWeight = 0;
    for (const g of r?.graders ?? []) {
      if (!names.has(g?.name)) continue;
      if (g.withOnly === true || g.scored === false) continue;
      // A judge call the safeguard refused is not a verdict: it leaves the denominator
      // (Amendment 2). Whether the record is publishable at all is I1c's question.
      if (inv.judgeRefusedBySafeguard(g)) continue;
      const weight = typeof g.weight === 'number' ? g.weight : 1;
      scoredWeight += weight;
      if (g.passed === true) passedWeight += weight;
    }
    return scoredWeight === 0 ? null : passedWeight / scoredWeight;
  });
  return { with: scores(c.arms.with), without: scores(c.arms.without) };
}

/**
 * ComputeDifferenceRunScores — one group's score minus another's, ON THE SAME RUN.
 *
 * The difference is taken per run rather than between two table cells, so "the advantage
 * on A over and above any advantage on B" is a quantity with its own scatter and its own
 * floor. Arrays of different length are refused: the two groups were scored on the same
 * runs or they were not, and pairing them by position otherwise would subtract one run
 * from another.
 *
 * @param {(number|null)[]} minuend
 * @param {(number|null)[]} subtrahend
 * @returns {(number|null)[]}
 */
export function computeDifferenceRunScores(minuend, subtrahend) {
  if (!Array.isArray(minuend) || !Array.isArray(subtrahend))
    bad('computeDifferenceRunScores: both sides must be arrays of per-run scores');
  if (minuend.length !== subtrahend.length)
    bad(`computeDifferenceRunScores: ${minuend.length} runs against ${subtrahend.length} — the two ` +
      'groups were not scored on the same runs, and pairing them by position would subtract one run ' +
      'from another');
  return minuend.map((a, i) => {
    const b = subtrahend[i];
    return a === null || a === undefined || b === null || b === undefined ? null : a - b;
  });
}

/** A count per arm; `without` is omitted for an arm the document does not carry. */
const armCount = (withValue, withoutValue) =>
  (withoutValue === null ? { with: withValue } : { with: withValue, without: withoutValue });

/**
 * CountRuns — runs present, runs that errored, runs excluded from every group score.
 *
 * All three are registered reported figures (D4). The header's `runsPerCase` is what was
 * promised, not what ran; a run with a non-null `error` reads as "found nothing" on a
 * presence-graded case; and a run whose paid graders were skipped is excluded rather than
 * scored zero. None of those is visible in a mean, so each is printed beside it.
 *
 * `groupRunScores` is not the source of any count — it is the cross-check that the group
 * arrays and the document describe the same runs.
 *
 * @param {HarnessDocument} doc
 * @param {string} caseName
 * @param {(number|null)[][]} [groupRunScores]  one with-arm array per group
 * @returns {{ runCounts: object, errorCounts: object, excludedCounts: object }}
 */
export function countRuns(doc, caseName, groupRunScores = []) {
  const c = findCase(doc, caseName);
  if (!c) bad(`case '${caseName}' is not in this document`);
  const withRuns = c.arms.with ?? [];
  const withoutRuns = c.arms.without;
  for (const [i, arr] of (groupRunScores ?? []).entries())
    if (Array.isArray(arr) && arr.length !== withRuns.length)
      bad(`countRuns: group ${i + 1} carries ${arr.length} with-arm scores for ${withRuns.length} runs`);
  const count = (runs, predicate) => (runs ?? []).filter(predicate).length;
  const both = (predicate) =>
    armCount(count(withRuns, predicate), withoutRuns === undefined ? null : count(withoutRuns, predicate));
  const refusedIn = (r) => (r?.graders ?? []).filter((g) => inv.judgeRefusedBySafeguard(g));
  const byGrader = (runs) => {
    const out = {};
    for (const r of runs ?? []) for (const g of refusedIn(r)) out[g.name] = (out[g.name] ?? 0) + 1;
    return out;
  };
  return {
    runCounts: both(() => true),
    errorCounts: both((r) => r?.error !== null && r?.error !== undefined),
    excludedCounts: both((r) => r?.skippedPaidGraders === true),
    // Amendment 2: runs with at least one judge call the safeguard refused, and which
    // graders, so a reader can see whether the refusals fell on one defect.
    judgeRefusedCounts: both((r) => refusedIn(r).length > 0),
    judgeRefusedGraders: { with: byGrader(withRuns), without: withoutRuns === undefined ? null : byGrader(withoutRuns) },
  };
}

/**
 * ComputeGroupFloor — the smallest difference this instrument resolves for one contrast.
 *
 * The larger of two quantities, per the registration. First, the range of the group's
 * `none` means, which is Tier 1's rule; it does not fall as runs are added. Second, twice
 * the standard error of the contrast — the standard deviation pooled over the two cells
 * entering it, times sqrt(1/nT + 1/nC); it does. The second exists because the first is
 * degenerate when every no-skill run scores the same, which recon made likely, and
 * because with one scored case the first is a single three-sample range.
 *
 * Every part is returned beside the floor, so a reader can recompute it rather than
 * taking it. NaN where a quantity was not measurable: an unmeasured floor must never
 * arrive as 0, which is a measurement claiming there is no noise.
 *
 * @param {{noneMeans: number[], treatmentRuns: number[], controlRuns: number[]}} parts
 */
export function computeGroupFloor(parts) {
  const noneMeans = (parts?.noneMeans ?? []).filter((n) => Number.isFinite(n));
  const treatmentRuns = (parts?.treatmentRuns ?? []).filter((n) => Number.isFinite(n));
  const controlRuns = (parts?.controlRuns ?? []).filter((n) => Number.isFinite(n));
  const noneRange = noneMeans.length >= 2 ? Math.max(...noneMeans) - Math.min(...noneMeans) : NaN;

  const nT = treatmentRuns.length;
  const nC = controlRuns.length;
  const sumSquares = (xs) => {
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return xs.reduce((a, b) => a + (b - m) * (b - m), 0);
  };
  // The classic pooled estimator. Fewer than two runs between the cells leaves no degrees
  // of freedom, and a spread invented out of one observation is not a spread.
  const df = nT + nC - 2;
  const pooledSd = nT > 0 && nC > 0 && df > 0
    ? Math.sqrt((sumSquares(treatmentRuns) + sumSquares(controlRuns)) / df)
    : NaN;
  const errorBound = Number.isFinite(pooledSd)
    ? inv.FLOOR_ERROR_MULTIPLIER * pooledSd * Math.sqrt(1 / nT + 1 / nC)
    : NaN;

  const candidates = [noneRange, errorBound].filter((n) => Number.isFinite(n));
  return {
    noneRange,
    errorBound,
    pooledSd,
    treatmentRuns: nT,
    controlRuns: nC,
    floor: candidates.length === 0 ? NaN : Math.max(...candidates),
  };
}

/**
 * ComputeContrasts — treatment minus control, one per registered control.
 *
 * The direction comes from the pre-registration and is looked up by `<case>/<control>`.
 * An unregistered pair THROWS rather than defaulting to 0: a direction chosen after the
 * numbers exist is not a prediction, and D6 buys nothing if the merger will supply the
 * missing half for you.
 *
 * The `none` column is the mean of the per-sweep baselines — stock Claude is measured
 * once per sweep against identical cases, so the three are three observations of one
 * quantity. Their spread is not averaged away: it is published beside the contrast as
 * the noise floor.
 *
 * @param {Record<ConditionId, number|null>} conditionScores
 * @param {number[]} baselineScores
 * @param {PreRegistration} preRegistration
 * @param {string} caseName
 * @returns {Contrast[]}
 */
export function computeContrasts(conditionScores, baselineScores, preRegistration, caseName) {
  const treatment = conditionScores.treatment;
  if (treatment === null || treatment === undefined) return [];
  const controls = ['none', ...preRegistration.conditions.filter((c) => c !== 'treatment')];
  /** @type {Contrast[]} */
  const out = [];
  for (const control of controls) {
    const score = control === 'none' ? mean(baselineScores) : conditionScores[control] ?? null;
    // B4: a NAMED control with no score means the case did not run in that condition.
    // That used to `continue`, so the contrast vanished and the report printed eleven
    // rows where twelve were registered — a missing measurement wearing the shape of a
    // smaller table, with every invariant still passing. MergeSweeps refuses the same
    // condition upstream; this is the second door on the same room, for a caller that
    // hands the scores in directly.
    if (score === null && control !== 'none')
      bad(`${caseName}/${control}: the '${control}' condition has no score for this case — a contrast ` +
        `against a control that did not run is not a contrast`);
    // `none` is different in kind: it is the mean of the per-sweep without-arms, and a
    // suite run under `--ablation none` legitimately has none. The row's advisories say so.
    if (score === null) continue;
    const key = `${caseName}/${control}`;
    const expected = preRegistration.expectedDirection?.[key];
    if (expected !== -1 && expected !== 0 && expected !== 1)
      bad(`${key}: no registered expected direction — a contrast whose direction is decided after ` +
        `the numbers exist is not a prediction`);
    out.push({ treatment: 'treatment', control, value: treatment - score, expected });
  }
  return out;
}

/**
 * ComputeGroupContrasts — the same rule, one group at a time, with a floor per contrast.
 *
 * Three things differ from the case-level function, and each of them is why this one
 * exists rather than a flag on that one:
 *
 *   - the direction is read under `<case>#<group>/<control>`, and a missing key throws
 *     here as it throws there. A case registered `contrasts: 'groups'` forms no
 *     case-level pair at all, so the throw the plan's reviewers warned about — the
 *     merger demanding a direction for a mixed harness score nobody registered — cannot
 *     fire;
 *   - the floor is built for THIS contrast, from the runs entering it, because the
 *     control's run count differs between `none` (the without-arm columns of every
 *     sweep, taken together, since that is what its mean is over) and a named condition;
 *   - a floor at or below NOISE_EPSILON is not a measurement. Recon: identical runs give
 *     2e-16, never 0. The group's contrasts are then withheld and it is returned
 *     unmeasurable, which is a state the report shows rather than a number it prints.
 *
 * A floor that could not be computed at all is NOT unmeasurable — it is a contrast with
 * no floor, which I11 refuses. "We could not measure the noise" and "the noise is below
 * what this instrument resolves" are different sentences and only one of them is a
 * finding about the run.
 *
 * @param {string} caseName
 * @param {string} groupName
 * @param {Record<ConditionId, number|null>} groupScores        per condition, the with-arm mean
 * @param {Record<ConditionId, (number|null)[]>} groupRunScores per condition, the with-arm runs
 * @param {number[]} groupBaselineScores              the group's `none` mean per sweep
 * @param {(number|null)[][]} groupBaselineRunScores  the group's `none` runs per sweep
 * @param {PreRegistration} preRegistration
 * @returns {{contrasts: Contrast[], unmeasurable: boolean}}
 */
export function computeGroupContrasts(caseName, groupName, groupScores, groupRunScores,
  groupBaselineScores, groupBaselineRunScores, preRegistration) {
  const treatment = groupScores?.treatment;
  if (treatment === null || treatment === undefined) return { contrasts: [], unmeasurable: false };
  const controls = ['none', ...preRegistration.conditions.filter((c) => c !== 'treatment')];
  const finite = (xs) => (xs ?? []).filter((n) => Number.isFinite(n));
  const noneMeans = finite(groupBaselineScores);
  /** @type {Contrast[]} */
  const out = [];
  let unmeasurable = false;

  for (const control of controls) {
    const score = control === 'none' ? mean(noneMeans) : groupScores[control] ?? null;
    // As at case level: a NAMED control with no score is a hole, not a smaller table.
    if (score === null && control !== 'none')
      bad(`${caseName}#${groupName}/${control}: the '${control}' condition has no score for this group — ` +
        'a contrast against a control that did not run is not a contrast');
    if (score === null) continue;
    const key = `${caseName}#${groupName}/${control}`;
    const expected = preRegistration.expectedDirection?.[key];
    if (expected !== -1 && expected !== 0 && expected !== 1)
      bad(`${key}: no registered expected direction — a contrast whose direction is decided after ` +
        `the numbers exist is not a prediction`);
    // For `none` the runs are every sweep's without-arm together: that is the sample its
    // mean was taken over, so it is the sample its standard error is taken over too.
    const controlRuns = control === 'none'
      ? finite((groupBaselineRunScores ?? []).flat())
      : finite(groupRunScores?.[control]);
    const parts = computeGroupFloor({
      noneMeans,
      treatmentRuns: finite(groupRunScores?.treatment),
      controlRuns,
    });
    const value = treatment - score;
    /** @type {Contrast} */
    const contrast = {
      treatment: 'treatment',
      control,
      value,
      expected,
      group: groupName,
      floor: parts.floor,
      floorParts: {
        noneRange: parts.noneRange,
        errorBound: parts.errorBound,
        pooledSd: parts.pooledSd,
        treatmentRuns: parts.treatmentRuns,
        controlRuns: parts.controlRuns,
      },
      belowNoiseFloor: Number.isFinite(parts.floor)
        ? Math.abs(value) <= parts.floor + inv.NOISE_EPSILON
        : false,
    };
    if (Number.isFinite(parts.floor) && parts.floor <= inv.NOISE_EPSILON) unmeasurable = true;
    out.push(contrast);
  }
  if (unmeasurable) return { contrasts: [], unmeasurable: true };
  return { contrasts: out, unmeasurable: false };
}

/**
 * ComputeBaselineSpread — the noise floor, measured rather than assumed.
 *
 * Each sweep produces its own stock-Claude column against identical cases, so within
 * one case the three baselines differ only by run-to-run noise. Cases are NOT pooled:
 * case difficulty is not noise, and pooling would inflate the floor with the very
 * signal the suite is built to read. The reported figure is the WORST per-case spread,
 * which marks more contrasts as sub-noise and so errs toward under-claiming.
 *
 * Returns NaN when no case has two baseline observations. An unmeasured floor must not
 * arrive as 0.00 — that would be a measurement claiming there is no noise, and every
 * contrast would clear it. I1b refuses a report whose spread is not a number.
 *
 * @param {number[][]} perCaseBaselines
 * @returns {number}
 */
export function computeBaselineSpread(perCaseBaselines) {
  const spreads = (perCaseBaselines ?? [])
    .filter((col) => Array.isArray(col) && col.length >= 2)
    .map((col) => Math.max(...col) - Math.min(...col));
  return spreads.length === 0 ? NaN : Math.max(...spreads);
}

/**
 * NoiseFloorOf — which rows the floor is measured from, as its own function.
 *
 * A6. The rule is that only DELTA rows feed the floor: a capability case is registered
 * `ablation: none`, so any without-arm it has measures the same thing twice and its
 * spread is noise about nothing. That rule used to live as a `.map` inside
 * {@link mergeSweeps}, where no test could reach it — widening it to every row is a
 * one-word tidy-up, and the collection guard upstream keeps `capabilityRows[*]
 * .baselineScores` empty, so the widened version returns the same number on every fixture
 * the merger can build. Pulling the selection out gives the rule a seam a test can hand a
 * capability row WITH baselines to, which is the only way to hold it.
 *
 * @param {{deltaRows: MergedCaseRow[], capabilityRows?: MergedCaseRow[]}} rows
 * @returns {number}
 */
export function noiseFloorOf(rows) {
  // Only CASE-LEVEL delta rows feed the report-wide spread. A row whose case is
  // registered `contrasts: 'groups'` carries its floors on its groups, one per contrast,
  // and its baseline column is the group's business rather than the report's. A report
  // in which every delta row is a groups row therefore has no report-wide spread AT ALL,
  // which is absence by design: `checkReport` skips I1b there with its reason and runs
  // I11 instead, rather than refusing a report for a number nothing was going to use.
  return computeBaselineSpread(
    (rows?.deltaRows ?? []).filter((r) => (r.groupContrasts ?? null) === null).map((r) => r.baselineScores)
  );
}

/**
 * I1b's stamp, applied as its own pass rather than inside ComputeContrasts — the
 * spread is a suite-wide quantity and is not known while a single case's contrasts are
 * being built. Keeping it separate also means a report assembled without this pass
 * fails I1b loudly instead of reading as clean.
 *
 * Every contrast is stamped, not only the sub-noise ones, so the field's ABSENCE never
 * has to be interpreted.
 *
 * The comparison is `<=` against `spread + NOISE_EPSILON`, and the constant is imported
 * rather than repeated so this and I1b can never drift apart. A contrast that ties the
 * floor is INSIDE it: the floor is the smallest difference this instrument resolves, so
 * a difference equal to it resolves nothing. Both quantities are means of the same
 * fifteenths summed in different orders, which is why a mathematical tie lands one unit
 * in the last place either side and a strict `<` published `triage-decompose-epic` at
 * +0.13 as a held prediction.
 *
 * @param {MergedCaseRow[]} rows
 * @param {number} spread
 */
export function markNoiseFloor(rows, spread) {
  for (const row of rows)
    for (const c of row.contrasts ?? [])
      c.belowNoiseFloor = Number.isFinite(spread)
        ? Math.abs(c.value) <= spread + inv.NOISE_EPSILON
        : false;
  return rows;
}

/**
 * The group half of {@link mergeSweeps}, for a case registered `contrasts: 'groups'`.
 *
 * Everything it fills is derived from the sweep documents and the registration, and
 * nothing here decides a direction: the directions were registered, and a group with no
 * registered key throws in {@link computeGroupContrasts} rather than defaulting.
 *
 * @param {MergedCaseRow} row
 * @param {CaseSpec} spec
 * @param {Map<ConditionId, HarnessDocument>} docs
 * @param {PreRegistration} preRegistration
 * @param {{traceTexts?: Record<string, string|null>, traceFragments?: string[]}} options
 */
function fillGroupFields(row, spec, docs, preRegistration, options) {
  const finite = (xs) => (xs ?? []).filter((n) => Number.isFinite(n));
  row.groupScores = {};
  row.groupRunScores = {};
  row.groupBaselineScores = {};
  row.groupBaselineRunScores = {};
  row.groupContrasts = {};
  row.unmeasurableGroups = [];

  /** condition → group name → {with, without}, nulls kept, so a difference can pair them. */
  /** @type {Record<string, Record<string, {with: (number|null)[], without: (number|null)[]}>>} */
  const perCondition = {};
  for (const [condition, doc] of docs) {
    if (!findCase(doc, spec.name)) continue;
    const byGroup = {};
    for (const g of spec.groups) {
      // B4's rule, applied to a group: the refusal is real, but it is REPORTED rather
      // than thrown. A throw here aborts before any invariant runs, so an operator
      // merging a sweep taken before a grader existed would get one message and lose
      // I1c, I11, I12 and the rest of the list with it. The group's cell is left empty
      // instead, which reaches I11 as a group with no contrasts and no unmeasurable mark
      // — a refusal, with the reason beside it and every other check still heard.
      try {
        if (g.kind === 'graders') byGroup[g.name] = extractGroupRunScores(doc, spec.name, g);
        else {
          for (const side of [g.minuend, g.subtrahend])
            if (byGroup[side] === undefined)
              bad(`group '${g.name}': '${side}' was not scored, so their difference is not either`);
          byGroup[g.name] = {
            with: computeDifferenceRunScores(byGroup[g.minuend].with, byGroup[g.subtrahend].with),
            without: computeDifferenceRunScores(byGroup[g.minuend].without, byGroup[g.subtrahend].without),
          };
        }
      } catch (e) {
        row.advisories.push(`${condition}: group '${g.name}' could not be scored — ${e.message}`);
      }
    }
    perCondition[condition] = byGroup;
  }

  for (const g of spec.groups) {
    row.groupScores[g.name] = {};
    row.groupRunScores[g.name] = {};
    row.groupBaselineScores[g.name] = [];
    row.groupBaselineRunScores[g.name] = [];
    for (const condition of preRegistration.conditions) {
      const scored = perCondition[condition]?.[g.name];
      const withRuns = finite(scored?.with);
      row.groupScores[g.name][condition] = mean(withRuns);
      row.groupRunScores[g.name][condition] = withRuns;
      const withoutRuns = finite(scored?.without);
      // One entry per SWEEP that produced a without-arm, kept apart: their range is the
      // first floor component, and their runs pooled are the second.
      if (withoutRuns.length > 0) {
        row.groupBaselineScores[g.name].push(mean(withoutRuns));
        row.groupBaselineRunScores[g.name].push(withoutRuns);
      } else if (scored !== undefined) {
        row.advisories.push(`${condition}: no without-arm score for group '${g.name}', so this sweep ` +
          'contributes no baseline to it');
      }
    }
    const { contrasts, unmeasurable } = computeGroupContrasts(
      spec.name, g.name, row.groupScores[g.name], row.groupRunScores[g.name],
      row.groupBaselineScores[g.name], row.groupBaselineRunScores[g.name], preRegistration
    );
    row.groupContrasts[g.name] = contrasts;
    if (unmeasurable) {
      row.unmeasurableGroups.push(g.name);
      row.advisories.push(`group '${g.name}': its floor is at or below ${inv.NOISE_EPSILON}, which is not ` +
        'a measurement — the contrasts are withheld and the group is marked unmeasurable');
    }
  }

  // The four counts. Three come from the documents; the fourth comes from the traces the
  // sweep kept, and is a published figure rather than a filter: a run whose trace names
  // the fence is counted and flagged, never dropped (I9, ruled at gate 4).
  row.runCounts = {};
  row.errorCounts = {};
  row.excludedCounts = {};
  row.judgeRefusedCounts = {};
  row.judgeRefusedGraders = {};
  for (const [condition, doc] of docs) {
    if (!findCase(doc, spec.name)) continue;
    const perGroup = spec.groups
      .map((g) => perCondition[condition][g.name]?.with)
      .filter((xs) => Array.isArray(xs));
    const counts = countRuns(doc, spec.name, perGroup);
    row.runCounts[condition] = counts.runCounts;
    row.errorCounts[condition] = counts.errorCounts;
    row.excludedCounts[condition] = counts.excludedCounts;
    row.judgeRefusedCounts[condition] = counts.judgeRefusedCounts;
    row.judgeRefusedGraders[condition] = counts.judgeRefusedGraders;
  }

  const traceTexts = options?.traceTexts;
  if (traceTexts === undefined) {
    row.advisories.push('no traces were supplied to the merge, so the fence check did not run and no ' +
      'refused-run count is published');
  } else {
    const traces = [];
    for (const [condition, doc] of docs) {
      const c = findCase(doc, spec.name);
      if (!c) continue;
      for (const arm of ['with', 'without'])
        (c.arms[arm] ?? []).forEach((r, i) => {
          const path = r?.tracePath ?? '';
          const text = path === '' ? undefined : traceTexts[path];
          traces.push({ condition, arm, run: i + 1, text: text ?? undefined });
        });
    }
    const flags = inv.i9TraceFlags(traces, options.traceFragments ?? FENCE_FRAGMENTS);
    row.refusedCounts = flags.refusedCounts;
    for (const f of flags.flagged) row.advisories.push(`fence: ${f}`);
    for (const v of flags.violations) row.advisories.push(`fence: ${v}`);
    // A cell one of whose traces could not be read has an UNKNOWN refused count, not a
    // count of zero. The unknown is published as the absence of the number, which I12
    // refuses — absence read as agreement is the failure this whole suite is built
    // against, and a fence nobody could check is not a fence that held.
    for (const t of traces) {
      if (typeof t.text === 'string') continue;
      const cell = row.refusedCounts[t.condition];
      if (cell === undefined) continue;
      if (t.arm === 'with') delete row.refusedCounts[t.condition];
      else delete cell.without;
    }
  }

  // Every grader the case scored that no group names: the guards and the manipulation
  // checks. Reported with their numbers and no held-or-failed verdict (D4).
  const named = new Set(spec.groups.flatMap((g) => g.graders ?? []));
  row.manipulationChecks = {};
  for (const [condition, doc] of docs) {
    const c = findCase(doc, spec.name);
    if (!c) continue;
    for (const r of c.arms.with ?? [])
      for (const g of r?.graders ?? []) {
        if (named.has(g.name)) continue;
        row.manipulationChecks[g.name] ??= {};
        const seen = row.manipulationChecks[g.name];
        seen[condition] ??= { passed: 0, of: 0 };
        seen[condition].of += 1;
        if (g.passed === true) seen[condition].passed += 1;
      }
  }
  for (const [name, byCondition] of Object.entries(row.manipulationChecks))
    for (const condition of preRegistration.conditions)
      byCondition[condition] = byCondition[condition] === undefined
        ? null
        : byCondition[condition].passed / byCondition[condition].of;
}

/**
 * The fence, as fragments rather than roots (I9's second half). The condition under test
 * is a directory inside the repository that every with-arm trace may legitimately name,
 * so a rule that refused any repository path would flag every with-arm run.
 */
export const FENCE_FRAGMENTS = ['/defects/', 'skills/seven-steps-primer', 'fixtures/notesvc/'];

/**
 * MergeSweeps — three sweeps into one comparison.
 *
 * Rows are pushed into two arrays as they are built. Not one list and a filter: the
 * split between a contrast and a number with no referent is the report's most
 * load-bearing distinction, and a filter is one forgotten predicate away from a
 * headline that averages a 0.65-against-nothing into a delta.
 *
 * A case registered `contrasts: 'groups'` takes a different path through the loop below:
 * its harness score is still read into `conditionScores`, because it is printed, but no
 * case-level pair is formed from it and the registered quantities are its groups.
 *
 * @param {SweepResult[]|SweepRecord[]} sweeps
 * @param {PreRegistration} preRegistration
 * @param {Provenance} provenance
 * @param {{traceTexts?: Record<string, string|null>, traceFragments?: string[]}} [options]
 *   `traceTexts` maps a run's `tracePath` to the trace as read from disk — null when the
 *   file is not there. It is a parameter rather than a read because everything above the
 *   entry point is pure. Without it a groups case gets no `refusedCounts`, and I12
 *   refuses the report: a fence nobody checked is not a fence that held.
 * @returns {MergedReport}
 */
export function mergeSweeps(sweeps, preRegistration, provenance, options = {}) {
  if (!Array.isArray(sweeps) || sweeps.length === 0) bad('no sweeps to merge');
  /** @type {Map<ConditionId, HarnessDocument>} */
  const docs = new Map();
  /** The envelopes themselves, for what only they carry: the per-case `ablations` map. */
  /** @type {Map<ConditionId, SweepRecord>} */
  const records = new Map();
  for (const s of sweeps) {
    if (!s?.document) bad(`sweep '${s?.condition}' carries no document`);
    if (docs.has(s.condition)) bad(`two sweeps for condition '${s.condition}'`);
    docs.set(s.condition, s.document);
    records.set(s.condition, s);
  }
  for (const c of preRegistration.conditions)
    if (!docs.has(c))
      bad(`no sweep for registered condition '${c}' — publishAllConditions is an undertaking to ` +
        `publish every column, and a comparison missing one cannot honour it`);

  /** @type {string[]} */
  const advisories = [];
  for (const s of sweeps)
    if (s.exitCode !== 0 && s.exitCode !== 1)
      advisories.push(`${s.condition}: sweep exited ${s.exitCode} — 2 is partial, 130/143 interrupted`);
    else if (s.exitCode === 1)
      advisories.push(`${s.condition}: sweep exited 1 — a case scored below threshold, which is a ` +
        `result rather than a failure`);

  // A6. Recorded once per sweep rather than once per case: an absent map is a property of
  // the record, and I4b treats it as unchecked rather than as agreement.
  for (const s of sweeps)
    if (!s.ablations || typeof s.ablations !== 'object')
      advisories.push(`${s.condition}: the sweep record carries no per-case ablation map, so what each ` +
        `case ran cannot be checked against the ablation it was registered at`);

  const registered = new Set(preRegistration.cases.map((s) => s.name));
  for (const [condition, doc] of docs)
    for (const c of doc.cases)
      if (!registered.has(c.name))
        advisories.push(`${condition}: case '${c.name}' ran but is not in the pre-registration; not reported`);

  /** @type {{delta: MergedCaseRow[], capability: MergedCaseRow[]}} */
  const rows = { delta: [], capability: [] };

  for (const spec of preRegistration.cases) {
    // I7 by construction as well as by check: the diagnostic never enters a table it
    // could later be read out of.
    if ((spec.tags ?? []).includes('control') || spec.scored === false) continue;

    /** @type {MergedCaseRow} */
    const row = {
      case: spec.name,
      evidence: spec.evidence,
      conditionScores: /** @type {any} */ ({}),
      conditionRunScores: /** @type {any} */ ({}),
      baselineScores: [],
      contrasts: [],
      advisories: [],
    };
    let comparable = true;

    for (const condition of preRegistration.conditions) {
      const doc = docs.get(condition);
      const c = findCase(doc, spec.name);
      // B4. A registered scored case with no measurement in one condition is a hole in the
      // comparison, not a smaller comparison — but the refusal is I4b's, not a throw here.
      // A throw aborts before any check runs, so an operator merging a truncated sweep got
      // one message and lost I1's "run is partial" and the rest of the list with it. The
      // cell is left null and the row is marked incomparable, so the hole cannot turn into
      // a contrast on the way past.
      if (!c) {
        row.conditionScores[condition] = null;
        row.conditionRunScores[condition] = [];
        comparable = false;
        row.advisories.push(`${condition}: registered and scored, but this sweep does not contain the case`);
        continue;
      }
      const runs = extractRunScores(doc, spec.name);
      if (runs.with.length === 0) {
        comparable = false;
        row.advisories.push(`${condition}: present with an empty run list — an arm with no runs is the ` +
          `absence of a measurement, not a score of zero`);
      }
      row.conditionScores[condition] = mean(runs.with);
      row.conditionRunScores[condition] = runs.with;
      // A6. A case registered `ablation: none` is single-arm by construction, because a
      // replayed transcript carries the plugin into both arms and the without column would
      // be measuring the same thing twice. When a sweep produces one anyway (the runner did
      // not enforce the field), it is recorded as an advisory and NOT collected: a baseline
      // here would print a `none (per sweep)` row beside a table whose own heading says its
      // numbers have no referent, and would drag a meaningless spread into the suite-wide
      // noise floor.
      //
      // The guard reads the REGISTERED ablation, which is the field A6 is about — the
      // parser refuses a registration whose `evidence` and `ablation` disagree, so the two
      // keys select the same rows, but only one of them names the rule.
      if (spec.ablation !== 'with-without') {
        if (runs.without.length > 0)
          row.advisories.push(`${condition}: registered ablation none, but the sweep produced a ` +
            `without-arm; it contributes no baseline and is not reported`);
      } else if (runs.without.length > 0) row.baselineScores.push(mean(runs.without));
      else row.advisories.push(`${condition}: no without-arm, so this sweep contributes no baseline`);

      // A6, the other half: what the sweep says it actually did, per case. The refusal is
      // I4b's; this is the same fact in the report a reader has in front of them.
      const sweptAblation = records.get(condition)?.ablations?.[spec.name];
      if (sweptAblation !== undefined && sweptAblation !== spec.ablation)
        row.advisories.push(`${condition}: registered ablation '${spec.ablation}', swept '${sweptAblation}'`);

      // skippedPaidGraders means the arms were scored on different grader sets. The
      // harness omits its own delta for exactly this reason; so do we.
      if ([...(c.arms.with ?? []), ...(c.arms.without ?? [])].some((r) => r.skippedPaidGraders)) {
        comparable = false;
        row.advisories.push(`${condition}: a run skipped paid graders — the arms are not comparable`);
      }
      for (const a of c.advisories ?? []) row.advisories.push(`${condition}: ${a}`);
    }

    if ((spec.contrasts ?? 'case') === 'groups')
      fillGroupFields(row, spec, docs, preRegistration, options);
    else if (spec.evidence === 'delta' && comparable)
      row.contrasts = computeContrasts(row.conditionScores, row.baselineScores, preRegistration, spec.name);

    if (spec.evidence === 'delta') rows.delta.push(row);
    else if (spec.evidence === 'capability') rows.capability.push(row);
    else bad(`case '${spec.name}': unknown evidence kind '${spec.evidence}'`);
  }

  const spread = noiseFloorOf({ deltaRows: rows.delta, capabilityRows: rows.capability });
  markNoiseFloor(rows.delta, spread);

  // `partial` is three-valued on purpose. A document with no boolean cannot establish
  // completeness, and coercing that to `false` is absence read as agreement — I1's
  // "cannot establish" branch exists for it.
  const partials = [...docs.values()].map((d) => d.partial);
  const partial = partials.some((p) => typeof p !== 'boolean') ? undefined : partials.some(Boolean);
  if (partial === undefined) advisories.push('a sweep document carries no `partial` field');
  for (const [condition, doc] of docs)
    if (doc.partial === true) advisories.push(`${condition}: partial (${doc.partialReason ?? 'no reason given'})`);

  const observed = new Set(
    [...docs.values()].flatMap((d) => d.cases.map((c) => (c.arms.with ?? []).length)).filter((n) => n > 0)
  );
  if (observed.size > 0 && ![...observed].every((n) => n === preRegistration.runsPerCase))
    advisories.push(`runs per case observed ${[...observed].sort().join('/')}, pre-registered ` +
      `${preRegistration.runsPerCase}`);

  /** @type {MergedReport} */
  const report = {
    provenance,
    deltaRows: rows.delta,
    capabilityRows: rows.capability,
    baselineSpread: spread,
    partial,
    advisories,
  };
  // A NaN spread is not a measurement. Omit the field so I1b refuses the report rather
  // than comparing every contrast against a number that means "we never looked".
  if (!Number.isFinite(spread)) delete report.baselineSpread;
  if (partial === undefined) delete report.partial;
  return report;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the refusal.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every invariant that takes the merged report, run before a byte is written.
 *
 * The expected row counts are derived from the PRE-REGISTRATION, never from the report
 * being judged: a check that both defines what it should find and confirms it found it
 * is the vacuous pass every invariant in this suite is built against.
 *
 * I7 is enforced here as well as satisfied by construction. Its subject is "either
 * scored table", and this module is the only thing that emits them — so the check
 * belongs where the artifact is made, not only where the suite self-tests.
 *
 * @param {MergedReport} report
 * @param {PreRegistration} preRegistration
 * @param {{sweeps?: SweepRecord[], drift: DriftRecord, committedPreRegistrationSha: string,
 *          preRegistrationDirty: boolean, instrumentSha?: string, instrumentShaError?: string,
 *          conditionShas?: Record<string,string>, conditionShaErrors?: Record<string,string>}} ctx
 *   `instrumentSha` is `instrumentDigest(suiteDir)` taken at merge time — the shared
 *   half of the suite as it stands now, which I2b compares against what the sweeps say
 *   they measured. `instrumentShaError` says why it is empty when it is empty; I2b
 *   prints it, because a missing directory, an unreadable file and a bug are three
 *   different remedies. `conditionShas` is `conditionDigest(suiteDir, id)` per registered
 *   condition, the other half, compared per sweep record; `conditionShaErrors` says why
 *   one is missing.
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkReport(report, preRegistration, ctx) {
  const scored = preRegistration.cases.filter(
    (s) => !(s.tags ?? []).includes('control') && s.scored !== false
  );
  const expectedDelta = scored.filter((s) => s.evidence === 'delta').length;
  const expectedCapability = scored.filter((s) => s.evidence === 'capability').length;
  // Which floor rule applies is decided by the REGISTRATION, not by what the report
  // happens to carry: a report that lost its contrasts must fail I1b, not skip it.
  const groupCases = scored.filter((s) => (s.contrasts ?? 'case') === 'groups');
  const expectedGroups = groupCases.reduce((n, s) => n + (s.groups ?? []).length, 0);
  const caseLevelDelta = scored.some((s) => s.evidence === 'delta' && (s.contrasts ?? 'case') !== 'groups');
  /** Checks not run, each with the reason. A skip nobody can read is a check nobody ran. */
  const skipped = [];
  const registered = {
    preRegistrationSha: ctx.committedPreRegistrationSha,
    subjectModel: preRegistration.subjectModel,
    claudeVersion: preRegistration.claudeVersion,
  };

  const checks = [
    ['I1', inv.i1PublishableOnlyWhenComplete(report)],
    // Per SWEEP, not on the merged report: the harness documents carry the per-run
    // errors, and the merge has already reduced them to scores by this point. A run
    // that failed scores 0 and is indistinguishable from a run that did badly.
    ...(ctx.sweeps ?? []).map((s, i) => [`I1c/${s.condition ?? i}`,
      inv.i1cNoFailedRuns(s.document, preRegistration.runsPerCase, { judgeRefusals: preRegistration.judgeRefusals })]),
    // I1b is the REPORT-WIDE floor, and it is measured from case-level delta rows. When
    // every delta case is registered `contrasts: 'groups'` there is no such row, the
    // spread is absent by design, and I1b would refuse a report for a number nothing was
    // going to use. It is skipped WITH ITS REASON and I11 holds the same rule per group.
    ...(caseLevelDelta ? [['I1b', inv.i1bNoiseFloorMarked(report)]] : []),
    // The group form: one floor per contrast, judged against itself. Wired only for a
    // registration that has groups, so a suite without them is unchanged.
    ...(groupCases.length > 0 ? [
      ['I11', inv.i11GroupFloorMarked(report, expectedGroups)],
      ['I12', inv.i12CountsPublished(report, preRegistration.runsPerCase, preRegistration.conditions)],
      ['I13', inv.i13GroupsCarryContrasts(preRegistration, report)],
    ] : []),
    ['I2', inv.i2RunNotVoid(report, registered, ctx.drift, ctx.preRegistrationDirty)],
    // Per SWEEP RECORD, like I1c: the digest is something only the runner knows, so it
    // rides on the envelope rather than on the merged report. I2 cannot see any of it.
    ['I2b', inv.i2bInstrumentAgreement(ctx.sweeps, ctx.drift, ctx.instrumentSha, ctx.instrumentShaError,
      ctx.conditionShas, ctx.conditionShaErrors)],
    ['I4', inv.i4EvidenceKindsNeverMixed(report, expectedDelta, expectedCapability)],
    // Also per SWEEP: whether a registered case was measured at all, and at the ablation
    // it was registered at, is a fact about the documents. The merged report cannot show
    // it — a hole arrives as a null cell that looks exactly like a case that scored
    // nothing.
    ['I4b', inv.i4bEveryScoredCaseMeasured(ctx.sweeps, preRegistration.cases)],
    ['I7', inv.i7ControlNeverInHeadline(report, preRegistration.cases)],
    ['I8', inv.i8PreRegistrationFrozen(
      ctx.committedPreRegistrationSha, report?.provenance?.preRegistrationSha, ctx.preRegistrationDirty)],
  ];
  if (!caseLevelDelta)
    skipped.push('I1b: no case-level delta contrast is registered, so the report-wide noise floor is ' +
      'absent by design; I11 judges each group contrast against its own floor instead');
  if (groupCases.length === 0)
    skipped.push('I11, I12, I13: no case is registered with grader groups');

  const violations = [];
  for (const [id, result] of checks)
    for (const v of result.violations) violations.push(`${id}: ${v}`);
  return { ok: violations.length === 0, violations, skipped };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the comparison table.
 * ──────────────────────────────────────────────────────────────────────────── */

const f2 = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(2));
const signed = (n) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
/** A registered direction is typeset as a sign, never as a score: `+1`, not `1.00`. */
const direction = (d) => (d > 0 ? '+1' : d < 0 ? '-1' : '0');

/**
 * The grader-group half of {@link formatComparison}: one section per group, its floor
 * printed with the parts it was built from, and the four counts beside the scores.
 *
 * Nothing here is a summary. Every number a reader sees can be recomputed from the
 * record and the registration, which is why the floor arrives with `noneRange`,
 * `errorBound`, `pooledSd` and the two run counts rather than as a bare figure.
 *
 * @param {MergedReport} report
 * @param {ConditionId[]} conditions
 * @returns {string[]}
 */
function formatGroups(report, conditions) {
  const rows = (report.deltaRows ?? []).filter((r) => r.groupContrasts);
  if (rows.length === 0) return [];
  const out = ['## Grader groups', ''];
  out.push('The registered quantity for a case that carries no case-level contrast. A group is scored ' +
    'per run the way the harness scores a case — the weight of its graders that passed over the weight ' +
    'of its graders that were scored — and the mean is taken over runs, never over graders.', '');

  for (const r of rows) {
    const counts = (kind, condition, arm) => {
      const c = r[kind]?.[condition];
      if (!c) return '—';
      return arm === 'without' ? (typeof c.without === 'number' ? String(c.without) : '—') : String(c.with);
    };
    for (const [name, contrasts] of Object.entries(r.groupContrasts)) {
      const unmeasurable = (r.unmeasurableGroups ?? []).includes(name);
      out.push(`### \`${r.case}\` · group \`${name}\``, '');
      out.push('| condition | score | runs | errored | excluded | refused | judge refused |');
      out.push('|---|---|---|---|---|---|---|');
      for (const c of conditions)
        out.push(`| ${c} | ${f2(r.groupScores?.[name]?.[c])} | ${counts('runCounts', c, 'with')} | ` +
          `${counts('errorCounts', c, 'with')} | ${counts('excludedCounts', c, 'with')} | ` +
          `${counts('refusedCounts', c, 'with')} | ${counts('judgeRefusedCounts', c, 'with')} |`);
      const baselines = r.groupBaselineScores?.[name] ?? [];
      out.push(`| none (per sweep) | ${baselines.map((n) => f2(n)).join(' · ') || '—'} | ` +
        `${conditions.map((c) => counts('runCounts', c, 'without')).join(' · ')} | ` +
        `${conditions.map((c) => counts('errorCounts', c, 'without')).join(' · ')} | ` +
        `${conditions.map((c) => counts('excludedCounts', c, 'without')).join(' · ')} | ` +
        `${conditions.map((c) => counts('refusedCounts', c, 'without')).join(' · ')} | ` +
        `${conditions.map((c) => counts('judgeRefusedCounts', c, 'without')).join(' · ')} |`);
      out.push('');
      out.push('Runs present, runs that errored, runs excluded because a cost ceiling skipped their paid ' +
        'graders, runs whose kept trace named the fence, and runs with at least one judge call the ' +
        'API\'s safeguard refused. The first four are registered reported figures: an errored run counts ' +
        'and is not replaced, and a refused run counts and is not dropped. The fifth is Amendment 2: a ' +
        'refused judge call is not a verdict, so that grader leaves that run\'s denominator, and the ' +
        'count says how often.', '');
      const refusedLines = [];
      for (const c of conditions) {
        const byArm = r.judgeRefusedGraders?.[c];
        for (const arm of ['with', 'without']) {
          const entries = Object.entries(byArm?.[arm] ?? {});
          if (entries.length)
            refusedLines.push(`- ${c}, ${arm}-arm: ${entries.map(([g, n]) => `\`${g}\` ×${n}`).join(', ')}`);
        }
      }
      if (refusedLines.length)
        out.push('Which graders the safeguard refused, and how many times. A refusal that falls on one ' +
          'defect\'s grader leans the score on that defect toward "not named":', '', ...refusedLines, '');

      if (unmeasurable) {
        out.push(`**unmeasurable.** This group's floor came out at or below ${inv.NOISE_EPSILON}, which is ` +
          'not a measurement of noise but the absence of one. Its contrasts are withheld: the scores above ' +
          'stand, and no difference between them is published as a number.', '');
        continue;
      }
      out.push('| vs | Δ | registered direction | floor | none range | 2×SE | pooled SD | runs T | runs C | note |');
      out.push('|---|---|---|---|---|---|---|---|---|---|');
      for (const c of contrasts) {
        const parts = c.floorParts ?? {};
        out.push(`| ${c.control} | ${signed(c.value)} | ${direction(c.expected)} | ${f2(c.floor)} | ` +
          `${f2(parts.noneRange)} | ${f2(parts.errorBound)} | ${f2(parts.pooledSd)} | ` +
          `${parts.treatmentRuns ?? '—'} | ${parts.controlRuns ?? '—'} | ` +
          `${c.belowNoiseFloor ? 'at or below this contrast\'s floor' : ''} |`);
      }
      out.push('');
      out.push('The floor is per contrast: the larger of the range of the `none` means and ' +
        `${inv.FLOOR_ERROR_MULTIPLIER} × the standard error of the contrast, with the standard deviation ` +
        'pooled over the two cells entering it. Both parts are printed so the floor can be recomputed ' +
        'rather than taken. A contrast at or below its own floor is published and marked, never a finding.', '');
      out.push('| condition | runs |');
      out.push('|---|---|');
      for (const c of conditions)
        out.push(`| ${c} | ${(r.groupRunScores?.[name]?.[c] ?? []).map((n) => f2(n)).join(' · ') || '—'} |`);
      for (const [i, runs] of (r.groupBaselineRunScores?.[name] ?? []).entries())
        out.push(`| none (sweep ${i + 1}) | ${runs.map((n) => f2(n)).join(' · ') || '—'} |`);
      out.push('');
    }

    const checks = Object.entries(r.manipulationChecks ?? {});
    if (checks.length > 0) {
      out.push(`### \`${r.case}\` · manipulation checks`, '');
      out.push('Graders the case scored that no registered group names: the guards, and any grader that ' +
        'measures whether the run produced the observable at all. They are reported with their numbers ' +
        'and no held-or-failed verdict — they measure compliance with an instruction, which is a ' +
        'behaviour, and the trace they read includes the reply, so they are not independent of the ' +
        'group above.', '');
      out.push(`| grader | ${conditions.join(' | ')} |`);
      out.push(`|---|${conditions.map(() => '---').join('|')}|`);
      for (const [grader, byCondition] of checks)
        out.push(`| \`${grader}\` | ${conditions.map((c) => f2(byCondition[c])).join(' | ')} |`);
      out.push('');
    }
  }
  return out;
}

/**
 * FormatComparison — delta and capability under separate headings, the noise floor
 * printed beside them, per-run scatter kept, and no combined mean anywhere. A contrast
 * no larger than the spread is published and marked; suppressing it would be publication
 * bias, and publishing it unmarked would be worse.
 *
 * A5. The printed rule is the rule the code applies, tolerance included: a contrast is
 * inside the floor when `|Δ| <= floor + NOISE_EPSILON`. It used to say "smaller than
 * this is not a finding", which sends a reader applying it by hand to the opposite
 * verdict on exactly the row the code marks — `triage-decompose-epic`/placebo comes out
 * |Δ| 0.13 against a floor of 0.13, and the two differ by one unit in the last place.
 * The legend prints the epsilon rather than describing an exact `<=` the code does not
 * implement, because a reader who reproduces the arithmetic will land on the ulp too.
 * Both the legend and the note cell are pinned by tests.
 *
 * @param {MergedReport} report
 * @returns {string}
 */
export function formatComparison(report) {
  const p = report.provenance ?? {};
  const conditions = Object.keys(report.deltaRows[0]?.conditionScores ?? report.capabilityRows[0]?.conditionScores ?? {});
  const spread = report.baselineSpread;
  const out = [];

  out.push('# Condition comparison', '');
  out.push(`**Subject** \`${p.subjectModel}\` · **judge** \`${p.judgeModel}\` · **CLI** \`${p.claudeVersion}\` · ` +
    `**runs/case** ${p.runsPerCase} · **started** ${p.startedAt}`);
  out.push('');
  out.push(`**Suite** \`${p.suiteSha}\` · **pre-registration** \`${p.preRegistrationSha}\` · ` +
    `**instrument** \`${String(p.instrumentSha ?? '').slice(0, 12) || 'unrecorded'}\` · ` +
    `**cost** ~$${(p.costUsdEstimate ?? 0).toFixed(2)} API-equivalent (subscription-metered; no money moved)`);
  const own = Object.entries(p.conditionShas ?? {});
  if (own.length > 0)
    out.push('', '**Conditions** ' + own.map(([id, sha]) =>
      `${id} \`${String(sha).slice(0, 12) || 'unrecorded'}\``).join(' · ') +
      ' — each condition\'s own digest; the instrument above is everything the conditions share.');
  out.push('');
  out.push(`**Noise floor — ${typeof spread === 'number' ? f2(spread) : 'unmeasured'}.** The worst per-case ` +
    `spread between the stock-Claude columns the sweeps produced against identical cases. A contrast at ` +
    `or below this floor (|Δ| <= floor + ${inv.NOISE_EPSILON}) is not a finding, and every one of them ` +
    `is marked. A contrast that ties the floor is inside it: the floor is the smallest difference this ` +
    `instrument resolves, so a difference equal to it resolves nothing. The tolerance is there because ` +
    `a contrast and the floor are means of the same fractions summed in different orders, so a ` +
    `mathematical tie lands one unit in the last place either side.`);
  out.push('');

  out.push('## Delta evidence', '');
  if (report.deltaRows.length === 0) out.push('_No delta rows._', '');
  else {
    out.push(`| case | ${conditions.join(' | ')} | none |`);
    out.push(`|---|${conditions.map(() => '---').join('|')}|---|`);
    for (const r of report.deltaRows)
      out.push(`| \`${r.case}\` | ${conditions.map((c) => f2(r.conditionScores[c])).join(' | ')} | ` +
        `${f2(mean(r.baselineScores))} |`);
    out.push('');
    out.push('The `none` column is stock Claude Code, measured once per sweep against identical cases and ' +
      'averaged here. The averaging is only for this cell — the columns themselves are kept apart below, ' +
      'because their spread is the noise floor.', '');
    for (const r of report.deltaRows.filter((x) => x.groupContrasts))
      out.push(`\`${r.case}\` is registered as carrying no case-level contrast, so it has no contrast ` +
        'column below. The score above is the harness\'s own, which averages every grader on the case, ' +
        'guards included; it is printed and not registered. The registered quantities are its grader ' +
        'groups, below.', '');
    out.push('### Contrasts — treatment minus control', '');
    out.push('| case | vs | Δ | registered direction | note |');
    out.push('|---|---|---|---|---|');
    for (const r of report.deltaRows)
      for (const c of r.contrasts)
        out.push(`| \`${r.case}\` | ${c.control} | ${signed(c.value)} | ${direction(c.expected)} | ` +
          // A5. "at or below" so a tie with the floor — which the code marks — reads the
          // same way in the cell as it does in the legend above.
          `${c.belowNoiseFloor ? 'at or below the noise floor' : ''} |`);
    out.push('');
    out.push('The direction column is the sign registered before any run. It is a prediction, not a ' +
      'measurement, and it is typeset as a sign so it can never be read as one.', '');
  }

  out.push('## Capability evidence', '');
  out.push('Single-arm: a replayed transcript carries the plugin into both arms, so these numbers have no ' +
    'referent outside themselves. They are description, not contrast, and nothing here may be averaged ' +
    'with the table above.', '');
  if (report.capabilityRows.length === 0) out.push('_No capability rows._', '');
  else {
    out.push(`| case | ${conditions.join(' | ')} |`);
    out.push(`|---|${conditions.map(() => '---').join('|')}|`);
    for (const r of report.capabilityRows)
      out.push(`| \`${r.case}\` | ${conditions.map((c) => f2(r.conditionScores[c])).join(' | ')} |`);
    out.push('');
  }

  out.push(...formatGroups(report, conditions));

  out.push('## Per-run scatter', '');
  out.push('Means are printed above; these are what they were taken from. A method that works two runs in ' +
    'three and one that works every time have the same mean.', '');
  out.push('| case | condition | runs |');
  out.push('|---|---|---|');
  const scatter = (r) => {
    for (const c of conditions)
      out.push(`| \`${r.case}\` | ${c} | ${(r.conditionRunScores[c] ?? []).map((n) => f2(n)).join(' · ') || '—'} |`);
  };
  for (const r of report.deltaRows) {
    scatter(r);
    if (r.baselineScores.length > 0)
      out.push(`| \`${r.case}\` | none (per sweep) | ${r.baselineScores.map((n) => f2(n)).join(' · ')} |`);
  }
  // A6. Capability rows get no `none (per sweep)` row, and the loop is split rather than
  // guarded so the rule is structural: these cases are registered `ablation: none`, so a
  // baseline row here would print numbers for the comparison the heading above says does
  // not exist. MergeSweeps already refuses to collect the baselines; this is the printer
  // saying the same thing, so neither half alone has to be remembered.
  for (const r of report.capabilityRows) scatter(r);
  out.push('');

  const notes = [...report.advisories, ...report.deltaRows.flatMap((r) => r.advisories.map((a) => `${r.case}: ${a}`)),
    ...report.capabilityRows.flatMap((r) => r.advisories.map((a) => `${r.case}: ${a}`))];
  if (notes.length > 0) {
    out.push('## Advisories', '');
    for (const n of notes) out.push(`- ${n}`);
    out.push('');
  }

  out.push('No combined score is emitted. Delta and capability evidence answer different questions, and a ' +
    'mean across them would answer neither.');
  return out.join('\n') + '\n';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Handles-first — everything below receives what it touches.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * BuildProvenance.
 *
 * The declared signature is `(revParse, digest, clock, sweeps)`. Two inputs it needs
 * have no other source and are appended: the pre-registration (whose `runsPerCase` is
 * a registered promise, not an observation) and the path the digest handle is asked
 * for. Both are recorded as insufficiencies rather than smuggled in.
 *
 * Models and CLI version are read from the sweep DOCUMENTS — what actually ran — so
 * that I2 compares the promise against the event. Reading them from the
 * pre-registration would compare the promise against itself, which is vacuous. Sweeps
 * that disagree on any of the three are refused: three sweeps run under two CLI
 * versions are not one comparison.
 *
 * `instrumentSha` is recorded the same way and for the same reason — it says which
 * cases, graders, transcripts and fixture produced these numbers; `conditionShas` says
 * which condition text each sweep loaded — but a disagreement is
 * left to I2b rather than thrown here. See the comment at the assignment.
 *
 * @param {RevParse} revParse
 * @param {(path: string) => Promise<{digest: string, dirty: boolean}>} digest
 * @param {Clock} clock
 * @param {SweepRecord[]} sweeps
 * @param {PreRegistration} preRegistration
 * @param {string} preRegistrationPath
 * @returns {Promise<Provenance>}
 */
export async function buildProvenance(revParse, digest, clock, sweeps, preRegistration, preRegistrationPath) {
  const agree = (label, values) => {
    const set = new Set(values.map((v) => JSON.stringify(v ?? null)));
    if (set.size > 1)
      bad(`sweeps disagree on ${label} (${[...set].join(', ')}) — they are not one comparison`);
    return values[0];
  };
  const docs = sweeps.map((s) => s.document);
  const claudeVersion = agree('claudeVersion', docs.map((d) => d.claudeVersion));
  const subjectModel = agree('subject model', docs.map((d) => d.suite?.modelOverride));
  const judgeModel = agree('judge model', docs.map((d) => d.suite?.judgeModel));

  // NOT routed through `agree`. A mixed set — some sweeps stamped, some not — must be
  // refused by I2b, which can name the side that differs and say what to re-run; a throw
  // here could only say "they disagree", and an absent digest is not a disagreement.
  // Anything short of unanimity records '' and I2b does the refusing.
  const shas = sweeps.map((s) => s.instrumentSha).filter((x) => typeof x === 'string' && x !== '');
  const instrumentSha =
    shas.length === sweeps.length && new Set(shas).size === 1 ? shas[0] : '';
  // The per-condition half is never expected to agree across sweeps, so each is recorded
  // under its own id, '' where a record predates it. I2b does the refusing.
  /** @type {Record<string, string>} */
  const conditionShas = {};
  for (const s of sweeps)
    conditionShas[s.condition] = typeof s.conditionSha === 'string' ? s.conditionSha : '';

  const starts = sweeps.map((s) => s.startedAt ?? s.document.startedAt).filter(Boolean).sort();
  const { digest: preRegistrationSha } = await digest(preRegistrationPath);

  return {
    suiteSha: (await revParse('HEAD')).trim(),
    preRegistrationSha,
    instrumentSha,
    conditionShas,
    claudeVersion: claudeVersion ?? '',
    subjectModel: subjectModel ?? '',
    judgeModel: judgeModel ?? '',
    startedAt: starts[0] ?? clock(),
    runsPerCase: preRegistration.runsPerCase,
    costUsdEstimate: docs.reduce((a, d) => a + (d.costUsd ?? 0), 0),
  };
}

/** sha256 hex over exact bytes. The algorithm was never named; this one is named here. */
export const digestOf = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * PreRegistrationDigest — the working-tree content hash, plus dirtiness, together.
 * They travel as one value because a caller that has to ask separately will eventually
 * forget to, and a digest a reader cannot check out is worse than no digest at all.
 *
 * @param {(path: string) => Promise<string>} readTextFile
 * @param {(args: string[]) => Promise<{code: number, stdout: string, stderr: string}>} git
 */
export const makePreRegistrationDigest = (readTextFile, git) => async (path) => {
  const text = await readTextFile(path);
  const status = await git(['status', '--porcelain', '--', path]);
  // A git that cannot answer is not a git that says "clean".
  const dirty = status.code !== 0 || status.stdout.trim() !== '';
  return { digest: digestOf(text), dirty };
};

/**
 * The digest of the pre-registration AS COMMITTED. I8 compares it against the
 * working-tree digest the report carries, so an edit made after the commit is caught
 * even on a tree git reports clean — and a file that is not committed at all yields
 * '', which I8 refuses rather than reading as agreement.
 */
/**
 * The instrument as it stands at merge time, for I2b to compare against what the sweeps
 * recorded. Takes the digest function as a handle rather than calling `instrumentDigest`
 * directly, so a test can supply one without a suite on disk — the same seam as
 * {@link RevParse} and {@link PreRegistrationDigest}.
 *
 * A digest that cannot be taken yields '', and I2b refuses that: a suite the merger
 * cannot read is not a suite it can vouch for, and returning the sweeps' own sha here
 * would be the check confirming itself.
 *
 * The failure travels WITH the empty sha rather than being swallowed. "No instrument
 * digest was computed" is the same sentence for a suite directory that is not there, a
 * file the process may not read, and a bug in the digest itself — and those are three
 * different things for the operator to do next. The reason is not thrown, because the
 * other invariants still have things to say about this report.
 *
 * @param {(suiteDir: string) => Promise<string>} digestSuite
 * @param {string} suiteDir
 * @returns {Promise<{sha: string, error: string}>}
 */
export const resolveInstrumentSha = (digestSuite, suiteDir) =>
  Promise.resolve()
    .then(() => digestSuite(suiteDir))
    .then((d) =>
      typeof d === 'string' && d !== ''
        ? { sha: d, error: '' }
        : { sha: '', error: `the digest of ${suiteDir} came back as ${JSON.stringify(d)}, not a sha` })
    // `code` first: ENOENT and EACCES are the two an operator can act on directly.
    .catch((e) => {
      const message = e?.message ?? String(e);
      // Node already prefixes fs errors with their code; do not print "ENOENT: ENOENT: …".
      const prefixed = e?.code && !message.startsWith(`${e.code}`) ? `${e.code}: ${message}` : message;
      return { sha: '', error: prefixed };
    });

/**
 * ResolveConditionShas — the per-condition half of {@link resolveInstrumentSha}, one
 * digest per registered condition. A failure is recorded against ITS condition and the
 * others are still computed: a merge missing one condition's directory should say so
 * for that condition, and say nothing false about the rest.
 *
 * @param {(suiteDir: string, id: string) => Promise<string>} digestCondition
 * @param {string} suiteDir
 * @param {string[]} conditions  the registered ids
 * @returns {Promise<{shas: Record<string,string>, errors: Record<string,string>}>}
 */
export async function resolveConditionShas(digestCondition, suiteDir, conditions) {
  const shas = {};
  const errors = {};
  for (const id of conditions) {
    const r = await resolveInstrumentSha((dir) => digestCondition(dir, id), suiteDir);
    if (r.sha) shas[id] = r.sha;
    else errors[id] = r.error;
  }
  return { shas, errors };
}

async function committedDigest(git, absPath) {
  const root = await git(['rev-parse', '--show-toplevel']);
  if (root.code !== 0) return '';
  const rel = relative(root.stdout.trim(), absPath);
  const shown = await git(['show', `HEAD:${rel}`]);
  return shown.code === 0 ? digestOf(shown.stdout) : '';
}

/* ────────────────────────────────────────────────────────────────────────────
 * Entry point — the only place that reads, writes or spawns.
 * ──────────────────────────────────────────────────────────────────────────── */

const USAGE = 'usage: node scripts/merge-results.mjs <results-dir> [--out <file>] [--pre-registration <file>]';

/** @param {string[]} argv */
export function parseArgv(argv) {
  const args = { resultsDir: '', out: '', preRegistration: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i] ?? bad(USAGE);
    else if (a === '--pre-registration') args.preRegistration = argv[++i] ?? bad(USAGE);
    else if (a.startsWith('--')) bad(`unknown option ${a}\n${USAGE}`);
    else if (args.resultsDir === '') args.resultsDir = a;
    else bad(`unexpected argument ${a}\n${USAGE}`);
  }
  if (args.resultsDir === '') bad(USAGE);
  return args;
}

const spawnCapture = (command, args) =>
  new Promise((res) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => res({ code: 127, stdout, stderr: String(e) }));
    child.on('close', (code) => res({ code: code ?? 0, stdout, stderr }));
  });

async function main(argv) {
  const args = parseArgv(argv);
  const readTextFile = (p) => readFile(p, 'utf8');
  const writeTextFile = async (p, c) => {
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, c, 'utf8');
  };
  const git = (a) => spawnCapture('git', a);
  const revParse = async (ref) => (await git(['rev-parse', ref])).stdout;
  const clock = () => new Date().toISOString();

  const resultsDir = resolve(args.resultsDir);
  // SuitePaths puts results at <suiteDir>/results, so the suite is its parent and the
  // pre-registration is its sibling.
  const suiteDir = resolve(resultsDir, '..');
  const preRegPath = resolve(args.preRegistration || join(resultsDir, '..', 'PRE-REGISTRATION.md'));
  const outPath = args.out ? resolve(args.out) : '';

  const preRegistration = parsePreRegistration(
    await readTextFile(preRegPath).catch(() => bad(`no pre-registration at ${preRegPath}`))
  );
  const drift = parseDriftRecord(await readTextFile(join(resultsDir, 'drift.json')).catch(() => null));

  const sweeps = [];
  for (const condition of preRegistration.conditions) {
    const file = join(resultsDir, `${condition}.json`);
    const text = await readTextFile(file).catch(() => bad(`no sweep at ${file} for registered condition '${condition}'`));
    sweeps.push(parseSweepRecord(text, condition));
  }

  const { digest: workingDigest, dirty } = await makePreRegistrationDigest(readTextFile, git)(preRegPath);
  const memoisedDigest = async () => ({ digest: workingDigest, dirty });
  const provenance = await buildProvenance(revParse, memoisedDigest, clock, sweeps, preRegistration, preRegPath);

  // The kept traces, read once and handed in, so everything above this line stays pure.
  // Only a registration with a grader group needs them — the fence count is published on
  // a group row — and a run whose trace cannot be read produces no count, which I12
  // refuses rather than reading as a clean run.
  /** @type {Record<string, string|null>|undefined} */
  let traceTexts;
  if (preRegistration.cases.some((c) => (c.contrasts ?? 'case') === 'groups')) {
    traceTexts = {};
    for (const s of sweeps)
      for (const c of s.document.cases ?? [])
        for (const arm of ['with', 'without'])
          for (const r of c.arms?.[arm] ?? [])
            if (typeof r?.tracePath === 'string' && r.tracePath !== '' && !(r.tracePath in traceTexts))
              traceTexts[r.tracePath] = await readTextFile(r.tracePath).catch(() => null);
  }
  const report = mergeSweeps(sweeps, preRegistration, provenance, { traceTexts });

  // Taken now, over the tree being merged from — so a grader, fixture or condition edited
  // between the sweeps and this merge is caught by I2b rather than published.
  const instrument = await resolveInstrumentSha(instrumentDigest, suiteDir);
  const conditions = await resolveConditionShas(conditionDigest, suiteDir, preRegistration.conditions);

  const check = checkReport(report, preRegistration, {
    sweeps,
    drift,
    committedPreRegistrationSha: await committedDigest(git, preRegPath),
    preRegistrationDirty: dirty,
    instrumentSha: instrument.sha,
    instrumentShaError: instrument.error,
    conditionShas: conditions.shas,
    conditionShaErrors: conditions.errors,
  });
  for (const reason of check.skipped ?? []) process.stderr.write(`not run — ${reason}\n`);
  if (!check.ok) {
    process.stderr.write('refusing to emit a report — invariants violated:\n');
    for (const v of check.violations) process.stderr.write(`  ${v}\n`);
    // The advisories go with them. A violation says WHICH rule refused; an advisory
    // often says why — a group that could not be scored, a sweep that produced no
    // baseline, a trace that could not be read — and on a refusal the report that would
    // have carried them is never written.
    const notes = [
      ...report.advisories,
      ...[...report.deltaRows, ...report.capabilityRows].flatMap((r) => r.advisories.map((a) => `${r.case}: ${a}`)),
    ];
    if (notes.length > 0) {
      process.stderr.write('advisories:\n');
      for (const n of notes) process.stderr.write(`  ${n}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const text = formatComparison(report);
  if (outPath) {
    await writeTextFile(outPath, text);
    process.stderr.write(`wrote ${outPath}\n`);
  } else process.stdout.write(text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => {
    process.stderr.write(`${e instanceof MergeError ? e.message : e.stack}\n`);
    process.exitCode = 1;
  });
}

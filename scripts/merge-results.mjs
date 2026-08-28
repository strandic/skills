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

/** The three conditions we author. `none` arrives as the harness's own without-arm. */
const CONDITION_IDS = ['treatment', 'oneliner', 'placebo'];

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
  for (const c of pre.conditions)
    if (!CONDITION_IDS.includes(c)) bad(`${at('conditions')}: '${c}' is not a ConditionId`);
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
    if (!Array.isArray(s.tags)) bad(`${at('cases')}: ${s.name} has no tags array`);
    if (typeof s.scored !== 'boolean') bad(`${at('cases')}: ${s.name} has no scored flag`);
    if (typeof s.measures !== 'string') bad(`${at('cases')}: ${s.name} has no measures line`);
  }

  const controls = ['none', ...pre.conditions.filter((c) => c !== 'treatment')];
  if (!pre.expectedDirection || typeof pre.expectedDirection !== 'object')
    bad(`${at('expectedDirection')}: missing`);
  for (const [key, value] of Object.entries(pre.expectedDirection)) {
    if (value !== -1 && value !== 0 && value !== 1)
      bad(`${at('expectedDirection')}: ${key} = ${JSON.stringify(value)} — a direction is a sign ` +
        `(-1 | 0 | 1), never a predicted score`);
    const slash = key.lastIndexOf('/');
    const [caseName, control] = [key.slice(0, slash), key.slice(slash + 1)];
    if (!names.has(caseName)) bad(`${at('expectedDirection')}: ${key} names no registered case`);
    if (!controls.includes(control)) bad(`${at('expectedDirection')}: ${key} names no registered control`);
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
  return pre;
}

/**
 * `results/drift.json`. Absent, unparseable, or missing its boolean, this reads as
 * DRIFTED: absence of evidence is not evidence of compliance, and a run that skipped
 * the drift check must not be able to quietly produce a report.
 *
 * @param {string|null} json  null when the file is not there
 * @returns {DriftRecord}
 */
export function parseDriftRecord(json) {
  if (json === null || json === undefined)
    return { drifted: true, reason: 'no results/drift.json — the drift check did not run', checkedAt: '' };
  let value;
  try {
    value = JSON.parse(json);
  } catch (e) {
    return { drifted: true, reason: `results/drift.json is not JSON: ${e.message}`, checkedAt: '' };
  }
  if (!value || typeof value.drifted !== 'boolean')
    return { drifted: true, reason: 'results/drift.json carries no `drifted` boolean', checkedAt: '' };
  return { drifted: value.drifted, reason: value.reason ?? '', checkedAt: value.checkedAt ?? '' };
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
    if (score === null) continue; // the control did not run here; the row says so in its advisories
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
 * I1b's stamp, applied as its own pass rather than inside ComputeContrasts — the
 * spread is a suite-wide quantity and is not known while a single case's contrasts are
 * being built. Keeping it separate also means a report assembled without this pass
 * fails I1b loudly instead of reading as clean.
 *
 * Every contrast is stamped, not only the sub-noise ones, so the field's ABSENCE never
 * has to be interpreted.
 *
 * @param {MergedCaseRow[]} rows
 * @param {number} spread
 */
export function markNoiseFloor(rows, spread) {
  for (const row of rows)
    for (const c of row.contrasts ?? [])
      c.belowNoiseFloor = Number.isFinite(spread) ? Math.abs(c.value) < spread : false;
  return rows;
}

/**
 * MergeSweeps — three sweeps into one comparison.
 *
 * Rows are pushed into two arrays as they are built. Not one list and a filter: the
 * split between a contrast and a number with no referent is the report's most
 * load-bearing distinction, and a filter is one forgotten predicate away from a
 * headline that averages a 0.65-against-nothing into a delta.
 *
 * @param {SweepResult[]|SweepRecord[]} sweeps
 * @param {PreRegistration} preRegistration
 * @param {Provenance} provenance
 * @returns {MergedReport}
 */
export function mergeSweeps(sweeps, preRegistration, provenance) {
  if (!Array.isArray(sweeps) || sweeps.length === 0) bad('no sweeps to merge');
  /** @type {Map<ConditionId, HarnessDocument>} */
  const docs = new Map();
  for (const s of sweeps) {
    if (!s?.document) bad(`sweep '${s?.condition}' carries no document`);
    if (docs.has(s.condition)) bad(`two sweeps for condition '${s.condition}'`);
    docs.set(s.condition, s.document);
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
      if (!c) {
        row.conditionScores[condition] = null;
        row.conditionRunScores[condition] = [];
        row.advisories.push(`${condition}: case did not run`);
        continue;
      }
      const runs = extractRunScores(doc, spec.name);
      row.conditionScores[condition] = mean(runs.with);
      row.conditionRunScores[condition] = runs.with;
      if (runs.without.length > 0) row.baselineScores.push(mean(runs.without));
      else if (spec.evidence === 'delta')
        row.advisories.push(`${condition}: no without-arm, so this sweep contributes no baseline`);

      // skippedPaidGraders means the arms were scored on different grader sets. The
      // harness omits its own delta for exactly this reason; so do we.
      if ([...(c.arms.with ?? []), ...(c.arms.without ?? [])].some((r) => r.skippedPaidGraders)) {
        comparable = false;
        row.advisories.push(`${condition}: a run skipped paid graders — the arms are not comparable`);
      }
      for (const a of c.advisories ?? []) row.advisories.push(`${condition}: ${a}`);
    }

    if (spec.evidence === 'delta' && comparable)
      row.contrasts = computeContrasts(row.conditionScores, row.baselineScores, preRegistration, spec.name);

    if (spec.evidence === 'delta') rows.delta.push(row);
    else if (spec.evidence === 'capability') rows.capability.push(row);
    else bad(`case '${spec.name}': unknown evidence kind '${spec.evidence}'`);
  }

  const spread = computeBaselineSpread(rows.delta.map((r) => r.baselineScores));
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
 * @param {{drift: DriftRecord, committedPreRegistrationSha: string, preRegistrationDirty: boolean}} ctx
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function checkReport(report, preRegistration, ctx) {
  const scored = preRegistration.cases.filter(
    (s) => !(s.tags ?? []).includes('control') && s.scored !== false
  );
  const expectedDelta = scored.filter((s) => s.evidence === 'delta').length;
  const expectedCapability = scored.filter((s) => s.evidence === 'capability').length;
  const registered = {
    preRegistrationSha: ctx.committedPreRegistrationSha,
    subjectModel: preRegistration.subjectModel,
    claudeVersion: preRegistration.claudeVersion,
  };

  const checks = [
    ['I1', inv.i1PublishableOnlyWhenComplete(report)],
    ['I1b', inv.i1bNoiseFloorMarked(report)],
    ['I2', inv.i2RunNotVoid(report, registered, ctx.drift, ctx.preRegistrationDirty)],
    ['I4', inv.i4EvidenceKindsNeverMixed(report, expectedDelta, expectedCapability)],
    ['I7', inv.i7ControlNeverInHeadline(report, preRegistration.cases)],
    ['I8', inv.i8PreRegistrationFrozen(
      ctx.committedPreRegistrationSha, report?.provenance?.preRegistrationSha, ctx.preRegistrationDirty)],
  ];
  const violations = [];
  for (const [id, result] of checks)
    for (const v of result.violations) violations.push(`${id}: ${v}`);
  return { ok: violations.length === 0, violations };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure — the comparison table.
 * ──────────────────────────────────────────────────────────────────────────── */

const f2 = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : n.toFixed(2));
const signed = (n) => (n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2));
/** A registered direction is typeset as a sign, never as a score: `+1`, not `1.00`. */
const direction = (d) => (d > 0 ? '+1' : d < 0 ? '-1' : '0');

/**
 * FormatComparison — delta and capability under separate headings, the noise floor
 * printed beside them, per-run scatter kept, and no combined mean anywhere. A contrast
 * smaller than the spread is published and marked; suppressing it would be publication
 * bias, and publishing it unmarked would be worse.
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
    `**cost** ~$${(p.costUsdEstimate ?? 0).toFixed(2)} API-equivalent (subscription-metered; no money moved)`);
  out.push('');
  out.push(`**Noise floor — ${typeof spread === 'number' ? f2(spread) : 'unmeasured'}.** The worst per-case ` +
    `spread between the stock-Claude columns the sweeps produced against identical cases. A contrast ` +
    `smaller than this is not a finding, and every one below it is marked.`);
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
    out.push('### Contrasts — treatment minus control', '');
    out.push('| case | vs | Δ | registered direction | note |');
    out.push('|---|---|---|---|---|');
    for (const r of report.deltaRows)
      for (const c of r.contrasts)
        out.push(`| \`${r.case}\` | ${c.control} | ${signed(c.value)} | ${direction(c.expected)} | ` +
          `${c.belowNoiseFloor ? 'below the noise floor' : ''} |`);
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

  out.push('## Per-run scatter', '');
  out.push('Means are printed above; these are what they were taken from. A method that works two runs in ' +
    'three and one that works every time have the same mean.', '');
  out.push('| case | condition | runs |');
  out.push('|---|---|---|');
  for (const r of [...report.deltaRows, ...report.capabilityRows]) {
    for (const c of conditions)
      out.push(`| \`${r.case}\` | ${c} | ${(r.conditionRunScores[c] ?? []).map((n) => f2(n)).join(' · ') || '—'} |`);
    if (r.baselineScores.length > 0)
      out.push(`| \`${r.case}\` | none (per sweep) | ${r.baselineScores.map((n) => f2(n)).join(' · ')} |`);
  }
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

  const starts = sweeps.map((s) => s.startedAt ?? s.document.startedAt).filter(Boolean).sort();
  const { digest: preRegistrationSha } = await digest(preRegistrationPath);

  return {
    suiteSha: (await revParse('HEAD')).trim(),
    preRegistrationSha,
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
  // SuitePaths puts results at <suiteDir>/results, so the pre-registration is its sibling.
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
  const report = mergeSweeps(sweeps, preRegistration, provenance);

  const check = checkReport(report, preRegistration, {
    drift,
    committedPreRegistrationSha: await committedDigest(git, preRegPath),
    preRegistrationDirty: dirty,
  });
  if (!check.ok) {
    process.stderr.write('refusing to emit a report — invariants violated:\n');
    for (const v of check.violations) process.stderr.write(`  ${v}\n`);
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

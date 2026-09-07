/**
 * The defect ledger: reading it, classifying and accepting its entries, and probing a
 * criterion against the judge outside the harness.
 *
 * Signatures: `scripts/interfaces.mjs` (ReadDefectLedger, ClassifyDefect,
 * RunDetectScript, CheckDefectAcceptance, JudgePrompt, AskJudge, CheckCriterionProbes).
 * Shapes: `scripts/types.mjs` (DefectSpec, DefectClass, ReviewTally).
 * Placement: a module of its own, recorded as a correction to step 0's tree in
 * `docs/plans/primer-evals/defect-injection/3-todos.md`.
 *
 * Nothing here names a defect, a suite or a skill.
 *
 * The split is the one every other module here keeps: everything that decides something
 * is pure, and everything that touches the world takes a named handle first. So the
 * classification rule, the acceptance table, the judge prompt and the probe verdicts are
 * all functions of their arguments, and only the ledger read, the detect script and the
 * judge call receive a handle.
 */

/** @import { DefectSpec, DefectClass, ReviewTally } from './types.mjs' */
/** @import { ReadTextFile, SpawnCapture, EvalCommand } from './interfaces.mjs' */

/** Raised by a function here that refuses its input. Carries no stack the caller wants. */
export class LedgerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LedgerError';
  }
}

const bad = (message) => {
  throw new LedgerError(message);
};

/**
 * Every file an entry must carry, as `field: filename`. A missing one is a refusal
 * rather than an absent field: an entry with no `criteria.md` grades nothing, and an
 * entry with no `signature` cannot be looked for in a trace — in both cases the ledger
 * would report a defect the instrument never measures.
 */
const ENTRY_FILES = {
  intendedClass: 'intended-class',
  class: 'class',
  tallyAlone: 'tally-alone',
  tallyInCompany: 'tally-in-company',
  signature: 'signature',
  neighbour: 'neighbour',
  diff: 'diff.patch',
  detect: 'detect.sh',
  behaviour: 'behaviour.md',
  cause: 'cause.md',
  criteria: 'criteria.md',
};

/** The four replies the designer wrote per defect, plus the neighbour's, make five probes. */
export const PROBE_NAMES = ['by-cause', 'by-observable', 'hedge', 'wrong', 'neighbour'];

/** Which way each probe must come out. The neighbour is the one that tests discrimination. */
const PROBE_MUST = {
  'by-cause': 'PASS',
  'by-observable': 'PASS',
  hedge: 'FAIL',
  wrong: 'FAIL',
  neighbour: 'FAIL',
};

const CLASSES = ['run-only', 'read-visible'];

/**
 * `3/3` → `{named: 3, of: 3}`. `of` travels with `named` so a tally is never read
 * against an assumed panel size: "3" alone is three out of a number the reader supplies,
 * and the reader would supply the number the design expected rather than the number who
 * looked.
 *
 * @param {string} text
 * @param {string} where
 * @returns {ReviewTally}
 */
export function parseTally(text, where) {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(String(text ?? ''));
  if (!m)
    bad(`${where}: ${JSON.stringify(String(text ?? '').trim())} is not a tally — it must read ` +
      'named/of, because a count with no panel size is read against the size the reader expected');
  const [named, of] = [Number(m[1]), Number(m[2])];
  if (of < 1) bad(`${where}: nobody reviewed it — a tally out of zero classifies nothing`);
  if (named > of) bad(`${where}: ${named} named it out of ${of} who looked`);
  return { named, of };
}

/**
 * ClassifyDefect — the whole classification rule, and nothing else sets a class.
 *
 * Zero named: `run-only`. Two or more: `read-visible`. Exactly one: `dropped`, which
 * means replaced by a fresh defect and reviewed again — one reader is not a panel, and a
 * defect one of three saw is neither invisible to a read nor visible to it.
 *
 * The designer's intent reaches no branch here. It is recorded beside the class so the
 * two can be compared, and recon's value came from exactly that comparison: every defect
 * intended run-only came out read-visible.
 *
 * @param {ReviewTally} tallyAlone
 * @returns {DefectClass|'dropped'}
 */
export function classifyDefect(tallyAlone) {
  const named = tallyAlone?.named;
  const of = tallyAlone?.of;
  if (!Number.isInteger(named) || !Number.isInteger(of) || of < 1 || named < 0 || named > of)
    bad(`classifyDefect: ${JSON.stringify(tallyAlone)} is not a tally of named out of of`);
  if (named === 0) return 'run-only';
  if (named === 1) return 'dropped';
  return 'read-visible';
}

/**
 * ReadDefectLedger — one entry per directory under the ledger.
 *
 * Refuses an entry missing any of its files, a tally without `of`, a `neighbour` that
 * names no other entry, and a `class` that disagrees with what the tally says. The last
 * is the point of the type: `class` is set by {@link classifyDefect} and by nothing else,
 * so a hand-edited `class` file is a human reclassifying, which the design forbids.
 *
 * An empty ledger comes back as an empty array. Every consumer refuses that on its own
 * terms, and each of them can say something more useful about it than a reader could.
 *
 * @param {ReadTextFile} readTextFile
 * @param {(path: string) => Promise<{name: string, isDirectory: boolean}[]>} listDirectory
 * @param {string} ledgerDir
 * @returns {Promise<DefectSpec[]>}
 */
export async function readDefectLedger(readTextFile, listDirectory, ledgerDir) {
  const entries = await listDirectory(ledgerDir);
  const ids = (entries ?? []).filter((e) => e.isDirectory).map((e) => e.name).sort();
  /** @type {DefectSpec[]} */
  const ledger = [];

  const digests = await readTextFile(`${ledgerDir}/transcript-digests.txt`).catch(() => null);
  const transcriptDigests = {};
  for (const line of (digests ?? '').split('\n')) {
    const m = /^\s*([a-z-]+)\s+([0-9a-f]{8,64})\s*$/.exec(line);
    if (m) transcriptDigests[m[1] === 'criteria-author' ? 'criteriaAuthor' : m[1]] = m[2];
  }

  for (const id of ids) {
    const dir = `${ledgerDir}/${id}`;
    /** @type {Record<string, string>} */
    const raw = {};
    for (const [field, file] of Object.entries(ENTRY_FILES))
      raw[field] = await readTextFile(`${dir}/${file}`)
        .catch(() => bad(`${id}: no ${file} — an entry missing one of its files describes a defect the ` +
          'instrument does not measure'));
    for (const probe of PROBE_NAMES.filter((p) => p !== 'neighbour'))
      await readTextFile(`${dir}/probes/${probe}.md`)
        .catch(() => bad(`${id}: no probes/${probe}.md — a criterion probed on four replies is a ` +
          'criterion probed on the four it happened to pass'));

    const tallyAlone = parseTally(raw.tallyAlone, `${id}/tally-alone`);
    const tallyInCompany = parseTally(raw.tallyInCompany, `${id}/tally-in-company`);
    const trimmed = (field) => raw[field].trim();
    for (const field of ['class', 'intendedClass'])
      if (!CLASSES.includes(trimmed(field)))
        bad(`${id}: ${ENTRY_FILES[field]} reads ${JSON.stringify(trimmed(field))}, which is neither ` +
          `${CLASSES.join(' nor ')}`);
    const byRule = classifyDefect(tallyAlone);
    if (trimmed('class') !== byRule)
      bad(`${id}: class reads '${trimmed('class')}' but its alone tally ${tallyAlone.named}/` +
        `${tallyAlone.of} makes it '${byRule}' — the class is the tally, and nothing else sets one`);
    if (trimmed('signature') === '') bad(`${id}: the signature is empty`);
    if (trimmed('neighbour') === '') bad(`${id}: neighbour names nothing`);

    ledger.push({
      id,
      intendedClass: /** @type {DefectClass} */ (trimmed('intendedClass')),
      class: /** @type {DefectClass} */ (trimmed('class')),
      tallyAlone,
      tallyInCompany,
      signature: trimmed('signature'),
      neighbour: trimmed('neighbour'),
      // The graders that score this defect follow from its class: every defect gets a
      // `reported-<id>`, and only a run-only one gets a `surfaced-<id>`, because the
      // manipulation check exists for the class whose observable a read cannot produce.
      graders: [`reported-${id}`, ...(trimmed('class') === 'run-only' ? [`surfaced-${id}`] : [])],
      transcriptDigests,
    });
  }

  // Resolved once every id is known: a neighbour naming a defect that comes later in the
  // sort is legal, one naming nothing is not.
  const known = new Set(ledger.map((d) => d.id));
  for (const d of ledger) {
    if (d.neighbour === d.id) bad(`${d.id}: names itself as its neighbour`);
    if (!known.has(d.neighbour))
      bad(`${d.id}: neighbour '${d.neighbour}' is not an entry in this ledger — the neighbour's ` +
        'observable-only reply is the probe that tests this criterion against a near miss');
  }
  return ledger;
}

/**
 * RunDetectScript — one detection script against one copy of the service.
 *
 * Exit 1 is `fired`, exit 0 is not, and any other exit THROWS: a script that could not
 * run has said nothing about the defect, and reading its failure as "did not fire" is
 * how a defect that no longer reproduces gets accepted. Recon met exactly this: an
 * acceptance pass let a script fall back to its default argument, which is the service
 * the ledger sits in, and reported every script as firing where none should have.
 *
 * The service is named as the script's ARGUMENT rather than by running the script in
 * that directory: every committed script takes the service root as `$1` and defaults to
 * its own ledger's service, and {@link SpawnCapture} carries no working directory. The
 * argument is the explicit half of the same choice, and it is the half that fails loudly
 * when it is wrong.
 *
 * @param {SpawnCapture} spawnCapture
 * @param {string} scriptPath
 * @param {string} serviceDir
 * @returns {Promise<{fired: boolean, stderr: string}>}
 */
export async function runDetectScript(spawnCapture, scriptPath, serviceDir) {
  const { code, stderr } = await spawnCapture('bash', [scriptPath, serviceDir], {});
  if (code === 1) return { fired: true, stderr };
  if (code === 0) return { fired: false, stderr };
  return bad(`${scriptPath}: exited ${code}, which is neither fired (1) nor not-fired (0) — a script ` +
    `that could not run has said nothing about the defect${stderr ? `: ${stderr.trim().slice(0, 200)}` : ''}`);
}

/**
 * CheckDefectAcceptance — the acceptance gate as a table of booleans a reader can check.
 *
 * Pure over what the acceptance runs recorded, so nothing here is a judgement. A defect
 * is accepted when all eight hold, and each of them is a separate way for a planted
 * defect to be worthless:
 *
 *   - the suite is green with every defect present, or the fixture announces itself;
 *   - the script fires on the seeded service, or the defect is not there;
 *   - it does not fire on the clean one, or it is not the defect that was planted;
 *   - it still fires after the reference implementation, or the treatment's own build
 *     deletes it before the service starts;
 *   - the signature is in no shipped file, or a trace that only READ the source matches;
 *   - it is not in the transcript, for the same reason;
 *   - it is in no trace from a run that did not start the service, which is that reason
 *     measured rather than argued;
 *   - the scaffolded workspace carries no ledger, or the run can read the answers.
 *
 * An empty ledger or an empty set of observations is refused rather than accepted
 * vacuously: an acceptance gate nothing was put through is not a gate.
 *
 * @param {DefectSpec[]} ledger
 * @param {Record<string, Record<string, boolean>>} observed  keyed by defect id
 * @param {{runOnly: number, readVisible: number}} minimum
 * @returns {{ok: boolean, violations: string[], accepted: string[]}}
 */
export function checkDefectAcceptance(ledger, observed, minimum) {
  const violations = [];
  if (!Array.isArray(ledger) || ledger.length === 0)
    return { ok: false, violations: ['no ledger entries — an acceptance gate nothing was put through is not a gate'], accepted: [] };
  if (!observed || Object.keys(observed).length === 0)
    return { ok: false, violations: ['no acceptance observations — nothing was run against these defects'], accepted: [] };
  if (!minimum || !Number.isInteger(minimum.runOnly) || !Number.isInteger(minimum.readVisible))
    return { ok: false, violations: ['no minimum surviving set supplied'], accepted: [] };

  /** Each rule as `field: [required value, why it matters]`. */
  const RULES = [
    ['suiteGreenWithAll', true, 'the existing suite is not green with every defect present'],
    ['firedOnSeeded', true, 'its detect script does not fire on the seeded service'],
    ['firedOnClean', false, 'its detect script fires on the CLEAN service, so it is not this defect'],
    ['firedAfterReference', true, 'its detect script stops firing once the feature is implemented'],
    ['signatureInShippedFiles', false, 'its signature is a literal in a shipped file, so a run that only read the source would match'],
    ['signatureInTranscript', false, 'its signature appears in the replayed transcript'],
    ['signatureInNonRunningTraces', false, 'its signature appears in a trace from a run that did not start the service'],
    ['workspaceHasLedger', false, 'the scaffolded workspace carries the ledger, so the run can read the answers'],
  ];

  const accepted = [];
  for (const d of ledger) {
    const o = observed[d.id];
    if (!o) { violations.push(`${d.id}: no acceptance observations`); continue; }
    let ok = true;
    for (const [field, required, why] of RULES) {
      if (typeof o[field] !== 'boolean') {
        violations.push(`${d.id}: ${field} was not observed — an unobserved check is not a passed one`);
        ok = false;
        continue;
      }
      if (o[field] !== required) { violations.push(`${d.id}: ${why}`); ok = false; }
    }
    if (ok) accepted.push(d.id);
  }

  const byClass = (kind) => accepted.filter((id) => ledger.find((d) => d.id === id).class === kind).length;
  if (byClass('run-only') < minimum.runOnly)
    violations.push(`${byClass('run-only')} run-only defects survive, ${minimum.runOnly} required`);
  if (byClass('read-visible') < minimum.readVisible)
    violations.push(`${byClass('read-visible')} read-visible defects survive, ${minimum.readVisible} required`);
  return { ok: violations.length === 0, violations, accepted };
}

/**
 * JudgePrompt — the harness's own judge prompt, verbatim.
 *
 * Recorded from the shipped code so an offline probe asks the judge exactly what a sweep
 * would ask it. A criterion probed against a paraphrase of this prompt is a criterion
 * probed against a judge nobody will run. `graders.test.mjs` pins both strings against
 * the pinned binary, so a CLI release that reworded them fails there rather than
 * quietly changing what the probe measured.
 *
 * @param {string} criteria
 * @param {string} focusLabel
 * @param {string} text
 * @returns {{system: string, user: string}}
 */
export function judgePrompt(criteria, focusLabel, text) {
  return {
    system: 'You are a strict, terse evaluation judge for coding-agent traces.',
    user: 'You are grading the output of a coding agent against a criterion.\n\n' +
      `Criterion:\n${criteria}\n\n\n` +
      `Agent output (${focusLabel}):\n${text}\n\n\n` +
      'Respond with exactly one word: PASS or FAIL.',
  };
}

/**
 * AskJudge — one judge call, outside the harness, against the pinned binary in print mode.
 *
 * Resolved by running (`4-recon.md` seam 4): print mode takes a separate system prompt
 * and answers with one word in `result`. Recon put the user prompt on stdin; it is passed
 * here as the trailing positional argument instead, which recon also tried and which
 * returned normally, because {@link SpawnCapture} — the handle every other spawn in this
 * repository goes through — takes a command, its arguments and an environment, and has no
 * stdin. Widening the handle for one caller would put a second way to spawn beside the
 * one that is tested. The verdict is read
 * the way the harness reads it — PASS present and FAIL absent — rather than by string
 * equality, because the model occasionally answers with the word inside a sentence.
 *
 * `is_error` is retried ONCE and then reported `unclear`. Recon saw three consecutive
 * "Not logged in" replies inside one minute, at zero cost and 220 ms, while the harness
 * runs beside them were logged in throughout; a single retry costs one call and covers
 * the whole observed failure. An `unclear` is never a verdict: {@link checkCriterionProbes}
 * fails whichever half it lands on.
 *
 * A call costs about $0.075 in print mode, seventeen times the harness's own judge rate,
 * because print mode carries the CLI's own context. The probe is therefore priced apart
 * from the sweep, and a sweep's judge cost is read from the records instead.
 *
 * @param {SpawnCapture} spawnCapture
 * @param {EvalCommand} evalCommand
 * @param {string} model
 * @param {{system: string, user: string}} prompt
 * @returns {Promise<'PASS'|'FAIL'|'unclear'>}
 */
export async function askJudge(spawnCapture, evalCommand, model, prompt) {
  const { command, env } = evalCommand();
  const argv = ['-p', '--model', model, '--system-prompt', prompt.system, '--output-format', 'json',
    prompt.user];
  const once = async () => {
    const { stdout } = await spawnCapture(command, argv, env);
    let reply;
    try {
      reply = JSON.parse(stdout);
    } catch {
      return { verdict: /** @type {const} */ ('unclear'), retry: false };
    }
    if (reply?.is_error === true) return { verdict: /** @type {const} */ ('unclear'), retry: true };
    const text = String(reply?.result ?? '');
    const passed = /\bPASS\b/i.test(text) && !/\bFAIL\b/i.test(text);
    const failed = /\bFAIL\b/i.test(text) && !/\bPASS\b/i.test(text);
    if (passed) return { verdict: /** @type {const} */ ('PASS'), retry: false };
    if (failed) return { verdict: /** @type {const} */ ('FAIL'), retry: false };
    return { verdict: /** @type {const} */ ('unclear'), retry: false };
  };
  const first = await once();
  if (!first.retry) return first.verdict;
  return (await once()).verdict;
}

/**
 * CheckCriterionProbes — all five verdicts, each the way it was registered.
 *
 * `by-cause` and `by-observable` must PASS, because the criterion scores a reply that
 * identifies the defect by its cause OR by what a client sees, and either alone is
 * enough. `hedge`, `wrong` and the neighbour's observable-only reply must FAIL — the
 * neighbour is the one probe that tests the criterion against a near miss rather than
 * against nothing.
 *
 * All five must be present. A criterion probed on four is a criterion probed on the four
 * it happened to pass. `unclear` fails whichever half it lands on: a judge that did not
 * answer has not agreed.
 *
 * @param {{probe: string, verdict: 'PASS'|'FAIL'|'unclear'}[]} verdicts
 * @returns {{ok: boolean, failures: string[]}}
 */
export function checkCriterionProbes(verdicts) {
  const failures = [];
  const seen = new Map();
  for (const v of verdicts ?? []) {
    if (!PROBE_NAMES.includes(v?.probe)) { failures.push(`'${v?.probe}' is not one of the five probes`); continue; }
    if (seen.has(v.probe)) { failures.push(`${v.probe}: two verdicts for one probe`); continue; }
    seen.set(v.probe, v.verdict);
  }
  for (const probe of PROBE_NAMES) {
    if (!seen.has(probe)) { failures.push(`${probe}: no verdict — all five are required`); continue; }
    const verdict = seen.get(probe);
    const must = PROBE_MUST[probe];
    if (verdict === 'unclear') { failures.push(`${probe}: unclear — a judge that did not answer has not agreed`); continue; }
    if (verdict !== must) failures.push(`${probe}: ${verdict}, must ${must}`);
  }
  return { ok: failures.length === 0, failures };
}

/**
 * The grader files a ledger implies, so the case's graders and the ledger cannot drift
 * apart. `reported-<id>.md` carries the criteria author's rule verbatim and grades the
 * last message; `surfaced-<id>.md` matches the signature in the trace and exists only
 * for a run-only defect — recon classified every defect read-visible, so today this
 * writes twelve files and no `surfaced-*` at all.
 *
 * The `surfaced-*` body carries both probe halves, because it is a patterned grader and
 * I5 refuses one without them: the signature itself must match, and the fixture source
 * must not.
 *
 * @param {DefectSpec[]} ledger
 * @param {Record<string, string>} criteria  defect id → its `criteria.md`
 * @returns {{path: string, text: string}[]}  relative to the case's `graders/` directory
 */
export function graderFilesFor(ledger, criteria) {
  if (!Array.isArray(ledger) || ledger.length === 0)
    bad('graderFilesFor: an empty ledger implies no graders, and a case that grades nothing scores everything');
  const out = [];
  for (const d of ledger) {
    const body = criteria?.[d.id];
    if (typeof body !== 'string' || body.trim() === '')
      bad(`graderFilesFor: no criteria for '${d.id}' — an llm grader with no rubric passes on the judge's mood`);
    out.push({
      path: `reported-${d.id}.md`,
      text: `---\ntype: llm\nfocus: last_message\n---\n${body.trim()}\n`,
    });
    if (d.class !== 'run-only') continue;
    // Regex over the whole session, so the signature has to survive JSON escaping: it is
    // letters, digits, spaces, hyphens and underscores by construction, none of which a
    // JSON encoder touches.
    const pattern = d.signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out.push({
      path: `surfaced-${d.id}.md`,
      text: `---\ntype: regex\ntarget: trace\npattern: '${pattern}'\n---\n` +
        'A manipulation check, not a score: did the run produce this observable at all. ' +
        'Reported with its numbers and no held-or-failed verdict, because it measures ' +
        'compliance with an instruction rather than the outcome, and the trace it reads ' +
        'includes the reply.\n\n## Probes\n\n' +
        `\`\`\`probe-match\n${d.signature}\n\`\`\`\n\n` +
        '```probe-no-match\nthe fixture source, which composes this string at emit time and never ' +
        'carries it as a literal\n```\n',
    });
  }
  return out;
}

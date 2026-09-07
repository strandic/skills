/**
 * Tests for the defect ledger: the classification rule, the acceptance table, the judge
 * prompt and the probe verdicts.
 *
 * Two things here are worth more than the rest. The classification rule is the only
 * thing that sets a class, so a test that it reads the tally is a test that no human
 * reclassified. And the acceptance table is eight booleans, each of which is a separate
 * way for a planted defect to be worthless — so each one is failed on its own, alone,
 * with the other seven true.
 *
 * `node --test scripts/test/*.test.mjs` — the trailing glob matters; a bare directory is
 * read as a module path and fails to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyDefect, parseTally, readDefectLedger, runDetectScript, checkDefectAcceptance,
  judgePrompt, askJudge, checkCriterionProbes, graderFilesFor, LedgerError, PROBE_NAMES,
} from '../ledger.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const LEDGER = 'evals/seven-steps-primer-defects/fixtures/notesvc-seeded/defects';
const GRADERS = 'evals/seven-steps-primer-defects/step4-seeded-defects/graders';

const readTextFile = (p) => readFile(join(repoRoot, p), 'utf8');
const listDirectory = async (p) => {
  const entries = await readdir(join(repoRoot, p), { withFileTypes: true });
  return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
};

const throws = (fn, needle) =>
  assert.throws(fn, (e) => e instanceof LedgerError && e.message.includes(needle),
    `expected a refusal mentioning ${JSON.stringify(needle)}`);

/* ── ClassifyDefect — the whole rule, and nothing else sets a class ────────── */

test('classifyDefect reads the tally and nothing else: 0 run-only, 1 dropped, 2+ read-visible', () => {
  assert.equal(classifyDefect({ named: 0, of: 3 }), 'run-only');
  assert.equal(classifyDefect({ named: 1, of: 3 }), 'dropped');
  assert.equal(classifyDefect({ named: 2, of: 3 }), 'read-visible');
  assert.equal(classifyDefect({ named: 3, of: 3 }), 'read-visible');
});

test('classifyDefect refuses a tally it cannot read rather than guessing a class', () => {
  for (const tally of [undefined, {}, { named: 2 }, { of: 3 }, { named: 4, of: 3 }, { named: -1, of: 3 },
    { named: 0, of: 0 }, { named: 1.5, of: 3 }])
    throws(() => classifyDefect(tally), 'not a tally');
});

test('a tally carries `of`, because a count with no panel size is read against an assumed one', () => {
  assert.deepEqual(parseTally('2/3', 'x'), { named: 2, of: 3 });
  assert.deepEqual(parseTally(' 0 / 5 \n', 'x'), { named: 0, of: 5 });
  throws(() => parseTally('2', 'x'), 'not a tally');
  throws(() => parseTally('', 'x'), 'not a tally');
  throws(() => parseTally('2/0', 'x'), 'classifies nothing');
  throws(() => parseTally('4/3', 'x'), '4 named it out of 3');
});

/* ── ReadDefectLedger — against the committed ledger, and against its refusals ── */

test('the committed ledger reads, and every entry is classified by its own alone tally', async () => {
  const ledger = await readDefectLedger(readTextFile, listDirectory, LEDGER);
  assert.equal(ledger.length, 12, 'twelve defects were accepted at gate 4');
  for (const d of ledger) {
    assert.equal(d.class, classifyDefect(d.tallyAlone), `${d.id}: class disagrees with its tally`);
    assert.ok(d.tallyAlone.of >= 3, `${d.id}: fewer than three reviewers looked at it alone`);
    assert.ok(d.signature.length >= 6, `${d.id}: signature shorter than six characters`);
    assert.ok(ledger.some((o) => o.id === d.neighbour), `${d.id}: neighbour is not in the ledger`);
  }
  assert.deepEqual(ledger[0].transcriptDigests,
    { designer: '91d2f12689938090', criteriaAuthor: 'aa1eb06f85313e8d' },
    'the authoring digests travel with the ledger, so the isolation check has something to check');
});

test('recon`s finding survives in the ledger: every intended run-only defect is read-visible', async () => {
  const ledger = await readDefectLedger(readTextFile, listDirectory, LEDGER);
  assert.equal(ledger.filter((d) => d.class === 'run-only').length, 0,
    'the run-only class is empty on this fixture; a defect appearing in it means the ledger changed');
  assert.ok(ledger.some((d) => d.intendedClass === 'run-only'),
    'the intent is recorded beside the class, and the difference between them is the finding');
});

/** The committed ledger with one entry's files overridden, so a refusal is one edit away. */
const ledgerWith = (overrides, missing = []) => {
  const read = async (p) => {
    const rel = p.replace(`${LEDGER}/`, '');
    if (missing.includes(rel)) throw new Error('ENOENT');
    if (rel in overrides) return overrides[rel];
    return readTextFile(p);
  };
  const list = async (p) => (p === LEDGER
    ? [{ name: 'echo-bypass', isDirectory: true }, { name: 'clienterror-code-leak', isDirectory: true }]
    : listDirectory(p));
  return readDefectLedger(read, list, LEDGER);
};

test('readDefectLedger refuses an entry missing any one of its files', async () => {
  for (const file of ['class', 'signature', 'criteria.md', 'detect.sh', 'neighbour', 'probes/hedge.md'])
    await assert.rejects(() => ledgerWith({}, [`echo-bypass/${file}`]),
      (e) => e.message.includes(file), `a missing ${file} must be a refusal`);
});

test('readDefectLedger refuses a class that disagrees with the tally — no human reclassifies', async () => {
  await assert.rejects(() => ledgerWith({ 'echo-bypass/class': 'run-only\n' }),
    /the class is the tally/);
});

test('readDefectLedger refuses a neighbour that names nothing, and one that names itself', async () => {
  await assert.rejects(() => ledgerWith({ 'echo-bypass/neighbour': 'no-such-defect\n' }),
    /is not an entry in this ledger/);
  await assert.rejects(() => ledgerWith({ 'echo-bypass/neighbour': 'echo-bypass\n' }),
    /names itself/);
});

test('readDefectLedger refuses a tally with no panel size', async () => {
  await assert.rejects(() => ledgerWith({ 'echo-bypass/tally-alone': '3\n' }), /not a tally/);
});

test('an empty ledger reads as an empty array, and every consumer refuses that on its own terms', async () => {
  const ledger = await readDefectLedger(readTextFile, async () => [], LEDGER);
  assert.deepEqual(ledger, []);
  assert.equal(checkDefectAcceptance(ledger, { a: {} }, { runOnly: 0, readVisible: 0 }).ok, false);
});

/* ── The graders the ledger implies ────────────────────────────────────────── */

test('the committed reported-*.md graders are exactly what the ledger generates', async () => {
  const ledger = await readDefectLedger(readTextFile, listDirectory, LEDGER);
  const criteria = {};
  for (const d of ledger) criteria[d.id] = await readTextFile(`${LEDGER}/${d.id}/criteria.md`);
  const files = graderFilesFor(ledger, criteria);
  assert.equal(files.length, 12, 'twelve reported-*, and no surfaced-*: the run-only class is empty');
  for (const f of files)
    assert.equal(f.text, await readTextFile(`${GRADERS}/${f.path}`),
      `${f.path} on disk is not what the ledger generates — one of the two was edited by hand`);
});

test('a run-only defect would gain a surfaced-* grader carrying both probe halves', () => {
  const runOnly = {
    id: 'x', class: 'run-only', intendedClass: 'run-only', signature: 'quota drift 7',
    tallyAlone: { named: 0, of: 3 }, tallyInCompany: { named: 0, of: 3 }, neighbour: 'y',
    graders: [], transcriptDigests: {},
  };
  const files = graderFilesFor([runOnly], { x: 'Score 1 if…' });
  assert.deepEqual(files.map((f) => f.path), ['reported-x.md', 'surfaced-x.md']);
  assert.match(files[1].text, /```probe-match/);
  assert.match(files[1].text, /```probe-no-match/);
  assert.match(files[1].text, /target: trace/);
});

test('graderFilesFor refuses an empty ledger and a defect with no criteria', () => {
  throws(() => graderFilesFor([], {}), 'an empty ledger implies no graders');
  const d = { id: 'x', class: 'read-visible', signature: 's', graders: [] };
  throws(() => graderFilesFor([d], {}), 'no criteria');
  throws(() => graderFilesFor([d], { x: '   ' }), 'no criteria');
});

/* ── RunDetectScript — an exit code that is neither answer is not an answer ─── */

const spawnReturning = (result) => async (command, args) => ({ code: 0, stdout: '', stderr: '', ...result(command, args) });

test('runDetectScript reads exit 1 as fired and exit 0 as not, and names the service it drove', async () => {
  let seen = null;
  const spawn = spawnReturning((command, args) => { seen = [command, args]; return { code: 1 }; });
  assert.deepEqual(await runDetectScript(spawn, 'd/detect.sh', '/svc'), { fired: true, stderr: '' });
  assert.deepEqual(seen, ['bash', ['d/detect.sh', '/svc']],
    'the service is named explicitly: a script left to its default argument drives the ledger`s own copy');
  assert.deepEqual(await runDetectScript(spawnReturning(() => ({ code: 0 })), 'd/detect.sh', '/svc'),
    { fired: false, stderr: '' });
});

test('runDetectScript throws on any other exit — a script that could not run said nothing', async () => {
  for (const code of [2, 127, 137])
    await assert.rejects(
      () => runDetectScript(spawnReturning(() => ({ code, stderr: 'bash: node: not found' })), 'd.sh', '/svc'),
      /neither fired \(1\) nor not-fired \(0\)/);
});

/* ── CheckDefectAcceptance — eight booleans, each failed alone ─────────────── */

const PASSING = {
  suiteGreenWithAll: true,
  firedOnSeeded: true,
  firedOnClean: false,
  firedAfterReference: true,
  signatureInShippedFiles: false,
  signatureInTranscript: false,
  signatureInNonRunningTraces: false,
  workspaceHasLedger: false,
};

const defect = (id, cls) => ({
  id, class: cls, intendedClass: cls, signature: `${id} signal`, neighbour: 'other',
  tallyAlone: { named: cls === 'run-only' ? 0 : 3, of: 3 }, tallyInCompany: { named: 0, of: 3 },
  graders: [], transcriptDigests: {},
});

test('a ledger whose observations all pass is accepted, and the minimum is met', () => {
  const ledger = [defect('a', 'run-only'), defect('b', 'read-visible')];
  const r = checkDefectAcceptance(ledger, { a: { ...PASSING }, b: { ...PASSING } },
    { runOnly: 1, readVisible: 1 });
  assert.ok(r.ok, r.violations.join('; '));
  assert.deepEqual(r.accepted, ['a', 'b']);
});

test('each acceptance boolean, flipped alone, refuses the defect it describes', () => {
  for (const [field, why] of Object.entries({
    suiteGreenWithAll: 'not green',
    firedOnSeeded: 'does not fire on the seeded service',
    firedOnClean: 'fires on the CLEAN service',
    firedAfterReference: 'stops firing once the feature is implemented',
    signatureInShippedFiles: 'literal in a shipped file',
    signatureInTranscript: 'appears in the replayed transcript',
    signatureInNonRunningTraces: 'did not start the service',
    workspaceHasLedger: 'read the answers',
  })) {
    const observed = { a: { ...PASSING, [field]: !PASSING[field] } };
    const r = checkDefectAcceptance([defect('a', 'read-visible')], observed, { runOnly: 0, readVisible: 1 });
    assert.equal(r.ok, false, `${field} flipped and the defect was still accepted`);
    assert.deepEqual(r.accepted, []);
    assert.match(r.violations.join(' '), new RegExp(why), `${field}: the violation does not say why`);
  }
});

test('an unobserved check is not a passed one', () => {
  const { suiteGreenWithAll, ...missing } = PASSING;
  const r = checkDefectAcceptance([defect('a', 'read-visible')], { a: missing }, { runOnly: 0, readVisible: 1 });
  assert.equal(r.ok, false);
  assert.match(r.violations.join(' '), /suiteGreenWithAll was not observed/);
});

test('acceptance refuses an empty ledger, empty observations and a missing minimum', () => {
  assert.match(checkDefectAcceptance([], { a: PASSING }, { runOnly: 0, readVisible: 0 }).violations.join(' '),
    /nothing was put through/);
  assert.match(checkDefectAcceptance([defect('a', 'read-visible')], {}, { runOnly: 0, readVisible: 0 }).violations.join(' '),
    /nothing was run against these defects/);
  assert.match(checkDefectAcceptance([defect('a', 'read-visible')], { a: PASSING }, undefined).violations.join(' '),
    /no minimum surviving set/);
});

test('the minimum is per class, and the plan`s original minimum is unreachable on this ledger', () => {
  const ledger = [defect('a', 'read-visible'), defect('b', 'read-visible')];
  const observed = { a: { ...PASSING }, b: { ...PASSING } };
  assert.ok(checkDefectAcceptance(ledger, observed, { runOnly: 0, readVisible: 2 }).ok);
  const r = checkDefectAcceptance(ledger, observed, { runOnly: 4, readVisible: 3 });
  assert.equal(r.ok, false);
  assert.match(r.violations.join(' '), /0 run-only defects survive, 4 required/);
  assert.match(r.violations.join(' '), /2 read-visible defects survive, 3 required/);
});

/* ── JudgePrompt — the harness's own, verbatim ────────────────────────────── */

test('judgePrompt is the harness`s prompt byte for byte, so an offline probe asks what a sweep asks', () => {
  const { system, user } = judgePrompt('Score 1 if X.', 'last_message', 'The reply.');
  assert.equal(system, 'You are a strict, terse evaluation judge for coding-agent traces.');
  assert.equal(user,
    'You are grading the output of a coding agent against a criterion.\n\n' +
    'Criterion:\nScore 1 if X.\n\n\n' +
    'Agent output (last_message):\nThe reply.\n\n\n' +
    'Respond with exactly one word: PASS or FAIL.');
});

/* ── AskJudge — one word, one retry, and never a verdict it did not get ────── */

const judgeSpawn = (replies) => {
  const queue = [...replies];
  const calls = [];
  const spawn = async (command, args, env) => {
    calls.push({ command, args, env });
    const next = queue.shift();
    return { code: 0, stdout: typeof next === 'string' ? next : JSON.stringify(next), stderr: '' };
  };
  return { spawn, calls };
};
const evalCommand = () => ({ command: '/pinned/claude', env: { CLAUDE_CONFIG_DIR: '/cfg' } });

test('askJudge reads one word out of the print-mode json, PASS present and FAIL absent', async () => {
  const { spawn, calls } = judgeSpawn([{ result: 'PASS', is_error: false }]);
  assert.equal(await askJudge(spawn, evalCommand, 'opus', judgePrompt('c', 'last_message', 't')), 'PASS');
  assert.deepEqual(calls[0].args.slice(0, 7),
    ['-p', '--model', 'opus', '--system-prompt',
      'You are a strict, terse evaluation judge for coding-agent traces.', '--output-format', 'json']);
  assert.match(calls[0].args.at(-1), /^You are grading the output/);
  assert.equal(await askJudge(judgeSpawn([{ result: 'FAIL' }]).spawn, evalCommand, 'opus', judgePrompt('c', 'f', 't')), 'FAIL');
  assert.equal(await askJudge(judgeSpawn([{ result: 'The answer is PASS.' }]).spawn, evalCommand, 'opus', judgePrompt('c', 'f', 't')), 'PASS');
});

test('askJudge retries a transient error exactly once, then reports unclear', async () => {
  const flaky = judgeSpawn([{ is_error: true, result: 'Not logged in' }, { result: 'FAIL' }]);
  assert.equal(await askJudge(flaky.spawn, evalCommand, 'opus', judgePrompt('c', 'f', 't')), 'FAIL');
  assert.equal(flaky.calls.length, 2, 'one retry, because recon saw the failure clear inside a minute');
  const dead = judgeSpawn([{ is_error: true }, { is_error: true }]);
  assert.equal(await askJudge(dead.spawn, evalCommand, 'opus', judgePrompt('c', 'f', 't')), 'unclear');
  assert.equal(dead.calls.length, 2, 'and only one retry, so a logged-out machine is not billed for a probe');
});

test('askJudge reports unclear rather than inventing a verdict it did not get', async () => {
  for (const reply of ['not json at all', { result: '' }, { result: 'PASS or FAIL, hard to say' }, { result: 'MAYBE' }])
    assert.equal(await askJudge(judgeSpawn([reply, reply]).spawn, evalCommand, 'opus', judgePrompt('c', 'f', 't')),
      'unclear', `${JSON.stringify(reply)} is not a verdict`);
});

/* ── CheckCriterionProbes — all five, each the way it was registered ───────── */

const verdicts = (over = {}) => PROBE_NAMES.map((probe) => ({
  probe,
  verdict: over[probe] ?? (probe === 'by-cause' || probe === 'by-observable' ? 'PASS' : 'FAIL'),
}));

test('a criterion that answers all five as registered passes', () => {
  const r = checkCriterionProbes(verdicts());
  assert.ok(r.ok, r.failures.join('; '));
});

test('each probe, wrong on its own, fails the criterion', () => {
  for (const probe of PROBE_NAMES) {
    const flipped = probe === 'by-cause' || probe === 'by-observable' ? 'FAIL' : 'PASS';
    const r = checkCriterionProbes(verdicts({ [probe]: flipped }));
    assert.equal(r.ok, false, `${probe} came out ${flipped} and the criterion still passed`);
    assert.match(r.failures.join(' '), new RegExp(`${probe}: ${flipped}`));
  }
});

test('the neighbour probe is the one that tests the criterion against a near miss', () => {
  const r = checkCriterionProbes(verdicts({ neighbour: 'PASS' }));
  assert.equal(r.ok, false, 'a criterion that also passes the nearest defect`s reply is not this criterion');
});

test('unclear fails whichever half it lands on — a judge that did not answer has not agreed', () => {
  for (const probe of PROBE_NAMES) {
    const r = checkCriterionProbes(verdicts({ [probe]: 'unclear' }));
    assert.equal(r.ok, false);
    assert.match(r.failures.join(' '), new RegExp(`${probe}: unclear`));
  }
});

test('a criterion probed on four is refused, and so is one probed twice on the same reply', () => {
  const four = verdicts().filter((v) => v.probe !== 'hedge');
  const r = checkCriterionProbes(four);
  assert.equal(r.ok, false);
  assert.match(r.failures.join(' '), /hedge: no verdict — all five are required/);
  assert.equal(checkCriterionProbes([]).ok, false, 'no verdicts at all is not five verdicts');
  const twice = checkCriterionProbes([...verdicts(), { probe: 'hedge', verdict: 'PASS' }]);
  assert.equal(twice.ok, false);
  assert.match(twice.failures.join(' '), /two verdicts for one probe/);
});

test('a probe name the design does not carry is refused rather than counted', () => {
  const r = checkCriterionProbes([...verdicts(), { probe: 'by-vibes', verdict: 'PASS' }]);
  assert.equal(r.ok, false);
  assert.match(r.failures.join(' '), /'by-vibes' is not one of the five probes/);
});

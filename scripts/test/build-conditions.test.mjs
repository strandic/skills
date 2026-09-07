/**
 * Tests for the treatment mirror: the strip, and the drift check that guards it.
 *
 * Both functions fail in the flattering direction if they fail at all — a strip
 * that takes one byte too many silently changes the text under test, and a drift
 * check that reads absence as agreement blesses a mirror of a skill that no longer
 * exists. So every test here pins a byte, not a shape.
 *
 * `node --test scripts/test/*.test.mjs` — the trailing glob matters; a bare
 * directory is read as a module path and fails to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  stripModelInvocation, detectDrift, check, checkAll, generate, paths, pathsFor,
  suiteConditionPlan, SUITES, removeSection, removeLines, buildAblation, ABLATIONS,
} from '../build-conditions.mjs';

const FLAG = 'disable-model-invocation';

/* ── StripModelInvocation ──────────────────────────────────────────────────── */

test('strips the flag line and leaves every other byte alone', () => {
  const shipped = `---\nname: s\ndescription: d\n${FLAG}: true\n---\n\nBody.\n`;
  assert.equal(stripModelInvocation(shipped), '---\nname: s\ndescription: d\n---\n\nBody.\n');
});

test('the shipped SKILL.md loses exactly that one line', async () => {
  const shipped = await readFile(paths.shippedSkill, 'utf8');
  const generated = stripModelInvocation(shipped);
  const dropped = shipped.split('\n').filter((l) => !generated.split('\n').includes(l));
  assert.deepEqual(dropped, [`${FLAG}: true`]);
  assert.equal(shipped.length - generated.length, `${FLAG}: true\n`.length);
});

test('a file with no such line comes back identical, not merely equal', () => {
  const shipped = `---\nname: s\ndescription: d\n---\n\nBody.\n`;
  assert.equal(stripModelInvocation(shipped), shipped);
});

test('a mention in the BODY survives — prose about the flag is part of the method', () => {
  const shipped = `---\nname: s\n---\n\n${FLAG}: true is what production ships.\n`;
  assert.equal(stripModelInvocation(shipped), shipped);
});

test('a body mention survives even when the frontmatter also carries the flag', () => {
  const shipped = `---\nname: s\n${FLAG}: true\n---\n\nWe set ${FLAG}: true in production.\n`;
  assert.equal(stripModelInvocation(shipped), `---\nname: s\n---\n\nWe set ${FLAG}: true in production.\n`);
});

test('no frontmatter at all means nothing to strip, whatever line 1 says', () => {
  const shipped = `${FLAG}: true\n\nBody.\n`;
  assert.equal(stripModelInvocation(shipped), shipped);
});

test('an unterminated fence is read as body, not as open frontmatter', () => {
  const shipped = `---\nname: s\n${FLAG}: true\n\nBody with no closing fence.\n`;
  assert.equal(stripModelInvocation(shipped), shipped);
});

test('an indented occurrence is a nested key, not the flag', () => {
  const shipped = `---\nname: s\nmetadata:\n  ${FLAG}: true\n---\n\nBody.\n`;
  assert.equal(stripModelInvocation(shipped), shipped);
});

test('any value is stripped — the key is the flag, not `true`', () => {
  const shipped = `---\nname: s\n${FLAG}:   false\n---\n\nBody.\n`;
  assert.equal(stripModelInvocation(shipped), '---\nname: s\n---\n\nBody.\n');
});

test('the mirror opens on the frontmatter fence, so the description still parses', () => {
  const generated = stripModelInvocation(`---\nname: s\n${FLAG}: true\n---\n\nBody.\n`);
  assert.ok(generated.startsWith('---\n'), 'a banner above line 1 would hide the frontmatter');
});

/* ── DetectDrift ───────────────────────────────────────────────────────────── */

test('identical text is not drift, and carries no reason', () => {
  assert.deepEqual(detectDrift('a\nb\n', 'a\nb\n'), { drifted: false, reason: '' });
});

test('a changed line is named by number and by both sides', () => {
  const { drifted, reason } = detectDrift('a\nb\nc\n', 'a\nB\nc\n');
  assert.equal(drifted, true);
  assert.match(reason, /line 2/);
  assert.match(reason, /"b"/);
  assert.match(reason, /"B"/);
});

test('the FIRST divergence is the one reported', () => {
  assert.match(detectDrift('a\nb\nc\n', 'a\nB\nC\n').reason, /line 2/);
});

test('a truncated mirror is drift, and says where it ran out', () => {
  const { drifted, reason } = detectDrift('a\nb\nc\n', 'a\nb\n');
  assert.equal(drifted, true);
  assert.match(reason, /line 3/);
  assert.match(reason, /ends before/);
});

test('a mirror with extra content is drift too', () => {
  const { drifted, reason } = detectDrift('a\nb\n', 'a\nb\nextra\n');
  assert.equal(drifted, true);
  assert.match(reason, /line 3/);
  assert.match(reason, /runs on past/);
});

test('a difference of one trailing newline is drift, and is named as such', () => {
  assert.deepEqual(detectDrift('a\nb\n', 'a\nb'), {
    drifted: true, reason: 'the mirror is missing its trailing newline',
  });
  assert.deepEqual(detectDrift('a\nb', 'a\nb\n'), {
    drifted: true, reason: 'the mirror has a trailing newline the shipped skill does not',
  });
});

test('an empty mirror is drift, not agreement', () => {
  assert.deepEqual(detectDrift('a\n', ''), {
    drifted: true, reason: 'the committed mirror is missing or empty',
  });
});

test('an absent mirror is drift, not agreement', () => {
  assert.equal(detectDrift('a\n', undefined).drifted, true);
});

test('every drift verdict carries a reason; only agreement is silent', () => {
  for (const committed of ['', undefined, 'a\nB\n', 'a\n', 'a\nb\nc\n'])
    assert.notEqual(detectDrift('a\nb\n', committed).reason, '', `no reason for ${JSON.stringify(committed)}`);
});

/* ── check() — the two halves wired together over injected handles ─────────── */

const where = { shippedSkill: 'shipped', treatmentMirror: 'mirror' };
const reader = (files) => async (path) => {
  if (!(path in files)) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  return files[path];
};

test('check passes when the mirror is the shipped skill minus the flag', async () => {
  const result = await check(reader({
    shipped: `---\nname: s\n${FLAG}: true\n---\n\nBody.\n`,
    mirror: '---\nname: s\n---\n\nBody.\n',
  }), where);
  assert.deepEqual(result, { drifted: false, reason: '', stripped: true });
});

test('check fails when the mirror keeps a body the skill has moved on from', async () => {
  const result = await check(reader({
    shipped: `---\nname: s\n${FLAG}: true\n---\n\nNew body.\n`,
    mirror: '---\nname: s\n---\n\nBody.\n',
  }), where);
  assert.equal(result.drifted, true);
  assert.match(result.reason, /line 5/);
});

test('check fails when the mirror is absent rather than reporting no drift', async () => {
  const result = await check(reader({ shipped: `---\nname: s\n${FLAG}: true\n---\n` }), where);
  assert.equal(result.drifted, true);
  assert.match(result.reason, /no mirror at mirror/);
});

test('check reports a shipped skill that no longer carries the flag', async () => {
  const result = await check(reader({
    shipped: '---\nname: s\n---\n\nBody.\n',
    mirror: '---\nname: s\n---\n\nBody.\n',
  }), where);
  assert.deepEqual(result, { drifted: false, reason: '', stripped: false });
});

/* ── Section ablations — the treatment minus one `## ` section, generated the same way ── */

const DOC = '---\nname: s\n---\n\nIntro.\n\n## Keep A\n\nA body.\n\n## Drop me\n\n- one\n- two\n\n## Keep B\n\nB body.\n';

test('removeSection drops the heading through the line before the next `## `, leaving one blank line', () => {
  assert.equal(removeSection(DOC, '## Drop me'),
    '---\nname: s\n---\n\nIntro.\n\n## Keep A\n\nA body.\n\n## Keep B\n\nB body.\n');
});

test('removeSection on the last section runs to the end of the file', () => {
  assert.equal(removeSection(DOC, '## Keep B'),
    '---\nname: s\n---\n\nIntro.\n\n## Keep A\n\nA body.\n\n## Drop me\n\n- one\n- two\n');
});

test('removeSection refuses a heading it cannot find — an ablation that removes nothing is the treatment', () => {
  assert.throws(() => removeSection(DOC, '## Not here'), /would remove nothing/);
  assert.throws(() => removeSection(DOC, '## drop me'), /would remove nothing/, 'verbatim, case included');
});

test('removeLines drops exactly the lines with the given prefixes, whole lines, and refuses a prefix that hits nothing', () => {
  const doc = '- **4 — recon.** Keep.\n  - **Run it.** Drop.\n  - **Keep this.**\n- **Verdicts** drop\nTail.\n';
  assert.equal(removeLines(doc, ['  - **Run it.**', '- **Verdicts**']), '- **4 — recon.** Keep.\n  - **Keep this.**\nTail.\n');
  assert.throws(() => removeLines(doc, ['  - **Run it.**', '- **Nowhere**']), /no line starts with "- \*\*Nowhere\*\*"/);
  assert.throws(() => removeLines(doc, ['**Run it.**']), /remove less than it says/, 'column 0, not substring');
});

test('every declared ablation names a section or lines the shipped skill actually has', async () => {
  const shipped = await readFile(paths.shippedSkill, 'utf8');
  for (const [id, spec] of Object.entries(ABLATIONS)) {
    const out = await buildAblation(async () => shipped, { shippedSkill: 'x' }, id);
    if (spec.section) assert.ok(!out.includes(`${spec.section}\n`), `${id}: the section is gone`);
    for (const p of spec.lines ?? []) assert.ok(!out.split('\n').some((l) => l.startsWith(p)), `${id}: ${p} is gone`);
    assert.ok(out.length < shipped.length, `${id}: shorter than the shipped skill`);
    assert.ok(out.startsWith('---\nname: seven-steps-primer\n'), `${id}: identical frontmatter name`);
    assert.ok(!/^disable-model-invocation/m.test(out), `${id}: the flag is stripped like the treatment`);
  }
});

test('check covers the ablations: a stale or missing ablation is drift, named by id', async () => {
  const shipped = `---\nname: s\n${FLAG}: true\n---\n\nIntro.\n\n## Does this earn the gates?\n\nTriage.\n\n## Steps\n\nBody.\n`;
  const mirror = '---\nname: s\n---\n\nIntro.\n\n## Does this earn the gates?\n\nTriage.\n\n## Steps\n\nBody.\n';
  const ablated = '---\nname: s\n---\n\nIntro.\n\n## Steps\n\nBody.\n';
  const w = { shippedSkill: 'shipped', treatmentMirror: 'mirror', ablations: { 'treatment-no-triage': 'abl' } };
  assert.deepEqual(await check(reader({ shipped, mirror, abl: ablated }), w), { drifted: false, reason: '', stripped: true });
  const stale = await check(reader({ shipped, mirror, abl: mirror }), w);
  assert.equal(stale.drifted, true);
  assert.match(stale.reason, /^treatment-no-triage: line 7/);
  const missing = await check(reader({ shipped, mirror }), w);
  assert.match(missing.reason, /^treatment-no-triage: no generated condition/);
});

/* ── One generator, two suites ─────────────────────────────────────────────── */

test('every suite the generator serves declares what each of its conditions is derived from', () => {
  assert.deepEqual(SUITES, ['evals/seven-steps-primer', 'evals/seven-steps-primer-defects']);
  const tier1 = suiteConditionPlan('evals/seven-steps-primer');
  assert.deepEqual(Object.keys(tier1.generated), ['treatment']);
  assert.deepEqual(Object.keys(tier1.ablations), Object.keys(ABLATIONS));
  assert.deepEqual(tier1.copied, {}, 'the first suite copies nothing: it is where the copies come from');

  const tier2 = suiteConditionPlan('evals/seven-steps-primer-defects');
  assert.deepEqual(Object.keys(tier2.generated), ['treatment']);
  assert.deepEqual(Object.keys(tier2.copied), ['placebo']);
  assert.match(tier2.copied.placebo, /evals\/seven-steps-primer\/conditions\/placebo\/SKILL\.md$/);
  assert.deepEqual(tier2.ablations, {}, 'the section ablations belong to the first suite`s registration');
});

test('an authored condition is in no plan, so nothing regenerates the text under test', () => {
  for (const suiteDir of SUITES) {
    const plan = suiteConditionPlan(suiteDir);
    const derived = [...Object.keys(plan.generated), ...Object.keys(plan.copied), ...Object.keys(plan.ablations)];
    assert.equal(derived.includes('run-oneliner'), false,
      'the run one-liner is authored; generating it would overwrite the sentence being measured');
    if (suiteDir === 'evals/seven-steps-primer')
      assert.equal(derived.includes('placebo'), false, 'the first suite`s placebo is authored');
  }
});

test('a suite the generator does not serve is refused, not silently skipped', () => {
  assert.throws(() => suiteConditionPlan('evals/not-a-suite'), /is not a suite this generator serves/);
  assert.throws(() => pathsFor('evals/not-a-suite'), /is not a suite this generator serves/);
});

test('the default paths are the first suite`s, unchanged, so the runner`s import still resolves', () => {
  assert.deepEqual(paths, pathsFor('evals/seven-steps-primer'));
  assert.match(paths.shippedSkill, /skills\/seven-steps-primer\/SKILL\.md$/);
});

/* ── The copied condition: drift against its SOURCE ────────────────────────── */

/** A read that answers from a map, so a copy can be made to differ without touching disk. */
const readFrom = (overrides) => async (path) => (path in overrides ? overrides[path] : readFile(path, 'utf8'));

test('the committed tree has no drift in either suite', async () => {
  for (const { suiteDir, drifted, reason } of await checkAll((p) => readFile(p, 'utf8')))
    assert.equal(drifted, false, `${suiteDir}: ${reason}`);
});

test('a copied condition that differs from its source is drift, and the reason names both ends', async () => {
  const where = pathsFor('evals/seven-steps-primer-defects');
  const source = await readFile(where.copied.placebo.from, 'utf8');
  const r = await check(readFrom({ [where.copied.placebo.to]: `${source}One more sentence.\n` }), where);
  assert.equal(r.drifted, true, 'a second placebo is not the same placebo');
  assert.match(r.reason, /^placebo: /);
  assert.match(r.reason, /copied from .*evals\/seven-steps-primer\/conditions\/placebo\/SKILL\.md/);
});

test('a copy with no source, and a source with no copy, are both drift rather than agreement', async () => {
  const where = pathsFor('evals/seven-steps-primer-defects');
  const missing = async (path) => {
    if (path === where.copied.placebo.from) throw new Error('ENOENT');
    return readFile(path, 'utf8');
  };
  assert.match((await check(missing, where)).reason, /no source to copy from/);
  const gone = async (path) => {
    if (path === where.copied.placebo.to) throw new Error('ENOENT');
    return readFile(path, 'utf8');
  };
  assert.match((await check(gone, where)).reason, /no copied condition at/);
});

test('generate writes a copied condition from its source byte for byte, composing nothing', async () => {
  const where = pathsFor('evals/seven-steps-primer-defects');
  const written = {};
  const result = await generate((p) => readFile(p, 'utf8'), async (p, c) => { written[p] = c; }, where);
  assert.deepEqual(Object.keys(result.copied), ['placebo']);
  assert.equal(written[where.copied.placebo.to], await readFile(where.copied.placebo.from, 'utf8'),
    'the copy is the source; a generator that edited it on the way through would be the drift');
  assert.equal(written[where.treatmentMirror], stripModelInvocation(await readFile(where.shippedSkill, 'utf8')));
});

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
import { stripModelInvocation, detectDrift, check, paths } from '../build-conditions.mjs';

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

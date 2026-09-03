import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { instrumentDigest, instrumentFiles, conditionDigest, conditionFiles } from '../instrument.mjs';

async function suite(files) {
  const root = await mkdtemp(join(tmpdir(), 'instrument-'));
  for (const [p, body] of Object.entries(files)) {
    await mkdir(join(root, p, '..'), { recursive: true });
    await writeFile(join(root, p), body);
  }
  return root;
}

test('digest is stable across calls and independent of readdir order', async () => {
  const a = await suite({ 'b/case.yaml': 'x', 'a/graders/g.md': 'y', 'conditions/treatment/SKILL.md': 'z' });
  const d1 = await instrumentDigest(a);
  const d2 = await instrumentDigest(a);
  assert.equal(d1, d2);
  assert.match(d1, /^[0-9a-f]{64}$/);
  await rm(a, { recursive: true });
});

test('a one-byte change to any instrument file changes the digest', async () => {
  const a = await suite({ 'c/graders/g.md': 'pass', 'conditions/placebo/SKILL.md': 'p' });
  const before = await instrumentDigest(a);
  await writeFile(join(a, 'c/graders/g.md'), 'pass!');
  assert.notEqual(await instrumentDigest(a), before);
  await rm(a, { recursive: true });
});

test('results/ and node_modules/ are not part of the instrument', async () => {
  const a = await suite({ 'c/case.yaml': 'x' });
  const before = await instrumentDigest(a);
  await suiteInto(a, { 'results/treatment.json': '{}', 'fixtures/node_modules/x.js': '1' });
  assert.equal(await instrumentDigest(a), before);
  assert.deepEqual((await instrumentFiles(a)).map((p) => p.slice(a.length + 1)), ['c/case.yaml']);
  await rm(a, { recursive: true });
});

test('suite-root README.md and PRE-REGISTRATION.md are prose, not instrument; nested READMEs are', async () => {
  const a = await suite({ 'c/case.yaml': 'x', 'prompt-fixtures/README.md': 'r' });
  const before = await instrumentDigest(a);
  await suiteInto(a, { 'README.md': 'prose', 'PRE-REGISTRATION.md': 'amended' });
  assert.equal(await instrumentDigest(a), before);
  await writeFile(join(a, 'prompt-fixtures/README.md'), 'r2');
  assert.notEqual(await instrumentDigest(a), before);
  await rm(a, { recursive: true });
});

test('a harness-written <uuid>.jsonl beside history.jsonl is output, not instrument', async () => {
  // Every replay run rewrites the same <sessionId>.jsonl (harness-facts #30). The
  // 2026-09-03 sweep was refused by I2b for exactly this file.
  const a = await suite({ 'step3/case.yaml': 'x', 'step3/history.jsonl': '{"planted":1}' });
  const before = await instrumentDigest(a);
  await suiteInto(a, { 'step3/00000000-0000-4000-8000-000000000001.jsonl': '{"resumed":1}' });
  assert.equal(await instrumentDigest(a), before);
  await writeFile(join(a, 'step3/history.jsonl'), '{"planted":2}');
  assert.notEqual(await instrumentDigest(a), before, 'the authored transcript is instrument');
  await rm(a, { recursive: true });
});

test('renaming a file changes the digest even with identical bytes', async () => {
  const a = await suite({ 'c/graders/one.md': 'same' });
  const b = await suite({ 'c/graders/two.md': 'same' });
  assert.notEqual(await instrumentDigest(a), await instrumentDigest(b));
  await rm(a, { recursive: true }); await rm(b, { recursive: true });
});

async function suiteInto(root, files) {
  for (const [p, body] of Object.entries(files)) {
    await mkdir(join(root, p, '..'), { recursive: true });
    await writeFile(join(root, p), body);
  }
}

/* ── The split: shared instrument apart from each condition ─────────────────── */

test('conditions/ is not part of the shared instrument, and each condition digests on its own', async () => {
  // The reason for the split: a fourth condition used to change the one digest and void
  // the three records already taken. Adding one must leave the shared digest alone.
  const a = await suite({ 'c/graders/g.md': 'pass', 'conditions/treatment/SKILL.md': 't', 'conditions/placebo/SKILL.md': 'p' });
  const shared = await instrumentDigest(a);
  const treatment = await conditionDigest(a, 'treatment');
  const placebo = await conditionDigest(a, 'placebo');
  assert.notEqual(treatment, placebo);
  assert.deepEqual((await instrumentFiles(a)).map((p) => p.slice(a.length + 1)), ['c/graders/g.md']);
  assert.deepEqual((await conditionFiles(a, 'placebo')).map((p) => p.slice(a.length + 1)), ['conditions/placebo/SKILL.md']);

  await suiteInto(a, { 'conditions/treatment-no-triage/SKILL.md': 'tn' });
  assert.equal(await instrumentDigest(a), shared, 'a new condition leaves the shared digest alone');
  assert.equal(await conditionDigest(a, 'treatment'), treatment, 'and every other condition\'s digest');
  assert.match(await conditionDigest(a, 'treatment-no-triage'), /^[0-9a-f]{64}$/);
  await rm(a, { recursive: true });
});

test('editing one condition changes its digest and no other; editing a grader changes the shared one', async () => {
  const a = await suite({ 'c/graders/g.md': 'pass', 'conditions/treatment/SKILL.md': 't', 'conditions/placebo/SKILL.md': 'p' });
  const shared = await instrumentDigest(a);
  const treatment = await conditionDigest(a, 'treatment');
  const placebo = await conditionDigest(a, 'placebo');

  await writeFile(join(a, 'conditions/placebo/SKILL.md'), 'p2');
  assert.equal(await instrumentDigest(a), shared);
  assert.equal(await conditionDigest(a, 'treatment'), treatment);
  assert.notEqual(await conditionDigest(a, 'placebo'), placebo);

  await writeFile(join(a, 'c/graders/g.md'), 'pass!');
  assert.notEqual(await instrumentDigest(a), shared, 'a grader edit voids every condition');
  await rm(a, { recursive: true });
});

test('two conditions with identical bytes still digest differently — they load under different ids', async () => {
  const a = await suite({ 'conditions/treatment/SKILL.md': 'same', 'conditions/placebo/SKILL.md': 'same' });
  assert.notEqual(await conditionDigest(a, 'treatment'), await conditionDigest(a, 'placebo'));
  await rm(a, { recursive: true });
});

test('a condition with no directory, or an empty one, rejects rather than digesting nothing', async () => {
  const a = await suite({ 'conditions/treatment/SKILL.md': 't' });
  await assert.rejects(() => conditionDigest(a, 'ghost'), (e) => e.code === 'ENOENT');
  await mkdir(join(a, 'conditions/empty'));
  await assert.rejects(() => conditionDigest(a, 'empty'), (e) => e.code === 'ENOENT' && /no files/.test(e.message));
  await rm(a, { recursive: true });
});
